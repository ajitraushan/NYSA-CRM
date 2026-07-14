ALTER TABLE leads ADD COLUMN resolution_code TEXT CHECK (resolution_code IN ('lost','unqualified','duplicate'));
ALTER TABLE leads ADD COLUMN resolution_reason_code TEXT;
ALTER TABLE leads ADD COLUMN acceptance_due_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN sla_paused_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN sla_paused_seconds INTEGER NOT NULL DEFAULT 0;
UPDATE leads SET resolution_code='lost' WHERE stage='Lost' AND resolution_code IS NULL;
UPDATE leads SET resolution_reason_code='legacy' WHERE stage='Lost' AND resolution_reason_code IS NULL;
UPDATE leads SET acceptance_due_at=original_acceptance_due_at WHERE acceptance_due_at IS NULL;
ALTER TABLE leads ADD CONSTRAINT leads_terminal_resolution_check CHECK (
  stage<>'Lost' OR (resolution_code IS NOT NULL AND resolution_reason_code IS NOT NULL AND lost_reason IS NOT NULL)
);
CREATE OR REPLACE FUNCTION enforce_lead_stage_transition() RETURNS trigger AS $$
BEGIN
  IF NEW.stage=OLD.stage THEN RETURN NEW; END IF;
  IF (OLD.stage='New' AND NEW.stage IN ('Contacted','Lost')) OR
     (OLD.stage='Contacted' AND NEW.stage IN ('Qualified','Lost')) OR
     (OLD.stage='Qualified' AND NEW.stage IN ('Viewing','Negotiation','Lost')) OR
     (OLD.stage='Viewing' AND NEW.stage IN ('Qualified','Negotiation','Lost')) OR
     (OLD.stage='Negotiation' AND NEW.stage IN ('Viewing','Won','Lost')) OR
     (OLD.stage='Lost' AND NEW.stage='New') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid lead stage transition from % to %',OLD.stage,NEW.stage USING ERRCODE='check_violation';
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER leads_stage_transition_guard BEFORE UPDATE OF stage ON leads
FOR EACH ROW EXECUTE FUNCTION enforce_lead_stage_transition();

ALTER TABLE activities ADD COLUMN voided_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN voided_by UUID REFERENCES brokers(id);
ALTER TABLE activities ADD COLUMN void_reason TEXT;
CREATE TABLE activity_corrections (
  id UUID PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id),
  prior_snapshot JSONB NOT NULL,
  corrected_fields JSONB NOT NULL,
  correction_reason TEXT NOT NULL,
  corrected_by UUID NOT NULL REFERENCES brokers(id),
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX activity_corrections_activity_idx ON activity_corrections(activity_id,corrected_at DESC);

ALTER TABLE value_definitions ADD COLUMN change_reason TEXT;
ALTER TABLE value_definitions ADD COLUMN impact_review TEXT;

CREATE TABLE document_links (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('Contact','Lead','Activity','Listing','Proposal','ContactChannel')),
  entity_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id,entity_type,entity_id)
);
CREATE INDEX document_links_entity_idx ON document_links(entity_type,entity_id);
INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by)
SELECT id, id, 'Contact', contact_id, created_by FROM documents WHERE contact_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by)
SELECT (SUBSTR(MD5(id::text || ':lead'),1,8)||'-'||SUBSTR(MD5(id::text || ':lead'),9,4)||'-4'||SUBSTR(MD5(id::text || ':lead'),14,3)||'-8'||SUBSTR(MD5(id::text || ':lead'),18,3)||'-'||SUBSTR(MD5(id::text || ':lead'),21,12))::uuid,
  id,'Lead',lead_id,created_by FROM documents WHERE lead_id IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by)
SELECT (SUBSTR(MD5(id::text || ':listing'),1,8)||'-'||SUBSTR(MD5(id::text || ':listing'),9,4)||'-4'||SUBSTR(MD5(id::text || ':listing'),14,3)||'-8'||SUBSTR(MD5(id::text || ':listing'),18,3)||'-'||SUBSTR(MD5(id::text || ':listing'),21,12))::uuid,
  id,'Listing',listing_id,created_by FROM documents WHERE listing_id IS NOT NULL ON CONFLICT DO NOTHING;

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia','Proposal','ProposalVersion',
  'DashboardTarget','DashboardExport','SavedDashboardView'
));
