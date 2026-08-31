ALTER TABLE website_intake_events DROP CONSTRAINT IF EXISTS website_intake_events_status_check;
ALTER TABLE website_intake_events ADD CONSTRAINT website_intake_events_status_check
  CHECK (status IN ('processing','accepted','failed','email_review','identity_review','duplicate_review','rejected'));

ALTER TABLE website_intake_events DROP CONSTRAINT IF EXISTS website_intake_events_resolution_check;
ALTER TABLE website_intake_events ADD CONSTRAINT website_intake_events_resolution_check
  CHECK (resolution IS NULL OR resolution IN (
    'use_email_customer','use_phone_customer','create_distinct_customer','reject_invalid',
    'approve_email_only'
  ));

ALTER TABLE lead_recovery_cases DROP CONSTRAINT IF EXISTS lead_recovery_cases_category_check;
ALTER TABLE lead_recovery_cases ADD CONSTRAINT lead_recovery_cases_category_check
  CHECK (category IN (
    'intake_email_review','intake_identity_review','intake_duplicate_review','intake_failed','unassigned_ageing','acceptance_breach',
    'first_contact_breach','no_next_action','overdue_next_action','overdue_task','repeated_reassignment'
  ));

GRANT SELECT,INSERT,UPDATE ON website_intake_events TO nysareal_nysar2app;

CREATE TABLE customer_evidence_facts (
  id UUID PRIMARY KEY,
  intake_event_id UUID NOT NULL REFERENCES website_intake_events(id),
  contact_id UUID REFERENCES contacts(id),
  lead_id UUID REFERENCES leads(id),
  fact_group TEXT NOT NULL CHECK (fact_group IN ('identity','enquiry','requirement','profile','attribution','consent')),
  fact_code TEXT NOT NULL,
  value_json JSONB NOT NULL,
  evidence_kind TEXT NOT NULL CHECK (evidence_kind IN ('declared','inferred','system_observed','confirmed','verified')),
  review_status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review','active','rejected','superseded')),
  source_code TEXT NOT NULL,
  source_version TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  supersedes_fact_id UUID REFERENCES customer_evidence_facts(id),
  retention_policy_code TEXT,
  retention_until TIMESTAMPTZ,
  UNIQUE(intake_event_id,fact_code)
);

CREATE INDEX customer_evidence_contact_idx ON customer_evidence_facts(contact_id,captured_at DESC)
  WHERE review_status='active';
CREATE INDEX customer_evidence_lead_idx ON customer_evidence_facts(lead_id,captured_at DESC)
  WHERE review_status='active';
CREATE INDEX customer_evidence_review_idx ON customer_evidence_facts(review_status,captured_at)
  WHERE review_status='pending_review';

GRANT SELECT,INSERT,UPDATE ON customer_evidence_facts TO nysareal_nysar2app;
