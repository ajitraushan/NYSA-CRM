-- R2.5 fully reconciled remediation foundation.

CREATE TABLE inventory_verification_requests (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('verification','exemption')),
  status TEXT NOT NULL CHECK (status IN ('pending','verified','returned','rejected','exempted')),
  evidence_reference TEXT,
  request_reason TEXT NOT NULL,
  submitted_by UUID NOT NULL REFERENCES brokers(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES brokers(id),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  prior_request_id UUID REFERENCES inventory_verification_requests(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (
    (status='pending' AND decided_by IS NULL AND decided_at IS NULL)
    OR
    (status<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL)
  )
);
CREATE UNIQUE INDEX inventory_verification_one_pending_uq
  ON inventory_verification_requests(listing_id) WHERE status='pending';
CREATE INDEX inventory_verification_queue_idx
  ON inventory_verification_requests(status,submitted_at);

ALTER TABLE listings
  ADD COLUMN current_verification_request_id UUID REFERENCES inventory_verification_requests(id),
  ADD COLUMN verification_decided_by UUID REFERENCES brokers(id),
  ADD COLUMN verification_decided_at TIMESTAMPTZ,
  ADD COLUMN verification_reason TEXT;

CREATE TABLE external_listing_publications (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  channel TEXT NOT NULL,
  external_reference TEXT,
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','published','paused','withdrawn','rejected')),
  evidence_reference TEXT,
  submitted_by UUID REFERENCES brokers(id),
  submitted_at TIMESTAMPTZ,
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  reason TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX external_listing_publications_listing_idx
  ON external_listing_publications(listing_id,created_at DESC);

CREATE TABLE lead_inventory_selections (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  selection_source TEXT NOT NULL DEFAULT 'lead'
    CHECK (selection_source IN ('enquiry','lead','value_brief','manual')),
  selected_by UUID NOT NULL REFERENCES brokers(id),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_by UUID REFERENCES brokers(id),
  removed_at TIMESTAMPTZ,
  removal_reason TEXT,
  UNIQUE(lead_id,listing_id,removed_at)
);
CREATE INDEX lead_inventory_active_idx
  ON lead_inventory_selections(lead_id,selected_at) WHERE removed_at IS NULL;
INSERT INTO lead_inventory_selections(id,lead_id,listing_id,selection_source,selected_by,selected_at)
SELECT gen_random_uuid(),l.id,l.listing_id,'enquiry',l.created_by,l.created_at
FROM leads l
WHERE l.listing_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lead_inventory_selections s
    WHERE s.lead_id=l.id AND s.listing_id=l.listing_id AND s.removed_at IS NULL
  );

ALTER TABLE viewings
  ADD COLUMN rescheduled_from_viewing_id UUID REFERENCES viewings(id),
  ADD COLUMN reschedule_reason TEXT;
CREATE UNIQUE INDEX viewing_single_direct_reschedule_uq
  ON viewings(rescheduled_from_viewing_id)
  WHERE rescheduled_from_viewing_id IS NOT NULL;

CREATE TABLE transaction_counterparties (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  party_type TEXT NOT NULL CHECK (party_type IN (
    'existing_customer','existing_contact','company','inventory_owner',
    'external_broker','external_agency','transaction_only'
  )),
  role TEXT NOT NULL CHECK (role IN (
    'buyer','seller','landlord','tenant','buyer_agent','seller_agent',
    'buyer_agency','seller_agency','referrer','other'
  )),
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  phone TEXT,
  email TEXT,
  represented_party TEXT,
  source TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  promoted_customer_id UUID REFERENCES contacts(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (party_type='existing_customer' AND contact_id IS NOT NULL)
    OR party_type<>'existing_customer'
  )
);

CREATE TABLE provisional_external_properties (
  id UUID PRIMARY KEY,
  external_reference TEXT NOT NULL UNIQUE,
  project_or_building TEXT NOT NULL,
  property_address TEXT NOT NULL,
  asking_price NUMERIC(18,2),
  currency TEXT NOT NULL DEFAULT 'AED',
  property_type TEXT,
  permit_reference TEXT,
  source TEXT NOT NULL,
  source_evidence TEXT NOT NULL,
  owner_counterparty_id UUID REFERENCES transaction_counterparties(id),
  seller_agent_counterparty_id UUID REFERENCES transaction_counterparties(id),
  seller_agency_counterparty_id UUID REFERENCES transaction_counterparties(id),
  status TEXT NOT NULL DEFAULT 'captured' CHECK (status IN (
    'captured','verification_pending','approved_for_opportunity',
    'under_offer','reserved','closed','rejected'
  )),
  verification_notes TEXT,
  verified_by UUID REFERENCES brokers(id),
  verified_at TIMESTAMPTZ,
  promoted_listing_id UUID REFERENCES listings(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE deal_parties
  ADD COLUMN transaction_counterparty_id UUID REFERENCES transaction_counterparties(id);
ALTER TABLE deal_parties DROP CONSTRAINT IF EXISTS deal_parties_check;
ALTER TABLE deal_parties ADD CONSTRAINT deal_parties_single_source_ck CHECK (
  (contact_id IS NOT NULL)::int + (company_id IS NOT NULL)::int +
  (transaction_counterparty_id IS NOT NULL)::int = 1
);
CREATE UNIQUE INDEX deal_parties_active_counterparty_role_uq
  ON deal_parties(deal_id,transaction_counterparty_id,party_role)
  WHERE effective_to IS NULL AND transaction_counterparty_id IS NOT NULL;

ALTER TABLE opportunities
  ADD COLUMN representation_path TEXT NOT NULL DEFAULT 'buyer'
    CHECK (representation_path IN ('buyer','inventory','dual')),
  ADD COLUMN property_source TEXT NOT NULL DEFAULT 'nysa_inventory'
    CHECK (property_source IN ('nysa_inventory','external_cobroker')),
  ADD COLUMN buyer_source TEXT NOT NULL DEFAULT 'nysa_customer'
    CHECK (buyer_source IN ('nysa_customer','external_buyer_agent')),
  ADD COLUMN external_property_id UUID REFERENCES provisional_external_properties(id),
  ADD COLUMN buyer_side_agent_id UUID REFERENCES brokers(id),
  ADD COLUMN inventory_side_agent_id UUID REFERENCES brokers(id),
  ADD COLUMN buyer_counterparty_id UUID REFERENCES transaction_counterparties(id),
  ADD COLUMN seller_counterparty_id UUID REFERENCES transaction_counterparties(id),
  ADD COLUMN buyer_agency_counterparty_id UUID REFERENCES transaction_counterparties(id),
  ADD COLUMN seller_agency_counterparty_id UUID REFERENCES transaction_counterparties(id),
  ADD COLUMN buyer_side_commission NUMERIC(18,2),
  ADD COLUMN seller_side_commission NUMERIC(18,2),
  ADD COLUMN interagency_split TEXT,
  ADD COLUMN internal_agent_split TEXT,
  ADD COLUMN referral_fee NUMERIC(18,2),
  ADD COLUMN authority_evidence TEXT,
  ADD COLUMN disclosure_evidence TEXT,
  ADD COLUMN representation_locked_at TIMESTAMPTZ;

ALTER TABLE opportunities
  ALTER COLUMN lead_id DROP NOT NULL,
  ALTER COLUMN contact_id DROP NOT NULL,
  ALTER COLUMN requirement_id DROP NOT NULL,
  ALTER COLUMN qualification_assessment_id DROP NOT NULL;
ALTER TABLE opportunity_attribution ALTER COLUMN originating_lead_id DROP NOT NULL;
ALTER TABLE property_matches ALTER COLUMN requirement_id DROP NOT NULL;
ALTER TABLE property_matches
  ALTER COLUMN listing_id DROP NOT NULL,
  ADD COLUMN external_property_id UUID REFERENCES provisional_external_properties(id);
ALTER TABLE property_matches ADD CONSTRAINT property_matches_single_property_ck CHECK (
  (listing_id IS NOT NULL)::int + (external_property_id IS NOT NULL)::int = 1
);
CREATE UNIQUE INDEX property_matches_opportunity_external_uq
  ON property_matches(opportunity_id,external_property_id)
  WHERE external_property_id IS NOT NULL;

ALTER TABLE viewings
  ALTER COLUMN listing_id DROP NOT NULL,
  ADD COLUMN external_property_id UUID REFERENCES provisional_external_properties(id);
ALTER TABLE viewings ADD CONSTRAINT viewings_single_property_ck CHECK (
  (listing_id IS NOT NULL)::int + (external_property_id IS NOT NULL)::int = 1
);

ALTER TABLE offers
  ALTER COLUMN listing_id DROP NOT NULL,
  ADD COLUMN external_property_id UUID REFERENCES provisional_external_properties(id);
ALTER TABLE offers ADD CONSTRAINT offers_single_property_ck CHECK (
  (listing_id IS NOT NULL)::int + (external_property_id IS NOT NULL)::int = 1
);
CREATE UNIQUE INDEX offers_active_opportunity_external_uq
  ON offers(opportunity_id,external_property_id,offer_type)
  WHERE status NOT IN ('rejected','expired','withdrawn') AND external_property_id IS NOT NULL;

ALTER TABLE bookings
  ALTER COLUMN listing_id DROP NOT NULL,
  ADD COLUMN external_property_id UUID REFERENCES provisional_external_properties(id);
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_inventory_status_before_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_inventory_status_before_check CHECK (
  inventory_status_before IN ('Available','Under offer','approved_for_opportunity','under_offer')
);
ALTER TABLE bookings ADD CONSTRAINT bookings_single_property_ck CHECK (
  (listing_id IS NOT NULL)::int + (external_property_id IS NOT NULL)::int = 1
);
CREATE UNIQUE INDEX bookings_active_external_property_uq
  ON bookings(external_property_id)
  WHERE status='reserved' AND external_property_id IS NOT NULL;

ALTER TABLE deals
  ALTER COLUMN listing_id DROP NOT NULL,
  ADD COLUMN external_property_id UUID REFERENCES provisional_external_properties(id);
ALTER TABLE deals ADD CONSTRAINT deals_single_property_ck CHECK (
  (listing_id IS NOT NULL)::int + (external_property_id IS NOT NULL)::int = 1
);

DROP INDEX IF EXISTS opportunities_open_listing_pursuit_uq;
DROP INDEX IF EXISTS opportunities_open_unselected_pursuit_uq;
CREATE UNIQUE INDEX opportunities_open_origin_pursuit_uq
  ON opportunities(COALESCE(lead_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(listing_id,'00000000-0000-0000-0000-000000000000'::uuid),
    representation_path,transaction_type)
  WHERE stage NOT IN ('Closed Won','Closed Lost');

CREATE TABLE opportunity_representation_history (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  representation_path TEXT NOT NULL,
  property_source TEXT NOT NULL,
  buyer_source TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun',
  'Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview',
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus',
  'Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication',
  'TransactionCounterparty','ExternalProperty'
));

GRANT SELECT,INSERT,UPDATE ON inventory_verification_requests TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON external_listing_publications TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON lead_inventory_selections TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON transaction_counterparties TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON provisional_external_properties TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON deal_parties TO nysareal_nysar2app;
GRANT SELECT,INSERT ON opportunity_representation_history TO nysareal_nysar2app;
