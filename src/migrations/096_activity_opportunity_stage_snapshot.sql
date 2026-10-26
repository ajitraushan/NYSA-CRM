-- Separate lifecycle-evidence increment: preserve the active Opportunity context
-- that existed when a new activity was recorded. Historical rows remain NULL;
-- their former Opportunity state must not be inferred or backfilled.
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS opportunity_id_snapshot UUID REFERENCES opportunities(id),
  ADD COLUMN IF NOT EXISTS opportunity_stage_snapshot TEXT;

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_opportunity_stage_snapshot_ck;
ALTER TABLE activities ADD CONSTRAINT activities_opportunity_stage_snapshot_ck CHECK (
  opportunity_stage_snapshot IS NULL OR opportunity_stage_snapshot IN (
    'Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Won','Closed Lost'
  )
);

CREATE INDEX IF NOT EXISTS activities_opportunity_snapshot_idx
  ON activities(opportunity_id_snapshot,created_at DESC)
  WHERE opportunity_id_snapshot IS NOT NULL;
