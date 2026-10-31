CREATE TABLE lead_integration_setup (
 id UUID PRIMARY KEY,
 singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK(singleton),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 draft JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(draft)='object'),
 updated_by UUID NOT NULL REFERENCES brokers(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT,INSERT,UPDATE ON lead_integration_setup TO nysareal_nysar2app;
DO $$
DECLARE previous TEXT;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO previous FROM pg_constraint
 WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
 IF previous IS NULL THEN RAISE EXCEPTION 'Missing audit entity constraint'; END IF;
 ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
 EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('||previous||') OR entity_type=''LeadIntegrationSetup'')';
END $$;
