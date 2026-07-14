ALTER TABLE brokers ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'English';
ALTER TABLE brokers ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Dubai';

CREATE TABLE team_memberships (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  membership_role TEXT NOT NULL DEFAULT 'member' CHECK (membership_role IN ('member','manager')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX team_memberships_active_uq ON team_memberships(team_id,broker_id) WHERE ends_at IS NULL;
CREATE INDEX team_memberships_broker_idx ON team_memberships(broker_id,ends_at);
INSERT INTO team_memberships (id,team_id,broker_id,membership_role,starts_at,created_by)
SELECT b.id,b.team_id,b.id,CASE WHEN t.manager_id=b.id THEN 'manager' ELSE 'member' END,b.joined_at,
       COALESCE(t.manager_id,(SELECT id FROM brokers WHERE role='admin' ORDER BY joined_at LIMIT 1),b.id)
FROM brokers b JOIN teams t ON t.id=b.team_id
WHERE b.team_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE organization_settings (
  id UUID PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE CHECK (version > 0),
  legal_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  trade_license_number TEXT,
  registration_authority TEXT,
  registered_address TEXT,
  primary_phone TEXT,
  primary_email TEXT,
  website_url TEXT,
  default_currency CHAR(3) NOT NULL DEFAULT 'AED',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  locale TEXT NOT NULL DEFAULT 'en-AE',
  brand_version TEXT NOT NULL DEFAULT '1',
  proposal_footer TEXT,
  default_disclaimer TEXT,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  approved_by UUID REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE UNIQUE INDEX organization_settings_one_active_uq ON organization_settings(status) WHERE status='active';

ALTER TABLE contacts ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active'
  CHECK (lifecycle_status IN ('active','inactive','merged','restricted','anonymized'));
ALTER TABLE contacts ADD COLUMN preferred_contact_time TEXT;
ALTER TABLE contacts ADD COLUMN do_not_contact SMALLINT NOT NULL DEFAULT 0 CHECK (do_not_contact IN (0,1));
ALTER TABLE contacts ADD COLUMN contact_restriction_reason TEXT;
ALTER TABLE contacts ADD COLUMN source_first_seen TEXT;
ALTER TABLE contacts ADD COLUMN merged_into_contact_id UUID REFERENCES contacts(id);
ALTER TABLE contacts ADD COLUMN merged_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN merged_by UUID REFERENCES brokers(id);
ALTER TABLE contacts ADD COLUMN merge_reason TEXT;

CREATE TABLE contact_roles (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  role_code TEXT NOT NULL CHECK (role_code IN ('buyer','seller','landlord','tenant','developer','investor','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX contact_roles_active_uq ON contact_roles(contact_id,role_code) WHERE status='active';
INSERT INTO contact_roles (id,contact_id,role_code,created_by,created_at)
SELECT id,id,contact_type,created_by,created_at FROM contacts ON CONFLICT DO NOTHING;

ALTER TABLE companies ADD COLUMN legal_name TEXT;
ALTER TABLE companies ADD COLUMN trade_license_number TEXT;
ALTER TABLE companies ADD COLUMN registration_country TEXT;
ALTER TABLE companies ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','merged'));
ALTER TABLE companies ADD COLUMN merged_into_company_id UUID REFERENCES companies(id);

CREATE TABLE external_company_roles (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  role_code TEXT NOT NULL CHECK (role_code IN ('developer','agency','employer','supplier','corporate_client','landlord','vendor','other')),
  is_primary SMALLINT NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX external_company_roles_active_uq ON external_company_roles(company_id,role_code) WHERE status='active';

CREATE TABLE company_contacts (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  relationship_role TEXT,
  is_primary SMALLINT NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE UNIQUE INDEX company_contacts_active_uq ON company_contacts(company_id,contact_id) WHERE ends_at IS NULL;
INSERT INTO company_contacts (id,company_id,contact_id,relationship_role,is_primary,created_by,created_at)
SELECT c.id,c.company_id,c.id,'customer_contact',1,c.created_by,c.created_at FROM contacts c
WHERE c.company_id IS NOT NULL ON CONFLICT DO NOTHING;

CREATE TABLE contact_channels (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  channel_kind TEXT NOT NULL CHECK (channel_kind IN ('Phone','Email')),
  usage_label TEXT NOT NULL DEFAULT 'Primary',
  raw_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  whatsapp_enabled SMALLINT NOT NULL DEFAULT 0 CHECK (whatsapp_enabled IN (0,1)),
  is_primary SMALLINT NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','format_valid','verified','invalid')),
  verified_at TIMESTAMPTZ,
  restriction_status TEXT NOT NULL DEFAULT 'allowed'
    CHECK (restriction_status IN ('allowed','restricted','do_not_contact')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (channel_kind='Phone' OR whatsapp_enabled=0)
);
CREATE INDEX contact_channels_contact_idx ON contact_channels(contact_id);
CREATE INDEX contact_channels_normalized_idx ON contact_channels(channel_kind,normalized_value);
CREATE UNIQUE INDEX contact_channels_contact_value_uq ON contact_channels(contact_id,channel_kind,normalized_value);
INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,created_by,created_at)
SELECT id, id, 'Email', 'Primary', email, LOWER(BTRIM(email)), 0, 1, email_status, created_by, created_at
FROM contacts WHERE email IS NOT NULL ON CONFLICT DO NOTHING;
INSERT INTO contact_channels (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,created_by,created_at)
SELECT (SUBSTR(MD5(id::text || ':phone'),1,8) || '-' || SUBSTR(MD5(id::text || ':phone'),9,4) || '-4' ||
        SUBSTR(MD5(id::text || ':phone'),14,3) || '-8' || SUBSTR(MD5(id::text || ':phone'),18,3) || '-' ||
        SUBSTR(MD5(id::text || ':phone'),21,12))::uuid,
       id, 'Phone', 'Primary', phone, phone,
       CASE WHEN preferred_channel='WhatsApp' THEN 1 ELSE 0 END, 1, phone_status, created_by, created_at
FROM contacts WHERE phone IS NOT NULL ON CONFLICT DO NOTHING;

CREATE TABLE document_templates (
  id UUID PRIMARY KEY,
  template_type TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  storage_key TEXT,
  file_hash TEXT,
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_type,version)
);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  document_reference TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('Inbound','Outbound','Internal')),
  access_classification TEXT NOT NULL DEFAULT 'private' CHECK (access_classification IN ('internal','private','restricted')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','sent','received','retired')),
  owner_id UUID NOT NULL REFERENCES brokers(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id),
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  template_id UUID REFERENCES document_templates(id),
  supersedes_version_id UUID REFERENCES document_versions(id),
  file_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  storage_key TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  immutable SMALLINT NOT NULL DEFAULT 0 CHECK (immutable IN (0,1)),
  recipient TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  UNIQUE(document_id,version_number)
);

CREATE TABLE marketing_agreements (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  template_id UUID NOT NULL REFERENCES document_templates(id),
  status TEXT NOT NULL CHECK (status IN ('executed','withdrawn','expired','superseded')),
  consent_scope TEXT[] NOT NULL,
  permitted_channels TEXT[] NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT,
  superseded_by UUID REFERENCES marketing_agreements(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at IS NULL OR expires_at > effective_at),
  CHECK (status<>'withdrawn' OR (withdrawn_at IS NOT NULL AND withdrawal_reason IS NOT NULL))
);
CREATE INDEX marketing_agreements_contact_idx ON marketing_agreements(contact_id,status);

CREATE TABLE value_sets (
  id UUID PRIMARY KEY,
  stable_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  configuration_class CHAR(1) NOT NULL CHECK (configuration_class IN ('A','B','C')),
  description TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE value_definitions (
  id UUID PRIMARY KEY,
  value_set_id UUID NOT NULL REFERENCES value_sets(id),
  stable_code TEXT NOT NULL,
  display_label_en TEXT NOT NULL,
  display_label_ar TEXT,
  description TEXT,
  definition_status TEXT NOT NULL DEFAULT 'draft' CHECK (definition_status IN ('draft','active','deprecated','retired')),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_default SMALLINT NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  replacement_value_id UUID REFERENCES value_definitions(id),
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(value_set_id,stable_code),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);
CREATE INDEX value_definitions_active_idx ON value_definitions(value_set_id,display_order) WHERE definition_status='active';

CREATE TABLE workflow_transitions (
  id UUID PRIMARY KEY,
  workflow_code TEXT NOT NULL,
  from_code TEXT NOT NULL,
  to_code TEXT NOT NULL,
  allowed_job_roles TEXT[] NOT NULL,
  reason_required SMALLINT NOT NULL DEFAULT 0 CHECK (reason_required IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  effective_from TIMESTAMPTZ,
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workflow_code,from_code,to_code,version)
);

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion'
));
