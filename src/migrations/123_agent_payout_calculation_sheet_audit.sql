-- DEV-192: permit audited viewing and downloading of Agent-quarter payout
-- calculation sheets. The document route already records this event; migration
-- 121 omitted its entity type from the audit_log constraint.

DO $$ DECLARE prior_expression TEXT; BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression
  FROM pg_constraint
  WHERE conrelid='audit_log'::regclass
    AND conname='audit_log_entity_type_check';

  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression
    || ') OR entity_type = ''AgentPayoutCalculationSheet'')';
END $$;
