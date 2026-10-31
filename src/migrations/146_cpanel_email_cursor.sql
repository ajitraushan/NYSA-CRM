CREATE TABLE lead_email_mailbox_cursors (
 connection_ref TEXT PRIMARY KEY,uid_validity TEXT NOT NULL,last_uid BIGINT NOT NULL CHECK(last_uid>=0),
 initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lead_source_inbox ADD COLUMN review_owner_id UUID REFERENCES brokers(id);
ALTER TABLE lead_source_inbox ADD COLUMN review_due_at TIMESTAMPTZ;
ALTER TABLE lead_response_provider_inbox ADD COLUMN review_owner_id UUID REFERENCES brokers(id);
ALTER TABLE lead_response_provider_inbox ADD COLUMN review_due_at TIMESTAMPTZ;
GRANT SELECT,INSERT,UPDATE ON lead_email_mailbox_cursors TO nysareal_nysar2app;
