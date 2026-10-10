CREATE TABLE agent_payout_advices (
 id UUID PRIMARY KEY,
 advice_number BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
 batch_id UUID NOT NULL REFERENCES commission_payment_batches(id),
 agent_id UUID NOT NULL REFERENCES brokers(id),
 currency TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','generating','generated','failed')),
 input_snapshot JSONB NOT NULL,
 template_version TEXT NOT NULL DEFAULT 'ACC-WS-001-v1',
 storage_key TEXT,
 pdf_hash TEXT,
 template_hash TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 locked_at TIMESTAMPTZ,
 error_code TEXT,
 created_by UUID NOT NULL REFERENCES brokers(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 generated_at TIMESTAMPTZ,
 UNIQUE(batch_id,agent_id,currency),
 CHECK(status<>'generated' OR (storage_key IS NOT NULL AND pdf_hash IS NOT NULL))
);
CREATE INDEX agent_payout_advice_work_idx ON agent_payout_advices(status,retry_at);
CREATE INDEX agent_payout_advice_agent_idx ON agent_payout_advices(agent_id,created_at DESC,id);
CREATE INDEX agent_payout_queue_idx ON agent_payout_calculations(status,receipt_date,id);
CREATE INDEX commission_batch_queue_idx ON commission_payment_batches(payment_status,submitted_at DESC,id);
CREATE INDEX commission_invoice_queue_idx ON commission_receivable_invoices(state,due_date,id);
-- Advice evidence is immutable. Generation may update only operational fields.
CREATE FUNCTION protect_agent_payout_advice_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.batch_id,NEW.agent_id,NEW.currency,NEW.input_snapshot,NEW.template_version,NEW.created_by,NEW.created_at,NEW.advice_number) IS DISTINCT FROM ROW(OLD.batch_id,OLD.agent_id,OLD.currency,OLD.input_snapshot,OLD.template_version,OLD.created_by,OLD.created_at,OLD.advice_number) THEN
  RAISE EXCEPTION 'Payout advice source evidence is immutable';
 END IF;
 IF OLD.status='generated' AND ROW(NEW.status,NEW.storage_key,NEW.pdf_hash,NEW.template_hash,NEW.generated_at) IS DISTINCT FROM ROW(OLD.status,OLD.storage_key,OLD.pdf_hash,OLD.template_hash,OLD.generated_at) THEN
  RAISE EXCEPTION 'Generated payout advice is immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_agent_payout_advice_evidence BEFORE UPDATE ON agent_payout_advices FOR EACH ROW EXECUTE FUNCTION protect_agent_payout_advice_evidence();
-- Runtime access is scoped to reading, recording and generation. No delete grant.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='nysareal_nysar2app') THEN
  GRANT SELECT,INSERT,UPDATE ON agent_payout_advices TO nysareal_nysar2app;
  GRANT USAGE,SELECT ON SEQUENCE agent_payout_advices_advice_number_seq TO nysareal_nysar2app;
 END IF;
END $$;
