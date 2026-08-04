UPDATE routing_rules
SET agent_id=NULL, assignment_method='team_queue', updated_at=NOW()
WHERE agent_id IS NOT NULL OR assignment_method<>'team_queue';

ALTER TABLE routing_rules
  ADD CONSTRAINT routing_rules_team_queue_only_ck
  CHECK (agent_id IS NULL AND assignment_method='team_queue');
