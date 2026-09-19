-- Opportunity is the finance parent. Historical Deal IDs/evidence are retained;
-- views resolve their existing Opportunity without rewriting financial history.
ALTER TABLE deal_commission_receipts ADD COLUMN opportunity_id UUID REFERENCES opportunities(id),
  ALTER COLUMN deal_id DROP NOT NULL,
  ADD CHECK(opportunity_id IS NOT NULL OR deal_id IS NOT NULL);
ALTER TABLE deal_commission_proofs ADD COLUMN opportunity_id UUID REFERENCES opportunities(id),
  ALTER COLUMN deal_id DROP NOT NULL,
  ADD CHECK(opportunity_id IS NOT NULL OR deal_id IS NOT NULL);
ALTER TABLE deal_commission_receipt_confirmations ADD COLUMN opportunity_id UUID REFERENCES opportunities(id),
  ADD COLUMN expectation_basis TEXT NOT NULL DEFAULT 'frozen_expectation'
    CHECK(expectation_basis IN ('frozen_expectation','issued_invoices')),
  ALTER COLUMN deal_id DROP NOT NULL, ALTER COLUMN expectation_version_id DROP NOT NULL,
  ALTER COLUMN deal_version DROP NOT NULL,
  ADD CHECK(opportunity_id IS NOT NULL OR deal_id IS NOT NULL),
  ADD CHECK(expectation_basis='issued_invoices' OR expectation_version_id IS NOT NULL);
CREATE UNIQUE INDEX commission_current_opportunity_confirmation ON deal_commission_receipt_confirmations(opportunity_id)
  WHERE status='confirmed' AND opportunity_id IS NOT NULL;
CREATE INDEX commission_receipts_opportunity ON deal_commission_receipts(opportunity_id,recorded_at);
CREATE INDEX commission_proofs_opportunity ON deal_commission_proofs(opportunity_id,uploaded_at);
ALTER TABLE commission_receivable_collections ADD COLUMN opportunity_id UUID REFERENCES opportunities(id);
ALTER TABLE commission_receivable_collections DROP CONSTRAINT receivable_collection_split;
ALTER TABLE commission_receivable_collections ADD CONSTRAINT receivable_collection_split CHECK (
  (deal_id IS NULL AND opportunity_id IS NULL AND net_commission_cents IS NULL AND vat_cents IS NULL AND commission_receipt_id IS NULL)
  OR ((opportunity_id IS NOT NULL OR deal_id IS NOT NULL) AND net_commission_cents IS NOT NULL AND vat_cents IS NOT NULL
    AND net_commission_cents>=0 AND vat_cents>=0 AND net_commission_cents+vat_cents=amount_cents
    AND ((net_commission_cents=0 AND commission_receipt_id IS NULL) OR (net_commission_cents>0 AND commission_receipt_id IS NOT NULL))));

CREATE VIEW opportunity_commission_receipts AS SELECT r.*,COALESCE(r.opportunity_id,d.opportunity_id) AS finance_opportunity_id
  FROM deal_commission_receipts r LEFT JOIN deals d ON d.id=r.deal_id;
CREATE VIEW opportunity_commission_proofs AS SELECT r.*,COALESCE(r.opportunity_id,d.opportunity_id) AS finance_opportunity_id
  FROM deal_commission_proofs r LEFT JOIN deals d ON d.id=r.deal_id;
CREATE VIEW opportunity_commission_confirmations AS SELECT r.*,COALESCE(r.opportunity_id,d.opportunity_id) AS finance_opportunity_id
  FROM deal_commission_receipt_confirmations r LEFT JOIN deals d ON d.id=r.deal_id;
GRANT SELECT ON opportunity_commission_receipts,opportunity_commission_proofs,opportunity_commission_confirmations TO nysareal_nysar2app;

CREATE FUNCTION validate_finance_opportunity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE linked UUID; original RECORD;
BEGIN
  IF NEW.deal_id IS NOT NULL THEN
    SELECT opportunity_id INTO STRICT linked FROM deals WHERE id=NEW.deal_id;
    IF NEW.opportunity_id IS NOT NULL AND NEW.opportunity_id<>linked THEN RAISE EXCEPTION 'Finance Opportunity does not match historical Deal'; END IF;
    NEW.opportunity_id:=linked;
  END IF;
  IF NEW.opportunity_id IS NULL THEN RAISE EXCEPTION 'Finance requires an Opportunity'; END IF;
  -- A common identity lock covers legacy and Opportunity API paths.
  PERFORM pg_advisory_xact_lock(hashtext('finance-opportunity:'||NEW.opportunity_id));
  IF TG_TABLE_NAME='deal_commission_receipts' THEN
    IF NEW.proof_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM opportunity_commission_proofs
      WHERE id=NEW.proof_id AND finance_opportunity_id=NEW.opportunity_id) THEN
      RAISE EXCEPTION 'Proof must belong to the receipt Opportunity';
    END IF;
    IF NEW.entry_type='reversal' THEN
      SELECT * INTO STRICT original FROM opportunity_commission_receipts WHERE id=NEW.reverses_receipt_id;
      IF original.finance_opportunity_id<>NEW.opportunity_id OR original.entry_type<>'receipt'
        OR original.amount<>NEW.amount OR original.currency<>NEW.currency THEN RAISE EXCEPTION 'Reversal must match the exact Opportunity receipt'; END IF;
      IF EXISTS(SELECT 1 FROM deal_commission_receipts WHERE reverses_receipt_id=original.id) THEN RAISE EXCEPTION 'Receipt already reversed'; END IF;
    END IF;
  ELSIF TG_TABLE_NAME='deal_commission_receipt_confirmations' THEN
    IF NEW.expectation_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM deal_commission_expectation_versions e
      JOIN deals d ON d.id=e.deal_id WHERE e.id=NEW.expectation_version_id AND d.opportunity_id=NEW.opportunity_id) THEN
      RAISE EXCEPTION 'Expectation must belong to the confirmation Opportunity';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
ALTER TABLE deal_commission_receipts DROP CONSTRAINT receipt_proof_same_deal;
CREATE TRIGGER receipt_opportunity BEFORE INSERT ON deal_commission_receipts FOR EACH ROW EXECUTE FUNCTION validate_finance_opportunity();
CREATE TRIGGER proof_opportunity BEFORE INSERT ON deal_commission_proofs FOR EACH ROW EXECUTE FUNCTION validate_finance_opportunity();
CREATE TRIGGER confirmation_opportunity BEFORE INSERT ON deal_commission_receipt_confirmations FOR EACH ROW EXECUTE FUNCTION validate_finance_opportunity();

CREATE OR REPLACE FUNCTION supersede_changed_receipt_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE deal_commission_receipt_confirmations SET status='superseded' WHERE id IN
    (SELECT id FROM opportunity_commission_confirmations WHERE finance_opportunity_id=NEW.opportunity_id AND status='confirmed');
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION validate_receivable_receipt_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c commission_receivable_collections; r RECORD; opp UUID;
BEGIN
  IF TG_TABLE_NAME='commission_receivable_collections' THEN c:=NEW;
  ELSE SELECT * INTO STRICT c FROM commission_receivable_collections WHERE id=NEW.collection_id; END IF;
  SELECT s.opportunity_id INTO STRICT opp FROM commission_receivable_invoices i
    JOIN commission_receivable_schedules s ON s.id=i.schedule_id WHERE i.id=c.invoice_id;
  IF c.net_commission_cents IS NULL THEN RAISE EXCEPTION 'Legacy collection needs reviewed reconciliation'; END IF;
  IF c.opportunity_id IS NOT NULL AND c.opportunity_id<>opp THEN RAISE EXCEPTION 'Invoice Opportunity mismatch'; END IF;
  IF c.deal_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM deals WHERE id=c.deal_id AND opportunity_id=opp AND currency='AED') THEN RAISE EXCEPTION 'Historical Deal Opportunity mismatch'; END IF;
  IF TG_TABLE_NAME='commission_receivable_collections' THEN NEW.opportunity_id:=opp; END IF;
  IF c.net_commission_cents=0 THEN
    IF NEW.commission_receipt_id IS NOT NULL THEN RAISE EXCEPTION 'VAT-only rounding has no commission receipt'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT r FROM opportunity_commission_receipts WHERE id=NEW.commission_receipt_id;
  IF r.finance_opportunity_id<>opp OR r.currency<>'AED' OR r.amount*100<>c.net_commission_cents THEN RAISE EXCEPTION 'Invoice and Opportunity receipt do not match'; END IF;
  IF TG_TABLE_NAME='commission_receivable_collections' THEN
    IF r.entry_type<>'receipt' OR r.received_date<>c.received_date OR r.recorded_by<>c.created_by THEN RAISE EXCEPTION 'Invoice receipt identity mismatch'; END IF;
  ELSE
    IF r.entry_type<>'reversal' OR r.reverses_receipt_id IS DISTINCT FROM c.commission_receipt_id OR r.recorded_by<>NEW.created_by THEN RAISE EXCEPTION 'Correction must reverse exact Opportunity receipt'; END IF;
  END IF;
  RETURN NEW;
END; $$;
