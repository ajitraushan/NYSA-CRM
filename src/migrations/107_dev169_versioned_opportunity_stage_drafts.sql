-- DEF-092 / UAT-092: dedicated Opportunity stage workspaces retain immutable
-- numbered draft versions without creating downstream governed records.

CREATE TABLE opportunity_stage_draft_versions (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  stage_code TEXT NOT NULL CHECK(stage_code IN ('inventory','viewing','offer','negotiation','booking','deal')),
  version_no INTEGER NOT NULL CHECK(version_no > 0),
  opportunity_version INTEGER NOT NULL CHECK(opportunity_version > 0),
  payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object'),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id,stage_code,created_by,version_no)
);

CREATE INDEX opportunity_stage_draft_latest_idx
  ON opportunity_stage_draft_versions(opportunity_id,stage_code,created_by,version_no DESC);

CREATE TABLE opportunity_stage_draft_finalizations (
  id UUID PRIMARY KEY,
  draft_version_id UUID NOT NULL UNIQUE REFERENCES opportunity_stage_draft_versions(id) ON DELETE CASCADE,
  finalized_by UUID NOT NULL REFERENCES brokers(id),
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
