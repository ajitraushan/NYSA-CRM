-- Release 3D Microsoft 365 Email. Additive, disabled by configuration and no legacy mailbox backfill.
CREATE TABLE microsoft365_mailbox_connections (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES brokers(id),
  tenant_ref TEXT NOT NULL,
  external_user_ref TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  refresh_token_generation INTEGER NOT NULL DEFAULT 1 CHECK(refresh_token_generation>0),
  granted_scopes TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK(status IN('pending','active','reauthorization_required','disconnected')),
  connected_by UUID NOT NULL REFERENCES brokers(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_by UUID REFERENCES brokers(id),
  disconnected_at TIMESTAMPTZ,
  disconnect_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(cardinality(granted_scopes)>0),
  CHECK(NOT ('Mail.ReadWrite'=ANY(granted_scopes))),
  CHECK(NOT ('Mail.ReadWrite.Shared'=ANY(granted_scopes))),
  CHECK((status='disconnected')=(disconnected_at IS NOT NULL)),
  CHECK(disconnected_at IS NULL OR (disconnected_by IS NOT NULL AND LENGTH(BTRIM(disconnect_reason))>=5))
);
CREATE UNIQUE INDEX microsoft365_one_active_mailbox_per_broker_idx ON microsoft365_mailbox_connections(broker_id)
  WHERE status IN('pending','active','reauthorization_required');
CREATE UNIQUE INDEX microsoft365_external_user_active_idx ON microsoft365_mailbox_connections(tenant_ref,external_user_ref)
  WHERE status IN('pending','active','reauthorization_required');

CREATE TABLE microsoft365_oauth_states (
  state_hash CHAR(64) PRIMARY KEY CHECK(state_hash~'^[a-f0-9]{64}$'),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  encrypted_pkce_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(expires_at>created_at)
);

CREATE TABLE email_threads (
  id UUID PRIMARY KEY,
  thread_reference TEXT NOT NULL UNIQUE,
  mailbox_connection_id UUID NOT NULL REFERENCES microsoft365_mailbox_connections(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  opportunity_id UUID REFERENCES opportunities(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  owner_id UUID NOT NULL REFERENCES brokers(id),
  provider_conversation_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','closed','correlation_review')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CHECK((status='closed')=(closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX email_thread_provider_conversation_idx ON email_threads(mailbox_connection_id,provider_conversation_ref)
  WHERE provider_conversation_ref IS NOT NULL;
CREATE INDEX email_threads_lead_idx ON email_threads(lead_id,created_at DESC);

CREATE TABLE email_drafts (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES email_threads(id),
  purpose TEXT NOT NULL CHECK(purpose IN('service_follow_up','meeting_coordination','viewing_coordination')),
  contact_authority_hash CHAR(64) NOT NULL CHECK(contact_authority_hash~'^[a-f0-9]{64}$'),
  template_version_id UUID,
  restricted_payload_ref TEXT NOT NULL,
  payload_digest CHAR(64) NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
  sender_digest CHAR(64) NOT NULL CHECK(sender_digest~'^[a-f0-9]{64}$'),
  recipient_digest CHAR(64) NOT NULL CHECK(recipient_digest~'^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','confirmed','cancelled')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  CHECK((status='confirmed')=(confirmed_at IS NOT NULL))
);

CREATE TABLE email_message_evidence (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES email_threads(id),
  attempt_reference TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK(direction IN('outbound','inbound')),
  purpose TEXT NOT NULL CHECK(purpose IN('service_follow_up','meeting_coordination','viewing_coordination')),
  initial_state TEXT NOT NULL CHECK(initial_state IN('confirmed','accepted')),
  draft_id UUID REFERENCES email_drafts(id),
  draft_version INTEGER CHECK(draft_version>0),
  contact_authority_hash CHAR(64) NOT NULL CHECK(contact_authority_hash~'^[a-f0-9]{64}$'),
  template_version_id UUID,
  restricted_payload_ref TEXT NOT NULL,
  payload_digest CHAR(64) NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
  sender_digest CHAR(64) NOT NULL CHECK(sender_digest~'^[a-f0-9]{64}$'),
  recipient_digest CHAR(64) NOT NULL CHECK(recipient_digest~'^[a-f0-9]{64}$'),
  provider_message_ref TEXT,
  provider_event_ref TEXT,
  provider_occurred_at TIMESTAMPTZ,
  activity_id UUID REFERENCES activities(id),
  idempotency_key TEXT,
  confirmed_by UUID REFERENCES brokers(id),
  confirmed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((direction='outbound' AND initial_state='confirmed' AND draft_id IS NOT NULL AND draft_version IS NOT NULL AND confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL) OR
    (direction='inbound' AND initial_state='accepted' AND draft_id IS NULL AND draft_version IS NULL))
);
CREATE UNIQUE INDEX email_message_provider_idx ON email_message_evidence(thread_id,provider_message_ref)
  WHERE provider_message_ref IS NOT NULL;
CREATE UNIQUE INDEX email_message_idempotency_idx ON email_message_evidence(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX email_message_thread_idx ON email_message_evidence(thread_id,created_at DESC);

CREATE TABLE email_message_state_events (
  id UUID PRIMARY KEY,
  message_evidence_id UUID NOT NULL REFERENCES email_message_evidence(id),
  sequence INTEGER NOT NULL CHECK(sequence>0),
  from_state TEXT NOT NULL CHECK(from_state IN('confirmed','queued','dispatching','accepted','retry_wait','outcome_unknown','reconciled','failed_permanent','cancelled')),
  to_state TEXT NOT NULL CHECK(to_state IN('queued','dispatching','accepted','retry_wait','outcome_unknown','reconciled','failed_permanent','cancelled')),
  event_type TEXT NOT NULL,
  controlled_reason_code TEXT,
  performed_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_evidence_id,sequence)
);

CREATE TABLE email_outbox (
  id UUID PRIMARY KEY,
  message_evidence_id UUID NOT NULL REFERENCES email_message_evidence(id),
  dispatch_generation INTEGER NOT NULL DEFAULT 1 CHECK(dispatch_generation=1),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','claimed','accepted','retry_wait','outcome_unknown','dead_letter','cancelled')),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
  next_attempt_at TIMESTAMPTZ,
  last_reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_evidence_id,dispatch_generation)
);
CREATE INDEX email_outbox_ready_idx ON email_outbox(state,available_at) WHERE state IN('pending','retry_wait');

CREATE TABLE microsoft365_subscription_leases (
  id UUID PRIMARY KEY,
  mailbox_connection_id UUID NOT NULL REFERENCES microsoft365_mailbox_connections(id),
  folder_scope TEXT NOT NULL CHECK(folder_scope IN('inbox','sent_items')),
  subscription_ref TEXT NOT NULL,
  resource_ref TEXT NOT NULL,
  client_state_digest CHAR(64) NOT NULL CHECK(client_state_digest~'^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK(status IN('active','renewal_due','expired','failed','cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  last_renewed_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mailbox_connection_id,folder_scope),
  UNIQUE(subscription_ref)
);

CREATE TABLE email_sync_checkpoints (
  id UUID PRIMARY KEY,
  mailbox_connection_id UUID NOT NULL REFERENCES microsoft365_mailbox_connections(id),
  folder_scope TEXT NOT NULL CHECK(folder_scope IN('inbox','sent_items')),
  encrypted_delta_link TEXT NOT NULL,
  generation INTEGER NOT NULL DEFAULT 1 CHECK(generation>0),
  last_success_at TIMESTAMPTZ,
  last_error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mailbox_connection_id,folder_scope)
);

CREATE TABLE email_provider_events (
  id UUID PRIMARY KEY,
  mailbox_connection_id UUID NOT NULL REFERENCES microsoft365_mailbox_connections(id),
  subscription_ref TEXT NOT NULL,
  provider_event_ref TEXT NOT NULL,
  resource_ref TEXT NOT NULL,
  client_state_digest CHAR(64) NOT NULL CHECK(client_state_digest~'^[a-f0-9]{64}$'),
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mailbox_connection_id,provider_event_ref)
);

CREATE TABLE email_provider_event_processing (
  id UUID PRIMARY KEY,
  provider_event_id UUID NOT NULL REFERENCES email_provider_events(id),
  sequence INTEGER NOT NULL CHECK(sequence>0),
  state TEXT NOT NULL CHECK(state IN('received','deduplicated','correlated','discarded_unrelated','correlation_review','projected','failed')),
  controlled_reason_code TEXT,
  processed_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_event_id,sequence)
);

CREATE TABLE email_projection_events (
  id UUID PRIMARY KEY,
  message_evidence_id UUID NOT NULL REFERENCES email_message_evidence(id),
  activity_id UUID NOT NULL REFERENCES activities(id),
  projection_type TEXT NOT NULL CHECK(projection_type IN('outbound_email_activity','inbound_email_activity')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_evidence_id,projection_type),
  UNIQUE(activity_id)
);

CREATE OR REPLACE FUNCTION prevent_email_integration_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Email integration evidence is immutable'; END $$;
CREATE TRIGGER email_message_evidence_immutable BEFORE UPDATE OR DELETE ON email_message_evidence FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();
CREATE TRIGGER email_message_state_events_immutable BEFORE UPDATE OR DELETE ON email_message_state_events FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();
CREATE TRIGGER email_provider_events_immutable BEFORE UPDATE OR DELETE ON email_provider_events FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();
CREATE TRIGGER email_provider_event_processing_immutable BEFORE UPDATE OR DELETE ON email_provider_event_processing FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();
CREATE TRIGGER email_projection_events_immutable BEFORE UPDATE OR DELETE ON email_projection_events FOR EACH ROW EXECUTE FUNCTION prevent_email_integration_evidence_mutation();

GRANT SELECT,INSERT,UPDATE ON microsoft365_mailbox_connections,microsoft365_oauth_states,email_threads,email_drafts,email_outbox,
  microsoft365_subscription_leases,email_sync_checkpoints TO nysareal_nysar2app;
GRANT SELECT,INSERT ON email_message_evidence,email_message_state_events,email_provider_events,email_provider_event_processing,email_projection_events TO nysareal_nysar2app;
