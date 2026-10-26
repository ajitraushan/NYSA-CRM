-- One invoice may have many payments. Link each NEW collection to a net commission
-- receipt without rewriting any historical receivable, receipt or payout record.
ALTER TABLE commission_receivable_collections
  ADD COLUMN deal_id UUID REFERENCES deals(id),
  ADD COLUMN net_commission_cents BIGINT,
  ADD COLUMN vat_cents BIGINT,
  ADD COLUMN commission_receipt_id UUID UNIQUE REFERENCES deal_commission_receipts(id),
  ADD CONSTRAINT receivable_collection_split CHECK (
    (deal_id IS NULL AND net_commission_cents IS NULL AND vat_cents IS NULL AND commission_receipt_id IS NULL)
    OR (deal_id IS NOT NULL AND net_commission_cents IS NOT NULL AND vat_cents IS NOT NULL
      AND net_commission_cents>=0 AND vat_cents>=0 AND net_commission_cents+vat_cents=amount_cents
      AND ((net_commission_cents=0 AND commission_receipt_id IS NULL) OR (net_commission_cents>0 AND commission_receipt_id IS NOT NULL))));
ALTER TABLE commission_receivable_reversals
  ADD COLUMN commission_receipt_id UUID UNIQUE REFERENCES deal_commission_receipts(id);

CREATE FUNCTION validate_receivable_receipt_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c commission_receivable_collections; r deal_commission_receipts; opp UUID;
BEGIN
  IF TG_TABLE_NAME='commission_receivable_collections' THEN
    c:=NEW;
    IF c.deal_id IS NULL THEN RAISE EXCEPTION 'New invoice payments require a linked finance posting'; END IF;
  ELSE
    SELECT * INTO STRICT c FROM commission_receivable_collections WHERE id=NEW.collection_id;
    IF c.deal_id IS NULL THEN RAISE EXCEPTION 'Legacy collection requires reviewed reconciliation before correction'; END IF;
  END IF;
  SELECT s.opportunity_id INTO STRICT opp FROM commission_receivable_invoices i
    JOIN commission_receivable_schedules s ON s.id=i.schedule_id WHERE i.id=c.invoice_id;
  IF NOT EXISTS(SELECT 1 FROM deals WHERE id=c.deal_id AND opportunity_id=opp AND currency='AED') THEN
    RAISE EXCEPTION 'Receipt must belong to the invoice Opportunity and AED Deal';
  END IF;
  IF c.net_commission_cents=0 THEN
    IF NEW.commission_receipt_id IS NOT NULL THEN RAISE EXCEPTION 'VAT-only rounding has no commission receipt'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT r FROM deal_commission_receipts WHERE id=NEW.commission_receipt_id;
  IF r.deal_id<>c.deal_id OR r.currency<>'AED' OR r.amount*100<>c.net_commission_cents THEN
    RAISE EXCEPTION 'Invoice payment and net commission posting do not match';
  END IF;
  IF TG_TABLE_NAME='commission_receivable_collections' THEN
    IF r.entry_type<>'receipt' OR r.received_date<>c.received_date OR r.recorded_by<>c.created_by THEN
      RAISE EXCEPTION 'Invoice payment receipt identity does not match';
    END IF;
  ELSE
    IF r.entry_type<>'reversal' OR r.reverses_receipt_id IS DISTINCT FROM c.commission_receipt_id
      OR r.recorded_by<>NEW.created_by THEN RAISE EXCEPTION 'Invoice correction must reverse its exact net receipt'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER receivable_collection_link BEFORE INSERT ON commission_receivable_collections
  FOR EACH ROW EXECUTE FUNCTION validate_receivable_receipt_link();
CREATE TRIGGER receivable_reversal_link BEFORE INSERT ON commission_receivable_reversals
  FOR EACH ROW EXECUTE FUNCTION validate_receivable_receipt_link();

-- Preserve immutable confirmation evidence; only its lifecycle may be superseded.
CREATE FUNCTION protect_commission_confirmation_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.status='confirmed' AND NEW.status='superseded'
    AND (to_jsonb(NEW)-'status')=(to_jsonb(OLD)-'status') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Receipt confirmation evidence is immutable; supersede and reconcile again';
END; $$;
DROP TRIGGER commission_confirmations_immutable ON deal_commission_receipt_confirmations;
CREATE TRIGGER commission_confirmations_immutable BEFORE UPDATE OR DELETE ON deal_commission_receipt_confirmations
  FOR EACH ROW EXECUTE FUNCTION protect_commission_confirmation_evidence();
CREATE FUNCTION supersede_changed_receipt_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE deal_commission_receipt_confirmations SET status='superseded'
    WHERE deal_id=NEW.deal_id AND status='confirmed';
  RETURN NEW;
END; $$;
CREATE TRIGGER receipt_changes_supersede_confirmation AFTER INSERT ON deal_commission_receipts
  FOR EACH ROW EXECUTE FUNCTION supersede_changed_receipt_confirmation();
