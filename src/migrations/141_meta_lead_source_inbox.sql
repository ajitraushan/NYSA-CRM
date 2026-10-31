-- NYSA-CRM-20261026-LEAD-001 v1.2: additive durable source-reference inbox.
-- No existing users, ownership, lead classification or configuration is changed.
-- Restricted original form answers/PII are not stored in this reference-only inbox.
CREATE TABLE lead_source_inbox (
 id UUID PRIMARY KEY,
 source_system TEXT NOT NULL CHECK (source_system = 'meta'),
 source_account_id TEXT NOT NULL,
 source_event_id TEXT NOT NULL,
 source_form_id TEXT NOT NULL,
 reference_digest TEXT NOT NULL CHECK (reference_digest ~ '^[a-f0-9]{64}$'),
 source_created_at TIMESTAMPTZ NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 state TEXT NOT NULL DEFAULT 'pending_retrieval' CHECK (state IN ('pending_retrieval','processing','needs_review','accepted','failed')),
 lead_id UUID REFERENCES leads(id),
 error_code TEXT,
 processed_at TIMESTAMPTZ,
 UNIQUE (source_system, source_account_id, source_event_id)
);
CREATE INDEX lead_source_inbox_work ON lead_source_inbox(state, received_at);
