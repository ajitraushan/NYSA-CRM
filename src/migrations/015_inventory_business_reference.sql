CREATE SEQUENCE IF NOT EXISTS listing_inventory_reference_seq START WITH 1;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS inventory_reference TEXT;

UPDATE listings
SET inventory_reference = 'NYSA-INV-' || LPAD(nextval('listing_inventory_reference_seq')::TEXT, 6, '0')
WHERE inventory_reference IS NULL;

ALTER TABLE listings
  ALTER COLUMN inventory_reference SET DEFAULT
    ('NYSA-INV-' || LPAD(nextval('listing_inventory_reference_seq')::TEXT, 6, '0')),
  ALTER COLUMN inventory_reference SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS listings_inventory_reference_uq
  ON listings(inventory_reference);
