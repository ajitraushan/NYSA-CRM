-- REVIEW ONLY. Production execution requires exact version approval and fresh paired backups.
-- Source a6fafab35ef0042f0a5b1c31c5bd35dd33821590; baseline RC1 b6e013c51f46be482858e733160fa7e675ff3106; 19 pending migrations.
\set ON_ERROR_STOP on
DO $guard$ BEGIN
 IF current_database()<>'nysareal_nysacrm' OR current_user<>'nysareal_nysacrmapp' THEN RAISE EXCEPTION 'Production database/role identity mismatch'; END IF;
 IF (SELECT COUNT(*) FROM schema_migrations)<>140 OR EXISTS(SELECT version FROM schema_migrations EXCEPT SELECT UNNEST(ARRAY['001_initial.sql','002_crm_foundation.sql','003_phase1_completion.sql','004_governance_and_scope.sql','005_lead_operations.sql','006_qualification_and_finance.sql','007_media_documents_proposals.sql','008_dashboards_reporting.sql','009_acceptance_hardening.sql','010_role_dashboard_rebuild.sql','011_organization_profile_governance.sql','012_release1_admin_uat_corrections.sql','013_customer_proposal_address.sql','014_customer_kyc_summary.sql','015_inventory_business_reference.sql','016_ai_assistance_runs.sql','017_operational_qualification_questionnaire.sql','018_team_queue_only_lead_intake.sql','019_ai_assistance_audit_constraint.sql','020_proposal_business_numbers.sql','021_password_reset_requests.sql','022_proposal_changes_requested.sql','023_proposal_correction_tasks.sql','024_team_reporting_lines.sql','025_manager_director_reporting.sql','026_routing_rule_governance.sql','027_inventory_commercial_readiness.sql','028_governed_areas_and_routing.sql','029_listing_executive_workflow.sql','030_property_media_governance.sql','031_orphaned_property_media_approval.sql','032_listing_location_and_bulk_deals.sql','033_property_media_approval_policy.sql','034_property_media_policy_audit.sql','035_listing_approval_policy.sql','036_provider_neutral_listing_intake.sql','037_listing_mapping_governance.sql','038_release2_opportunity_foundation.sql','039_release2_connected_operations.sql','040_release2_matching_viewing.sql','041_google_calendar_integration.sql','042_google_calendar_sync_reconciliation.sql','043_activity_google_meet.sql','044_viewing_client_message.sql','045_release2_offer_negotiation.sql','046_release2_booking_reservation.sql','047_release2_deal_foundation.sql','048_release2_deal_stage_constraint.sql','049_release2_release_candidate.sql','050_release2_customer_kyc_uat_corrections.sql','051_release2_final_uat_remediation.sql','052_release2_full_remediation_foundation.sql','053_release2_uat_evidence_and_queue.sql','054_release26_consolidated.sql','055_release26_transaction_inventory_finance.sql','056_release26_agent_assignment_scope.sql','057_release26_inventory_ownership_capture.sql','058_release26_lead_first_representation.sql','059_release26_inventory_owner_and_activation.sql','060_consolidated_lead_opportunity_remediation.sql','061_dev90_reference_and_status_governance.sql','062_release3a_customer_action_suggestions.sql','063_release3a_trusted_intake_evidence.sql','064_release3a_website_profile_evidence.sql','065_release3a_campaign_governance.sql','066_release3a_duplicate_lead_review.sql','067_release3a_lead_recovery_cases.sql','068_release3a_contact_enrichment_evidence.sql','069_release3a_contact_credibility_details.sql','070_release3a_email_only_intake_gate.sql','071_release3a_advisory_customer360_evidence.sql','072_release3a_website_journey_continuity.sql','073_release3ai_lossless_website_recommendations.sql','074_release3ai_governed_website_routing.sql','075_release3b_governed_inventory_matching.sql','076_release3b_match_decisions_and_feedback.sql','077_release3b_requirement_confirmation.sql','078_release3b_inventory_progressive_governance.sql','079_release3b_reservation_expiry_governance.sql','080_release3b_external_portal_preparation.sql','081_release3b_portal_permit_reconciliation.sql','082_release3b_property_finder_media_derivatives.sql','083_inventory_duplicate_prevention.sql','084_partner_organization_integration.sql','085_release3c_governed_share_response.sql','086_release4_official_document_evidence.sql','087_release4_dld_market_intelligence.sql','088_release5_commission_receipt_realtime_payout.sql','089_agent_employment_leave.sql','090_release6_customer_transaction_document_compliance.sql','091_release6_marketing_material_compliance.sql','092_release3b_matching_completion.sql','093_release3d_microsoft365_email.sql','094_release3d_calendly_scheduling.sql','095_dev146_full_scope_uat_governance.sql','096_activity_opportunity_stage_snapshot.sql','097_activity_enrichment_pathways.sql','098_developer_arrangement_and_listing_noc.sql','099_dev153_inventory_assignment_lifecycle.sql','100_dev158_uat040_048_operational_corrections.sql','101_dev159_customer_fit_ranking_only.sql','102_dev159_uat008_049_069_corrections.sql','103_dev159_uat062_single_source_classification.sql','104_dev160_uat070_079_journey_unblock.sql','105_dev163_uat081_qualification_follow_up_sla.sql','106_dev165_opportunity_requirement_realignment.sql','107_dev169_versioned_opportunity_stage_drafts.sql','108_dev174_single_area_maintenance.sql','109_dev174_inventory_parking_spaces.sql','110_dev174_financial_illustration.sql','111_dev175_stage_draft_audit.sql','112_dev176_commission_proof.sql','113_dev177_commission_receivables.sql','114_commission_independent_transaction_closure.sql','115_receivable_single_entry_receipts.sql','116_opportunity_finance_identity.sql','117_transaction_completion_documents.sql','118_dev186_187_receivable_workflow.sql','119_invoice_payment_auto_confirmation.sql','120_commission_payment_batches.sql','121_agent_social_media_payout_eligibility.sql','122_commission_invoice_legal_and_bank_details.sql','123_agent_payout_calculation_sheet_audit.sql','124_commission_payment_batch_release.sql','125_agent_payout_gross_tier_then_split.sql','126_executing_agent_tier_and_social_uplift.sql','127_governed_purchased_data_intake.sql','128_dev211_uat210_remediation.sql','129_dev214_offplan_developer_stock.sql','130_line_manager_leave_approval.sql','131_optional_booking_amount.sql','132_approved_documents_and_brand.sql','133_customer_identity_documents.sql','134_customer_identity_audit_types.sql','135_accountant_workspace_payout_advice.sql','136_uat_inventory_mandates_and_offer_acceptance.sql','137_uat_inventory_viewing_and_reservations.sql','138_terminal_lead_follow_up_cleanup.sql','139_workable_dashboard_targets.sql','140_business_line_organisation.sql']::text[])) THEN RAISE EXCEPTION 'Production baseline changed'; END IF;
END $guard$;

-- src/migrations/141_meta_lead_source_inbox.sql
BEGIN;
-- NYSA-CRM-20261026-LEAD-001 v1.2: additive durable source-reference inbox.
-- No existing users, ownership, lead classification or configuration is changed.
-- Restricted original form answers/PII are not stored in this reference-only inbox.
CREATE TABLE lead_source_inbox (
 id UUID PRIMARY KEY,
 source_system TEXT NOT NULL CHECK (source_system = 'meta'),
 source_account_id TEXT NOT NULL,
 source_event_id TEXT NOT NULL,
 source_form_id TEXT NOT NULL,
 reference_digest TEXT NOT NULL CHECK (reference_digest ~ '^[a-f0-9]{64}$'),
 source_created_at TIMESTAMPTZ NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 state TEXT NOT NULL DEFAULT 'pending_retrieval' CHECK (state IN ('pending_retrieval','processing','needs_review','accepted','failed')),
 lead_id UUID REFERENCES leads(id),
 error_code TEXT,
 processed_at TIMESTAMPTZ,
 UNIQUE (source_system, source_account_id, source_event_id)
);
CREATE INDEX lead_source_inbox_work ON lead_source_inbox(state, received_at);

INSERT INTO schema_migrations(version) VALUES('141_meta_lead_source_inbox.sql');
COMMIT;

-- src/migrations/142_nonvoice_follow_up_jobs.sql
BEGIN;
-- Additive, initially unused until the governed nonvoice runtime is wired and enabled.
CREATE TABLE lead_follow_up_cases (
 id UUID PRIMARY KEY,
 source_inbox_id UUID NOT NULL UNIQUE REFERENCES lead_source_inbox(id),
 lead_id UUID NOT NULL UNIQUE REFERENCES leads(id),
 fallback_owner_id UUID NOT NULL REFERENCES brokers(id),
 created_by UUID NOT NULL REFERENCES brokers(id),
 policy_version TEXT NOT NULL,
 country TEXT,
 time_zone TEXT,
 location_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
 consent_statement_version TEXT,
 consent_evidence_ref TEXT,
 whatsapp_permitted BOOLEAN NOT NULL DEFAULT FALSE,
 email_permitted BOOLEAN NOT NULL DEFAULT FALSE,
 generation INTEGER NOT NULL DEFAULT 1 CHECK(generation > 0),
 state TEXT NOT NULL CHECK(state IN ('ready','needs_review','engaged','outcome_unknown','human_owned','booked','opted_out','wrong_person','complete')),
 next_action_task_id UUID NOT NULL REFERENCES tasks(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE lead_follow_up_jobs (
 id UUID PRIMARY KEY,
 case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),
 generation INTEGER NOT NULL CHECK(generation > 0),
 step INTEGER NOT NULL CHECK(step IN (0,2,3,5,6,7)),
 channel TEXT NOT NULL CHECK(channel IN ('whatsapp','email','handoff')),
 prerequisite TEXT CHECK(prerequisite IN ('first_missed_call','first_call_ended','second_missed_call','first_call_day3')),
 state TEXT NOT NULL CHECK(state IN ('waiting','queued','claimed','outcome_unknown','complete','cancelled')),
 due_at TIMESTAMPTZ,
 lease_token UUID,
 lease_expires_at TIMESTAMPTZ,
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(case_id,generation,step),
 CHECK((step IN (0,2,5) AND channel='whatsapp') OR (step IN (3,6) AND channel='email') OR (step=7 AND channel='handoff')),
 CHECK(state<>'queued' OR due_at IS NOT NULL),
 CHECK(state<>'claimed' OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE INDEX lead_follow_up_due_jobs ON lead_follow_up_jobs(due_at) WHERE state='queued';
CREATE TABLE lead_follow_up_events (
 id UUID PRIMARY KEY,
 case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),
 provider_connection_ref TEXT NOT NULL,
 provider_event_ref TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('reply','booking','opt_out','wrong_person','takeover','unknown_outcome')),
 event_digest TEXT NOT NULL CHECK(event_digest ~ '^[a-f0-9]{64}$'),
 generation INTEGER NOT NULL,
 applied BOOLEAN NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(provider_connection_ref,provider_event_ref)
);
-- These rows store safe references only. Customer content remains in governed restricted evidence.
GRANT SELECT,INSERT,UPDATE,DELETE ON lead_source_inbox,lead_follow_up_cases,lead_follow_up_jobs,lead_follow_up_events TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('142_nonvoice_follow_up_jobs.sql');
COMMIT;

-- src/migrations/143_lead_integration_setup.sql
BEGIN;
CREATE TABLE lead_integration_setup (
 id UUID PRIMARY KEY,
 singleton BOOLEAN NOT NULL DEFAULT TRUE UNIQUE CHECK(singleton),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 draft JSONB NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(draft)='object'),
 updated_by UUID NOT NULL REFERENCES brokers(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT,INSERT,UPDATE ON lead_integration_setup TO nysareal_nysacrmapp;
DO $$
DECLARE previous TEXT;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO previous FROM pg_constraint
 WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
 IF previous IS NULL THEN RAISE EXCEPTION 'Missing audit entity constraint'; END IF;
 ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
 EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('||previous||') OR entity_type=''LeadIntegrationSetup'')';
END $$;

INSERT INTO schema_migrations(version) VALUES('143_lead_integration_setup.sql');
COMMIT;

-- src/migrations/144_nonvoice_response_workflow.sql
BEGIN;
-- CRM Test candidate: source evidence, sequence anchors, tier review, callbacks and message accounting.
CREATE TABLE lead_response_evidence (
 id UUID PRIMARY KEY,source_inbox_id UUID NOT NULL UNIQUE REFERENCES lead_source_inbox(id),
 encrypted_payload TEXT NOT NULL,payload_digest TEXT NOT NULL,expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE lead_response_anchors (
 case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),kind TEXT NOT NULL,
 anchor_at TIMESTAMPTZ NOT NULL,PRIMARY KEY(case_id,kind)
);
ALTER TABLE lead_follow_up_cases ADD COLUMN declared_requirements JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE lead_follow_up_cases ADD COLUMN tier_suggestion JSONB;
ALTER TABLE lead_follow_up_cases ADD COLUMN accepted_tier TEXT CHECK(accepted_tier IN ('Hot','Warm','Cold','Unreached','Stopped'));
ALTER TABLE lead_follow_up_cases ADD COLUMN tier_decided_by UUID REFERENCES brokers(id);
ALTER TABLE lead_follow_up_cases ADD COLUMN tier_decision_reason TEXT;
ALTER TABLE lead_follow_up_cases ADD COLUMN handoff_requested_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN handoff_accepted_at TIMESTAMPTZ;
CREATE TABLE lead_response_callbacks (
 id UUID PRIMARY KEY,case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),
 owner_id UUID NOT NULL REFERENCES brokers(id),starts_at TIMESTAMPTZ NOT NULL,
 ends_at TIMESTAMPTZ NOT NULL,customer_confirmed BOOLEAN NOT NULL CHECK(customer_confirmed),
 status TEXT NOT NULL CHECK(status IN ('confirmed_callback','cancelled')),
 created_by UUID NOT NULL REFERENCES brokers(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(ends_at=starts_at+INTERVAL '30 minutes')
);
CREATE INDEX lead_response_callback_slots ON lead_response_callbacks(owner_id,starts_at) WHERE status='confirmed_callback';
CREATE TABLE lead_response_messaging_budgets (
 budget_day DATE PRIMARY KEY,limit_usd NUMERIC(12,6) NOT NULL DEFAULT 10 CHECK(limit_usd=10),
 reserved_usd NUMERIC(12,6) NOT NULL DEFAULT 0 CHECK(reserved_usd>=0),
 CHECK(reserved_usd<=limit_usd)
);
CREATE TABLE lead_response_message_attempts (
 id UUID PRIMARY KEY,job_id UUID NOT NULL UNIQUE REFERENCES lead_follow_up_jobs(id),
 budget_day DATE NOT NULL REFERENCES lead_response_messaging_budgets(budget_day),
 reserved_usd NUMERIC(12,6) NOT NULL CHECK(reserved_usd>0),
 state TEXT NOT NULL CHECK(state IN ('reserved','accepted','outcome_unknown','cancelled')),
 provider_ref TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON lead_response_evidence,lead_response_anchors,lead_response_callbacks,
 lead_response_messaging_budgets,lead_response_message_attempts TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('144_nonvoice_response_workflow.sql');
COMMIT;

-- src/migrations/145_nonvoice_provider_inbox.sql
BEGIN;
CREATE TABLE lead_response_provider_inbox (
 id UUID PRIMARY KEY,provider TEXT NOT NULL CHECK(provider IN ('whatsapp','email')),
 event_ref TEXT NOT NULL,connection_ref TEXT NOT NULL,event_digest TEXT NOT NULL,
 encrypted_payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'received' CHECK(state IN ('received','processed','needs_review')),
 error_code TEXT,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,
 UNIQUE(provider,connection_ref,event_ref)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON lead_response_provider_inbox TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('145_nonvoice_provider_inbox.sql');
COMMIT;

-- src/migrations/146_cpanel_email_cursor.sql
BEGIN;
CREATE TABLE lead_email_mailbox_cursors (
 connection_ref TEXT PRIMARY KEY,uid_validity TEXT NOT NULL,last_uid BIGINT NOT NULL CHECK(last_uid>=0),
 initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lead_source_inbox ADD COLUMN review_owner_id UUID REFERENCES brokers(id);
ALTER TABLE lead_source_inbox ADD COLUMN review_due_at TIMESTAMPTZ;
ALTER TABLE lead_response_provider_inbox ADD COLUMN review_owner_id UUID REFERENCES brokers(id);
ALTER TABLE lead_response_provider_inbox ADD COLUMN review_due_at TIMESTAMPTZ;
GRANT SELECT,INSERT,UPDATE ON lead_email_mailbox_cursors TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('146_cpanel_email_cursor.sql');
COMMIT;

-- src/migrations/147_nonvoice_handoff_pending.sql
BEGIN;
ALTER TABLE lead_follow_up_cases DROP CONSTRAINT lead_follow_up_cases_state_check;
ALTER TABLE lead_follow_up_cases ADD CONSTRAINT lead_follow_up_cases_state_check CHECK(state IN
 ('ready','needs_review','engaged','outcome_unknown','human_owned','booked','opted_out','wrong_person','complete','handoff_pending'));

INSERT INTO schema_migrations(version) VALUES('147_nonvoice_handoff_pending.sql');
COMMIT;

-- src/migrations/148_nonvoice_ai_chat.sql
BEGIN;
CREATE TABLE lead_response_chat_drafts (
 id UUID PRIMARY KEY,case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),
 generation INTEGER NOT NULL,provider_inbox_id UUID NOT NULL UNIQUE REFERENCES lead_response_provider_inbox(id),
 encrypted_reply TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('ready','needs_human','sent','outcome_unknown','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,conversation_expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE lead_follow_up_cases ADD COLUMN chat_opened_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN chat_replies_without_progress INTEGER NOT NULL DEFAULT 0 CHECK(chat_replies_without_progress>=0);
GRANT SELECT,INSERT,UPDATE,DELETE ON lead_response_chat_drafts TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('148_nonvoice_ai_chat.sql');
COMMIT;

-- src/migrations/149_nonvoice_chat_budget.sql
BEGIN;
ALTER TABLE lead_response_chat_drafts DROP CONSTRAINT lead_response_chat_drafts_state_check;
ALTER TABLE lead_response_chat_drafts ADD CONSTRAINT lead_response_chat_drafts_state_check CHECK(state IN ('preparing','ready','needs_human','sent','outcome_unknown','cancelled'));
ALTER TABLE lead_response_chat_drafts ADD COLUMN budget_day DATE REFERENCES lead_response_messaging_budgets(budget_day);
ALTER TABLE lead_response_chat_drafts ADD COLUMN reserved_usd NUMERIC(12,6) CHECK(reserved_usd>0);
ALTER TABLE lead_response_chat_drafts ADD COLUMN provider_ref TEXT;

INSERT INTO schema_migrations(version) VALUES('149_nonvoice_chat_budget.sql');
COMMIT;

-- src/migrations/150_nonvoice_delivery_evidence.sql
BEGIN;
ALTER TABLE lead_response_message_attempts ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'unknown' CHECK(delivery_state IN ('unknown','sent','delivered','read','failed'));
ALTER TABLE lead_response_chat_drafts ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'unknown' CHECK(delivery_state IN ('unknown','sent','delivered','read','failed'));

INSERT INTO schema_migrations(version) VALUES('150_nonvoice_delivery_evidence.sql');
COMMIT;

-- src/migrations/151_nonvoice_protected_connections.sql
BEGIN;
CREATE TABLE lead_integration_connections (
 id UUID PRIMARY KEY,provider TEXT NOT NULL UNIQUE CHECK(provider IN ('meta','email','whatsapp')),
 encrypted_credentials TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,
 updated_by UUID NOT NULL REFERENCES brokers(id),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT,INSERT,UPDATE ON lead_integration_connections TO nysareal_nysacrmapp;
DO $$
DECLARE prior TEXT;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO prior FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
 IF prior IS NULL THEN RAISE EXCEPTION 'Required audit entity constraint missing'; END IF;
 ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
 EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('||prior||') OR entity_type=''LeadIntegrationConnection'')';
END $$;

INSERT INTO schema_migrations(version) VALUES('151_nonvoice_protected_connections.sql');
COMMIT;

-- src/migrations/152_nonvoice_pause_control.sql
BEGIN;
ALTER TABLE lead_integration_setup ADD COLUMN paused BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO schema_migrations(version) VALUES('152_nonvoice_pause_control.sql');
COMMIT;

-- src/migrations/153_nonvoice_retry_health.sql
BEGIN;
ALTER TABLE lead_source_inbox ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lead_source_inbox ADD COLUMN next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE lead_source_inbox ADD COLUMN requirement_digest TEXT;
CREATE INDEX lead_source_retry_due ON lead_source_inbox(next_attempt_at) WHERE state='pending_retrieval';
CREATE TABLE lead_integration_runtime_health (
 provider TEXT PRIMARY KEY,last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),status TEXT NOT NULL,safe_error_code TEXT
);
GRANT SELECT,INSERT,UPDATE ON lead_integration_runtime_health TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('153_nonvoice_retry_health.sql');
COMMIT;

-- src/migrations/154_nonvoice_manager_escalation.sql
BEGIN;
-- Approved interim routing: manager alert, never automatic agent reassignment.
ALTER TABLE lead_follow_up_cases ADD COLUMN manager_alert_task_id UUID REFERENCES tasks(id);
ALTER TABLE lead_follow_up_cases ADD COLUMN manager_alerted_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN manager_alert_setup_missing BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO schema_migrations(version) VALUES('154_nonvoice_manager_escalation.sql');
COMMIT;

-- src/migrations/155_website_shared_lead_response.sql
BEGIN;
-- NYSA-CRM-20261026-LEAD-001: website and Meta share the governed CORE response pipeline.
-- Existing cases, assignments, users, credentials and provider activation are unchanged.
ALTER TABLE lead_source_inbox DROP CONSTRAINT lead_source_inbox_source_system_check;
ALTER TABLE lead_source_inbox ADD CONSTRAINT lead_source_inbox_source_system_check
  CHECK (source_system IN ('meta','website'));
ALTER TABLE lead_source_inbox ADD COLUMN website_intake_event_id UUID UNIQUE REFERENCES website_intake_events(id);
CREATE INDEX lead_source_website_event ON lead_source_inbox(website_intake_event_id)
  WHERE source_system='website';

INSERT INTO schema_migrations(version) VALUES('155_website_shared_lead_response.sql');
COMMIT;

-- src/migrations/156_nonvoice_unassigned_response_queue.sql
BEGIN;
-- Owner-free intake is visible to authorized Admin/Managers but cannot send.
ALTER TABLE lead_follow_up_cases ALTER COLUMN fallback_owner_id DROP NOT NULL;
ALTER TABLE lead_follow_up_cases ALTER COLUMN next_action_task_id DROP NOT NULL;
ALTER TABLE lead_follow_up_cases ADD COLUMN assignment_due_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN response_owner_assigned_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN response_owner_assigned_by UUID REFERENCES brokers(id);

UPDATE lead_follow_up_cases
SET assignment_due_at=created_at+INTERVAL '2 minutes',
    response_owner_assigned_at=CASE WHEN fallback_owner_id IS NOT NULL THEN created_at END,
    response_owner_assigned_by=CASE WHEN fallback_owner_id IS NOT NULL THEN created_by END
WHERE assignment_due_at IS NULL;

ALTER TABLE lead_follow_up_cases ALTER COLUMN assignment_due_at SET NOT NULL;
CREATE INDEX lead_follow_up_unassigned_due_idx
  ON lead_follow_up_cases(assignment_due_at,created_at)
  WHERE fallback_owner_id IS NULL;

GRANT SELECT,INSERT,UPDATE,DELETE ON lead_follow_up_cases TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('156_nonvoice_unassigned_response_queue.sql');
COMMIT;

-- src/migrations/157_incoming_leads_campaign_register.sql
BEGIN;
-- NYSA-CRM-20261028-LEAD-002: campaign-level Meta intake evidence for the
-- Incoming Leads register. Customer form answers remain in encrypted evidence.
ALTER TABLE lead_source_inbox
  ADD COLUMN external_campaign_code TEXT,
  ADD COLUMN external_campaign_name TEXT,
  ADD COLUMN external_adset_code TEXT,
  ADD COLUMN external_adset_name TEXT,
  ADD COLUMN external_ad_code TEXT,
  ADD COLUMN external_ad_name TEXT,
  ADD COLUMN campaign_id UUID REFERENCES marketing_campaigns(id),
  ADD COLUMN campaign_mapping_status TEXT NOT NULL DEFAULT 'not_supplied'
    CHECK (campaign_mapping_status IN ('not_supplied','mapped','unmapped'));

CREATE INDEX lead_source_inbox_campaign_idx
  ON lead_source_inbox(campaign_id,received_at DESC)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX lead_source_inbox_unmapped_campaign_idx
  ON lead_source_inbox(received_at DESC)
  WHERE campaign_mapping_status='unmapped';

GRANT SELECT,INSERT,UPDATE ON lead_source_inbox TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('157_incoming_leads_campaign_register.sql');
COMMIT;

-- src/migrations/158_web_intake_phase1_foundation.sql
BEGIN;
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
TO nysareal_nysacrmapp;

INSERT INTO schema_migrations(version) VALUES('158_web_intake_phase1_foundation.sql');
COMMIT;

-- src/migrations/159_dev248_intake_corrections.sql
BEGIN;
-- DEV248: sequential WEB intake confirmation and closed-history evidence.
-- Additive only. Existing users, credentials, teams, assignments, Leads and
-- Requirements are retained unchanged.

ALTER TABLE lead_follow_up_cases
  ADD COLUMN closed_at TIMESTAMPTZ,
  ADD COLUMN closed_by UUID REFERENCES brokers(id);

ALTER TABLE lead_follow_up_cases
  DROP CONSTRAINT lead_follow_up_cases_close_outcome_check;
ALTER TABLE lead_follow_up_cases
  ADD CONSTRAINT lead_follow_up_cases_close_outcome_check CHECK(close_outcome IN (
    'not_interested','unreachable','wrong_person','duplicate','invalid','spam','opted_out','not_genuine'
  ));

ALTER TABLE web_intake_contact_attempts
  DROP CONSTRAINT web_intake_contact_attempts_outcome_check;
ALTER TABLE web_intake_contact_attempts
  ADD CONSTRAINT web_intake_contact_attempts_outcome_check CHECK(outcome IN (
    'contacted','no_answer','left_message','wrong_number','opted_out','meeting_confirmed',
    'callback_rescheduled','not_interested','not_genuine','duplicate','spam','invalid','promoted'
  ));

CREATE INDEX lead_follow_up_closed_history_idx
  ON lead_follow_up_cases(closed_at DESC,id)
  WHERE state IN ('closed','complete','no_response');


INSERT INTO schema_migrations(version) VALUES('159_dev248_intake_corrections.sql');
COMMIT;
