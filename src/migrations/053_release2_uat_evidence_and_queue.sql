ALTER TABLE lead_requirements
  ADD COLUMN IF NOT EXISTS ai_conversation_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_reviewed_evidence JSONB,
  ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_reviewed_by UUID REFERENCES brokers(id);

CREATE INDEX IF NOT EXISTS contacts_pending_duplicate_manager_queue_idx
  ON contacts(owner_id,created_at)
  WHERE duplicate_review_status='pending' AND archived_at IS NULL;
