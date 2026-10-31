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
GRANT SELECT,INSERT,UPDATE,DELETE ON lead_source_inbox,lead_follow_up_cases,lead_follow_up_jobs,lead_follow_up_events TO nysareal_nysar2app;
