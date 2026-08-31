CREATE TABLE lead_recovery_cases (
  id UUID PRIMARY KEY,
  case_key TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES leads(id),
  website_intake_event_id UUID REFERENCES website_intake_events(id),
  task_id UUID REFERENCES tasks(id),
  assigned_team_id UUID REFERENCES teams(id),
  category TEXT NOT NULL CHECK (category IN (
    'intake_identity_review','intake_duplicate_review','intake_failed','unassigned_ageing','acceptance_breach',
    'first_contact_breach','no_next_action','overdue_next_action','overdue_task','repeated_reassignment'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium')),
  title TEXT NOT NULL,
  required_action TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_kind TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status='open' AND resolved_at IS NULL) OR status='resolved')
);

CREATE INDEX lead_recovery_cases_open_idx ON lead_recovery_cases(severity,due_at,first_detected_at) WHERE status='open';
CREATE INDEX lead_recovery_cases_team_idx ON lead_recovery_cases(assigned_team_id,status,last_detected_at);

GRANT SELECT,INSERT,UPDATE ON lead_recovery_cases TO nysareal_nysar2app;
