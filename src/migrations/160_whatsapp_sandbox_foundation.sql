-- WA-001 Stage A only. No live-channel configuration, Customer or Lead mutation.
CREATE TABLE wa_sandbox_connections (
 id UUID PRIMARY KEY, singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK(singleton),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 encrypted_credentials TEXT NOT NULL, key_fingerprint TEXT NOT NULL CHECK(length(key_fingerprint)=64),
 paused BOOLEAN NOT NULL DEFAULT TRUE,
 updated_by UUID NOT NULL REFERENCES brokers(id), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE wa_sandbox_attempts (
 id UUID PRIMARY KEY, connection_id UUID NOT NULL REFERENCES wa_sandbox_connections(id),
 action_key UUID NOT NULL, request_digest TEXT NOT NULL, key_fingerprint TEXT NOT NULL,
 encrypted_payload TEXT NOT NULL, actor_id UUID NOT NULL REFERENCES brokers(id),
 state TEXT NOT NULL CHECK(state IN ('submitting','accepted','rejected','outcome_unknown')),
 provider_ref TEXT, result_code TEXT, http_status INTEGER,
 delivery_state TEXT CHECK(delivery_state IN ('sent','delivered','read','failed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(connection_id,action_key), UNIQUE(connection_id,provider_ref)
);
CREATE INDEX wa_sandbox_attempt_quota ON wa_sandbox_attempts(key_fingerprint);
CREATE TABLE wa_sandbox_events (
 id UUID PRIMARY KEY, connection_id UUID NOT NULL REFERENCES wa_sandbox_connections(id),
 event_ref TEXT NOT NULL, event_digest TEXT NOT NULL, encrypted_payload TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('reply','unsupported','opt_out','delivery_status')),
 provider_ref TEXT NOT NULL, occurred_at TIMESTAMPTZ NOT NULL,
 delivery_state TEXT CHECK(delivery_state IN ('sent','delivered','read','failed')),
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(connection_id,event_ref)
);
CREATE TABLE wa_sandbox_audit (
 id UUID PRIMARY KEY, connection_id UUID NOT NULL REFERENCES wa_sandbox_connections(id),
 actor_id UUID REFERENCES brokers(id), action TEXT NOT NULL,
 details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT,INSERT,UPDATE ON wa_sandbox_connections,wa_sandbox_attempts,wa_sandbox_events,wa_sandbox_audit TO nysareal_nysar2app;
