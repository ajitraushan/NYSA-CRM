-- WA-001 Stage B foundation. Draft/import/catalogue/approval records only.
-- No provider dispatch table or sending trigger exists in this migration.
CREATE TABLE wa_recipient_import_batches (
 id UUID PRIMARY KEY, batch_reference TEXT NOT NULL UNIQUE,
 original_file_name TEXT NOT NULL, file_hash TEXT NOT NULL CHECK(length(file_hash)=64),
 status TEXT NOT NULL CHECK(status IN ('reviewed','committed','retired')),
 row_count INTEGER NOT NULL CHECK(row_count BETWEEN 1 AND 5000),
 ready_count INTEGER NOT NULL DEFAULT 0, review_count INTEGER NOT NULL DEFAULT 0,
 invalid_count INTEGER NOT NULL DEFAULT 0,
 created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 committed_at TIMESTAMPTZ, raw_expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '30 days',
 UNIQUE(file_hash,created_by)
);

CREATE TABLE wa_campaign_recipients (
 id UUID PRIMARY KEY, batch_id UUID NOT NULL REFERENCES wa_recipient_import_batches(id),
 row_number INTEGER NOT NULL CHECK(row_number>0), name TEXT NOT NULL,
 normalized_phone TEXT NOT NULL CHECK(normalized_phone ~ '^\+[1-9][0-9]{7,14}$'),
 email TEXT, requirements JSONB NOT NULL DEFAULT '{}', tags TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
 source_code TEXT NOT NULL DEFAULT 'bulk_upload',
 consent_status TEXT NOT NULL DEFAULT 'not_documented' CHECK(consent_status IN ('documented','not_documented','withdrawn')),
 consent_evidence_ref TEXT, suppression_status TEXT NOT NULL DEFAULT 'not_suppressed' CHECK(suppression_status IN ('not_suppressed','suppressed')),
 duplicate_disposition TEXT NOT NULL DEFAULT 'unique' CHECK(duplicate_disposition IN ('unique','review_required','linked','kept_separate','excluded')),
 matched_contact_id UUID REFERENCES contacts(id), fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(batch_id,row_number),
 CHECK(consent_status<>'documented' OR consent_evidence_ref IS NOT NULL)
);
CREATE INDEX wa_campaign_recipients_phone_idx ON wa_campaign_recipients(normalized_phone);
CREATE INDEX wa_campaign_recipients_tags_idx ON wa_campaign_recipients USING GIN(tags);
CREATE INDEX wa_campaign_recipients_requirements_idx ON wa_campaign_recipients USING GIN(requirements);

CREATE TABLE wa_audience_segments (
 id UUID PRIMARY KEY, name TEXT NOT NULL, description TEXT,
 definition JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','retired')),
 owner_team_id UUID NOT NULL REFERENCES teams(id), created_by UUID NOT NULL REFERENCES brokers(id),
 updated_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), retired_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX wa_audience_segments_name_uq ON wa_audience_segments(owner_team_id,LOWER(name)) WHERE status='active';

CREATE TABLE wa_template_catalogue (
 id UUID PRIMARY KEY, provider TEXT NOT NULL DEFAULT '360dialog' CHECK(provider='360dialog'),
 account_ref_hash TEXT NOT NULL CHECK(length(account_ref_hash)=64), provider_template_id TEXT,
 template_name TEXT NOT NULL, language_code TEXT NOT NULL, category TEXT,
 provider_status TEXT NOT NULL CHECK(provider_status IN ('approved','pending','rejected','paused','disabled','unknown')),
 components JSONB NOT NULL DEFAULT '[]', synced_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(provider,account_ref_hash,template_name,language_code)
);

CREATE TABLE wa_campaign_drafts (
 id UUID PRIMARY KEY, campaign_reference TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 owner_team_id UUID NOT NULL REFERENCES teams(id), segment_id UUID NOT NULL REFERENCES wa_audience_segments(id),
 template_id UUID NOT NULL REFERENCES wa_template_catalogue(id), template_variables JSONB NOT NULL DEFAULT '{}',
 purpose TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_approval','approved','returned','retired')),
 prepared_by UUID NOT NULL REFERENCES brokers(id), submitted_at TIMESTAMPTZ,
 decision_by UUID REFERENCES brokers(id), decision_at TIMESTAMPTZ, decision_reason TEXT,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wa_campaign_drafts_scope_idx ON wa_campaign_drafts(owner_team_id,status,updated_at DESC);

CREATE TABLE wa_campaign_revisions (
 id UUID PRIMARY KEY, campaign_id UUID NOT NULL REFERENCES wa_campaign_drafts(id),
 revision INTEGER NOT NULL CHECK(revision>0), snapshot JSONB NOT NULL,
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64), created_by UUID NOT NULL REFERENCES brokers(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(campaign_id,revision)
);

CREATE TABLE wa_campaign_audit (
 id UUID PRIMARY KEY, entity_type TEXT NOT NULL CHECK(entity_type IN ('recipient_import','segment','template_catalogue','campaign')),
 entity_id UUID NOT NULL, action TEXT NOT NULL, actor_id UUID REFERENCES brokers(id),
 details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX wa_campaign_audit_entity_idx ON wa_campaign_audit(entity_type,entity_id,created_at DESC);

GRANT SELECT,INSERT,UPDATE ON wa_recipient_import_batches,wa_campaign_recipients,wa_audience_segments,
 wa_template_catalogue,wa_campaign_drafts,wa_campaign_revisions,wa_campaign_audit TO nysareal_nysar2app;
