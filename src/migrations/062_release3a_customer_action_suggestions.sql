ALTER TABLE ai_assistance_runs DROP CONSTRAINT IF EXISTS ai_assistance_runs_function_code_check;
ALTER TABLE ai_assistance_runs ADD CONSTRAINT ai_assistance_runs_function_code_check
  CHECK (function_code IN ('requirements_draft','match_explanation','missing_information','customer_next_action'));

CREATE TABLE customer_action_suggestions (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  opportunity_id UUID REFERENCES opportunities(id),
  ai_run_id UUID REFERENCES ai_assistance_runs(id),
  suggestion_source TEXT NOT NULL CHECK (suggestion_source IN ('deterministic_rules','ai_assisted')),
  ruleset_version TEXT NOT NULL,
  evidence_hash CHAR(64) NOT NULL,
  priority_band TEXT NOT NULL CHECK (priority_band IN ('immediate','new_enquiry','due_today','high_potential','waiting')),
  action_code TEXT NOT NULL CHECK (action_code IN (
    'review_contact_restriction','assign_agent','accept_assignment','record_first_contact','capture_requirements',
    'complete_qualification','create_opportunity','opportunity_action','continue_follow_up'
  )),
  action_label TEXT NOT NULL,
  why_now JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence TEXT NOT NULL CHECK (confidence IN ('low','medium','high')),
  missing_information JSONB NOT NULL DEFAULT '[]'::jsonb,
  delay_consequence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','scheduled','dismissed','superseded')),
  requested_by UUID NOT NULL REFERENCES brokers(id),
  decided_by UUID REFERENCES brokers(id),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  resulting_task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status='proposed' AND decided_at IS NULL AND decided_by IS NULL) OR
         (status<>'proposed' AND decided_at IS NOT NULL AND decided_by IS NOT NULL)),
  CHECK (status<>'dismissed' OR NULLIF(BTRIM(decision_reason),'') IS NOT NULL)
);

CREATE INDEX customer_action_suggestions_lead_idx ON customer_action_suggestions(lead_id,created_at DESC);
CREATE INDEX customer_action_suggestions_status_idx ON customer_action_suggestions(status,created_at DESC);

GRANT SELECT,INSERT,UPDATE ON customer_action_suggestions TO nysareal_nysar2app;
