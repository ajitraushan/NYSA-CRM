ALTER TABLE property_media
  ADD COLUMN usage_rights_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN rights_basis TEXT,
  ADD COLUMN rights_expires_at TIMESTAMPTZ,
  ADD COLUMN is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN rejection_reason TEXT;

ALTER TABLE property_media
  ADD CONSTRAINT property_media_rights_basis_check CHECK (
    rights_basis IS NULL OR rights_basis IN (
      'owner_authorized',
      'developer_authorized',
      'agency_authorized',
      'documented_other',
      'legacy_approved'
    )
  );

UPDATE property_media
SET usage_rights_confirmed=TRUE,
    rights_basis='legacy_approved'
WHERE approval_status='approved';

CREATE UNIQUE INDEX property_media_one_cover_idx
  ON property_media(listing_id)
  WHERE is_cover=TRUE;

CREATE INDEX property_media_rights_review_idx
  ON property_media(listing_id,approval_status,rights_expires_at,display_order);
