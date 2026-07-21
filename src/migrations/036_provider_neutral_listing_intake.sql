ALTER TABLE listings
  ADD COLUMN source_provider TEXT,
  ADD COLUMN external_record_id TEXT,
  ADD COLUMN source_mapping_version TEXT;

CREATE UNIQUE INDEX listings_provider_external_record_uq
  ON listings(source_provider,external_record_id)
  WHERE source_provider IS NOT NULL AND external_record_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE listing_intake_events (
  id UUID PRIMARY KEY,
  event_id TEXT NOT NULL,
  provider_code TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('integration','import')),
  external_record_id TEXT NOT NULL,
  mapping_version TEXT NOT NULL,
  payload_hash CHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing','accepted','failed','unmapped','duplicate_review')),
  error_code TEXT,
  error_detail TEXT,
  listing_id UUID REFERENCES listings(id),
  duplicate_listing_id UUID REFERENCES listings(id),
  assigned_to UUID NOT NULL REFERENCES brokers(id),
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count>0),
  replayed_by UUID REFERENCES brokers(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX listing_intake_provider_event_uq ON listing_intake_events(provider_code,event_id);
CREATE INDEX listing_intake_queue_idx ON listing_intake_events(assigned_to,status,received_at DESC);
CREATE INDEX listing_intake_external_idx ON listing_intake_events(provider_code,external_record_id,received_at DESC);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun'
));
