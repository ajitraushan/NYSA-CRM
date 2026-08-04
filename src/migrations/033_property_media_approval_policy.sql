CREATE TABLE property_media_approval_policy (
  id UUID PRIMARY KEY CHECK (id = '33000000-0000-4000-8000-000000000001'::uuid),
  manager_approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  change_reason TEXT NOT NULL,
  updated_by UUID REFERENCES brokers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO property_media_approval_policy
  (id, manager_approval_required, change_reason)
VALUES
  ('33000000-0000-4000-8000-000000000001', TRUE, 'Initial safe default: responsible Manager approval is required');
