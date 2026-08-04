ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id),
  ADD COLUMN IF NOT EXISTS proposal_version_id UUID REFERENCES proposal_versions(id);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN ('general','proposal_correction'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_proposal_correction_link_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_proposal_correction_link_check CHECK (
  task_type <> 'proposal_correction' OR
  (proposal_id IS NOT NULL AND proposal_version_id IS NOT NULL)
);

UPDATE tasks t
SET task_type='proposal_correction',
    proposal_id=p.id,
    proposal_version_id=v.id
FROM proposals p
JOIN proposal_versions v ON v.proposal_id=p.id
WHERE t.task_type='general'
  AND t.lead_id=p.lead_id
  AND t.assignee_id=v.created_by
  AND t.created_by=v.reviewed_by
  AND t.details=v.review_comment
  AND v.status='changes_requested'
  AND t.subject LIKE 'Revise ' || p.proposal_number || '%';

CREATE INDEX IF NOT EXISTS tasks_proposal_correction_idx
  ON tasks(proposal_id,proposal_version_id,status)
  WHERE task_type='proposal_correction';
