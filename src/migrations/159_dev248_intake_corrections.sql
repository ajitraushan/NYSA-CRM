-- DEV248: sequential WEB intake confirmation and closed-history evidence.
-- Additive only. Existing users, credentials, teams, assignments, Leads and
-- Requirements are retained unchanged.

ALTER TABLE lead_follow_up_cases
  ADD COLUMN closed_at TIMESTAMPTZ,
  ADD COLUMN closed_by UUID REFERENCES brokers(id);

ALTER TABLE lead_follow_up_cases
  DROP CONSTRAINT lead_follow_up_cases_close_outcome_check;
ALTER TABLE lead_follow_up_cases
  ADD CONSTRAINT lead_follow_up_cases_close_outcome_check CHECK(close_outcome IN (
    'not_interested','unreachable','wrong_person','duplicate','invalid','spam','opted_out','not_genuine'
  ));

ALTER TABLE web_intake_contact_attempts
  DROP CONSTRAINT web_intake_contact_attempts_outcome_check;
ALTER TABLE web_intake_contact_attempts
  ADD CONSTRAINT web_intake_contact_attempts_outcome_check CHECK(outcome IN (
    'contacted','no_answer','left_message','wrong_number','opted_out','meeting_confirmed',
    'callback_rescheduled','not_interested','not_genuine','duplicate','spam','invalid','promoted'
  ));

CREATE INDEX lead_follow_up_closed_history_idx
  ON lead_follow_up_cases(closed_at DESC,id)
  WHERE state IN ('closed','complete','no_response');

