CREATE TABLE external_portal_permit_evidence_versions (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  portal_code TEXT NOT NULL CHECK (portal_code IN ('property_finder','bayut','dubizzle')),
  compliance_type TEXT NOT NULL CHECK (compliance_type IN ('rera','trakheesi','madhmoun')),
  permit_number TEXT NOT NULL,
  issuing_company_license_number TEXT NOT NULL,
  property_reference TEXT NOT NULL,
  advertising_purpose TEXT NOT NULL CHECK (advertising_purpose IN ('sale','rent')),
  permitted_property_type TEXT NOT NULL,
  permitted_location TEXT NOT NULL,
  permitted_price NUMERIC(18,2) NOT NULL CHECK (permitted_price>0),
  currency CHAR(3) NOT NULL CHECK (currency=UPPER(currency)),
  advertising_copy TEXT NOT NULL,
  permit_expires_at TIMESTAMPTZ,
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('application/pdf','image/jpeg','image/png')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes>0),
  storage_key TEXT NOT NULL,
  file_hash CHAR(64) NOT NULL,
  facts_snapshot JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(listing_id,portal_code,permit_number,file_hash)
);

CREATE INDEX external_portal_permit_evidence_listing_idx
  ON external_portal_permit_evidence_versions(listing_id,portal_code,created_at DESC);

CREATE TRIGGER external_portal_permit_evidence_versions_immutable
  BEFORE UPDATE OR DELETE ON external_portal_permit_evidence_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT,INSERT ON external_portal_permit_evidence_versions TO nysareal_nysar2app;
