ALTER TABLE lead_follow_up_cases DROP CONSTRAINT lead_follow_up_cases_state_check;
ALTER TABLE lead_follow_up_cases ADD CONSTRAINT lead_follow_up_cases_state_check CHECK(state IN
 ('ready','needs_review','engaged','outcome_unknown','human_owned','booked','opted_out','wrong_person','complete','handoff_pending'));
