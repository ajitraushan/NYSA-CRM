-- DEV214: Off-plan developer stock is opportunity evidence, not maintained NYSA Inventory.
-- It becomes a Sold Inventory record only after authoritative Closed Won.

ALTER TABLE provisional_external_properties
  ADD COLUMN usage_kind TEXT NOT NULL DEFAULT 'external_cobroker'
    CHECK (usage_kind IN ('external_cobroker','developer_stock')),
  ADD COLUMN developer_name TEXT,
  ADD COLUMN community_or_area TEXT;

ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_property_source_check;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_property_source_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_property_source_ck
  CHECK (property_source IN ('nysa_inventory','external_cobroker','developer_stock'));

ALTER TABLE deal_inventory_linkages DROP CONSTRAINT IF EXISTS deal_inventory_linkages_change_kind_check;
ALTER TABLE deal_inventory_linkages ADD CONSTRAINT deal_inventory_linkages_change_kind_check
  CHECK (change_kind IN ('backfill','attached','replaced','booking_switched','detached','developer_stock_attached'));

ALTER TABLE deal_inventory_linkages DROP CONSTRAINT IF EXISTS deal_inventory_linkages_check;
ALTER TABLE deal_inventory_linkages ADD CONSTRAINT deal_inventory_linkages_check CHECK (
  (change_kind='detached' AND assignment_id IS NULL AND listing_id IS NULL AND external_property_id IS NULL
    AND offer_id IS NULL AND accepted_offer_revision_id IS NULL AND booking_id IS NULL)
  OR (change_kind='developer_stock_attached' AND assignment_id IS NULL AND listing_id IS NULL
    AND external_property_id IS NOT NULL AND offer_id IS NOT NULL
    AND accepted_offer_revision_id IS NOT NULL AND booking_id IS NULL)
  OR (change_kind NOT IN ('detached','developer_stock_attached')
    AND num_nonnulls(listing_id,external_property_id)=1
    AND (listing_id IS NULL OR assignment_id IS NOT NULL)
    AND offer_id IS NOT NULL AND accepted_offer_revision_id IS NOT NULL AND booking_id IS NOT NULL)
);

CREATE UNIQUE INDEX provisional_external_properties_open_developer_stock_uq
  ON provisional_external_properties(LOWER(developer_name),LOWER(project_or_building),LOWER(property_address))
  WHERE usage_kind='developer_stock' AND status NOT IN ('closed','rejected');

GRANT SELECT,INSERT,UPDATE ON provisional_external_properties TO nysareal_nysar2app;
