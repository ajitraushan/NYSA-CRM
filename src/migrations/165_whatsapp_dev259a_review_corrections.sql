-- DEV259a Addendum 2 corrections. Number-independent controls only.
-- No provider submission, external message dispatch or live receiver is enabled.

UPDATE wa_recipient_import_batches
SET source_type='other',
    source_description=COALESCE(source_description,'Legacy combined Website/CTWA source - classification review required')
WHERE source_type='website_ctwa';
ALTER TABLE wa_recipient_import_batches DROP CONSTRAINT IF EXISTS wa_recipient_import_batches_source_type_check;
ALTER TABLE wa_recipient_import_batches ADD CONSTRAINT wa_recipient_import_batches_source_type_check
  CHECK(source_type IN ('existing_crm','website','ctwa','property_portal','event','referral','purchased_list','other'));

UPDATE wa_conversations
SET source_type='other',source_reference=COALESCE(source_reference,'Legacy combined Website/CTWA source - classification review required')
WHERE source_type='website_ctwa';
ALTER TABLE wa_conversations DROP CONSTRAINT IF EXISTS wa_conversations_source_type_check;
ALTER TABLE wa_conversations ADD CONSTRAINT wa_conversations_source_type_check
  CHECK(source_type IN ('existing_crm','website','ctwa','property_portal','event','referral','purchased_list','other'));

ALTER TABLE wa_message_templates ADD COLUMN name_locked_at TIMESTAMPTZ;

ALTER TABLE wa_campaign_drafts
  ADD COLUMN scheduled_at TIMESTAMPTZ,
  ADD COLUMN budget_aed NUMERIC(12,2),
  ADD COLUMN approved_revision INTEGER,
  ADD COLUMN approved_snapshot_hash TEXT,
  ADD COLUMN approved_recipient_count INTEGER,
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD CONSTRAINT wa_campaign_drafts_budget_check CHECK(budget_aed IS NULL OR budget_aed>0),
  ADD CONSTRAINT wa_campaign_drafts_approval_hash_check CHECK(approved_snapshot_hash IS NULL OR length(approved_snapshot_hash)=64);

CREATE TABLE wa_campaign_approval_recipients (
  campaign_id UUID NOT NULL REFERENCES wa_campaign_drafts(id),
  revision INTEGER NOT NULL CHECK(revision>0),
  recipient_id UUID NOT NULL REFERENCES wa_campaign_recipients(id),
  normalized_phone TEXT NOT NULL CHECK(normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  display_name TEXT NOT NULL,
  rendered_message TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64),
  removed_at TIMESTAMPTZ,
  removal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(campaign_id,revision,normalized_phone)
);
CREATE INDEX wa_campaign_approval_recipients_phone_idx ON wa_campaign_approval_recipients(normalized_phone,removed_at);

CREATE TABLE wa_contact_suppressions (
  normalized_phone TEXT PRIMARY KEY CHECK(normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
  suppression_type TEXT NOT NULL CHECK(suppression_type IN ('opt_out','wrong_number')),
  evidence_reference TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES brokers(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audit_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '12 months'
);

ALTER TABLE wa_conversations
  ADD COLUMN responder_mode TEXT NOT NULL DEFAULT 'human' CHECK(responder_mode IN ('human','ai')),
  ADD COLUMN reply_lock_owner_id UUID REFERENCES brokers(id),
  ADD COLUMN reply_lock_acquired_at TIMESTAMPTZ;

ALTER TABLE wa_campaign_audit ADD COLUMN audit_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '12 months';
CREATE INDEX wa_campaign_audit_retention_idx ON wa_campaign_audit(audit_expires_at);

GRANT SELECT,INSERT,UPDATE ON wa_campaign_approval_recipients,wa_contact_suppressions TO nysareal_nysar2app;
