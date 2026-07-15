ALTER TABLE organization_settings DROP CONSTRAINT organization_settings_status_check;
ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_status_check
  CHECK (status IN ('draft','approved','active','retired'));

ALTER TABLE organization_settings ADD COLUMN approval_reason TEXT;
ALTER TABLE organization_settings ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE organization_settings ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE organization_settings ADD COLUMN logo_file_name TEXT;
ALTER TABLE organization_settings ADD COLUMN logo_media_type TEXT;
ALTER TABLE organization_settings ADD COLUMN logo_file_size_bytes BIGINT;
ALTER TABLE organization_settings ADD COLUMN logo_storage_key TEXT;
ALTER TABLE organization_settings ADD COLUMN logo_file_hash TEXT;

ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_logo_type_check
  CHECK (logo_media_type IS NULL OR logo_media_type IN ('image/jpeg','image/png','image/webp'));
ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_logo_size_check
  CHECK (logo_file_size_bytes IS NULL OR logo_file_size_bytes > 0);
UPDATE organization_settings
SET approved_at=COALESCE(approved_at,effective_from),
    approved_by=COALESCE(approved_by,created_by),
    approval_reason=COALESCE(approval_reason,'Legacy active version migrated into governed workflow')
WHERE status='active';

ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_approval_check
  CHECK (status NOT IN ('approved','active') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND approval_reason IS NOT NULL));
