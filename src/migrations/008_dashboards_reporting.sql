ALTER TABLE activities ADD COLUMN duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0);
ALTER TABLE activities ADD COLUMN follow_up_required SMALLINT NOT NULL DEFAULT 0 CHECK (follow_up_required IN (0,1));
ALTER TABLE activities ADD COLUMN lead_stage_snapshot TEXT;
ALTER TABLE activities ADD COLUMN qualification_snapshot TEXT;

CREATE TABLE dashboard_targets (
  id UUID PRIMARY KEY,
  metric_code TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('company','business_line','team','agent')),
  scope_id TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value NUMERIC(18,2) NOT NULL,
  unit TEXT NOT NULL,
  definition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (period_end >= period_start)
);
CREATE INDEX dashboard_targets_lookup_idx ON dashboard_targets(metric_code,scope_type,period_start,period_end);

CREATE TABLE saved_dashboard_views (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES brokers(id),
  name TEXT NOT NULL,
  dashboard_type TEXT NOT NULL,
  filters JSONB NOT NULL,
  approved SMALLINT NOT NULL DEFAULT 0 CHECK (approved IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id,name,dashboard_type)
);

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia','Proposal','ProposalVersion',
  'DashboardTarget','DashboardExport','SavedDashboardView'
));
