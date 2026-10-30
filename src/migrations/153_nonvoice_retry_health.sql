ALTER TABLE lead_source_inbox ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lead_source_inbox ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lead_source_inbox ADD COLUMN requirement_digest TEXT;
CREATE INDEX lead_source_retry_due ON lead_source_inbox(next_attempt_at) WHERE state='pending_retrieval';
CREATE TABLE lead_integration_runtime_health (
 provider TEXT PRIMARY KEY,last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),status TEXT NOT NULL,safe_error_code TEXT
);
GRANT SELECT,INSERT,UPDATE ON lead_integration_runtime_health TO nysareal_nysar2app;
