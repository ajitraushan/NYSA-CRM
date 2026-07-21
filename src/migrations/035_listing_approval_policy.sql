CREATE TABLE listing_approval_policy (
  id UUID PRIMARY KEY CHECK (id = '35000000-0000-4000-8000-000000000001'::uuid),
  manager_approval_required BOOLEAN NOT NULL DEFAULT TRUE,
  change_reason TEXT NOT NULL,
  updated_by UUID REFERENCES brokers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO listing_approval_policy
  (id, manager_approval_required, change_reason)
VALUES
  ('35000000-0000-4000-8000-000000000001', TRUE, 'Initial safe default: responsible Manager approval is required');

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView',
  'AiAssistanceRun'
));
