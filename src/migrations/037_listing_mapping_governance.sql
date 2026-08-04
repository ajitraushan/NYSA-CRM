CREATE TABLE listing_mapping_versions (
  id UUID PRIMARY KEY,
  provider_code TEXT NOT NULL CHECK (provider_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  version_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','tested','approved','active','retired')),
  lifecycle_reason TEXT,
  test_evidence TEXT,
  approval_evidence TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  tested_by UUID REFERENCES brokers(id),
  approved_by UUID REFERENCES brokers(id),
  activated_by UUID REFERENCES brokers(id),
  retired_by UUID REFERENCES brokers(id),
  replaced_by_version_id UUID REFERENCES listing_mapping_versions(id),
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tested_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  UNIQUE(provider_code,version_code)
);

CREATE UNIQUE INDEX listing_mapping_one_active_provider_uq
  ON listing_mapping_versions(provider_code) WHERE status='active';

CREATE TABLE listing_value_mappings (
  id UUID PRIMARY KEY,
  version_id UUID NOT NULL REFERENCES listing_mapping_versions(id) ON DELETE CASCADE,
  field_code TEXT NOT NULL CHECK (field_code IN ('areaCode','propertyType','bedrooms','paymentPlanType','exclusivityTier','handoverStatus','currency')),
  external_value TEXT NOT NULL,
  core_value TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX listing_value_mapping_external_uq
  ON listing_value_mappings(version_id,field_code,LOWER(external_value));

ALTER TABLE listings ADD COLUMN source_mapping_version_id UUID REFERENCES listing_mapping_versions(id);
ALTER TABLE listing_intake_events ADD COLUMN mapping_version_id UUID REFERENCES listing_mapping_versions(id);
ALTER TABLE listing_intake_events ADD COLUMN received_mapping_version TEXT;
ALTER TABLE listing_intake_events ADD COLUMN received_payload JSONB;
ALTER TABLE listing_intake_events ADD COLUMN received_payload_hash CHAR(64);
UPDATE listing_intake_events SET received_mapping_version=mapping_version WHERE received_mapping_version IS NULL;
UPDATE listing_intake_events SET received_payload=payload,received_payload_hash=payload_hash WHERE received_payload IS NULL;
ALTER TABLE listing_intake_events ALTER COLUMN received_mapping_version SET NOT NULL;
ALTER TABLE listing_intake_events ALTER COLUMN received_payload SET NOT NULL;
ALTER TABLE listing_intake_events ALTER COLUMN received_payload_hash SET NOT NULL;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun'
));
