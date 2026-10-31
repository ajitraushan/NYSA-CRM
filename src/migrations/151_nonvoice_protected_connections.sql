CREATE TABLE lead_integration_connections (
 id UUID PRIMARY KEY,provider TEXT NOT NULL UNIQUE CHECK(provider IN ('meta','email','whatsapp')),
 encrypted_credentials TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,
 updated_by UUID NOT NULL REFERENCES brokers(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT,INSERT,UPDATE ON lead_integration_connections TO nysareal_nysar2app;
DO $$
DECLARE prior TEXT;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO prior FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
 IF prior IS NULL THEN RAISE EXCEPTION 'Required audit entity constraint missing'; END IF;
 ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
 EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('||prior||') OR entity_type=''LeadIntegrationConnection'')';
END $$;
