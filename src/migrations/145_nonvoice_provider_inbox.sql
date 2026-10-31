CREATE TABLE lead_response_provider_inbox (
 id UUID PRIMARY KEY,provider TEXT NOT NULL CHECK(provider IN ('whatsapp','email')),
 event_ref TEXT NOT NULL,connection_ref TEXT NOT NULL,event_digest TEXT NOT NULL,
 encrypted_payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'received' CHECK(state IN ('received','processed','needs_review')),
 error_code TEXT,received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,
 UNIQUE(provider,connection_ref,event_ref)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON lead_response_provider_inbox TO nysareal_nysar2app;
