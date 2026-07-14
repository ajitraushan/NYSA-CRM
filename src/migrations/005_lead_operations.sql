CREATE TABLE sla_policies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Dubai',
  utc_offset_minutes INTEGER NOT NULL DEFAULT 240 CHECK (utc_offset_minutes BETWEEN -720 AND 840),
  work_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  work_start_minute INTEGER NOT NULL DEFAULT 540 CHECK (work_start_minute BETWEEN 0 AND 1439),
  work_end_minute INTEGER NOT NULL DEFAULT 1080 CHECK (work_end_minute BETWEEN 1 AND 1440),
  acceptance_minutes INTEGER NOT NULL DEFAULT 30 CHECK (acceptance_minutes BETWEEN 1 AND 10080),
  first_contact_minutes INTEGER NOT NULL DEFAULT 240 CHECK (first_contact_minutes BETWEEN 1 AND 10080),
  warning_minutes INTEGER NOT NULL DEFAULT 30 CHECK (warning_minutes BETWEEN 1 AND 1440),
  timer_policy TEXT NOT NULL DEFAULT 'continue' CHECK (timer_policy IN ('continue','pause_in_nurture')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  effective_from TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (work_start_minute < work_end_minute)
);
CREATE UNIQUE INDEX sla_policies_one_active_uq ON sla_policies(status) WHERE status='active';

CREATE TABLE routing_rules (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  source TEXT,
  business_type TEXT,
  team_id UUID NOT NULL REFERENCES teams(id),
  agent_id UUID REFERENCES brokers(id),
  assignment_method TEXT NOT NULL DEFAULT 'team_queue' CHECK (assignment_method IN ('named_agent','team_queue')),
  active SMALLINT NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX routing_rules_match_idx ON routing_rules(active,priority,source,business_type);

CREATE TABLE lead_assignments (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  sequence_no INTEGER NOT NULL,
  team_id UUID REFERENCES teams(id),
  agent_id UUID REFERENCES brokers(id),
  status TEXT NOT NULL CHECK (status IN ('queued','offered','accepted','rejected','timed_out','reassigned','closed')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acceptance_due_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_reason TEXT,
  assigned_by UUID REFERENCES brokers(id),
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id,sequence_no)
);
CREATE UNIQUE INDEX lead_assignments_current_uq ON lead_assignments(lead_id) WHERE superseded_at IS NULL;
CREATE INDEX lead_assignments_agent_idx ON lead_assignments(agent_id,status,acceptance_due_at);

ALTER TABLE leads ADD COLUMN received_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE leads ADD COLUMN external_source_id TEXT;
ALTER TABLE leads ADD COLUMN campaign_code TEXT;
ALTER TABLE leads ADD COLUMN source_page TEXT;
ALTER TABLE leads ADD COLUMN source_form TEXT;
ALTER TABLE leads ADD COLUMN accepted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN first_contact_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN original_acceptance_due_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN first_contact_due_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN sla_policy_id UUID REFERENCES sla_policies(id);
ALTER TABLE leads ADD COLUMN holding_status TEXT NOT NULL DEFAULT 'active'
  CHECK (holding_status IN ('active','nurture','paused','closed'));
CREATE UNIQUE INDEX leads_external_source_uq ON leads(source,external_source_id) WHERE external_source_id IS NOT NULL;

CREATE TABLE lead_stage_history (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason_code TEXT,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX lead_stage_history_lead_idx ON lead_stage_history(lead_id,changed_at DESC);

CREATE TABLE lead_requirements (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  version_no INTEGER NOT NULL,
  business_line TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('own_use','investment','business','other')),
  property_types TEXT[] NOT NULL DEFAULT '{}',
  areas TEXT[] NOT NULL DEFAULT '{}',
  budget_min NUMERIC(16,2),
  budget_max NUMERIC(16,2),
  funding_method TEXT NOT NULL CHECK (funding_method IN ('cash','mortgage','mixed','unknown')),
  bedrooms_min INTEGER,
  bedrooms_max INTEGER,
  timeline_code TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_at TIMESTAMPTZ,
  UNIQUE(lead_id,version_no),
  CHECK (budget_min IS NULL OR budget_min >= 0),
  CHECK (budget_max IS NULL OR budget_max >= budget_min),
  CHECK (bedrooms_max IS NULL OR bedrooms_min IS NULL OR bedrooms_max >= bedrooms_min)
);
CREATE UNIQUE INDEX lead_requirements_current_uq ON lead_requirements(lead_id) WHERE superseded_at IS NULL;

CREATE TABLE lead_inventory_matches (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  requirement_id UUID NOT NULL REFERENCES lead_requirements(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  match_note TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id,requirement_id,listing_id)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  subject TEXT NOT NULL,
  details TEXT,
  assignee_id UUID NOT NULL REFERENCES brokers(id),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  due_at TIMESTAMPTZ NOT NULL,
  outcome TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX tasks_assignee_due_idx ON tasks(assignee_id,status,due_at);
CREATE INDEX tasks_lead_idx ON tasks(lead_id,created_at DESC);

CREATE TABLE lead_conversions (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL UNIQUE REFERENCES leads(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  requirement_id UUID NOT NULL REFERENCES lead_requirements(id),
  conversion_type TEXT NOT NULL DEFAULT 'opportunity_scaffold',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled','completed')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sla_alerts (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  alert_kind TEXT NOT NULL CHECK (alert_kind IN ('acceptance_warning','acceptance_breach','first_contact_warning','first_contact_breach')),
  deadline_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  UNIQUE(lead_id,alert_kind,deadline_at)
);

CREATE TABLE website_intake_events (
  id UUID PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing','accepted','failed')),
  contact_id UUID REFERENCES contacts(id),
  lead_id UUID REFERENCES leads(id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  replayed_by UUID REFERENCES brokers(id)
);

CREATE TABLE consent_evidence (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('website_form','documented_agreement','manual_restriction')),
  purpose TEXT NOT NULL DEFAULT 'marketing',
  status TEXT NOT NULL CHECK (status IN ('granted','denied','withdrawn','expired','superseded')),
  statement_version TEXT NOT NULL,
  source_event_id UUID REFERENCES website_intake_events(id),
  captured_at TIMESTAMPTZ NOT NULL,
  captured_by UUID REFERENCES brokers(id),
  evidence_hash TEXT NOT NULL,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX consent_evidence_contact_idx ON consent_evidence(contact_id,captured_at DESC);

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','WebsiteIntake','ConsentEvidence'
));
