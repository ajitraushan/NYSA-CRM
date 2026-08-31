ALTER TABLE lead_requirements
  ADD COLUMN declared_priorities TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN must_haves TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN preferences TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN exclusions TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN acceptable_trade_offs TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'broker_recorded' CHECK (source_kind IN ('broker_recorded','website_profile')),
  ADD COLUMN source_event_id UUID REFERENCES website_intake_events(id),
  ADD COLUMN source_tool_code TEXT,
  ADD COLUMN source_tool_version TEXT,
  ADD COLUMN source_completed_at TIMESTAMPTZ;

ALTER TABLE website_intake_events
  ADD COLUMN profile_source_code TEXT,
  ADD COLUMN profile_source_version TEXT;

CREATE INDEX lead_requirements_source_event_idx ON lead_requirements(source_event_id) WHERE source_event_id IS NOT NULL;

GRANT SELECT,INSERT,UPDATE ON lead_requirements TO nysareal_nysar2app;
