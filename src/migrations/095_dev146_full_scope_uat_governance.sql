ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS next_action_code TEXT,
  ADD COLUMN IF NOT EXISTS next_action_notes TEXT;

UPDATE opportunities
SET next_action_code=CASE
  WHEN stage='Closed Won' THEN 'closed_won'
  WHEN stage='Closed Lost' THEN 'closed_lost'
  WHEN stage='Deal' THEN 'complete_deal'
  WHEN stage='Booking' THEN 'monitor_reservation'
  WHEN stage='Negotiation' THEN 'follow_up_offer_feedback'
  WHEN stage='Offer' THEN 'prepare_or_review_offer'
  WHEN stage='Viewing' THEN 'complete_viewing_feedback'
  WHEN stage='Matching' THEN 'send_property_details'
  ELSE 'confirm_requirements'
END
WHERE next_action_code IS NULL;

ALTER TABLE opportunities ALTER COLUMN next_action_code SET NOT NULL;
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_next_action_code_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_next_action_code_ck CHECK (next_action_code IN (
  'confirm_requirements','send_property_details','arrange_consultation','schedule_viewing',
  'obtain_missing_information','confirm_finance_readiness','prepare_or_review_offer',
  'follow_up_offer_feedback','await_customer_decision','nurture_follow_up','controlled_exception',
  'complete_viewing_feedback','return_to_matching','monitor_reservation','complete_deal','closed_won','closed_lost'
));

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS contact_outcome_code TEXT,
  ADD COLUMN IF NOT EXISTS next_action_owner_id UUID REFERENCES brokers(id);
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_contact_outcome_code_ck;
ALTER TABLE activities ADD CONSTRAINT activities_contact_outcome_code_ck CHECK (
  contact_outcome_code IS NULL OR contact_outcome_code IN (
    'substantive_discussion','requirements_confirmed','viewing_agreed','offer_feedback','decision_received',
    'callback_requested','no_answer','voicemail_left','invalid_contact','unreachable'
  )
);

ALTER TABLE lead_assignments
  ADD COLUMN IF NOT EXISTS operating_sla_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operating_sla_end_reason TEXT;

CREATE TABLE IF NOT EXISTS offer_replacement_actions (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  original_offer_id UUID NOT NULL REFERENCES offers(id),
  replacement_offer_id UUID REFERENCES offers(id),
  booking_id UUID REFERENCES bookings(id),
  deal_id UUID REFERENCES deals(id),
  requirement_impact TEXT NOT NULL CHECK (requirement_impact IN ('unchanged','agent_review','customer_confirmed_change')),
  replacement_requirement_id UUID REFERENCES lead_requirements(id),
  property_disposition TEXT NOT NULL CHECK (property_disposition IN ('not_suitable','fallback','reconsider_terms')),
  reservation_disposition TEXT NOT NULL CHECK (reservation_disposition IN ('not_applicable','released_atomically')),
  reason TEXT NOT NULL,
  evidence_reference TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requirement_impact<>'customer_confirmed_change' OR replacement_requirement_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS offer_replacement_actions_opportunity_idx
  ON offer_replacement_actions(opportunity_id,created_at DESC);

CREATE OR REPLACE FUNCTION reject_offer_replacement_action_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'offer replacement actions are immutable';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS offer_replacement_actions_immutable ON offer_replacement_actions;
CREATE TRIGGER offer_replacement_actions_immutable
  BEFORE UPDATE OR DELETE ON offer_replacement_actions
  FOR EACH ROW EXECUTE FUNCTION reject_offer_replacement_action_mutation();

WITH active_opportunity AS (
  SELECT DISTINCT ON (lead_id) lead_id,opened_at,opportunity_reference
  FROM opportunities WHERE stage NOT IN ('Closed Won','Closed Lost')
  ORDER BY lead_id,opened_at
)
UPDATE lead_assignments a
SET operating_sla_ended_at=COALESCE(a.operating_sla_ended_at,o.opened_at),
    operating_sla_end_reason=COALESCE(a.operating_sla_end_reason,'Superseded by active Opportunity '||o.opportunity_reference)
FROM active_opportunity o
WHERE o.lead_id=a.lead_id AND a.superseded_at IS NULL AND a.operating_sla_ended_at IS NULL;
