-- Release 2.6: Inventory counterparties/agreements and maintained DBR guidance.

ALTER TABLE organization_settings
  ADD COLUMN prudent_dbr_percent NUMERIC(5,2) NOT NULL DEFAULT 47,
  ADD COLUMN regulatory_dbr_percent NUMERIC(5,2) NOT NULL DEFAULT 50,
  ADD CONSTRAINT organization_settings_dbr_thresholds_ck
    CHECK (prudent_dbr_percent > 0 AND regulatory_dbr_percent > prudent_dbr_percent AND regulatory_dbr_percent <= 100);

CREATE TABLE inventory_counterparties (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  party_role TEXT NOT NULL CHECK (party_role IN ('seller','landlord','lessor','developer','authorized_representative')),
  party_type TEXT NOT NULL CHECK (party_type IN ('person','company','external_broker','external_agency')),
  display_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  represented_party TEXT,
  source TEXT NOT NULL,
  authority_evidence TEXT NOT NULL,
  contact_restrictions TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_agreements (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  counterparty_id UUID REFERENCES inventory_counterparties(id),
  agreement_type TEXT NOT NULL CHECK (agreement_type IN (
    'listing_mandate','leasing_mandate','seller_representation','landlord_representation',
    'co_broker','commission_sharing','ownership_authority','marketing_publication',
    'viewing_access','developer_authorization','amendment','renewal'
  )),
  representation_type TEXT NOT NULL CHECK (representation_type IN ('exclusive','non_exclusive','referral','co_broker','not_applicable')),
  evidence_reference TEXT NOT NULL,
  effective_from DATE,
  effective_to DATE,
  commission_terms TEXT,
  marketing_authorized SMALLINT NOT NULL DEFAULT 0 CHECK (marketing_authorized IN (0,1)),
  viewing_authorized SMALLINT NOT NULL DEFAULT 0 CHECK (viewing_authorized IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','terminated')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
);

CREATE INDEX inventory_counterparties_listing_idx ON inventory_counterparties(listing_id,created_at);
CREATE INDEX inventory_agreements_listing_idx ON inventory_agreements(listing_id,status,created_at);

ALTER TABLE transaction_counterparties
  ADD COLUMN inventory_counterparty_id UUID UNIQUE REFERENCES inventory_counterparties(id);

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
  'TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement'
));

GRANT SELECT,INSERT,UPDATE ON inventory_counterparties TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON inventory_agreements TO nysareal_nysar2app;
