-- Form/workflow increment: controlled interaction outcomes and governed next work.
-- The document-evidence rule is keyed to contact_outcome_code, never Subject text.
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_contact_outcome_code_ck;
ALTER TABLE activities ADD CONSTRAINT activities_contact_outcome_code_ck CHECK (
  contact_outcome_code IS NULL OR contact_outcome_code IN (
    'substantive_discussion','requirements_confirmed','viewing_agreed','offer_feedback','decision_received',
    'callback_requested','no_answer','voicemail_left','invalid_contact','unreachable','offer_letter_sent'
  )
);

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS next_action_code TEXT,
  ADD COLUMN IF NOT EXISTS next_action_due_at TIMESTAMPTZ;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_next_action_code_ck;
ALTER TABLE activities ADD CONSTRAINT activities_next_action_code_ck CHECK (
  next_action_code IS NULL OR next_action_code IN (
    'confirm_requirements','search_inventory','send_property_options','arrange_consultation',
    'schedule_viewing','confirm_finance_readiness','nurture_follow_up'
  )
);
