-- Private, immutable commission attachments. Existing receipt authority/gates are unchanged.
CREATE TABLE deal_commission_proofs (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id),
  proof_reference TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('application/pdf','image/png','image/jpeg')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 5242880),
  file_hash TEXT NOT NULL CHECK (length(file_hash)=64),
  storage_key TEXT NOT NULL UNIQUE,
  uploaded_by UUID NOT NULL REFERENCES brokers(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  UNIQUE(uploaded_by,idempotency_key),
  UNIQUE(deal_id,id)
);
CREATE INDEX deal_commission_proofs_deal_idx ON deal_commission_proofs(deal_id,uploaded_at);
CREATE TRIGGER commission_proofs_immutable BEFORE UPDATE OR DELETE ON deal_commission_proofs
  FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
ALTER TABLE deal_commission_receipts ADD COLUMN proof_id UUID;
ALTER TABLE deal_commission_receipts ADD CONSTRAINT receipt_proof_same_deal
  FOREIGN KEY(deal_id,proof_id) REFERENCES deal_commission_proofs(deal_id,id);
GRANT SELECT,INSERT ON deal_commission_proofs TO nysareal_nysar2app;

DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression FROM pg_constraint
    WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression || ') OR entity_type = ''DealCommissionProof'')';
END;
$$;
