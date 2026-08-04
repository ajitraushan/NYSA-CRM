ALTER TABLE opportunities DROP CONSTRAINT opportunities_r2_2_enabled_stage_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_r2_3a_enabled_stage_ck
  CHECK (stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Closed Lost'));

ALTER TABLE opportunity_stage_history DROP CONSTRAINT opportunity_history_r2_2_enabled_stage_ck;
ALTER TABLE opportunity_stage_history ADD CONSTRAINT opportunity_history_r2_3a_enabled_stage_ck CHECK (
  (from_stage IS NULL OR from_stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Closed Lost'))
  AND to_stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Closed Lost')
);

CREATE TABLE offer_number_counters (
  period_code CHAR(6) PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE offers (
  id UUID PRIMARY KEY,
  offer_reference TEXT NOT NULL UNIQUE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  offer_type TEXT NOT NULL CHECK (offer_type IN ('purchase','rental','off_plan','commercial')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft','sent','viewed','countered','accepted','rejected','expired','withdrawn')
  ),
  currency CHAR(3) NOT NULL,
  owner_id UUID NOT NULL REFERENCES brokers(id),
  current_revision_id UUID,
  accepted_revision_id UUID,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX offers_opportunity_idx ON offers(opportunity_id,created_at DESC);
CREATE UNIQUE INDEX offers_active_opportunity_listing_uq
  ON offers(opportunity_id,listing_id,offer_type)
  WHERE status NOT IN ('rejected','expired','withdrawn');

CREATE TABLE offer_revisions (
  id UUID PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES offers(id),
  revision_number INTEGER NOT NULL CHECK (revision_number > 0),
  supersedes_revision_id UUID REFERENCES offer_revisions(id),
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  proposer_role TEXT NOT NULL CHECK (
    proposer_role IN ('customer','seller','landlord','developer','agent','other')
  ),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  deposit_amount NUMERIC(15,2) CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  financing_method TEXT,
  payment_terms TEXT,
  conditions TEXT,
  validity_expires_at TIMESTAMPTZ NOT NULL,
  material_correction_reason TEXT,
  document_version_id UUID NOT NULL UNIQUE REFERENCES document_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(offer_id,revision_number),
  CHECK (revision_number = 1 OR material_correction_reason IS NOT NULL)
);
CREATE INDEX offer_revisions_offer_idx ON offer_revisions(offer_id,revision_number DESC);

ALTER TABLE offers ADD CONSTRAINT offers_current_revision_fk
  FOREIGN KEY(current_revision_id) REFERENCES offer_revisions(id);
ALTER TABLE offers ADD CONSTRAINT offers_accepted_revision_fk
  FOREIGN KEY(accepted_revision_id) REFERENCES offer_revisions(id);

CREATE TABLE negotiation_events (
  id UUID PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES offers(id),
  offer_revision_id UUID REFERENCES offer_revisions(id),
  document_version_id UUID REFERENCES document_versions(id),
  event_type TEXT NOT NULL CHECK (
    event_type IN ('created','revision_created','sent','viewed','acknowledged','countered',
      'accepted','rejected','expired','withdrawn','material_correction')
  ),
  direction TEXT NOT NULL CHECK (direction IN ('outbound','inbound','internal')),
  counterparty_role TEXT CHECK (
    counterparty_role IS NULL OR counterparty_role IN ('customer','seller','landlord','developer','agent','other')
  ),
  summary TEXT NOT NULL,
  reason TEXT,
  delivery_channel TEXT,
  delivery_recipient TEXT,
  actor_id UUID NOT NULL REFERENCES brokers(id),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (event_type NOT IN ('rejected','withdrawn','material_correction') OR reason IS NOT NULL),
  CHECK (event_type <> 'sent' OR (offer_revision_id IS NOT NULL AND document_version_id IS NOT NULL))
);
CREATE INDEX negotiation_events_offer_idx ON negotiation_events(offer_id,occurred_at,id);

CREATE OR REPLACE FUNCTION reject_offer_revision_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'offer revisions are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER offer_revisions_immutable
  BEFORE UPDATE OR DELETE ON offer_revisions
  FOR EACH ROW EXECUTE FUNCTION reject_offer_revision_mutation();

CREATE OR REPLACE FUNCTION reject_negotiation_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'negotiation events are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER negotiation_events_immutable
  BEFORE UPDATE OR DELETE ON negotiation_events
  FOR EACH ROW EXECUTE FUNCTION reject_negotiation_event_mutation();

ALTER TABLE document_links DROP CONSTRAINT document_links_entity_type_check;
ALTER TABLE document_links ADD CONSTRAINT document_links_entity_type_check CHECK (
  entity_type IN ('Contact','Lead','Activity','Listing','Proposal','ContactChannel','Opportunity','Offer','OfferRevision')
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
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent'
));
