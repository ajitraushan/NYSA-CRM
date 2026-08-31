CREATE TABLE inventory_matching_runs (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  requirement_id UUID NOT NULL REFERENCES lead_requirements(id),
  opportunity_id UUID REFERENCES opportunities(id),
  policy_version TEXT NOT NULL,
  trigger_kind TEXT NOT NULL DEFAULT 'broker_requested' CHECK (trigger_kind='broker_requested'),
  checked_at TIMESTAMPTZ NOT NULL,
  requirement_snapshot JSONB NOT NULL,
  evidence_hash CHAR(64) NOT NULL,
  eligible_count INTEGER NOT NULL CHECK (eligible_count>=0),
  excluded_count INTEGER NOT NULL CHECK (excluded_count>=0),
  requested_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_matching_runs_lead_idx ON inventory_matching_runs(lead_id,created_at DESC);

CREATE TABLE inventory_matching_candidates (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES inventory_matching_runs(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('eligible','excluded')),
  presented_rank INTEGER CHECK (presented_rank IS NULL OR presented_rank>0),
  score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  fit_label TEXT,
  listing_snapshot JSONB NOT NULL,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusion_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id,listing_id),
  CHECK ((eligibility_status='eligible' AND presented_rank IS NOT NULL AND score IS NOT NULL)
    OR (eligibility_status='excluded' AND presented_rank IS NULL AND score IS NULL))
);

CREATE INDEX inventory_matching_candidates_run_idx
  ON inventory_matching_candidates(run_id,eligibility_status,presented_rank);

CREATE TRIGGER inventory_matching_runs_immutable BEFORE UPDATE OR DELETE ON inventory_matching_runs
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();
CREATE TRIGGER inventory_matching_candidates_immutable BEFORE UPDATE OR DELETE ON inventory_matching_candidates
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT,INSERT ON inventory_matching_runs TO nysareal_nysar2app;
GRANT SELECT,INSERT ON inventory_matching_candidates TO nysareal_nysar2app;
