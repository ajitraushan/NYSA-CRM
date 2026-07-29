CREATE TABLE agent_area_assignments (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES brokers(id),
  area_id UUID NOT NULL REFERENCES areas(id),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX agent_area_assignments_active_uq
  ON agent_area_assignments(broker_id,area_id) WHERE ends_at IS NULL;
CREATE INDEX agent_area_assignments_area_idx
  ON agent_area_assignments(area_id,broker_id) WHERE ends_at IS NULL;

GRANT SELECT,INSERT,UPDATE ON agent_area_assignments TO nysareal_nysar2app;
