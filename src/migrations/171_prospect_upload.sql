-- Extend Prospect Diary to record email-only prospects and upload provenance.
CREATE TABLE prospect_upload_batches (
  id UUID PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES brokers(id),
  owner_id UUID NOT NULL REFERENCES brokers(id),
  file_name TEXT NOT NULL,
  file_sha256 TEXT NOT NULL CHECK(file_sha256 ~ '^[0-9a-f]{64}$'),
  status_counts JSONB NOT NULL,
  skipped_rows JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prospects
  ADD COLUMN upload_batch_id UUID REFERENCES prospect_upload_batches(id),
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN normalized_phone DROP NOT NULL,
  DROP CONSTRAINT prospects_source_check,
  ADD CONSTRAINT prospects_source_check CHECK(source IN(
    'cold_call','referral','event','personal_network','purchased_data','other',
    'diary','notebook','whatsapp','rem')),
  ADD CONSTRAINT prospects_contact_identity_check CHECK(
    (phone IS NULL) = (normalized_phone IS NULL)
    AND (normalized_phone IS NOT NULL OR normalized_email IS NOT NULL)
    AND (normalized_phone IS NOT NULL OR upload_batch_id IS NOT NULL));
CREATE INDEX prospects_upload_batch_idx ON prospects(upload_batch_id) WHERE upload_batch_id IS NOT NULL;

ALTER TABLE prospect_activities
  DROP CONSTRAINT prospect_activities_notes_check,
  ADD CONSTRAINT prospect_activities_notes_check CHECK(
    length(btrim(notes)) >= CASE WHEN activity_type='note' THEN 1 ELSE 2 END);
