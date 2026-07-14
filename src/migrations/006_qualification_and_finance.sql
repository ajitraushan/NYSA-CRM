CREATE TABLE qualification_models (
  id UUID PRIMARY KEY,
  model_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  purpose TEXT NOT NULL,
  business_line TEXT,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','retired')),
  factors JSONB NOT NULL,
  thresholds JSONB NOT NULL,
  guidance JSONB NOT NULL,
  normalization_method TEXT NOT NULL DEFAULT 'weighted_percentage',
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  supersedes_model_id UUID REFERENCES qualification_models(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  approved_by UUID REFERENCES brokers(id),
  approval_reason TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(model_code,version)
);
CREATE UNIQUE INDEX qualification_models_active_uq ON qualification_models(model_code) WHERE status='active';

CREATE TABLE qualification_assessments (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  model_id UUID NOT NULL REFERENCES qualification_models(id),
  model_version INTEGER NOT NULL,
  factor_inputs JSONB NOT NULL,
  factor_contributions JSONB NOT NULL,
  calculated_score NUMERIC(6,2) NOT NULL,
  calculated_temperature TEXT NOT NULL CHECK (calculated_temperature IN ('Hot','Warm','Cold')),
  final_temperature TEXT NOT NULL CHECK (final_temperature IN ('Hot','Warm','Cold')),
  recommendation JSONB,
  override_reason TEXT,
  overridden_by UUID REFERENCES brokers(id),
  assessed_by UUID NOT NULL REFERENCES brokers(id),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX qualification_assessments_lead_idx ON qualification_assessments(lead_id,assessed_at DESC);

CREATE TABLE regulatory_assumption_versions (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  effective_from TIMESTAMPTZ,
  currency TEXT NOT NULL DEFAULT 'AED',
  assumptions JSONB NOT NULL,
  disclaimer TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name,version)
);
CREATE UNIQUE INDEX regulatory_assumptions_active_uq ON regulatory_assumption_versions(status) WHERE status='active';

CREATE TABLE financial_scenarios (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  listing_id UUID REFERENCES listings(id),
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('mortgage','roi')),
  scenario_name TEXT NOT NULL,
  input_snapshot JSONB NOT NULL,
  output_snapshot JSONB NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED',
  assumption_version_id UUID NOT NULL REFERENCES regulatory_assumption_versions(id),
  property_price NUMERIC(16,2) NOT NULL,
  loan_amount NUMERIC(16,2),
  monthly_payment NUMERIC(16,2),
  gross_yield NUMERIC(8,4),
  net_yield NUMERIC(8,4),
  cash_on_cash_return NUMERIC(8,4),
  disclaimer TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX financial_scenarios_lead_idx ON financial_scenarios(lead_id,created_at DESC);

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario'
));
