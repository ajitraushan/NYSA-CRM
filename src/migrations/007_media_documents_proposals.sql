CREATE TABLE property_media (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image','floor_plan','brochure')),
  title TEXT NOT NULL,
  caption TEXT,
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  display_order INTEGER NOT NULL DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES brokers(id),
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX property_media_listing_idx ON property_media(listing_id,approval_status,display_order);

ALTER TABLE documents ADD COLUMN contact_id UUID REFERENCES contacts(id);
ALTER TABLE documents ADD COLUMN lead_id UUID REFERENCES leads(id);
ALTER TABLE documents ADD COLUMN activity_id UUID REFERENCES activities(id);
ALTER TABLE documents ADD COLUMN listing_id UUID REFERENCES listings(id);
ALTER TABLE document_versions ADD COLUMN source TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE document_versions ADD COLUMN classification TEXT NOT NULL DEFAULT 'private';
ALTER TABLE document_versions ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft','generated','reviewed','sent','received','retired'));
ALTER TABLE document_versions ADD COLUMN owner_id UUID REFERENCES brokers(id);
ALTER TABLE activities ADD COLUMN document_version_id UUID REFERENCES document_versions(id);

CREATE TABLE proposal_templates (
  id UUID PRIMARY KEY,
  template_type TEXT NOT NULL CHECK (template_type IN ('Quick','Investment','Comparison')),
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  brand_version TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','active','retired')),
  effective_from TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_type,version)
);
CREATE UNIQUE INDEX proposal_templates_active_uq ON proposal_templates(template_type) WHERE status='active';

CREATE TABLE proposals (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  template_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','generated','reviewed','sent','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX proposals_lead_idx ON proposals(lead_id,created_at DESC);

CREATE TABLE proposal_versions (
  id UUID PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  version_number INTEGER NOT NULL,
  template_id UUID NOT NULL REFERENCES proposal_templates(id),
  recipient_snapshot JSONB NOT NULL,
  requirement_snapshot JSONB,
  organization_snapshot JSONB NOT NULL,
  financial_snapshot JSONB,
  narrative_snapshot JSONB NOT NULL,
  disclaimer TEXT NOT NULL,
  data_snapshot JSONB NOT NULL,
  data_as_of TIMESTAMPTZ NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','reviewed','sent')),
  document_version_id UUID REFERENCES document_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  sent_by UUID REFERENCES brokers(id),
  sent_at TIMESTAMPTZ,
  delivery_channel TEXT,
  delivery_recipient TEXT,
  UNIQUE(proposal_id,version_number)
);

CREATE TABLE proposal_properties (
  id UUID PRIMARY KEY,
  proposal_version_id UUID NOT NULL REFERENCES proposal_versions(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  display_order INTEGER NOT NULL,
  property_snapshot JSONB NOT NULL,
  UNIQUE(proposal_version_id,listing_id)
);
CREATE TABLE proposal_media (
  id UUID PRIMARY KEY,
  proposal_version_id UUID NOT NULL REFERENCES proposal_versions(id),
  property_media_id UUID NOT NULL REFERENCES property_media(id),
  display_order INTEGER NOT NULL,
  caption TEXT,
  storage_key_snapshot TEXT NOT NULL,
  file_hash_snapshot TEXT NOT NULL,
  UNIQUE(proposal_version_id,property_media_id)
);

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia','Proposal','ProposalVersion'
));
