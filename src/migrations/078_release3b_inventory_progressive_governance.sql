CREATE TABLE inventory_agent_assignment_history (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  originating_agent_id UUID NOT NULL REFERENCES brokers(id),
  from_responsible_agent_id UUID REFERENCES brokers(id),
  to_responsible_agent_id UUID NOT NULL REFERENCES brokers(id),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('historical','manual','import','integration','reassignment')),
  source_reference TEXT,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_agent_assignment_history_listing_idx
  ON inventory_agent_assignment_history(listing_id,changed_at DESC);

INSERT INTO inventory_agent_assignment_history(
  id,listing_id,originating_agent_id,to_responsible_agent_id,source_kind,source_reference,reason,changed_by,changed_at
)
SELECT md5('r3b-inventory-attribution:' || l.id::text)::uuid,l.id,l.originating_agent_id,l.responsible_agent_id,
  'historical',COALESCE(l.external_record_id,l.contact),'Historical Inventory attribution snapshot retained at Release 3B boundary separation',
  l.posted_by,l.created_at
FROM listings l
WHERE NOT EXISTS (SELECT 1 FROM inventory_agent_assignment_history h WHERE h.listing_id=l.id);

CREATE TRIGGER inventory_agent_assignment_history_immutable
  BEFORE UPDATE OR DELETE ON inventory_agent_assignment_history
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT,INSERT ON inventory_agent_assignment_history TO nysareal_nysar2app;
