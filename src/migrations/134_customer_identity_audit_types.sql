-- DEV223 introduced these audit entities without extending the governed allow-list.
-- Preserve every previously allowed entity and fail closed if the guard is missing.
DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO prior_expression
  FROM pg_constraint
  WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  IF prior_expression IS NULL THEN
    RAISE EXCEPTION 'Required audit entity constraint is missing';
  END IF;
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression || ') OR entity_type IN (''CustomerDocumentRequirement'',''CustomerIdentityDocument'',''CompanyIdentityDocument''))';
END $$;
