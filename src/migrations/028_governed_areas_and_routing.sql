CREATE TABLE areas (
  id UUID PRIMARY KEY,
  stable_code TEXT NOT NULL UNIQUE CHECK (stable_code ~ '^[a-z][a-z0-9_]*$'),
  business_label TEXT NOT NULL,
  emirate TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 100 CHECK (display_order >= 0),
  active SMALLINT NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by UUID NOT NULL REFERENCES brokers(id),
  retired_by UUID REFERENCES brokers(id),
  retirement_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX areas_active_label_emirate_uq ON areas(LOWER(business_label),LOWER(emirate)) WHERE active=1;

ALTER TABLE routing_rules ADD COLUMN area_id UUID REFERENCES areas(id);
ALTER TABLE leads ADD COLUMN primary_routing_area_id UUID REFERENCES areas(id);

ALTER TABLE routing_rules DROP CONSTRAINT routing_rules_active_fallback_ck;
ALTER TABLE routing_rules ADD CONSTRAINT routing_rules_active_fallback_ck
  CHECK (active=0 OR source IS NOT NULL OR business_type IS NOT NULL OR area_id IS NOT NULL OR team_id IS NULL);

DROP INDEX routing_rules_active_match_uq;
CREATE UNIQUE INDEX routing_rules_active_match_area_uq
  ON routing_rules(COALESCE(source,''),COALESCE(business_type,''),COALESCE(area_id,'00000000-0000-0000-0000-000000000000'::uuid)) WHERE active=1;
CREATE INDEX routing_rules_area_match_idx ON routing_rules(active,priority,area_id,source,business_type);
CREATE INDEX leads_primary_routing_area_idx ON leads(primary_routing_area_id);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia','Proposal','ProposalVersion',
  'DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun'
));
