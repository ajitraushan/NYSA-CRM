ALTER TABLE lead_requirements ADD COLUMN requirement_fingerprint CHAR(64);
CREATE INDEX lead_requirements_fingerprint_idx ON lead_requirements(lead_id,requirement_fingerprint)
  WHERE requirement_fingerprint IS NOT NULL AND superseded_at IS NULL;

ALTER TABLE website_intake_events
  ADD COLUMN requirement_fingerprint CHAR(64),
  ADD COLUMN duplicate_candidate_lead_id UUID REFERENCES leads(id),
  ADD COLUMN duplicate_resolution TEXT
    CHECK (duplicate_resolution IN ('use_existing_lead','create_distinct_lead','reject_invalid')),
  ADD COLUMN duplicate_resolution_reason TEXT;

CREATE INDEX website_intake_duplicate_review_idx ON website_intake_events(review_due_at,received_at)
  WHERE status='duplicate_review';

GRANT SELECT,INSERT,UPDATE ON website_intake_events TO nysareal_nysar2app;
