-- Additive opportunity-linked AED commission receivables. No change to Deal closure/payout.
CREATE TABLE commission_receivable_schedules (
  id UUID PRIMARY KEY,
  schedule_reference TEXT NOT NULL UNIQUE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  payer_type TEXT NOT NULL CHECK(payer_type IN ('customer','agency','developer')),
  payer_contact_id UUID REFERENCES contacts(id),
  payer_company_id UUID REFERENCES companies(id),
  payer_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED' CHECK(currency='AED'),
  commission_cents BIGINT NOT NULL CHECK(commission_cents>0),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((payer_type='customer' AND payer_contact_id IS NOT NULL AND payer_company_id IS NULL)
    OR (payer_type IN ('agency','developer') AND payer_company_id IS NOT NULL AND payer_contact_id IS NULL))
);
CREATE TABLE commission_receivable_invoices (
  id UUID PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES commission_receivable_schedules(id),
  instalment_number INTEGER NOT NULL CHECK(instalment_number BETWEEN 1 AND 60),
  milestone TEXT NOT NULL DEFAULT '',
  commission_cents BIGINT NOT NULL CHECK(commission_cents>0),
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK(vat_rate=5),
  vat_cents BIGINT NOT NULL CHECK(vat_cents=ROUND(commission_cents::numeric*0.05)),
  total_cents BIGINT NOT NULL CHECK(total_cents=commission_cents+vat_cents),
  due_date DATE NOT NULL,
  invoice_date DATE,
  invoice_reference TEXT,
  state TEXT NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','issued','cancelled')),
  cancellation_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(schedule_id,instalment_number),
  CHECK((invoice_date IS NULL)=(invoice_reference IS NULL)),
  CHECK(state<>'issued' OR (invoice_date IS NOT NULL AND length(invoice_reference)>0)),
  CHECK(invoice_date IS NULL OR due_date>=invoice_date),
  CHECK(state<>'cancelled' OR length(cancellation_reason)>=10)
);
CREATE UNIQUE INDEX commission_receivable_invoice_ref_uq ON commission_receivable_invoices(LOWER(invoice_reference));
CREATE INDEX commission_receivable_opportunity_idx ON commission_receivable_schedules(opportunity_id);
CREATE INDEX commission_receivable_due_idx ON commission_receivable_invoices(state,due_date);
CREATE TABLE commission_receivable_collections (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES commission_receivable_invoices(id),
  amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
  received_date DATE NOT NULL,
  finance_reference TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX commission_receivable_collection_ref_uq ON commission_receivable_collections(invoice_id,LOWER(finance_reference));
CREATE TABLE commission_receivable_reversals (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL UNIQUE REFERENCES commission_receivable_collections(id),
  reason TEXT NOT NULL CHECK(length(reason)>=10),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE commission_receivable_requests (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES brokers(id),
  idempotency_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER receivable_schedules_immutable BEFORE UPDATE OR DELETE ON commission_receivable_schedules FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER receivable_collections_immutable BEFORE UPDATE OR DELETE ON commission_receivable_collections FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER receivable_reversals_immutable BEFORE UPDATE OR DELETE ON commission_receivable_reversals FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER receivable_requests_immutable BEFORE UPDATE OR DELETE ON commission_receivable_requests FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE FUNCTION protect_commission_receivable_invoice() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Receivable invoice is immutable; cancel with a reason'; END IF;
  IF ROW(NEW.id,NEW.schedule_id,NEW.instalment_number,NEW.milestone,NEW.commission_cents,NEW.vat_rate,NEW.vat_cents,NEW.total_cents,NEW.due_date)
    IS DISTINCT FROM ROW(OLD.id,OLD.schedule_id,OLD.instalment_number,OLD.milestone,OLD.commission_cents,OLD.vat_rate,OLD.vat_cents,OLD.total_cents,OLD.due_date)
    OR OLD.state='cancelled' OR (OLD.state='issued' AND (NEW.state<>'cancelled' OR NEW.invoice_date IS DISTINCT FROM OLD.invoice_date OR NEW.invoice_reference IS DISTINCT FROM OLD.invoice_reference))
    OR (OLD.state='planned' AND NEW.state NOT IN ('issued','cancelled')) THEN
    RAISE EXCEPTION 'Receivable invoice is immutable except governed issue or cancellation';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER receivable_invoice_protection BEFORE UPDATE OR DELETE ON commission_receivable_invoices FOR EACH ROW EXECUTE FUNCTION protect_commission_receivable_invoice();
GRANT SELECT,INSERT ON commission_receivable_schedules,commission_receivable_collections,commission_receivable_reversals,commission_receivable_requests TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON commission_receivable_invoices TO nysareal_nysar2app;
DO $$ DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK ((' || prior_expression || ') OR entity_type = ''CommissionReceivable'')';
END; $$;
