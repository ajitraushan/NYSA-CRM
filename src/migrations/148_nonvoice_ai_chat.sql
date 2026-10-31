CREATE TABLE lead_response_chat_drafts (
 id UUID PRIMARY KEY,case_id UUID NOT NULL REFERENCES lead_follow_up_cases(id),
 generation INTEGER NOT NULL,provider_inbox_id UUID NOT NULL UNIQUE REFERENCES lead_response_provider_inbox(id),
 encrypted_reply TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('ready','needs_human','sent','outcome_unknown','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,conversation_expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE lead_follow_up_cases ADD COLUMN chat_opened_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN chat_replies_without_progress INTEGER NOT NULL DEFAULT 0 CHECK(chat_replies_without_progress>=0);
GRANT SELECT,INSERT,UPDATE,DELETE ON lead_response_chat_drafts TO nysareal_nysar2app;
