-- NYSA-CRM-20261029-LEAD-003 v1.3, Phase 1.
-- Additive journey, provisional identity, pickup and primary-task foundation.
-- Existing Customers, Leads, Requirements, owners and response cases are retained.

CREATE TABLE web_intake_provisional_identities (
  id UUID PRIMARY KEY,
  source_system TEXT NOT NULL CHECK(source_system IN ('website','meta','other')),
  encrypted_identity TEXT,
  masked_name TEXT,
  masked_email TEXT,
  masked_phone TEXT,
  phone_match_hash CHAR(64),
  email_match_hash CHAR(64),
  match_key_version TEXT NOT NULL,
  matched_contact_id UUID REFERENCES contacts(id),
  match_confidence TEXT NOT NULL DEFAULT 'none'
    CHECK(match_confidence IN ('none','candidate','deterministic')),
  consent_statement_ref TEXT,
  permitted_channels TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  state TEXT NOT NULL DEFAULT 'provisional'
    CHECK(state IN ('provisional','resolved','expired','invalid')),
  resolved_contact_id UUID REFERENCES contacts(id),
  resolved_at TIMESTAMPTZ,
  resolved_by_event TEXT CHECK(resolved_by_event IN ('completion','pickup','verified_reply')),
  expires_at TIMESTAMPTZ NOT NULL,
  deidentified_at TIMESTAMPTZ,
  invalid_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(state<>'resolved' OR (resolved_contact_id IS NOT NULL AND resolved_at IS NOT NULL AND resolved_by_event IS NOT NULL)),
  CHECK(state<>'expired' OR deidentified_at IS NOT NULL),
  CHECK(phone_match_hash IS NULL OR phone_match_hash ~ '^[a-f0-9]{64}$'),
  CHECK(email_match_hash IS NULL OR email_match_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX web_intake_provisional_phone_match_idx
  ON web_intake_provisional_identities(match_key_version,phone_match_hash)
  WHERE state='provisional' AND phone_match_hash IS NOT NULL;
CREATE INDEX web_intake_provisional_email_match_idx
  ON web_intake_provisional_identities(match_key_version,email_match_hash)
  WHERE state='provisional' AND email_match_hash IS NOT NULL;
CREATE INDEX web_intake_provisional_expiry_idx
  ON web_intake_provisional_identities(expires_at)
  WHERE state='provisional';

CREATE TABLE web_intake_contact_match_keys (
  contact_id UUID NOT NULL REFERENCES contacts(id),
  channel_kind TEXT NOT NULL CHECK(channel_kind IN ('Email','Phone')),
  match_key_version TEXT NOT NULL,
  match_hash CHAR(64) NOT NULL CHECK(match_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(contact_id,channel_kind,match_key_version),
  UNIQUE(channel_kind,match_key_version,match_hash,contact_id)
);
CREATE INDEX web_intake_contact_match_lookup_idx
  ON web_intake_contact_match_keys(channel_kind,match_key_version,match_hash);

CREATE TABLE web_intake_journeys (
  id UUID PRIMARY KEY,
  source_system TEXT NOT NULL CHECK(source_system IN ('website','meta','other')),
  source_account_id TEXT NOT NULL,
  source_form_id TEXT NOT NULL,
  journey_key TEXT NOT NULL,
  predecessor_journey_id UUID REFERENCES web_intake_journeys(id),
  chain_root_journey_id UUID NOT NULL REFERENCES web_intake_journeys(id) DEFERRABLE INITIALLY DEFERRED,
  prefilled_from_journey_id UUID REFERENCES web_intake_journeys(id),
  carried_forward_answers TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  provisional_identity_id UUID NOT NULL REFERENCES web_intake_provisional_identities(id),
  contact_id UUID REFERENCES contacts(id),
  intake_mode TEXT NOT NULL CHECK(intake_mode IN ('single_step','multi_step')),
  state TEXT NOT NULL CHECK(state IN ('in_progress','dropped_incomplete','completed','invalid')),
  invalid_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL,
  resume_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  dropped_at TIMESTAMPTZ,
  current_event_id UUID REFERENCES website_intake_events(id),
  final_event_id UUID REFERENCES website_intake_events(id),
  final_snapshot JSONB,
  structured_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  missing_fields TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  source_campaign_code TEXT,
  campaign_id UUID REFERENCES marketing_campaigns(id),
  campaign_mapping_status TEXT NOT NULL DEFAULT 'not_supplied'
    CHECK(campaign_mapping_status IN ('not_supplied','mapped','unmapped')),
  follow_up_case_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((state='in_progress' AND intake_mode='multi_step' AND resume_expires_at IS NOT NULL AND completed_at IS NULL AND dropped_at IS NULL)
    OR (state='dropped_incomplete' AND intake_mode='multi_step' AND dropped_at IS NOT NULL AND completed_at IS NULL)
    OR (state='completed' AND completed_at IS NOT NULL)
    OR (state='invalid' AND invalid_reason IS NOT NULL)),
  CHECK(intake_mode<>'single_step' OR state IN ('completed','invalid'))
);
CREATE UNIQUE INDEX web_intake_one_active_source_journey_idx
  ON web_intake_journeys(source_system,source_account_id,journey_key)
  WHERE state='in_progress';
CREATE INDEX web_intake_journey_chain_idx
  ON web_intake_journeys(chain_root_journey_id,last_activity_at DESC);
CREATE INDEX web_intake_journey_expiry_idx
  ON web_intake_journeys(resume_expires_at)
  WHERE state='in_progress';
CREATE INDEX web_intake_journey_desk_idx
  ON web_intake_journeys(state,completed_at,dropped_at,last_activity_at);

ALTER TABLE website_intake_events
  ADD COLUMN web_intake_journey_id UUID REFERENCES web_intake_journeys(id),
  ADD COLUMN intake_stage TEXT CHECK(intake_stage IN ('provisional','final','invalid'));
CREATE INDEX website_intake_events_web_journey_idx
  ON website_intake_events(web_intake_journey_id,received_at);

ALTER TABLE lead_source_inbox
  ADD COLUMN web_intake_journey_id UUID UNIQUE REFERENCES web_intake_journeys(id);

ALTER TABLE lead_follow_up_cases ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE lead_follow_up_cases
  ADD COLUMN journey_id UUID REFERENCES web_intake_journeys(id),
  ADD COLUMN chain_root_journey_id UUID REFERENCES web_intake_journeys(id),
  ADD COLUMN case_kind TEXT NOT NULL DEFAULT 'legacy_response'
    CHECK(case_kind IN ('legacy_response','completed_intake','incomplete_recovery','routed_to_owner')),
  ADD COLUMN picked_up_by UUID REFERENCES brokers(id),
  ADD COLUMN picked_up_at TIMESTAMPTZ,
  ADD COLUMN promoted_at TIMESTAMPTZ,
  ADD COLUMN requested_callback_at TIMESTAMPTZ,
  ADD COLUMN requested_meeting_at TIMESTAMPTZ,
  ADD COLUMN booking_status TEXT CHECK(booking_status IN ('requested','human_confirmed')),
  ADD COLUMN escalation_due_at TIMESTAMPTZ,
  ADD COLUMN escalated_at TIMESTAMPTZ,
  ADD COLUMN stale_notice_due_at TIMESTAMPTZ,
  ADD COLUMN stale_notified_at TIMESTAMPTZ,
  ADD COLUMN stale_release_due_at TIMESTAMPTZ,
  ADD COLUMN released_at TIMESTAMPTZ,
  ADD COLUMN released_from_owner UUID REFERENCES brokers(id),
  ADD COLUMN close_outcome TEXT CHECK(close_outcome IN ('not_interested','unreachable','wrong_person','duplicate','invalid','spam','opted_out')),
  ADD COLUMN exception_owner_id UUID REFERENCES brokers(id),
  ADD COLUMN last_contact_attempt_at TIMESTAMPTZ,
  ADD COLUMN previous_owner_id UUID REFERENCES brokers(id),
  ADD COLUMN released_reason TEXT;

ALTER TABLE lead_follow_up_cases DROP CONSTRAINT lead_follow_up_cases_state_check;
ALTER TABLE lead_follow_up_cases ADD CONSTRAINT lead_follow_up_cases_state_check CHECK(state IN (
  'ready','needs_review','engaged','outcome_unknown','human_owned','booked','opted_out','wrong_person','complete','handoff_pending',
  'unassigned','ai_handling','awaiting_pickup_urgent','promoted','released','closed','needs_attention','no_response'
));
ALTER TABLE lead_follow_up_cases ADD CONSTRAINT lead_follow_up_cases_journey_context_check CHECK(
  (case_kind='legacy_response') OR (journey_id IS NOT NULL AND chain_root_journey_id IS NOT NULL)
);
CREATE UNIQUE INDEX lead_follow_up_active_chain_idx
  ON lead_follow_up_cases(chain_root_journey_id)
  WHERE chain_root_journey_id IS NOT NULL AND state NOT IN ('closed','complete','opted_out','wrong_person');
CREATE INDEX lead_follow_up_pickup_desk_idx
  ON lead_follow_up_cases(state,escalation_due_at,assignment_due_at)
  WHERE fallback_owner_id IS NULL;
CREATE INDEX lead_follow_up_owner_stale_idx
  ON lead_follow_up_cases(stale_release_due_at)
  WHERE fallback_owner_id IS NOT NULL AND last_contact_attempt_at IS NULL;

ALTER TABLE web_intake_journeys
  ADD CONSTRAINT web_intake_journeys_follow_up_case_fk
  FOREIGN KEY(follow_up_case_id) REFERENCES lead_follow_up_cases(id);

ALTER TABLE tasks ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE tasks
  ADD COLUMN follow_up_case_id UUID REFERENCES lead_follow_up_cases(id),
  ADD COLUMN task_kind TEXT,
  ADD COLUMN landing_priority INTEGER CHECK(landing_priority BETWEEN 1 AND 8),
  ADD COLUMN due_basis TEXT CHECK(due_basis IN ('pickup','requested_time','routing','promotion','attempt_cadence')),
  ADD COLUMN due_at_open BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN customer_timezone TEXT,
  ADD COLUMN ai_summary_ref TEXT,
  ADD COLUMN attempt_number INTEGER CHECK(attempt_number IS NULL OR attempt_number>0),
  ADD COLUMN is_primary_next_action BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN outcome_at TIMESTAMPTZ;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK(task_type IN(
  'general','proposal_correction','customer_response_follow_up','leave_approval','document_compliance_follow_up',
  'marketing_material_review','marketing_material_follow_up','qualification_follow_up','web_intake_follow_up'
));
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_context_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_context_check CHECK(
  (task_type='leave_approval' AND leave_application_id IS NOT NULL AND marketing_material_version_id IS NULL AND follow_up_case_id IS NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type IN('marketing_material_review','marketing_material_follow_up') AND marketing_material_version_id IS NOT NULL AND leave_application_id IS NULL AND follow_up_case_id IS NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type='web_intake_follow_up' AND follow_up_case_id IS NOT NULL AND leave_application_id IS NULL AND marketing_material_version_id IS NULL) OR
  (task_type NOT IN('leave_approval','marketing_material_review','marketing_material_follow_up','web_intake_follow_up') AND leave_application_id IS NULL AND marketing_material_version_id IS NULL AND follow_up_case_id IS NULL AND lead_id IS NOT NULL AND contact_id IS NOT NULL)
);
CREATE UNIQUE INDEX tasks_one_open_primary_follow_up_idx
  ON tasks(follow_up_case_id)
  WHERE follow_up_case_id IS NOT NULL AND is_primary_next_action AND status IN ('open','in_progress');
CREATE INDEX tasks_web_intake_queue_idx
  ON tasks(assignee_id,status,landing_priority,due_at)
  WHERE follow_up_case_id IS NOT NULL;

CREATE TABLE web_intake_contact_attempts (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),
  task_id UUID NOT NULL REFERENCES tasks(id),
  actor_id UUID NOT NULL REFERENCES brokers(id),
  outcome TEXT NOT NULL CHECK(outcome IN ('contacted','no_answer','left_message','wrong_number','opted_out','meeting_confirmed','callback_rescheduled','not_interested','promoted')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  successor_task_id UUID REFERENCES tasks(id),
  notes TEXT,
  UNIQUE(task_id)
);
CREATE INDEX web_intake_attempt_case_idx ON web_intake_contact_attempts(case_id,occurred_at DESC);

CREATE TABLE web_intake_configuration_versions (
  id UUID PRIMARY KEY,
  scope_code TEXT NOT NULL,
  version_no INTEGER NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_escalation_minutes INTEGER NOT NULL DEFAULT 15 CHECK(completed_escalation_minutes BETWEEN 1 AND 1440),
  dropped_escalation_business_minutes INTEGER NOT NULL DEFAULT 480 CHECK(dropped_escalation_business_minutes BETWEEN 1 AND 10080),
  stale_notice_minutes INTEGER NOT NULL DEFAULT 30 CHECK(stale_notice_minutes BETWEEN 1 AND 1440),
  stale_release_minutes INTEGER NOT NULL DEFAULT 60 CHECK(stale_release_minutes BETWEEN 1 AND 1440),
  pickup_cap INTEGER NOT NULL DEFAULT 5 CHECK(pickup_cap BETWEEN 1 AND 100),
  journey_inactivity_minutes INTEGER NOT NULL DEFAULT 30 CHECK(journey_inactivity_minutes BETWEEN 5 AND 1440),
  provisional_retention_days INTEGER NOT NULL DEFAULT 30 CHECK(provisional_retention_days BETWEEN 1 AND 365),
  outbound_start_minute INTEGER NOT NULL DEFAULT 540 CHECK(outbound_start_minute BETWEEN 0 AND 1439),
  outbound_end_minute INTEGER NOT NULL DEFAULT 1260 CHECK(outbound_end_minute BETWEEN 1 AND 1440),
  created_by UUID REFERENCES brokers(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  UNIQUE(scope_code,version_no)
);
CREATE UNIQUE INDEX web_intake_current_configuration_idx
  ON web_intake_configuration_versions(scope_code) WHERE superseded_at IS NULL;
INSERT INTO web_intake_configuration_versions(id,scope_code,version_no,reason)
VALUES(gen_random_uuid(),'default',1,'Approved CRM Test UAT values from NYSA-CRM-20261029-LEAD-003 v1.3');

CREATE TABLE web_intake_configuration_exceptions (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),
  exception_code TEXT NOT NULL CHECK(exception_code IN ('no_escalation_recipient','identity_ambiguous','source_mapping','invalid_configuration')),
  state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','resolved')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_by UUID REFERENCES brokers(id),
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX web_intake_one_open_exception_idx
  ON web_intake_configuration_exceptions(case_id,exception_code) WHERE state='open';

DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO prior_expression
  FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  IF prior_expression IS NOT NULL THEN
    ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
    EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
      || prior_expression || ') OR entity_type IN (''WebIntakeJourney'',''WebIntakeIdentity'',''WebIntakeCase'',''WebIntakeConfiguration''))';
  END IF;
END $$;

GRANT SELECT,INSERT,UPDATE,DELETE ON
  web_intake_provisional_identities,web_intake_contact_match_keys,web_intake_journeys,
  web_intake_contact_attempts,web_intake_configuration_versions,web_intake_configuration_exceptions
TO nysareal_nysar2app;
