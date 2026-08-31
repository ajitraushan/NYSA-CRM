CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY,
  campaign_code TEXT NOT NULL UNIQUE CHECK (campaign_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES brokers(id),
  objective TEXT NOT NULL,
  audience TEXT,
  channels TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  applicable_property_references TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  starts_on DATE,
  ends_on DATE,
  planned_budget NUMERIC(16,2),
  operational_targets JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  updated_by UUID NOT NULL REFERENCES brokers(id),
  status_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CHECK (planned_budget IS NULL OR planned_budget >= 0)
);

CREATE TABLE campaign_external_mappings (
  id UUID PRIMARY KEY,
  source_code TEXT NOT NULL,
  external_campaign_code TEXT NOT NULL,
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  retired_by UUID REFERENCES brokers(id),
  retirement_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX campaign_external_mapping_active_uq
  ON campaign_external_mappings(LOWER(source_code),LOWER(external_campaign_code)) WHERE status='active';
CREATE INDEX marketing_campaigns_status_idx ON marketing_campaigns(status,starts_on,ends_on);

ALTER TABLE leads ADD COLUMN campaign_id UUID REFERENCES marketing_campaigns(id);
ALTER TABLE website_intake_events
  ADD COLUMN campaign_id UUID REFERENCES marketing_campaigns(id),
  ADD COLUMN campaign_mapping_status TEXT NOT NULL DEFAULT 'not_supplied'
    CHECK (campaign_mapping_status IN ('not_supplied','mapped','unmapped'));

CREATE INDEX leads_campaign_id_idx ON leads(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX website_intake_unmapped_campaign_idx ON website_intake_events(received_at DESC)
  WHERE campaign_mapping_status='unmapped';

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
  'TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement',
  'MarketingCampaign','CampaignMapping'
));

GRANT SELECT,INSERT,UPDATE ON marketing_campaigns TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON campaign_external_mappings TO nysareal_nysar2app;
