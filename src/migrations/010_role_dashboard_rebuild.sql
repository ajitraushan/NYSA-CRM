ALTER TABLE dashboard_targets
  ADD COLUMN exception_threshold NUMERIC(18,2),
  ADD COLUMN threshold_direction TEXT NOT NULL DEFAULT 'high_bad'
    CHECK (threshold_direction IN ('high_bad','low_bad')),
  ADD COLUMN benchmark_source TEXT;

CREATE INDEX dashboard_targets_scope_idx
  ON dashboard_targets(scope_type,scope_id,metric_code,period_start,period_end,status);

ALTER TABLE listings
  ADD COLUMN availability_confirmed_at TIMESTAMPTZ,
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','expired','not_required')),
  ADD COLUMN verification_expires_at TIMESTAMPTZ,
  ADD COLUMN permit_number TEXT,
  ADD COLUMN permit_expires_at TIMESTAMPTZ,
  ADD COLUMN portal_status TEXT NOT NULL DEFAULT 'not_ready'
    CHECK (portal_status IN ('not_ready','ready','published','blocked'));

CREATE INDEX listings_readiness_idx
  ON listings(status,availability_confirmed_at,verification_status,verification_expires_at,permit_expires_at,portal_status)
  WHERE deleted_at IS NULL;

CREATE TABLE dashboard_metric_snapshots (
  id UUID PRIMARY KEY,
  metric_code TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'company' CHECK (scope_type IN ('company','business_line','team','agent')),
  scope_id TEXT NOT NULL DEFAULT '',
  snapshot_date DATE NOT NULL,
  value NUMERIC(18,2) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(metric_code,scope_type,scope_id,snapshot_date)
);

CREATE INDEX dashboard_metric_snapshots_history_idx
  ON dashboard_metric_snapshots(metric_code,scope_type,scope_id,snapshot_date DESC);
