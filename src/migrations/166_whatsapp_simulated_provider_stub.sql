-- DEV262 CRM Test-only simulated WhatsApp provider.
-- The application startup guard prevents this provider from being enabled outside CRM Test.

ALTER TABLE wa_conversations
  ADD COLUMN simulated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN simulation_run_id UUID,
  ADD COLUMN simulation_seed TEXT;
CREATE INDEX wa_conversations_simulated_idx
  ON wa_conversations(simulated,simulation_run_id,last_activity_at DESC);

ALTER TABLE wa_conversation_messages
  ADD COLUMN simulated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN provider_message_id TEXT,
  ADD COLUMN provider_status TEXT
    CHECK(provider_status IS NULL OR provider_status IN ('accepted','sent','delivered','read','failed')),
  ADD COLUMN provider_status_at TIMESTAMPTZ,
  ADD COLUMN provider_payload_hash TEXT
    CHECK(provider_payload_hash IS NULL OR length(provider_payload_hash)=64);
CREATE UNIQUE INDEX wa_conversation_messages_provider_id_uq
  ON wa_conversation_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;
CREATE INDEX wa_conversation_messages_simulated_idx
  ON wa_conversation_messages(simulated,provider_status,occurred_at DESC);

ALTER TABLE wa_message_template_versions
  ADD COLUMN simulated_provider_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK(simulated_provider_status IN ('not_submitted','pending','approved','rejected','paused')),
  ADD COLUMN simulated_provider_status_at TIMESTAMPTZ,
  ADD COLUMN simulated_provider_reason TEXT;

ALTER TABLE wa_campaign_approval_recipients
  ADD COLUMN simulated_conversation_id UUID REFERENCES wa_conversations(id) ON DELETE SET NULL,
  ADD COLUMN simulated_provider_message_id TEXT,
  ADD COLUMN simulated_status TEXT
    CHECK(simulated_status IS NULL OR simulated_status IN ('accepted','sent','delivered','read','failed')),
  ADD COLUMN simulated_status_at TIMESTAMPTZ,
  ADD COLUMN simulated_sent_at TIMESTAMPTZ,
  ADD COLUMN simulated_last_error TEXT;
CREATE UNIQUE INDEX wa_campaign_approval_recipients_simulated_message_uq
  ON wa_campaign_approval_recipients(simulated_provider_message_id)
  WHERE simulated_provider_message_id IS NOT NULL;

CREATE TABLE wa_simulation_runs (
  id UUID PRIMARY KEY,
  seed TEXT NOT NULL,
  requested_conversations INTEGER NOT NULL CHECK(requested_conversations BETWEEN 1 AND 10000),
  requested_messages INTEGER NOT NULL DEFAULT 0 CHECK(requested_messages BETWEEN 0 AND 200000),
  requested_opt_outs INTEGER NOT NULL DEFAULT 0 CHECK(requested_opt_outs BETWEEN 0 AND 10000),
  requested_rate INTEGER NOT NULL DEFAULT 5 CHECK(requested_rate IN (5,20,50)),
  configuration JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed','cleaned')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cleaned_at TIMESTAMPTZ,
  result JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX wa_simulation_runs_status_idx ON wa_simulation_runs(status,created_at DESC);

ALTER TABLE wa_conversations
  ADD CONSTRAINT wa_conversations_simulation_run_fk
  FOREIGN KEY(simulation_run_id) REFERENCES wa_simulation_runs(id) ON DELETE SET NULL;

CREATE TABLE wa_simulated_provider_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
  paused BOOLEAN NOT NULL DEFAULT TRUE,
  fault_mode TEXT NOT NULL DEFAULT 'none'
    CHECK(fault_mode IN ('none','timeout','rate_limited','server_error','invalid_payload','template_paused')),
  updated_by UUID REFERENCES brokers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO wa_simulated_provider_control(singleton) VALUES(TRUE);

CREATE TABLE wa_simulated_provider_events (
  id UUID PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  simulation_run_id UUID REFERENCES wa_simulation_runs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL
    CHECK(event_type IN ('outbound_request','template_submission','template_status','message_status','inbound_message','blocked_external_host','cleanup')),
  direction TEXT NOT NULL CHECK(direction IN ('core_to_stub','stub_to_core','internal')),
  payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64),
  outcome TEXT NOT NULL CHECK(outcome IN ('accepted','processed','duplicate','rejected','blocked','cleaned')),
  diagnostic_code TEXT,
  related_entity_type TEXT,
  related_entity_id UUID,
  actor_id UUID REFERENCES brokers(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wa_simulated_provider_events_run_idx
  ON wa_simulated_provider_events(simulation_run_id,occurred_at DESC);
CREATE INDEX wa_simulated_provider_events_outcome_idx
  ON wa_simulated_provider_events(outcome,event_type,occurred_at DESC);

ALTER TABLE wa_campaign_audit DROP CONSTRAINT IF EXISTS wa_campaign_audit_entity_type_check;
ALTER TABLE wa_campaign_audit ADD CONSTRAINT wa_campaign_audit_entity_type_check
  CHECK(entity_type IN ('recipient_import','segment','template_catalogue','message_template','material_catalogue','campaign','conversation','simulation'));

GRANT SELECT,INSERT,UPDATE,DELETE ON
  wa_simulation_runs,wa_simulated_provider_control,wa_simulated_provider_events
  TO nysareal_nysar2app;
