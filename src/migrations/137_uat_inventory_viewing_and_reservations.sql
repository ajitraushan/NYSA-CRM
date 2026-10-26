-- ENH-005: exact Inventory configurations and approved fractional Customer/Lead requirements.
ALTER TABLE listings DROP CONSTRAINT listings_bedrooms_check;
ALTER TABLE listings ADD CONSTRAINT listings_bedrooms_check
  CHECK (bedrooms IN ('Studio','1','1.5','2','2.5','3','4','5+'));
ALTER TABLE listing_units DROP CONSTRAINT listing_units_bedrooms_check;
ALTER TABLE listing_units ADD CONSTRAINT listing_units_bedrooms_check
  CHECK (bedrooms IN ('Studio','1','1.5','2','2.5','3','4','5+'));
ALTER TABLE lead_requirements ALTER COLUMN bedrooms_min TYPE NUMERIC USING bedrooms_min::numeric;
ALTER TABLE lead_requirements ALTER COLUMN bedrooms_max TYPE NUMERIC USING bedrooms_max::numeric;

-- ENH-006: preserve historical null decisions; future completions are validated by the API.
ALTER TABLE viewings ADD COLUMN customer_next_decision TEXT
  CHECK (customer_next_decision IN ('more_viewings_required','ready_for_offer','not_proceeding','undecided'));

-- ENH-007: retain all historical evidence, permitting evidence-free new reservations.
ALTER TABLE bookings ALTER COLUMN evidence_document_version_id DROP NOT NULL;
