-- WA-001 Stage B number-independent workspaces.
-- This migration deliberately adds no provider-dispatch or provider-submission path.

ALTER TABLE wa_recipient_import_batches
  ADD COLUMN owner_team_id UUID REFERENCES teams(id);

CREATE INDEX wa_recipient_import_batches_team_idx
  ON wa_recipient_import_batches(owner_team_id,created_at DESC);

CREATE TABLE wa_message_templates (
  id UUID PRIMARY KEY,
  template_reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_team_id UUID NOT NULL REFERENCES teams(id),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft'
    CHECK(lifecycle_status IN ('draft','active','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX wa_message_templates_name_uq
  ON wa_message_templates(owner_team_id,LOWER(name))
  WHERE lifecycle_status<>'retired';

CREATE TABLE wa_message_template_versions (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES wa_message_templates(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  language_code TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('marketing','utility','authentication')),
  header_text TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  variable_names TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  internal_status TEXT NOT NULL DEFAULT 'draft'
    CHECK(internal_status IN ('draft','pending_approval','approved','returned','superseded')),
  meta_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK(meta_status IN ('not_submitted','pending','approved','rejected','paused','disabled')),
  prepared_by UUID NOT NULL REFERENCES brokers(id),
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  content_hash TEXT NOT NULL CHECK(length(content_hash)=64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_id,version_number)
);
CREATE INDEX wa_message_template_versions_status_idx
  ON wa_message_template_versions(internal_status,submitted_at DESC);

CREATE TABLE wa_material_catalogue (
  id UUID PRIMARY KEY,
  material_reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  material_type TEXT NOT NULL
    CHECK(material_type IN ('brochure','floor_plan','price_list','presentation','image','other')),
  description TEXT,
  owner_team_id UUID NOT NULL REFERENCES teams(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
  file_name TEXT,
  media_type TEXT,
  file_size_bytes INTEGER CHECK(file_size_bytes IS NULL OR file_size_bytes>0),
  storage_key TEXT,
  file_hash TEXT CHECK(file_hash IS NULL OR length(file_hash)=64),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((storage_key IS NULL AND file_hash IS NULL AND file_name IS NULL AND media_type IS NULL AND file_size_bytes IS NULL)
    OR (storage_key IS NOT NULL AND file_hash IS NOT NULL AND file_name IS NOT NULL AND media_type IS NOT NULL AND file_size_bytes IS NOT NULL))
);
CREATE INDEX wa_material_catalogue_team_idx
  ON wa_material_catalogue(owner_team_id,status,updated_at DESC);

ALTER TABLE wa_campaign_drafts
  ALTER COLUMN template_id DROP NOT NULL,
  ADD COLUMN template_version_id UUID REFERENCES wa_message_template_versions(id);

ALTER TABLE wa_campaign_drafts
  ADD CONSTRAINT wa_campaign_drafts_template_source_check
  CHECK(template_id IS NOT NULL OR template_version_id IS NOT NULL);

CREATE TABLE wa_campaign_materials (
  campaign_id UUID NOT NULL REFERENCES wa_campaign_drafts(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES wa_material_catalogue(id),
  added_by UUID NOT NULL REFERENCES brokers(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(campaign_id,material_id)
);

ALTER TABLE wa_campaign_audit
  DROP CONSTRAINT wa_campaign_audit_entity_type_check;
ALTER TABLE wa_campaign_audit
  ADD CONSTRAINT wa_campaign_audit_entity_type_check
  CHECK(entity_type IN ('recipient_import','segment','template_catalogue','message_template','material_catalogue','campaign'));

-- Retain every previously governed audit type and add only the Stage B
-- workspace entities. The main audit allow-list is intentionally fail-closed.
DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO prior_expression
  FROM pg_constraint
  WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  IF prior_expression IS NULL THEN
    RAISE EXCEPTION 'Required audit entity constraint is missing';
  END IF;
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression
    || ') OR entity_type IN (''WhatsAppMessageTemplate'',''WhatsAppRecipientImport'',''WhatsAppAudienceSegment'',''WhatsAppMaterial'',''WhatsAppCampaign''))';
END $$;

GRANT SELECT,INSERT,UPDATE ON
  wa_message_templates,wa_message_template_versions,wa_material_catalogue,wa_campaign_materials
  TO nysareal_nysar2app;
