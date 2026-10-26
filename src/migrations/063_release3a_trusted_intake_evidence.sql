ALTER TABLE website_intake_events DROP CONSTRAINT IF EXISTS website_intake_events_status_check;
ALTER TABLE website_intake_events ADD CONSTRAINT website_intake_events_status_check
  CHECK (status IN ('processing','accepted','failed','identity_review','duplicate_review','rejected'));

ALTER TABLE website_intake_events
  ADD COLUMN received_payload JSONB,
  ADD COLUMN source_code TEXT,
  ADD COLUMN campaign_code TEXT,
  ADD COLUMN source_page TEXT,
  ADD COLUMN source_form TEXT,
  ADD COLUMN email_credibility JSONB,
  ADD COLUMN identity_conflict_contact_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN review_due_at TIMESTAMPTZ,
  ADD COLUMN resolution TEXT CHECK (resolution IN ('use_email_customer','use_phone_customer','create_distinct_customer','reject_invalid')),
  ADD COLUMN resolution_reason TEXT,
  ADD COLUMN resolved_by UUID REFERENCES brokers(id),
  ADD COLUMN resolved_at TIMESTAMPTZ;

ALTER TABLE contacts
  ADD COLUMN email_credibility_status TEXT NOT NULL DEFAULT 'not_checked'
    CHECK (email_credibility_status IN ('not_checked','credible_domain','review_advised','check_unavailable','invalid_format')),
  ADD COLUMN email_credibility_reason TEXT,
  ADD COLUMN email_credibility_checked_at TIMESTAMPTZ;

CREATE INDEX website_intake_review_queue_idx ON website_intake_events(status,review_due_at,received_at);

GRANT SELECT,INSERT,UPDATE ON website_intake_events TO nysareal_nysar2app;
