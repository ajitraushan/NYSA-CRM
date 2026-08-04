ALTER TABLE opportunities DROP CONSTRAINT opportunities_r2_3a_enabled_stage_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_r2_3b_enabled_stage_ck
  CHECK (stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Lost'));

ALTER TABLE opportunity_stage_history DROP CONSTRAINT opportunity_history_r2_3a_enabled_stage_ck;
ALTER TABLE opportunity_stage_history ADD CONSTRAINT opportunity_history_r2_3b_enabled_stage_ck CHECK (
  (from_stage IS NULL OR from_stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Lost'))
  AND to_stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Lost')
);

CREATE TABLE booking_number_counters (
  period_code CHAR(6) PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY,
  booking_reference TEXT NOT NULL UNIQUE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  offer_id UUID NOT NULL REFERENCES offers(id),
  accepted_offer_revision_id UUID NOT NULL REFERENCES offer_revisions(id),
  status TEXT NOT NULL CHECK (status IN ('reserved','released','expired','cancelled')),
  booking_amount NUMERIC(15,2) NOT NULL CHECK (booking_amount > 0),
  currency CHAR(3) NOT NULL,
  refundable_state TEXT NOT NULL CHECK (refundable_state IN ('refundable','non_refundable','conditional')),
  reservation_starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  evidence_document_version_id UUID NOT NULL REFERENCES document_versions(id),
  inventory_status_before TEXT NOT NULL CHECK (inventory_status_before IN ('Available','Under offer')),
  owner_id UUID NOT NULL REFERENCES brokers(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  release_reason TEXT,
  released_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > reservation_starts_at),
  CHECK (status NOT IN ('released','cancelled') OR release_reason IS NOT NULL)
);
CREATE UNIQUE INDEX bookings_active_listing_uq ON bookings(listing_id) WHERE status='reserved';
CREATE UNIQUE INDEX bookings_active_offer_uq ON bookings(offer_id) WHERE status='reserved';
CREATE INDEX bookings_opportunity_idx ON bookings(opportunity_id,created_at DESC);

CREATE TABLE booking_status_history (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('reserved','released','expired','cancelled')),
  reason TEXT,
  actor_id UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX booking_status_history_booking_idx ON booking_status_history(booking_id,changed_at,id);

CREATE OR REPLACE FUNCTION reject_booking_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'booking status history is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER booking_status_history_immutable
  BEFORE UPDATE OR DELETE ON booking_status_history
  FOR EACH ROW EXECUTE FUNCTION reject_booking_history_mutation();

ALTER TABLE document_links DROP CONSTRAINT document_links_entity_type_check;
ALTER TABLE document_links ADD CONSTRAINT document_links_entity_type_check CHECK (
  entity_type IN ('Contact','Lead','Activity','Listing','Proposal','ContactChannel','Opportunity','Offer','OfferRevision','Booking')
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
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus'
));
