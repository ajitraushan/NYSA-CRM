CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  company_type TEXT NOT NULL DEFAULT 'other'
    CHECK (company_type IN ('developer','agency','corporate_client','landlord_company','vendor','other')),
  website TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  owner_id UUID REFERENCES brokers(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX companies_name_lower_uq ON companies (LOWER(name)) WHERE archived_at IS NULL;
CREATE INDEX companies_owner_idx ON companies(owner_id);

ALTER TABLE contacts ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE contacts ADD COLUMN email_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (email_status IN ('unverified','format_valid','verified','invalid'));
ALTER TABLE contacts ADD COLUMN phone_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (phone_status IN ('unverified','format_valid','verified','invalid'));
ALTER TABLE contacts ADD COLUMN public_profile_url TEXT;
ALTER TABLE contacts ADD COLUMN screening_notes TEXT;
ALTER TABLE contacts ADD COLUMN screened_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN screened_by UUID REFERENCES brokers(id);
ALTER TABLE contacts ADD COLUMN last_verified_at TIMESTAMPTZ;
CREATE INDEX contacts_company_idx ON contacts(company_id);

ALTER TABLE brokers ADD COLUMN job_role TEXT
  CHECK (job_role IN ('admin','sales_agent','listing_agent','manager','director','accountant'));
ALTER TABLE invitations ADD COLUMN job_role TEXT
  CHECK (job_role IN ('admin','sales_agent','listing_agent','manager','director','accountant'));
UPDATE brokers SET job_role = CASE
  WHEN role = 'admin' THEN 'admin'
  WHEN role = 'internal_broker' THEN 'sales_agent'
  ELSE NULL
END WHERE job_role IS NULL;
UPDATE invitations SET job_role = CASE
  WHEN role = 'admin' THEN 'admin'
  WHEN role = 'internal_broker' THEN 'sales_agent'
  ELSE NULL
END WHERE job_role IS NULL;

ALTER TABLE leads ADD COLUMN assignment_status TEXT NOT NULL DEFAULT 'assigned'
  CHECK (assignment_status IN ('unassigned','assigned','reassignment_due','closed'));
ALTER TABLE leads ADD COLUMN previous_assignee_id UUID REFERENCES brokers(id);
ALTER TABLE leads ADD COLUMN reassigned_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN reassigned_by UUID REFERENCES brokers(id);
ALTER TABLE leads ADD COLUMN listing_id UUID REFERENCES listings(id);
UPDATE leads SET assignment_status = CASE
  WHEN stage IN ('Won','Lost') THEN 'closed'
  WHEN assigned_to IS NULL THEN 'unassigned'
  ELSE 'assigned'
END;
CREATE INDEX leads_assignment_status_idx ON leads(assignment_status);
CREATE INDEX leads_assignment_due_idx ON leads(assignment_due_at) WHERE assignment_status = 'assigned';
CREATE INDEX leads_listing_idx ON leads(listing_id);

ALTER TABLE activities ADD COLUMN reminder_at TIMESTAMPTZ;
ALTER TABLE activities ADD COLUMN calendar_uid TEXT;
CREATE INDEX activities_reminder_idx ON activities(owner_id, reminder_at)
  WHERE completed_at IS NULL AND reminder_at IS NOT NULL;

CREATE TABLE value_briefs (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id),
  expected_annual_rent NUMERIC(16,2) CHECK (expected_annual_rent IS NULL OR expected_annual_rent >= 0),
  estimated_annual_costs NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (estimated_annual_costs >= 0),
  strengths TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX value_briefs_lead_idx ON value_briefs(lead_id, created_at DESC);

ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check
  CHECK (entity_type IN ('Listing','Comment','Broker','Invitation','Team','Contact','Lead','Activity','Company','ValueBrief'));
