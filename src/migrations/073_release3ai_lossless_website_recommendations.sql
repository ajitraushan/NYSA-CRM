ALTER TABLE customer_evidence_facts
  DROP CONSTRAINT IF EXISTS customer_evidence_facts_fact_group_check;

ALTER TABLE customer_evidence_facts
  ADD CONSTRAINT customer_evidence_facts_fact_group_check
  CHECK (fact_group IN ('identity','enquiry','requirement','profile','attribution','consent','advisory','recommendation'));

CREATE INDEX customer_evidence_facts_recommendation_event_idx
  ON customer_evidence_facts(intake_event_id,fact_code)
  WHERE fact_group='recommendation';

GRANT SELECT,INSERT,UPDATE ON customer_evidence_facts TO nysareal_nysar2app;
