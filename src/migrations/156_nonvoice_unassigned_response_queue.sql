-- Owner-free intake is visible to authorized Admin/Managers but cannot send.
ALTER TABLE lead_follow_up_cases ALTER COLUMN fallback_owner_id DROP NOT NULL;
ALTER TABLE lead_follow_up_cases ALTER COLUMN next_action_task_id DROP NOT NULL;
ALTER TABLE lead_follow_up_cases ADD COLUMN assignment_due_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN response_owner_assigned_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN response_owner_assigned_by UUID REFERENCES brokers(id);

UPDATE lead_follow_up_cases
SET assignment_due_at=created_at+INTERVAL '2 minutes',
    response_owner_assigned_at=CASE WHEN fallback_owner_id IS NOT NULL THEN created_at END,
    response_owner_assigned_by=CASE WHEN fallback_owner_id IS NOT NULL THEN created_by END
WHERE assignment_due_at IS NULL;

ALTER TABLE lead_follow_up_cases ALTER COLUMN assignment_due_at SET NOT NULL;
CREATE INDEX lead_follow_up_unassigned_due_idx
  ON lead_follow_up_cases(assignment_due_at,created_at)
  WHERE fallback_owner_id IS NULL;

GRANT SELECT,INSERT,UPDATE,DELETE ON lead_follow_up_cases TO nysareal_nysar2app;
