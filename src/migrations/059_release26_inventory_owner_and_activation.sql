-- Release 2.6 intermediate: one Inventory control and Customer-linked ownership.

ALTER TABLE listings ADD COLUMN inventory_headline TEXT;
UPDATE listings SET inventory_headline=project WHERE inventory_headline IS NULL;
ALTER TABLE listings ALTER COLUMN inventory_headline SET NOT NULL;

ALTER TABLE inventory_counterparties
  ADD COLUMN contact_id UUID REFERENCES contacts(id),
  ADD COLUMN identity_snapshot JSONB;

CREATE INDEX inventory_counterparties_contact_idx
  ON inventory_counterparties(contact_id,listing_id);

UPDATE listings
SET workflow_status=CASE
  WHEN verification_status IN ('verified','not_required') THEN 'approved'
  WHEN workflow_status='in_review' THEN 'draft'
  ELSE workflow_status
END,
review_comment=CASE
  WHEN verification_status IN ('verified','not_required')
    THEN 'Activated by the consolidated Inventory verification control'
  ELSE review_comment
END;

GRANT SELECT,INSERT,UPDATE ON listings TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON inventory_counterparties TO nysareal_nysar2app;

INSERT INTO schema_migrations(version)
VALUES ('059_release26_inventory_owner_and_activation.sql')
ON CONFLICT(version) DO NOTHING;
