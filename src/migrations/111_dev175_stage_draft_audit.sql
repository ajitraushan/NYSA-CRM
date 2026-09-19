-- Permit the exact audit entity used by migration 107's versioned stage drafts.
-- Preserve every existing entity restriction; do not rewrite historical evidence.
DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT prior_expression
  FROM pg_constraint
  WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression || ') OR entity_type = ''OpportunityStageDraft'')';
END;
$$;
