ALTER TABLE listings
  ADD COLUMN area_id UUID REFERENCES areas(id),
  ADD COLUMN community TEXT;

UPDATE listings l
SET area_id = a.id
FROM areas a
WHERE l.area_id IS NULL
  AND a.active = 1
  AND LOWER(a.business_label) = LOWER(l.area);

CREATE INDEX listings_area_id_idx ON listings(area_id);
CREATE INDEX listings_community_lower_idx ON listings(LOWER(community));

CREATE TABLE listing_units (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  unit_reference TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('Apartment','Villa','Townhouse','Penthouse','Duplex','Plot')),
  bedrooms TEXT CHECK (bedrooms IN ('Studio','1','2','3','4','5+')),
  size_sqft NUMERIC(14,2) NOT NULL CHECK (size_sqft > 0),
  price NUMERIC(16,2) NOT NULL CHECK (price > 0),
  display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, unit_reference),
  CHECK ((property_type = 'Plot' AND bedrooms IS NULL) OR (property_type <> 'Plot' AND bedrooms IS NOT NULL))
);

CREATE INDEX listing_units_listing_idx ON listing_units(listing_id,display_order,created_at);
