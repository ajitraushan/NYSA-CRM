-- Release 3D Calendly scheduling. Additive, disabled by configuration and no inferred mappings.
CREATE TABLE calendly_connections (
  id UUID PRIMARY KEY,
  organization_ref TEXT NOT NULL,
  connecting_user_ref TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  refresh_token_generation INTEGER NOT NULL DEFAULT 1 CHECK(refresh_token_generation>0),
  granted_scopes TEXT[] NOT NULL,
  webhook_subscription_ref TEXT,
  webhook_status TEXT NOT NULL DEFAULT 'not_registered' CHECK(webhook_status IN('not_registered','active','failed','cancelled')),
  status TEXT NOT NULL CHECK(status IN('pending','active','reauthorization_required','disconnected')),
  connected_by UUID NOT NULL REFERENCES brokers(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_by UUID REFERENCES brokers(id),
  disconnected_at TIMESTAMPTZ,
  disconnect_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(cardinality(granted_scopes)>0),
  CHECK(NOT ('scheduled_events:write'=ANY(granted_scopes))),
  CHECK((status='disconnected')=(disconnected_at IS NOT NULL)),
  CHECK(disconnected_at IS NULL OR (disconnected_by IS NOT NULL AND LENGTH(BTRIM(disconnect_reason))>=5))
);
CREATE UNIQUE INDEX calendly_one_active_organization_idx ON calendly_connections((status IN('pending','active','reauthorization_required')))
  WHERE status IN('pending','active','reauthorization_required');

CREATE TABLE calendly_oauth_states (
  state_hash CHAR(64) PRIMARY KEY CHECK(state_hash~'^[a-f0-9]{64}$'),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  encrypted_pkce_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(expires_at>created_at)
);

CREATE TABLE calendly_host_mappings (
  id UUID PRIMARY KEY,
  calendly_connection_id UUID NOT NULL REFERENCES calendly_connections(id),
  calendly_user_ref TEXT NOT NULL,
  broker_id UUID NOT NULL REFERENCES brokers(id),
  version INTEGER NOT NULL CHECK(version>0),
  status TEXT NOT NULL CHECK(status IN('active','retired')),
  reason TEXT NOT NULL CHECK(LENGTH(BTRIM(reason))>=5),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((status='retired')=(effective_until IS NOT NULL)),
  UNIQUE(calendly_connection_id,calendly_user_ref,version)
);
CREATE UNIQUE INDEX calendly_active_user_mapping_idx ON calendly_host_mappings(calendly_connection_id,calendly_user_ref) WHERE status='active';
CREATE UNIQUE INDEX calendly_active_broker_mapping_idx ON calendly_host_mappings(calendly_connection_id,broker_id) WHERE status='active';

CREATE TABLE calendly_event_type_mappings (
  id UUID PRIMARY KEY,
  calendly_connection_id UUID NOT NULL REFERENCES calendly_connections(id),
  event_type_ref TEXT NOT NULL,
  mapping_version INTEGER NOT NULL CHECK(mapping_version>0),
  kind TEXT NOT NULL CHECK(kind IN('customer_meeting','property_viewing')),
  duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 15 AND 480),
  location_mode TEXT NOT NULL CHECK(location_mode IN('physical','virtual','either')),
  status TEXT NOT NULL CHECK(status IN('active','retired')),
  reason TEXT NOT NULL CHECK(LENGTH(BTRIM(reason))>=5),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(kind<>'property_viewing' OR location_mode='physical'),
  CHECK((status='retired')=(effective_until IS NOT NULL)),
  UNIQUE(calendly_connection_id,event_type_ref,mapping_version)
);
CREATE UNIQUE INDEX calendly_active_event_type_mapping_idx ON calendly_event_type_mappings(calendly_connection_id,event_type_ref) WHERE status='active';

CREATE TABLE calendly_scheduling_intents (
  id UUID PRIMARY KEY,
  intent_reference TEXT NOT NULL UNIQUE,
  calendly_connection_id UUID NOT NULL REFERENCES calendly_connections(id),
  kind TEXT NOT NULL CHECK(kind IN('customer_meeting','property_viewing')),
  event_type_mapping_id UUID NOT NULL REFERENCES calendly_event_type_mappings(id),
  event_type_mapping_version INTEGER NOT NULL CHECK(event_type_mapping_version>0),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  lead_authority_hash CHAR(64) NOT NULL CHECK(lead_authority_hash ~ '^[a-f0-9]{64}$'),
  opportunity_id UUID REFERENCES opportunities(id),
  opportunity_version INTEGER,
  property_match_id UUID REFERENCES property_matches(id),
  property_match_version INTEGER,
  authority_hash CHAR(64) NOT NULL CHECK(authority_hash~'^[a-f0-9]{64}$'),
  correlation_ref TEXT NOT NULL UNIQUE,
  restricted_provider_link_ref TEXT NOT NULL,
  provider_link_digest CHAR(64) NOT NULL CHECK(provider_link_digest~'^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK(status IN('prepared','booked','cancelled','expired','reconciliation_required','projected')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(expires_at>created_at),
  CHECK((kind='customer_meeting' AND opportunity_id IS NULL AND opportunity_version IS NULL AND property_match_id IS NULL AND property_match_version IS NULL) OR
    (kind='property_viewing' AND opportunity_id IS NOT NULL AND opportunity_version>0 AND property_match_id IS NOT NULL AND property_match_version>0))
);
CREATE INDEX calendly_intents_lead_idx ON calendly_scheduling_intents(lead_id,created_at DESC);

CREATE TABLE calendly_provider_events (
  id UUID PRIMARY KEY,
  calendly_connection_id UUID NOT NULL REFERENCES calendly_connections(id),
  provider_event_ref TEXT NOT NULL,
  event_family TEXT NOT NULL CHECK(event_family IN('invitee.created','invitee.canceled')),
  event_ref TEXT NOT NULL,
  invitee_ref TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  signature_verified SMALLINT NOT NULL CHECK(signature_verified=1),
  payload_digest CHAR(64) NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$'),
  restricted_raw_event_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(calendly_connection_id,provider_event_ref),
  UNIQUE(calendly_connection_id,event_family,event_ref,invitee_ref)
);

CREATE TABLE calendly_provider_event_processing (
  id UUID PRIMARY KEY,
  provider_event_id UUID NOT NULL REFERENCES calendly_provider_events(id),
  sequence INTEGER NOT NULL CHECK(sequence>0),
  state TEXT NOT NULL CHECK(state IN('received','deduplicated','correlated','reconciliation_required','projected','failed')),
  controlled_reason_code TEXT,
  processed_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_event_id,sequence)
);

CREATE TABLE calendly_bookings (
  id UUID PRIMARY KEY,
  booking_reference TEXT NOT NULL UNIQUE,
  scheduling_intent_id UUID NOT NULL REFERENCES calendly_scheduling_intents(id),
  event_type_mapping_id UUID NOT NULL REFERENCES calendly_event_type_mappings(id),
  host_mapping_id UUID NOT NULL REFERENCES calendly_host_mappings(id),
  event_ref TEXT NOT NULL,
  invitee_ref TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  restricted_location_ref TEXT NOT NULL,
  location_digest CHAR(64) NOT NULL CHECK(location_digest~'^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK(status IN('booked','pending_broker_confirmation','confirmed','cancelled','rescheduled','reconciliation_required')),
  predecessor_booking_id UUID REFERENCES calendly_bookings(id),
  successor_booking_id UUID REFERENCES calendly_bookings(id),
  activity_id UUID REFERENCES activities(id),
  viewing_id UUID REFERENCES viewings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(ends_at>starts_at),
  CHECK(num_nonnulls(activity_id,viewing_id)<=1),
  UNIQUE(event_ref,invitee_ref)
);

CREATE TABLE calendly_projection_events (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES calendly_bookings(id),
  projection_type TEXT NOT NULL CHECK(projection_type IN('meeting_activity','viewing_confirmation_task','confirmed_viewing','cancellation','reschedule')),
  activity_id UUID REFERENCES activities(id),
  viewing_id UUID REFERENCES viewings(id),
  task_id UUID REFERENCES tasks(id),
  request_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(request_fingerprint~'^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(num_nonnulls(activity_id,viewing_id,task_id)=1),
  UNIQUE(booking_id,projection_type)
);

CREATE OR REPLACE FUNCTION prevent_calendly_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Calendly scheduling evidence is immutable'; END $$;
CREATE TRIGGER calendly_provider_events_immutable BEFORE UPDATE OR DELETE ON calendly_provider_events FOR EACH ROW EXECUTE FUNCTION prevent_calendly_evidence_mutation();
CREATE TRIGGER calendly_provider_event_processing_immutable BEFORE UPDATE OR DELETE ON calendly_provider_event_processing FOR EACH ROW EXECUTE FUNCTION prevent_calendly_evidence_mutation();
CREATE TRIGGER calendly_projection_events_immutable BEFORE UPDATE OR DELETE ON calendly_projection_events FOR EACH ROW EXECUTE FUNCTION prevent_calendly_evidence_mutation();

GRANT SELECT,INSERT,UPDATE ON calendly_connections,calendly_oauth_states,calendly_host_mappings,
  calendly_event_type_mappings,calendly_scheduling_intents,calendly_bookings TO nysareal_nysar2app;
GRANT SELECT,INSERT ON calendly_provider_events,calendly_provider_event_processing,calendly_projection_events TO nysareal_nysar2app;
