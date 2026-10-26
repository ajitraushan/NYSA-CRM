ALTER TABLE property_media
  ADD COLUMN derived_from_media_id UUID REFERENCES property_media(id) ON DELETE RESTRICT,
  ADD COLUMN derivative_purpose TEXT,
  ADD COLUMN derivative_transform JSONB;

ALTER TABLE property_media
  ADD CONSTRAINT property_media_derivative_purpose_check CHECK (
    derivative_purpose IS NULL OR derivative_purpose IN ('property_finder_portal_ready')
  ),
  ADD CONSTRAINT property_media_derivative_consistency_check CHECK (
    (derived_from_media_id IS NULL AND derivative_purpose IS NULL AND derivative_transform IS NULL)
    OR
    (derived_from_media_id IS NOT NULL AND derivative_purpose IS NOT NULL AND derivative_transform IS NOT NULL)
  );

CREATE INDEX property_media_derivative_source_idx
  ON property_media(derived_from_media_id,created_at)
  WHERE derived_from_media_id IS NOT NULL;
