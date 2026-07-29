-- Release 2.6: every Opportunity starts from a qualified Lead and inherits governed Inventory attribution.

ALTER TABLE listings
  ADD COLUMN originating_agent_id UUID REFERENCES brokers(id);

UPDATE listings
SET originating_agent_id=responsible_agent_id
WHERE originating_agent_id IS NULL;

ALTER TABLE listings
  ALTER COLUMN originating_agent_id SET NOT NULL;

CREATE INDEX listings_originating_agent_idx
  ON listings(originating_agent_id,status,workflow_status);

ALTER TABLE opportunities
  ADD COLUMN buyer_commission_percent NUMERIC(7,4)
    CHECK (buyer_commission_percent BETWEEN 0 AND 100),
  ADD COLUMN buyer_commission_minimum NUMERIC(18,2)
    CHECK (buyer_commission_minimum >= 0),
  ADD COLUMN seller_commission_percent NUMERIC(7,4)
    CHECK (seller_commission_percent BETWEEN 0 AND 100),
  ADD COLUMN seller_commission_minimum NUMERIC(18,2)
    CHECK (seller_commission_minimum >= 0),
  ADD COLUMN originating_agent_split_percent NUMERIC(7,4)
    CHECK (originating_agent_split_percent BETWEEN 0 AND 100),
  ADD COLUMN servicing_agent_split_percent NUMERIC(7,4)
    CHECK (servicing_agent_split_percent BETWEEN 0 AND 100);

ALTER TABLE opportunities
  ADD CONSTRAINT opportunities_internal_split_total_ck CHECK (
    originating_agent_split_percent IS NULL OR servicing_agent_split_percent IS NULL OR
    originating_agent_split_percent + servicing_agent_split_percent = 100
  );

GRANT SELECT,UPDATE (originating_agent_id) ON listings TO nysareal_nysar2app;

INSERT INTO schema_migrations(version)
VALUES ('058_release26_lead_first_representation.sql')
ON CONFLICT(version) DO NOTHING;
