ALTER TABLE dashboard_targets ADD COLUMN cadence TEXT NOT NULL DEFAULT 'one_off'
  CHECK(cadence IN ('one_off','daily','weekly','monthly'));
ALTER TABLE dashboard_targets ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE dashboard_targets ALTER COLUMN period_end DROP NOT NULL;
DROP INDEX dashboard_targets_no_active_overlap_uq;
CREATE UNIQUE INDEX dashboard_targets_no_active_overlap_uq ON dashboard_targets
  (metric_code,scope_type,COALESCE(scope_id,''),cadence,period_start,COALESCE(period_end,'infinity'::date))
  WHERE status IN ('approved','active');
CREATE TABLE dashboard_target_revisions (
  id UUID PRIMARY KEY,
  target_id UUID NOT NULL REFERENCES dashboard_targets(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  effective_on DATE NOT NULL,
  payload JSONB NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(target_id,revision)
);
INSERT INTO dashboard_target_revisions(id,target_id,revision,effective_on,payload,reason,changed_by)
SELECT gen_random_uuid(),id,revision,period_start,to_jsonb(dashboard_targets),
  'Existing target retained before recurring-target maintenance',created_by FROM dashboard_targets;
-- Only the positively identified synthetic dashboard benchmark records are retired.
WITH retired AS (
  UPDATE dashboard_targets SET status='retired',effective_to=NOW(),updated_at=NOW()
  WHERE id::text ~ '^d7000000-0000-4000-8000-[0-9]{12}$'
    AND benchmark_source='CORE Release 1 test benchmark' AND target_value=10
    AND definition LIKE 'Controlled test definition for %' AND status IN ('draft','approved','active')
  RETURNING *
)
INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
SELECT gen_random_uuid(),'DashboardTarget',id,'seeded_test_benchmark_retired',created_by,
  json_build_object('executionMode','approved_migration','reason','User approved retirement of identified seeded Target 10 test benchmarks',
    'attribution','original_target_creator','metricCode',metric_code,'targetValue',target_value)::text FROM retired;
GRANT SELECT,INSERT,UPDATE,DELETE ON dashboard_target_revisions TO nysareal_nysar2app;
