CREATE TABLE password_reset_requests (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','issued','used','cancelled','expired')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requested_ip TEXT,
  issued_by UUID REFERENCES brokers(id),
  code_hash CHAR(64),
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
);

CREATE INDEX password_reset_requests_broker_idx ON password_reset_requests(broker_id, requested_at DESC);
CREATE INDEX password_reset_requests_status_idx ON password_reset_requests(status, requested_at DESC);
CREATE UNIQUE INDEX password_reset_requests_one_open_uq ON password_reset_requests(broker_id)
  WHERE status IN ('pending','issued');
