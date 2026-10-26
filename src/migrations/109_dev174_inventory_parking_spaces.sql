-- DEF-103: make proposal parking an authoritative Inventory specification.
-- Existing records remain unknown; no value is inferred or backfilled.
ALTER TABLE listings
  ADD COLUMN parking_spaces INTEGER;

ALTER TABLE listings
  ADD CONSTRAINT listings_parking_spaces_nonnegative_ck
  CHECK (parking_spaces IS NULL OR parking_spaces >= 0);
