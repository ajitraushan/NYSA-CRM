CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES brokers(id),
  lead_response_hours INTEGER NOT NULL DEFAULT 4 CHECK (lead_response_hours BETWEEN 1 AND 168),
  active SMALLINT NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX teams_name_lower_uq ON teams (LOWER(name));

ALTER TABLE brokers ADD COLUMN team_id UUID REFERENCES teams(id);
ALTER TABLE brokers ADD COLUMN job_title TEXT;
CREATE INDEX brokers_team_idx ON brokers(team_id);

CREATE TABLE contacts (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  contact_type TEXT NOT NULL DEFAULT 'buyer'
    CHECK (contact_type IN ('buyer','seller','landlord','tenant','developer','investor','other')),
  company_name TEXT,
  preferred_channel TEXT CHECK (preferred_channel IN ('Phone','Email','WhatsApp','SMS')),
  nationality TEXT,
  language TEXT,
  notes TEXT,
  owner_id UUID REFERENCES brokers(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE INDEX contacts_name_idx ON contacts(full_name);
CREATE INDEX contacts_email_lower_idx ON contacts(LOWER(email));
CREATE INDEX contacts_phone_idx ON contacts(phone);
CREATE INDEX contacts_owner_idx ON contacts(owner_id);

CREATE TABLE leads (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('Website','WhatsApp','Current CRM','Referral','Social media','Walk-in','Phone','Property portal','Other')),
  business_type TEXT NOT NULL CHECK (business_type IN ('Sale','Rental','Off-plan','Commercial')),
  stage TEXT NOT NULL DEFAULT 'New'
    CHECK (stage IN ('New','Contacted','Qualified','Viewing','Negotiation','Won','Lost')),
  temperature TEXT NOT NULL DEFAULT 'Warm' CHECK (temperature IN ('Hot','Warm','Cold')),
  budget_min NUMERIC(16,2) CHECK (budget_min IS NULL OR budget_min >= 0),
  budget_max NUMERIC(16,2) CHECK (budget_max IS NULL OR budget_max >= 0),
  preferred_areas TEXT,
  property_requirements TEXT,
  assigned_team_id UUID REFERENCES teams(id),
  assigned_to UUID REFERENCES brokers(id),
  assignment_due_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  lost_reason TEXT,
  won_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min),
  CHECK (stage <> 'Lost' OR lost_reason IS NOT NULL)
);
CREATE INDEX leads_stage_idx ON leads(stage);
CREATE INDEX leads_assigned_to_idx ON leads(assigned_to);
CREATE INDEX leads_team_idx ON leads(assigned_team_id);
CREATE INDEX leads_follow_up_idx ON leads(next_follow_up_at);
CREATE INDEX leads_created_at_idx ON leads(created_at DESC);

CREATE TABLE activities (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  activity_type TEXT NOT NULL
    CHECK (activity_type IN ('Task','Note','Call','Email','WhatsApp','Meeting','Viewing')),
  subject TEXT NOT NULL,
  details TEXT,
  direction TEXT CHECK (direction IN ('Inbound','Outbound')),
  outcome TEXT,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  owner_id UUID NOT NULL REFERENCES brokers(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX activities_lead_idx ON activities(lead_id, created_at DESC);
CREATE INDEX activities_owner_due_idx ON activities(owner_id, due_at);

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('Listing','Comment','Broker','Invitation','Team','Contact','Lead','Activity'));
