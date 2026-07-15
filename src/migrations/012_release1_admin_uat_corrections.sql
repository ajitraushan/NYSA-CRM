ALTER TABLE value_sets ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('draft','active','retired'));
ALTER TABLE value_sets ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE controlled_value_consumers (
  id UUID PRIMARY KEY,
  value_set_id UUID NOT NULL REFERENCES value_sets(id),
  consumer_code TEXT NOT NULL,
  business_label TEXT NOT NULL,
  module_name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  active SMALLINT NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(value_set_id,consumer_code)
);

CREATE TABLE value_definition_usage (
  id UUID PRIMARY KEY,
  value_definition_id UUID NOT NULL REFERENCES value_definitions(id),
  consumer_code TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(value_definition_id,consumer_code,entity_type,entity_id)
);

ALTER TABLE routing_rules ALTER COLUMN team_id DROP NOT NULL;
ALTER TABLE leads ADD COLUMN queue_cycle_no INTEGER NOT NULL DEFAULT 1 CHECK (queue_cycle_no > 0);
ALTER TABLE leads ADD COLUMN last_queue_entered_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN routing_reason TEXT;

ALTER TABLE regulatory_assumption_versions DROP CONSTRAINT regulatory_assumption_versions_status_check;
ALTER TABLE regulatory_assumption_versions ADD CONSTRAINT regulatory_assumption_versions_status_check
  CHECK (status IN ('draft','approved','active','retired'));
ALTER TABLE regulatory_assumption_versions ADD COLUMN approved_by UUID REFERENCES brokers(id);
ALTER TABLE regulatory_assumption_versions ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE regulatory_assumption_versions ADD COLUMN approval_reason TEXT;
ALTER TABLE regulatory_assumption_versions ADD COLUMN effective_to TIMESTAMPTZ;
ALTER TABLE regulatory_assumption_versions ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE dashboard_targets DROP CONSTRAINT dashboard_targets_status_check;
ALTER TABLE dashboard_targets ADD CONSTRAINT dashboard_targets_status_check
  CHECK (status IN ('draft','approved','active','retired'));
-- Migration 010 already adds these three dashboard columns. IF NOT EXISTS keeps
-- this migration compatible with both the canonical sequence and older staging
-- databases that may not yet contain them.
ALTER TABLE dashboard_targets ADD COLUMN IF NOT EXISTS exception_threshold NUMERIC(18,2);
ALTER TABLE dashboard_targets ADD COLUMN IF NOT EXISTS threshold_direction TEXT NOT NULL DEFAULT 'high_bad'
  CHECK (threshold_direction IN ('high_bad','low_bad'));
ALTER TABLE dashboard_targets ADD COLUMN IF NOT EXISTS benchmark_source TEXT;
ALTER TABLE dashboard_targets ADD COLUMN approval_basis TEXT;
ALTER TABLE dashboard_targets ADD COLUMN approved_by UUID REFERENCES brokers(id);
ALTER TABLE dashboard_targets ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE dashboard_targets ADD COLUMN approval_reason TEXT;
ALTER TABLE dashboard_targets ADD COLUMN effective_from TIMESTAMPTZ;
ALTER TABLE dashboard_targets ADD COLUMN effective_to TIMESTAMPTZ;
ALTER TABLE dashboard_targets ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX dashboard_targets_no_active_overlap_uq
  ON dashboard_targets(metric_code,scope_type,COALESCE(scope_id,''),period_start,period_end)
  WHERE status IN ('approved','active');

ALTER TABLE brokers DROP CONSTRAINT brokers_status_check;
ALTER TABLE brokers ADD CONSTRAINT brokers_status_check
  CHECK (status IN ('pending_activation','active','suspended','revoked'));
ALTER TABLE brokers DROP CONSTRAINT brokers_job_role_check;
ALTER TABLE brokers ADD CONSTRAINT brokers_job_role_check
  CHECK (job_role IN ('admin','admin_assistant','sales_agent','listing_agent','manager','director','accountant'));
ALTER TABLE brokers ADD COLUMN user_classification TEXT NOT NULL DEFAULT 'internal_user'
  CHECK (user_classification IN ('internal_user','viewer','external_broker'));
ALTER TABLE brokers ADD COLUMN suspended_at TIMESTAMPTZ;
ALTER TABLE brokers ADD COLUMN revoked_at TIMESTAMPTZ;
ALTER TABLE brokers ADD COLUMN access_change_reason TEXT;
ALTER TABLE brokers ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE invitations DROP CONSTRAINT invitations_job_role_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_job_role_check
  CHECK (job_role IN ('admin','admin_assistant','sales_agent','listing_agent','manager','director','accountant'));
ALTER TABLE invitations ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE invitations ADD COLUMN pending_broker_id UUID REFERENCES brokers(id);

CREATE TABLE user_role_assignments (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES brokers(id),
  job_role TEXT NOT NULL CHECK (job_role IN ('admin','admin_assistant','sales_agent','listing_agent','manager','director','accountant')),
  team_id UUID REFERENCES teams(id),
  is_primary SMALLINT NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  approved_by UUID NOT NULL REFERENCES brokers(id),
  change_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX user_role_assignments_one_primary_uq ON user_role_assignments(broker_id)
  WHERE is_primary=1 AND status='active';

INSERT INTO user_role_assignments(id,broker_id,job_role,team_id,is_primary,status,starts_at,approved_by,change_reason)
SELECT b.id,b.id,b.job_role,b.team_id,1,'active',b.joined_at,
  COALESCE(b.invited_by,(SELECT id FROM brokers WHERE role='admin' ORDER BY joined_at LIMIT 1),b.id),
  'Migrated existing primary role'
FROM brokers b WHERE b.job_role IS NOT NULL
ON CONFLICT DO NOTHING;
