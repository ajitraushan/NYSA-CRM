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
 lead_response_messaging_budgets,lead_response_message_attempts TO nysareal_nysar2app;
