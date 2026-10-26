-- UAT-037: formal Inventory assignment and versioned Deal linkage.
-- Property matches remain discovery evidence and are deliberately unchanged.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('Available','Assigned','Reserved','Under offer','Closed','Sold','Rented'));

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_inventory_status_before_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_inventory_status_before_check CHECK (
  inventory_status_before IN ('Available','Assigned','Under offer','approved_for_opportunity','under_offer')
);

CREATE TABLE inventory_assignments (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  property_match_id UUID NOT NULL REFERENCES property_matches(id),
  predecessor_assignment_id UUID REFERENCES inventory_assignments(id),
  state TEXT NOT NULL DEFAULT 'active'
    CHECK (state IN ('active','expired','delinked','replaced','closed')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '7 days'),
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at>starts_at),
  CHECK ((state='active' AND ended_at IS NULL AND end_reason IS NULL)
    OR (state<>'active' AND ended_at IS NOT NULL AND end_reason IS NOT NULL))
);
CREATE UNIQUE INDEX inventory_assignments_active_opportunity_listing_uq
  ON inventory_assignments(opportunity_id,listing_id) WHERE state='active';
CREATE INDEX inventory_assignments_listing_lifecycle_idx
  ON inventory_assignments(listing_id,state,expires_at DESC,created_at DESC);
CREATE INDEX inventory_assignments_opportunity_lifecycle_idx
  ON inventory_assignments(opportunity_id,state,expires_at DESC,created_at DESC);

CREATE TABLE inventory_assignment_events (
  id UUID PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES inventory_assignments(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created','expired','expiry_changed','delinked','replaced','closed','reservation_won','reservation_released'
  )),
  reason TEXT NOT NULL,
  actor_id UUID REFERENCES brokers(id),
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX inventory_assignment_events_assignment_idx
  ON inventory_assignment_events(assignment_id,occurred_at DESC,id DESC);
CREATE TRIGGER inventory_assignment_events_immutable
  BEFORE UPDATE OR DELETE ON inventory_assignment_events
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

CREATE TABLE inventory_assignment_expiry_changes (
  id UUID PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES inventory_assignments(id),
  previous_expires_at TIMESTAMPTZ NOT NULL,
  approved_expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL CHECK (LENGTH(BTRIM(reason))>=10),
  approved_by UUID NOT NULL REFERENCES brokers(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (approved_expires_at<>previous_expires_at)
);
CREATE INDEX inventory_assignment_expiry_changes_assignment_idx
  ON inventory_assignment_expiry_changes(assignment_id,approved_at DESC,id DESC);
CREATE TRIGGER inventory_assignment_expiry_changes_immutable
  BEFORE UPDATE OR DELETE ON inventory_assignment_expiry_changes
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- Only existing selections with clear user/transaction commitment are formalized.
INSERT INTO inventory_assignments(
  id,opportunity_id,listing_id,property_match_id,starts_at,expires_at,created_by,created_at
)
SELECT md5('dev153-assignment:'||pm.id::text)::uuid,pm.opportunity_id,pm.listing_id,pm.id,
  pm.created_at,NOW()+INTERVAL '7 days',pm.created_by,pm.created_at
FROM property_matches pm
WHERE pm.listing_id IS NOT NULL AND pm.shortlist_status<>'rejected'
  AND (pm.shortlist_status='shortlisted'
    OR EXISTS(SELECT 1 FROM offers f WHERE f.opportunity_id=pm.opportunity_id AND f.listing_id=pm.listing_id)
    OR EXISTS(SELECT 1 FROM opportunities o WHERE o.id=pm.opportunity_id AND o.listing_id=pm.listing_id));

INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data,occurred_at)
SELECT md5('dev153-assignment-event:'||a.id::text)::uuid,a.id,'created',
  'Existing explicit Inventory selection formalized during dev.153 migration',a.created_by,
  jsonb_build_object('migration','099_dev153_inventory_assignment_lifecycle'),a.created_at
FROM inventory_assignments a;

CREATE OR REPLACE FUNCTION nysa_inventory_effective_status(target_listing_id UUID)
RETURNS TEXT AS $$
DECLARE master_status TEXT;
BEGIN
  SELECT status INTO master_status FROM listings WHERE id=target_listing_id;
  IF master_status IN ('Sold','Rented','Closed') THEN RETURN master_status; END IF;
  IF EXISTS(SELECT 1 FROM bookings WHERE listing_id=target_listing_id AND status='reserved' AND expires_at>NOW())
    THEN RETURN 'Reserved';
  END IF;
  IF EXISTS(SELECT 1 FROM inventory_assignments WHERE listing_id=target_listing_id
      AND state='active' AND starts_at<=NOW() AND expires_at>NOW())
    THEN RETURN 'Assigned';
  END IF;
  RETURN 'Available';
END;
$$ LANGUAGE plpgsql STABLE;

INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
SELECT md5('dev153-under-offer-history:'||id::text)::uuid,'Listing',id,'legacy_under_offer_migrated',posted_by,
  jsonb_build_object('fromStatus','Under offer','toStatus',nysa_inventory_effective_status(id),
    'migration','099_dev153_inventory_assignment_lifecycle','preservedAsImmutableHistory',TRUE)::text
FROM listings WHERE status='Under offer'
ON CONFLICT(id) DO NOTHING;

UPDATE listings SET status=nysa_inventory_effective_status(id),updated_at=NOW()
WHERE status='Under offer';

-- Historical successful Deals used Closed for both transaction outcomes.
UPDATE listings l SET status=CASE WHEN d.deal_type IN ('rental','commercial_rental') THEN 'Rented' ELSE 'Sold' END,
  closed_reason=CASE WHEN d.deal_type IN ('rental','commercial_rental') THEN 'Rented' ELSE 'Sold' END,updated_at=NOW()
FROM deals d WHERE d.listing_id=l.id AND d.status='closed_won' AND l.status='Closed';

-- Non-terminal status is derived from assignments and reservations; keep only a neutral stored fallback.
UPDATE listings SET status='Available',updated_at=NOW() WHERE status IN ('Assigned','Reserved','Under offer');

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_status_check;
ALTER TABLE listings ADD CONSTRAINT listings_status_check
  CHECK (status IN ('Available','Closed','Sold','Rented'));

-- Existing direct Deal pointers become enforced compatibility mirrors.
ALTER TABLE deals ALTER COLUMN booking_id DROP NOT NULL;
ALTER TABLE deals ALTER COLUMN listing_id DROP NOT NULL;
ALTER TABLE deals ALTER COLUMN offer_id DROP NOT NULL;
ALTER TABLE deals ALTER COLUMN accepted_offer_revision_id DROP NOT NULL;

CREATE TABLE deal_inventory_linkages (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  assignment_id UUID REFERENCES inventory_assignments(id),
  listing_id UUID REFERENCES listings(id),
  external_property_id UUID REFERENCES provisional_external_properties(id),
  offer_id UUID REFERENCES offers(id),
  accepted_offer_revision_id UUID REFERENCES offer_revisions(id),
  booking_id UUID REFERENCES bookings(id),
  predecessor_linkage_id UUID REFERENCES deal_inventory_linkages(id),
  change_kind TEXT NOT NULL CHECK (change_kind IN ('backfill','attached','replaced','booking_switched','detached')),
  reason TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((change_kind='detached' AND assignment_id IS NULL AND listing_id IS NULL AND external_property_id IS NULL AND offer_id IS NULL
      AND accepted_offer_revision_id IS NULL AND booking_id IS NULL)
    OR (change_kind<>'detached' AND num_nonnulls(listing_id,external_property_id)=1
      AND (listing_id IS NULL OR assignment_id IS NOT NULL)
      AND offer_id IS NOT NULL AND accepted_offer_revision_id IS NOT NULL AND booking_id IS NOT NULL))
);
CREATE INDEX deal_inventory_linkages_deal_idx
  ON deal_inventory_linkages(deal_id,created_at DESC,id DESC);
CREATE TRIGGER deal_inventory_linkages_immutable
  BEFORE UPDATE OR DELETE ON deal_inventory_linkages
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

ALTER TABLE deals ADD COLUMN current_inventory_linkage_id UUID REFERENCES deal_inventory_linkages(id);

-- Backfill exact Deal lineage, creating a formal Assignment only where one is absent.
-- Legacy Deals may predate the explicit matching row. Preserve that fact as
-- migration evidence rather than leaving their authoritative linkage incomplete.
INSERT INTO property_matches(
  id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,exceptions,
  shortlist_status,shortlisted_at,created_by,created_at,updated_by,updated_at
)
SELECT md5('dev153-deal-match:'||d.id::text)::uuid,d.opportunity_id,NULL,d.listing_id,'manual','exception',
  'Legacy Deal Inventory selection formalized during dev.153 migration',
  'The Deal predates an explicit property-match record','shortlisted',d.created_at,d.created_by,d.created_at,d.created_by,d.created_at
FROM deals d
WHERE d.listing_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM property_matches pm
  WHERE pm.opportunity_id=d.opportunity_id AND pm.listing_id=d.listing_id)
ON CONFLICT(opportunity_id,listing_id) DO NOTHING;

INSERT INTO inventory_assignments(id,opportunity_id,listing_id,property_match_id,starts_at,expires_at,created_by,created_at)
SELECT md5('dev153-deal-assignment:'||d.id::text)::uuid,d.opportunity_id,d.listing_id,pm.id,
  d.created_at,GREATEST(COALESCE(b.expires_at,NOW()+INTERVAL '7 days'),NOW()+INTERVAL '7 days'),d.created_by,d.created_at
FROM deals d JOIN bookings b ON b.id=d.booking_id
JOIN LATERAL (SELECT candidate.id FROM property_matches candidate
  WHERE candidate.opportunity_id=d.opportunity_id AND candidate.listing_id=d.listing_id
  ORDER BY candidate.created_at DESC LIMIT 1) pm ON TRUE
WHERE d.listing_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_assignments a
  WHERE a.opportunity_id=d.opportunity_id AND a.listing_id=d.listing_id AND a.state='active');

INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data,occurred_at)
SELECT md5('dev153-deal-assignment-event:'||a.id::text)::uuid,a.id,'created',
  'Existing Deal Inventory linkage formalized during dev.153 migration',a.created_by,
  jsonb_build_object('migration','099_dev153_inventory_assignment_lifecycle'),a.created_at
FROM inventory_assignments a
WHERE NOT EXISTS(SELECT 1 FROM inventory_assignment_events e WHERE e.assignment_id=a.id);

-- Terminal historical Inventory cannot retain an apparently active assignment.
WITH terminal_assignments AS (
  UPDATE inventory_assignments a SET state='closed',
    ended_at=COALESCE((SELECT MAX(d.closed_at) FROM deals d
      WHERE d.opportunity_id=a.opportunity_id AND d.listing_id=a.listing_id
        AND d.status IN ('closed_won','closed_lost')),NOW()),
    end_reason='Historical terminal Deal formalized during dev.153 migration'
  FROM listings l
  WHERE l.id=a.listing_id AND a.state='active' AND l.status IN ('Sold','Rented','Closed')
  RETURNING a.*
)
INSERT INTO inventory_assignment_events(id,assignment_id,event_type,reason,actor_id,event_data,occurred_at)
SELECT md5('dev153-terminal-assignment-event:'||a.id::text)::uuid,a.id,'closed',a.end_reason,a.created_by,
  jsonb_build_object('migration','099_dev153_inventory_assignment_lifecycle'),a.ended_at
FROM terminal_assignments a;

INSERT INTO deal_inventory_linkages(
  id,deal_id,opportunity_id,assignment_id,listing_id,external_property_id,offer_id,accepted_offer_revision_id,booking_id,
  change_kind,reason,created_by,created_at
)
SELECT md5('dev153-deal-linkage:'||d.id::text)::uuid,d.id,d.opportunity_id,a.id,d.listing_id,d.external_property_id,d.offer_id,
  d.accepted_offer_revision_id,d.booking_id,'backfill','Existing Deal lineage formalized during dev.153 migration',d.created_by,d.created_at
FROM deals d LEFT JOIN LATERAL (SELECT candidate.id FROM inventory_assignments candidate
  WHERE candidate.opportunity_id=d.opportunity_id AND candidate.listing_id=d.listing_id
  ORDER BY candidate.created_at DESC LIMIT 1) a ON TRUE
WHERE d.listing_id IS NOT NULL OR d.external_property_id IS NOT NULL;

UPDATE deals d SET current_inventory_linkage_id=l.id
FROM deal_inventory_linkages l WHERE l.deal_id=d.id AND l.change_kind='backfill';

CREATE OR REPLACE FUNCTION enforce_deal_current_inventory_linkage()
RETURNS trigger AS $$
DECLARE current_link deal_inventory_linkages%ROWTYPE;
BEGIN
  IF NEW.current_inventory_linkage_id IS NULL THEN
    IF NEW.listing_id IS NOT NULL OR NEW.external_property_id IS NOT NULL OR NEW.offer_id IS NOT NULL OR NEW.accepted_offer_revision_id IS NOT NULL OR NEW.booking_id IS NOT NULL THEN
      RAISE EXCEPTION 'Deal direct Inventory pointers require a current linkage';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO current_link FROM deal_inventory_linkages WHERE id=NEW.current_inventory_linkage_id;
  IF NOT FOUND OR current_link.deal_id<>NEW.id OR current_link.opportunity_id<>NEW.opportunity_id THEN
    RAISE EXCEPTION 'Deal current Inventory linkage does not belong to this Deal and Opportunity';
  END IF;
  IF NEW.listing_id IS DISTINCT FROM current_link.listing_id
    OR NEW.external_property_id IS DISTINCT FROM current_link.external_property_id
    OR NEW.offer_id IS DISTINCT FROM current_link.offer_id
    OR NEW.accepted_offer_revision_id IS DISTINCT FROM current_link.accepted_offer_revision_id
    OR NEW.booking_id IS DISTINCT FROM current_link.booking_id THEN
    RAISE EXCEPTION 'Deal direct Inventory pointers must mirror the authoritative current linkage';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER deals_current_inventory_linkage_consistency
  AFTER INSERT OR UPDATE OF current_inventory_linkage_id,listing_id,external_property_id,offer_id,accepted_offer_revision_id,booking_id
  ON deals DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_deal_current_inventory_linkage();

-- Already present from migration 061; repeated idempotently as part of this contract.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS predecessor_offer_id UUID REFERENCES offers(id);
CREATE INDEX IF NOT EXISTS offers_predecessor_idx ON offers(predecessor_offer_id);

GRANT SELECT,INSERT,UPDATE ON inventory_assignments TO nysareal_nysar2app;
GRANT SELECT,INSERT ON inventory_assignment_events,inventory_assignment_expiry_changes,deal_inventory_linkages TO nysareal_nysar2app;
