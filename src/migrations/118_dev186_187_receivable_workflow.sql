-- CRM-186/187: generated invoice identity and controlled issued-invoice adjustments.
CREATE TABLE commission_invoice_number_counters (
  invoice_year INTEGER PRIMARY KEY CHECK(invoice_year BETWEEN 2020 AND 2200),
  last_number INTEGER NOT NULL CHECK(last_number>0)
);

ALTER TABLE commission_receivable_invoices
  ADD COLUMN replaces_invoice_id UUID REFERENCES commission_receivable_invoices(id),
  ADD COLUMN superseded_by_invoice_id UUID REFERENCES commission_receivable_invoices(id);
CREATE UNIQUE INDEX commission_receivable_replacement_uq ON commission_receivable_invoices(replaces_invoice_id) WHERE replaces_invoice_id IS NOT NULL;

CREATE TABLE commission_receivable_adjustment_requests (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES commission_receivable_invoices(id),
  request_type TEXT NOT NULL CHECK(request_type IN('cancel','amend')),
  reason TEXT NOT NULL CHECK(length(reason)>=10),
  evidence_reference TEXT NOT NULL CHECK(length(evidence_reference)>=3),
  requested_commission_cents BIGINT CHECK(requested_commission_cents IS NULL OR requested_commission_cents>0),
  requested_due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected')),
  requested_by UUID NOT NULL REFERENCES brokers(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES brokers(id),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  replacement_invoice_id UUID REFERENCES commission_receivable_invoices(id),
  CHECK((request_type='cancel' AND requested_commission_cents IS NULL AND requested_due_date IS NULL)
    OR (request_type='amend' AND requested_commission_cents IS NOT NULL AND requested_due_date IS NOT NULL)),
  CHECK((status='pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL)
    OR (status IN('approved','rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND length(decision_reason)>=5))
);
CREATE UNIQUE INDEX commission_receivable_one_pending_adjustment_uq ON commission_receivable_adjustment_requests(invoice_id) WHERE status='pending';
CREATE INDEX commission_receivable_adjustment_status_idx ON commission_receivable_adjustment_requests(status,requested_at);

CREATE FUNCTION protect_receivable_adjustment_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Invoice adjustment requests are immutable'; END IF;
  IF OLD.status<>'pending' OR NEW.status NOT IN('approved','rejected')
    OR ROW(NEW.id,NEW.invoice_id,NEW.request_type,NEW.reason,NEW.evidence_reference,NEW.requested_commission_cents,NEW.requested_due_date,NEW.requested_by,NEW.requested_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.invoice_id,OLD.request_type,OLD.reason,OLD.evidence_reference,OLD.requested_commission_cents,OLD.requested_due_date,OLD.requested_by,OLD.requested_at)
  THEN RAISE EXCEPTION 'Only the pending adjustment decision may be recorded'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER receivable_adjustment_protection BEFORE UPDATE OR DELETE ON commission_receivable_adjustment_requests
  FOR EACH ROW EXECUTE FUNCTION protect_receivable_adjustment_request();

GRANT SELECT,INSERT,UPDATE ON commission_invoice_number_counters,commission_receivable_adjustment_requests TO nysareal_nysar2app;

DO $$ DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK ((' || prior_expression || ') OR entity_type = ''CommissionInvoiceAdjustment'')';
END; $$;
