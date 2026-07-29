-- Release 2.6 hotfix: require an accountable NYSA agent on every new Inventory record.

ALTER TABLE listings
  ADD COLUMN responsible_agent_id UUID REFERENCES brokers(id);

UPDATE listings
SET responsible_agent_id=posted_by
WHERE responsible_agent_id IS NULL;

ALTER TABLE listings
  ALTER COLUMN responsible_agent_id SET NOT NULL;

CREATE INDEX listings_responsible_agent_idx
  ON listings(responsible_agent_id,status,workflow_status);

GRANT SELECT ON listings TO nysareal_nysar2app;
GRANT UPDATE (responsible_agent_id) ON listings TO nysareal_nysar2app;

INSERT INTO schema_migrations(version)
VALUES ('057_release26_inventory_ownership_capture.sql')
ON CONFLICT(version) DO NOTHING;
