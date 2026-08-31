CREATE TABLE external_portal_mapping_versions (
  id UUID PRIMARY KEY,
  portal_code TEXT NOT NULL CHECK (portal_code IN ('property_finder','bayut','dubizzle')),
  version_code TEXT NOT NULL,
  specification_reference TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','tested','approved','active','retired')),
  lifecycle_evidence TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  tested_by UUID REFERENCES brokers(id),
  approved_by UUID REFERENCES brokers(id),
  activated_by UUID REFERENCES brokers(id),
  retired_by UUID REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tested_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  UNIQUE(portal_code,version_code)
);

CREATE UNIQUE INDEX external_portal_mapping_one_active_uq
  ON external_portal_mapping_versions(portal_code) WHERE status='active';

CREATE TABLE external_portal_field_mappings (
  id UUID PRIMARY KEY,
  mapping_version_id UUID NOT NULL REFERENCES external_portal_mapping_versions(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  requirement_level TEXT NOT NULL CHECK (requirement_level IN ('required','conditional','optional')),
  transform_rule TEXT NOT NULL,
  condition_expression TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mapping_version_id,source_field)
);

CREATE TABLE external_listing_preparation_versions (
  id UUID PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES external_listing_publications(id),
  revision_number INTEGER NOT NULL CHECK (revision_number>0),
  mapping_version_id UUID REFERENCES external_portal_mapping_versions(id),
  source_inventory_snapshot JSONB NOT NULL,
  portal_fields JSONB NOT NULL,
  readiness_snapshot JSONB NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(publication_id,revision_number)
);

ALTER TABLE external_listing_publications
  ADD COLUMN current_preparation_version_id UUID REFERENCES external_listing_preparation_versions(id);

CREATE INDEX external_listing_preparation_publication_idx
  ON external_listing_preparation_versions(publication_id,revision_number DESC);
CREATE INDEX external_portal_field_mapping_version_idx
  ON external_portal_field_mappings(mapping_version_id,source_field);

CREATE TRIGGER external_listing_preparation_versions_immutable
  BEFORE UPDATE OR DELETE ON external_listing_preparation_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT,INSERT,UPDATE ON external_portal_mapping_versions TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE,DELETE ON external_portal_field_mappings TO nysareal_nysar2app;
GRANT SELECT,INSERT ON external_listing_preparation_versions TO nysareal_nysar2app;
