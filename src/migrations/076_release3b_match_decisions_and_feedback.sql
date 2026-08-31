CREATE TABLE matching_policy_versions (
  policy_version TEXT PRIMARY KEY,
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('active','retired')),
  eligibility_definition JSONB NOT NULL,
  ranking_definition JSONB NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((lifecycle_status='active' AND retired_at IS NULL) OR lifecycle_status='retired')
);

INSERT INTO matching_policy_versions(policy_version,lifecycle_status,eligibility_definition,ranking_definition,activated_at)
VALUES('r3b-eligibility-v1','active',
  '{"eligibleStatuses":["Available"],"workflowStatuses":["approved"],"verificationStatuses":["verified","not_required"],"rejectExpiredVerification":true,"rejectActiveReservation":true}'::jsonb,
  '{"engine":"deterministic-rankInventoryMatches","eligibleOnly":true,"scoreRange":[0,100],"tieBreak":"inventory-input-order"}'::jsonb,
  '2026-08-02T00:00:00Z');

ALTER TABLE inventory_matching_runs
  ADD CONSTRAINT inventory_matching_runs_policy_fk FOREIGN KEY(policy_version)
  REFERENCES matching_policy_versions(policy_version);

CREATE TABLE inventory_match_decisions (
  id UUID PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES inventory_matching_candidates(id),
  previous_decision_id UUID REFERENCES inventory_match_decisions(id),
  sequence_no INTEGER NOT NULL CHECK (sequence_no>0),
  decision TEXT NOT NULL CHECK (decision IN ('shortlisted','rejected','deferred')),
  reason_code TEXT NOT NULL CHECK (reason_code IN ('strong_fit','customer_preference','budget','location','property_type','size_layout','payment_terms','timing','availability_clarification','missing_information','other')),
  reason_notes TEXT NOT NULL CHECK (LENGTH(BTRIM(reason_notes))>0),
  live_checked_at TIMESTAMPTZ NOT NULL,
  live_eligibility JSONB NOT NULL,
  decided_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id,sequence_no),
  UNIQUE(previous_decision_id),
  CHECK ((sequence_no=1 AND previous_decision_id IS NULL) OR (sequence_no>1 AND previous_decision_id IS NOT NULL))
);

CREATE INDEX inventory_match_decisions_candidate_idx
  ON inventory_match_decisions(candidate_id,sequence_no DESC);

CREATE TABLE inventory_match_feedback (
  id UUID PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES inventory_matching_candidates(id),
  decision_id UUID REFERENCES inventory_match_decisions(id),
  feedback_source TEXT NOT NULL CHECK (feedback_source IN ('customer_reported','broker_observed','viewing_feedback')),
  outcome TEXT NOT NULL CHECK (outcome IN ('interested','not_suitable','more_options','viewing_requested','information_required')),
  reason_code TEXT NOT NULL CHECK (reason_code IN ('strong_fit','customer_preference','budget','location','property_type','size_layout','payment_terms','timing','availability_clarification','missing_information','other')),
  notes TEXT NOT NULL CHECK (LENGTH(BTRIM(notes))>0),
  occurred_at TIMESTAMPTZ NOT NULL,
  recorded_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_match_feedback_candidate_idx
  ON inventory_match_feedback(candidate_id,occurred_at DESC,created_at DESC);

CREATE TRIGGER matching_policy_versions_immutable BEFORE UPDATE OR DELETE ON matching_policy_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();
CREATE TRIGGER inventory_match_decisions_immutable BEFORE UPDATE OR DELETE ON inventory_match_decisions
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();
CREATE TRIGGER inventory_match_feedback_immutable BEFORE UPDATE OR DELETE ON inventory_match_feedback
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT ON matching_policy_versions TO nysareal_nysar2app;
GRANT SELECT,INSERT ON inventory_match_decisions TO nysareal_nysar2app;
GRANT SELECT,INSERT ON inventory_match_feedback TO nysareal_nysar2app;
