-- DEV267: Prospect Diary / Cold Calling Desk and shared suppression foundation.
-- Additive and idempotent. Repeat-call thresholds are warnings, never hard limits.

ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS prospect_call_start_minute INTEGER NOT NULL DEFAULT 540,
  ADD COLUMN IF NOT EXISTS prospect_call_end_minute INTEGER NOT NULL DEFAULT 1080,
  ADD COLUMN IF NOT EXISTS prospect_decline_warning_threshold INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prospect_unanswered_daily_warning_threshold INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS prospect_unanswered_weekly_warning_threshold INTEGER NOT NULL DEFAULT 2;
DO $$ BEGIN
  ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_prospect_calling_policy_check CHECK(
    prospect_call_start_minute BETWEEN 540 AND 1079 AND prospect_call_end_minute BETWEEN 541 AND 1080
    AND prospect_call_start_minute < prospect_call_end_minute
    AND prospect_decline_warning_threshold >= 0 AND prospect_unanswered_daily_warning_threshold >= 0
    AND prospect_unanswered_weekly_warning_threshold >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE wa_contact_suppressions
  ADD COLUMN IF NOT EXISTS restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE wa_contact_suppressions SET restrictions=jsonb_build_object(suppression_type,
  jsonb_build_object('active',true,'recordedAt',recorded_at,'recordedBy',recorded_by,
    'evidenceReference',evidence_reference,'auditExpiresAt',audit_expires_at))
  WHERE restrictions='{}'::jsonb;
ALTER TABLE wa_contact_suppressions DROP CONSTRAINT IF EXISTS wa_contact_suppressions_suppression_type_check;
ALTER TABLE wa_contact_suppressions ADD CONSTRAINT wa_contact_suppressions_suppression_type_check
  CHECK(suppression_type IN('opt_out','do_not_contact','dncr','wrong_number'));
ALTER TABLE wa_contact_suppressions DROP CONSTRAINT IF EXISTS wa_contact_suppressions_restrictions_check;
ALTER TABLE wa_contact_suppressions ADD CONSTRAINT wa_contact_suppressions_restrictions_check CHECK(jsonb_typeof(restrictions)='object');

CREATE TABLE IF NOT EXISTS company_calling_numbers (
  id UUID PRIMARY KEY,label TEXT NOT NULL CHECK(length(btrim(label))>=2),phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL UNIQUE CHECK(normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','retired')),
  tdra_registration_reference TEXT NOT NULL CHECK(length(btrim(tdra_registration_reference))>=3),
  tdra_registered_legal_name TEXT NOT NULL CHECK(length(btrim(tdra_registered_legal_name))>=2),
  tdra_registered_at DATE NOT NULL,tdra_verified_at TIMESTAMPTZ NOT NULL,
  tdra_evidence_reference TEXT NOT NULL CHECK(length(btrim(tdra_evidence_reference))>=3),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),effective_to TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((status='active' AND effective_to IS NULL) OR (status='retired' AND effective_to IS NOT NULL)));

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY,display_name TEXT,phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL UNIQUE CHECK(normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  email TEXT,normalized_email TEXT CHECK(normalized_email IS NULL OR normalized_email=LOWER(normalized_email)),
  source TEXT NOT NULL DEFAULT 'cold_call' CHECK(source IN('cold_call','referral','event','personal_network','purchased_data','other')),
  source_supplier TEXT,source_batch_reference TEXT,source_acquired_at TIMESTAMPTZ,source_evidence_reference TEXT,
  brief_notes TEXT,status TEXT NOT NULL DEFAULT 'not_contacted' CHECK(status IN('not_contacted','no_answer','call_back','interested','not_interested','do_not_contact','converted')),
  owner_id UUID NOT NULL REFERENCES brokers(id),team_id UUID REFERENCES teams(id),timezone TEXT NOT NULL,
  timezone_source TEXT NOT NULL CHECK(timezone_source IN('phone_inferred','agent_confirmed','manager_override')),
  consent_status TEXT NOT NULL DEFAULT 'unknown' CHECK(consent_status IN('unknown','verified','withdrawn','denied')),
  consent_evidence_reference TEXT,suppression_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  do_not_contact_reason TEXT,do_not_contact_at TIMESTAMPTZ,converted_contact_id UUID REFERENCES contacts(id),
  converted_at TIMESTAMPTZ,converted_by UUID REFERENCES brokers(id),created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(source<>'purchased_data' OR (source_supplier IS NOT NULL AND source_batch_reference IS NOT NULL AND source_acquired_at IS NOT NULL AND source_evidence_reference IS NOT NULL)),
  CHECK(consent_status<>'verified' OR consent_evidence_reference IS NOT NULL),
  CHECK((status='do_not_contact')=(do_not_contact_reason IS NOT NULL AND do_not_contact_at IS NOT NULL)),
  CHECK((status='converted')=(converted_contact_id IS NOT NULL AND converted_at IS NOT NULL AND converted_by IS NOT NULL)));
CREATE INDEX IF NOT EXISTS prospects_owner_status_idx ON prospects(owner_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS prospects_team_status_idx ON prospects(team_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS prospects_normalized_email_idx ON prospects(normalized_email) WHERE normalized_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS prospect_activities (
  id UUID PRIMARY KEY,prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK(activity_type IN('call','note')),direction TEXT CHECK(direction IN('inbound','outbound')),
  outcome TEXT CHECK(outcome IN('answered','no_answer','callback_requested','interested','not_interested','declined','voicemail','consumer_ended','invalid_number','other')),
  notes TEXT NOT NULL CHECK(length(btrim(notes))>=2),corrects_activity_id UUID REFERENCES prospect_activities(id),correction_reason TEXT,
  company_calling_number_id UUID REFERENCES company_calling_numbers(id),warning_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  warning_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,warning_reason TEXT,occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES brokers(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((activity_type='call' AND direction IS NOT NULL AND outcome IS NOT NULL) OR (activity_type='note' AND direction IS NULL AND outcome IS NULL)),
  CHECK(direction<>'outbound' OR company_calling_number_id IS NOT NULL),
  CHECK((corrects_activity_id IS NULL AND correction_reason IS NULL) OR (corrects_activity_id IS NOT NULL AND length(btrim(correction_reason))>=5)),
  CHECK(cardinality(warning_codes)=0 OR (warning_acknowledged AND length(btrim(warning_reason))>=5)));
CREATE INDEX IF NOT EXISTS prospect_activities_timeline_idx ON prospect_activities(prospect_id,occurred_at DESC,id);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prospect_id UUID REFERENCES prospects(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prospect_channel TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS policy_warning_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS policy_warning_acknowledged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS policy_warning_reason TEXT;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK(task_type IN(
  'general','proposal_correction','customer_response_follow_up','leave_approval','document_compliance_follow_up',
  'marketing_material_review','marketing_material_follow_up','qualification_follow_up','web_intake_follow_up','prospect_follow_up'));
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_context_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_context_check CHECK(
  (task_type='prospect_follow_up' AND prospect_id IS NOT NULL AND prospect_channel IN('call','whatsapp','email') AND lead_id IS NULL AND contact_id IS NULL AND leave_application_id IS NULL AND marketing_material_version_id IS NULL AND follow_up_case_id IS NULL) OR
  (task_type='leave_approval' AND prospect_id IS NULL AND prospect_channel IS NULL AND leave_application_id IS NOT NULL AND marketing_material_version_id IS NULL AND follow_up_case_id IS NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type IN('marketing_material_review','marketing_material_follow_up') AND prospect_id IS NULL AND prospect_channel IS NULL AND marketing_material_version_id IS NOT NULL AND leave_application_id IS NULL AND follow_up_case_id IS NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type='web_intake_follow_up' AND prospect_id IS NULL AND prospect_channel IS NULL AND follow_up_case_id IS NOT NULL AND leave_application_id IS NULL AND marketing_material_version_id IS NULL) OR
  (task_type NOT IN('prospect_follow_up','leave_approval','marketing_material_review','marketing_material_follow_up','web_intake_follow_up') AND prospect_id IS NULL AND prospect_channel IS NULL AND leave_application_id IS NULL AND marketing_material_version_id IS NULL AND follow_up_case_id IS NULL AND lead_id IS NOT NULL AND contact_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS tasks_prospect_due_idx ON tasks(prospect_id,status,due_at) WHERE prospect_id IS NOT NULL;
DO $$ BEGIN
  ALTER TABLE tasks ADD CONSTRAINT tasks_policy_warning_acknowledgement_check CHECK(
    cardinality(policy_warning_codes)=0 OR (policy_warning_acknowledged AND length(btrim(policy_warning_reason))>=5));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION nysa_guard_prospect_outreach() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prospect_status TEXT; BEGIN
  SELECT status INTO prospect_status FROM prospects WHERE id=NEW.prospect_id;
  IF prospect_status IN('do_not_contact','converted') AND NEW.activity_type<>'note' THEN
    RAISE EXCEPTION 'Prospect outreach is blocked while status is %',prospect_status USING ERRCODE='23514'; END IF;
  RETURN NEW; END $$;
DROP TRIGGER IF EXISTS prospect_activities_outreach_guard ON prospect_activities;
CREATE TRIGGER prospect_activities_outreach_guard BEFORE INSERT ON prospect_activities FOR EACH ROW EXECUTE FUNCTION nysa_guard_prospect_outreach();

CREATE OR REPLACE FUNCTION nysa_prospect_activities_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Prospect Diary activity evidence is append-only' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS prospect_activities_append_only ON prospect_activities;
CREATE TRIGGER prospect_activities_append_only BEFORE UPDATE OR DELETE ON prospect_activities FOR EACH ROW EXECUTE FUNCTION nysa_prospect_activities_append_only();

CREATE OR REPLACE FUNCTION nysa_prospect_status_effects() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.status IN('do_not_contact','converted') AND OLD.status IS DISTINCT FROM NEW.status THEN
  UPDATE tasks SET status='cancelled',outcome='Prospect outreach closed: '||NEW.status,updated_at=NOW()
    WHERE prospect_id=NEW.id AND task_type='prospect_follow_up' AND status IN('open','in_progress'); END IF; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS prospects_status_effects ON prospects;
CREATE TRIGGER prospects_status_effects AFTER UPDATE OF status ON prospects FOR EACH ROW EXECUTE FUNCTION nysa_prospect_status_effects();

DO $$ DECLARE prior_expression TEXT; BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO prior_expression FROM pg_constraint
    WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  IF prior_expression IS NULL THEN RAISE EXCEPTION 'audit_log entity contract is missing'; END IF;
  IF prior_expression NOT LIKE '%Prospect%' THEN
    ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
    EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('||prior_expression||') OR entity_type IN (''Prospect'',''ProspectActivity'',''CompanyCallingNumber'',''ContactSuppression''))';
  END IF; END $$;
