ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check
  CHECK (status IN ('draft','generated','changes_requested','reviewed','sent','retired'));

ALTER TABLE proposal_versions DROP CONSTRAINT IF EXISTS proposal_versions_status_check;
ALTER TABLE proposal_versions ADD CONSTRAINT proposal_versions_status_check
  CHECK (status IN ('generated','changes_requested','reviewed','sent'));

ALTER TABLE proposal_versions ADD COLUMN review_decision TEXT
  CHECK (review_decision IS NULL OR review_decision IN ('approved','changes_requested'));
ALTER TABLE proposal_versions ADD COLUMN review_comment TEXT;

UPDATE proposal_versions
SET review_decision='approved'
WHERE status IN ('reviewed','sent') AND review_decision IS NULL;

CREATE INDEX proposal_versions_changes_requested_idx
  ON proposal_versions(created_by, reviewed_at DESC)
  WHERE status='changes_requested';
