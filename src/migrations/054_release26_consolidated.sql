-- Release 2.6: consolidated R2.5 remediation and governed WhatsApp property sharing.

CREATE TABLE opportunity_property_shares (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel='whatsapp'),
  recipient_phone TEXT NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'customer'
    CHECK (recipient_type IN ('customer','external_broker')),
  recipient_name TEXT NOT NULL,
  recipient_agency TEXT,
  customer_message TEXT NOT NULL,
  public_token_hash TEXT NOT NULL UNIQUE,
  public_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared','sent','delivery_failed','responded','cancelled')),
  sent_by UUID REFERENCES brokers(id),
  sent_at TIMESTAMPTZ,
  response_status TEXT
    CHECK (response_status IS NULL OR response_status IN ('accepted','rejected','alternatives_requested','mixed')),
  response_notes TEXT,
  responded_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE opportunity_property_share_items (
  id UUID PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES opportunity_property_shares(id) ON DELETE CASCADE,
  property_match_id UUID NOT NULL REFERENCES property_matches(id),
  listing_id UUID REFERENCES listings(id),
  external_property_id UUID REFERENCES provisional_external_properties(id),
  property_snapshot JSONB NOT NULL,
  response_status TEXT
    CHECK (response_status IS NULL OR response_status IN ('accepted','rejected','alternatives_requested')),
  response_notes TEXT,
  responded_at TIMESTAMPTZ,
  UNIQUE(share_id,property_match_id)
);

CREATE INDEX opportunity_property_shares_opportunity_idx
  ON opportunity_property_shares(opportunity_id,created_at DESC);
CREATE INDEX opportunity_property_shares_public_token_idx
  ON opportunity_property_shares(public_token_hash,public_expires_at);

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
  'TransactionCounterparty','ExternalProperty','OpportunityPropertyShare'
));

GRANT SELECT,INSERT,UPDATE ON opportunity_property_shares TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON opportunity_property_share_items TO nysareal_nysar2app;
