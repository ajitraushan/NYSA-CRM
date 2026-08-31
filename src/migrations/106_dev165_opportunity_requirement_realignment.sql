-- UAT-082 through UAT-085: retain Property Match lineage when an Opportunity
-- is deliberately moved to a newer confirmed Requirement Version.

ALTER TABLE property_matches
  DROP CONSTRAINT IF EXISTS property_matches_opportunity_id_listing_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS property_matches_opportunity_requirement_listing_uq
  ON property_matches(opportunity_id,requirement_id,listing_id);
