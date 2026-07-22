CREATE TABLE integration_oauth_states (
  state_hash CHAR(64) PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider='google_calendar'),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE CHECK (provider='google_calendar'),
  account_email TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  encrypted_refresh_token TEXT NOT NULL,
  scope TEXT NOT NULL,
  connected_by UUID NOT NULL REFERENCES brokers(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE viewing_calendar_events (
  id UUID PRIMARY KEY,
  viewing_id UUID NOT NULL REFERENCES viewings(id),
  provider TEXT NOT NULL CHECK (provider='google_calendar'),
  external_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  event_url TEXT,
  meeting_url TEXT,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('active','cancelled','error')),
  synced_by UUID NOT NULL REFERENCES brokers(id),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(viewing_id,provider),
  UNIQUE(provider,external_event_id)
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
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent'
));
