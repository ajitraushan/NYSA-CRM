-- DEV259a number-independent WhatsApp workspaces.
-- Adds governed recipient provenance, consent/suppression and inbox records.
-- It intentionally adds no provider submission or message dispatch capability.

ALTER TABLE wa_recipient_import_batches
  ADD COLUMN file_format TEXT NOT NULL DEFAULT 'csv' CHECK(file_format IN ('csv','xlsx')),
  ADD COLUMN source_type TEXT NOT NULL DEFAULT 'other'
    CHECK(source_type IN ('existing_crm','website_ctwa','property_portal','event','referral','purchased_list','other')),
  ADD COLUMN source_description TEXT,
  ADD COLUMN supplier_name TEXT,
  ADD COLUMN supplier_batch_reference TEXT,
  ADD COLUMN acquisition_date DATE,
  ADD COLUMN source_evidence_ref TEXT;

UPDATE wa_recipient_import_batches
SET source_description='Legacy import created before maintained source types'
WHERE source_type='other' AND source_description IS NULL;

ALTER TABLE wa_recipient_import_batches
  ADD CONSTRAINT wa_recipient_import_batches_source_detail_check
    CHECK(source_type<>'other' OR source_description IS NOT NULL),
  ADD CONSTRAINT wa_recipient_import_batches_purchased_provenance_check
    CHECK(source_type<>'purchased_list' OR (
      supplier_name IS NOT NULL AND supplier_batch_reference IS NOT NULL
      AND acquisition_date IS NOT NULL AND source_evidence_ref IS NOT NULL
    ));

ALTER TABLE wa_campaign_recipients
  DROP CONSTRAINT wa_campaign_recipients_consent_status_check,
  DROP CONSTRAINT wa_campaign_recipients_check;
UPDATE wa_campaign_recipients
SET consent_status=CASE consent_status
  WHEN 'documented' THEN 'verified'
  WHEN 'not_documented' THEN 'evidence_pending'
  ELSE consent_status END;
ALTER TABLE wa_campaign_recipients
  ADD CONSTRAINT wa_campaign_recipients_consent_status_check
    CHECK(consent_status IN ('verified','evidence_pending','withdrawn','denied')),
  ADD CONSTRAINT wa_campaign_recipients_verified_consent_check
    CHECK(consent_status<>'verified' OR consent_evidence_ref IS NOT NULL),
  ADD COLUMN suppressed_at TIMESTAMPTZ,
  ADD COLUMN suppression_reason TEXT;

CREATE TABLE wa_conversations (
  id UUID PRIMARY KEY,
  conversation_reference TEXT NOT NULL UNIQUE,
  normalized_phone TEXT NOT NULL CHECK(normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  display_name TEXT NOT NULL,
  source_type TEXT NOT NULL
    CHECK(source_type IN ('existing_crm','website_ctwa','property_portal','event','referral','purchased_list','other')),
  source_reference TEXT,
  contact_id UUID REFERENCES contacts(id),
  lead_id UUID REFERENCES leads(id),
  owner_team_id UUID NOT NULL REFERENCES teams(id),
  owner_agent_id UUID REFERENCES brokers(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','waiting_customer','closed')),
  last_customer_message_at TIMESTAMPTZ,
  ctwa_entry_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wa_conversations_agent_idx ON wa_conversations(owner_agent_id,status,last_activity_at DESC);
CREATE INDEX wa_conversations_team_idx ON wa_conversations(owner_team_id,status,last_activity_at DESC);

CREATE TABLE wa_conversation_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  message_type TEXT NOT NULL CHECK(message_type IN ('text','template','image','video','document','system')),
  body TEXT,
  template_version_id UUID REFERENCES wa_message_template_versions(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wa_conversation_messages_timeline_idx ON wa_conversation_messages(conversation_id,occurred_at DESC);
CREATE INDEX wa_conversation_messages_retention_idx ON wa_conversation_messages(retention_expires_at);

CREATE TABLE wa_conversation_assignment_history (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id),
  from_agent_id UUID REFERENCES brokers(id),
  to_agent_id UUID REFERENCES brokers(id),
  action TEXT NOT NULL CHECK(action IN ('assigned','reassigned','taken_over')),
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE wa_inbox_notifications (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES brokers(id),
  notification_type TEXT NOT NULL CHECK(notification_type IN ('new_message','assignment','reply_window_closing')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wa_inbox_notifications_broker_idx ON wa_inbox_notifications(broker_id,read_at,created_at DESC);

ALTER TABLE wa_campaign_audit DROP CONSTRAINT wa_campaign_audit_entity_type_check;
ALTER TABLE wa_campaign_audit ADD CONSTRAINT wa_campaign_audit_entity_type_check
  CHECK(entity_type IN ('recipient_import','segment','template_catalogue','message_template','material_catalogue','campaign','conversation'));

DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO prior_expression
  FROM pg_constraint
  WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  IF prior_expression IS NULL THEN RAISE EXCEPTION 'Required audit entity constraint is missing'; END IF;
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression || ') OR entity_type IN (''WhatsAppConversation''))';
END $$;

GRANT SELECT,INSERT,UPDATE ON wa_recipient_import_batches,wa_campaign_recipients,
  wa_conversations,wa_conversation_messages,wa_conversation_assignment_history,wa_inbox_notifications
  TO nysareal_nysar2app;
