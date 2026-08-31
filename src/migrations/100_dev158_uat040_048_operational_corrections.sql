-- dev.158: corporate Developer governance and explicit Inventory availability expiry.

ALTER TABLE partner_organization_versions
  ADD COLUMN IF NOT EXISTS legal_structure TEXT
    CHECK (legal_structure IN ('listed_company','private_company','sole_establishment','partnership','government_entity','other'));

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS availability_expires_at TIMESTAMPTZ;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_availability_window_check;
ALTER TABLE listings ADD CONSTRAINT listings_availability_window_check
  CHECK (availability_expires_at IS NULL OR availability_confirmed_at IS NULL OR availability_expires_at>availability_confirmed_at);

CREATE INDEX IF NOT EXISTS listings_availability_expiry_idx
  ON listings(availability_expires_at) WHERE deleted_at IS NULL AND availability_expires_at IS NOT NULL;

-- The original independent-review constraint prevented the approved authority
-- roles from activating a Developer version they had just created. Remove only
-- that specific cross-actor check; actor and decision evidence remain audited.
DO $$
DECLARE constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid='partner_organization_versions'::regclass
    AND contype='c'
    AND pg_get_constraintdef(oid) ILIKE '%verified_by%created_by%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE partner_organization_versions DROP CONSTRAINT %I',constraint_name);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_partner_organization_fact_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.company_id,NEW.version_number,NEW.policy_version,NEW.classification,NEW.legal_structure,NEW.legal_name,NEW.normalized_legal_name,NEW.trade_name,
    NEW.licence_reference,NEW.normalized_licence_reference,NEW.licence_issuer,NEW.licence_expires_at,NEW.licence_evidence_status,
    NEW.source_evidence_reference,NEW.source_evidence_sha256,NEW.supersedes_version_id,NEW.created_by,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.company_id,OLD.version_number,OLD.policy_version,OLD.classification,OLD.legal_structure,OLD.legal_name,OLD.normalized_legal_name,OLD.trade_name,
    OLD.licence_reference,OLD.normalized_licence_reference,OLD.licence_issuer,OLD.licence_expires_at,OLD.licence_evidence_status,
    OLD.source_evidence_reference,OLD.source_evidence_sha256,OLD.supersedes_version_id,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'Governed organization version facts are immutable';
  END IF;
  RETURN NEW;
END $$;

GRANT SELECT,UPDATE ON listings TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON partner_organization_versions TO nysareal_nysar2app;
