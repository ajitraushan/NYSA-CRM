ALTER TABLE listings
  ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (workflow_status IN ('draft','in_review','approved','changes_requested','blocked')),
  ADD COLUMN submitted_at TIMESTAMPTZ,
  ADD COLUMN submitted_by UUID REFERENCES brokers(id),
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN reviewed_by UUID REFERENCES brokers(id),
  ADD COLUMN review_comment TEXT,
  ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'manual'
    CHECK (source_kind IN ('manual','import','integration'));

CREATE INDEX listings_workflow_owner_idx
  ON listings(posted_by,workflow_status,updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX listings_workflow_review_idx
  ON listings(workflow_status,updated_at DESC)
  WHERE deleted_at IS NULL AND workflow_status IN ('in_review','changes_requested','blocked');
