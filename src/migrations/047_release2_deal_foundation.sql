ALTER TABLE opportunities DROP CONSTRAINT opportunities_r2_3b_enabled_stage_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_r2_4_enabled_stage_ck
  CHECK (stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal','Closed Won','Closed Lost'));

ALTER TABLE opportunity_stage_history DROP CONSTRAINT opportunity_history_r2_3b_enabled_stage_ck;
ALTER TABLE opportunity_stage_history ADD CONSTRAINT opportunity_history_r2_4_enabled_stage_ck CHECK (
  (from_stage IS NULL OR from_stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal','Closed Won','Closed Lost'))
  AND to_stage IN ('Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal','Closed Won','Closed Lost')
);

CREATE TABLE deal_number_counters (
  period_code CHAR(6) PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deals (
  id UUID PRIMARY KEY,
  deal_reference TEXT NOT NULL UNIQUE,
  opportunity_id UUID NOT NULL UNIQUE REFERENCES opportunities(id),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  offer_id UUID NOT NULL REFERENCES offers(id),
  accepted_offer_revision_id UUID NOT NULL REFERENCES offer_revisions(id),
  deal_type TEXT NOT NULL CHECK (deal_type IN ('sale','rental','off_plan','commercial_sale','commercial_rental')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completion_in_progress','pending_approval','approved','closed_won','closed_lost')),
  agreed_value NUMERIC(15,2) NOT NULL CHECK (agreed_value > 0),
  currency CHAR(3) NOT NULL,
  target_completion_at TIMESTAMPTZ NOT NULL,
  actual_completion_at TIMESTAMPTZ,
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  closed_by UUID REFERENCES brokers(id),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  owner_id UUID NOT NULL REFERENCES brokers(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status NOT IN ('closed_won','closed_lost') OR closed_at IS NOT NULL),
  CHECK (status <> 'closed_lost' OR closed_reason IS NOT NULL)
);
CREATE INDEX deals_status_idx ON deals(status,target_completion_at);
CREATE INDEX deals_owner_idx ON deals(owner_id,status);

CREATE TABLE deal_parties (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id),
  contact_id UUID REFERENCES contacts(id),
  company_id UUID REFERENCES companies(id),
  party_role TEXT NOT NULL CHECK (party_role IN ('buyer','seller','tenant','landlord','developer','buyer_representative','seller_representative','tenant_representative','landlord_representative','other')),
  side TEXT NOT NULL CHECK (side IN ('buyer_side','seller_side','neutral')),
  representation TEXT NOT NULL DEFAULT 'direct',
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  source_evidence TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((contact_id IS NOT NULL)::int + (company_id IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX deal_parties_active_contact_role_uq ON deal_parties(deal_id,contact_id,party_role) WHERE effective_to IS NULL AND contact_id IS NOT NULL;
CREATE UNIQUE INDEX deal_parties_active_company_role_uq ON deal_parties(deal_id,company_id,party_role) WHERE effective_to IS NULL AND company_id IS NOT NULL;
CREATE INDEX deal_parties_deal_idx ON deal_parties(deal_id,effective_from);

CREATE TABLE checklist_templates (
  id UUID PRIMARY KEY,
  template_code TEXT NOT NULL,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  name TEXT NOT NULL,
  deal_type TEXT NOT NULL CHECK (deal_type IN ('sale','rental','off_plan','commercial_sale','commercial_rental')),
  status TEXT NOT NULL CHECK (status IN ('draft','approved','retired')),
  approved_by UUID REFERENCES brokers(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(template_code,version_no),
  CHECK (status <> 'approved' OR approved_at IS NOT NULL)
);
CREATE UNIQUE INDEX checklist_templates_approved_type_uq ON checklist_templates(deal_type) WHERE status='approved';

CREATE TABLE checklist_template_items (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES checklist_templates(id),
  item_code TEXT NOT NULL,
  label TEXT NOT NULL,
  responsible_role TEXT NOT NULL CHECK (responsible_role IN ('sales_agent','manager','director','accountant')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  evidence_required BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL CHECK (display_order > 0),
  UNIQUE(template_id,item_code),
  UNIQUE(template_id,display_order)
);

CREATE TABLE deal_checklists (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id),
  template_id UUID NOT NULL REFERENCES checklist_templates(id),
  template_version_no INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','ready_for_approval','approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deal_checklist_items (
  id UUID PRIMARY KEY,
  deal_checklist_id UUID NOT NULL REFERENCES deal_checklists(id),
  template_item_id UUID NOT NULL REFERENCES checklist_template_items(id),
  item_code TEXT NOT NULL,
  label TEXT NOT NULL,
  responsible_role TEXT NOT NULL,
  required BOOLEAN NOT NULL,
  evidence_required BOOLEAN NOT NULL,
  display_order INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','waived')),
  assignee_id UUID REFERENCES brokers(id),
  due_at TIMESTAMPTZ,
  completed_by UUID REFERENCES brokers(id),
  completed_at TIMESTAMPTZ,
  evidence_reference TEXT,
  waiver_reason TEXT,
  waived_by UUID REFERENCES brokers(id),
  waived_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE(deal_checklist_id,template_item_id),
  CHECK (status <> 'completed' OR completed_at IS NOT NULL),
  CHECK (status <> 'waived' OR (waiver_reason IS NOT NULL AND waived_at IS NOT NULL))
);
CREATE INDEX deal_checklist_items_checklist_idx ON deal_checklist_items(deal_checklist_id,display_order);

CREATE TABLE deal_status_history (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION reject_deal_status_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'deal status history is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER deal_status_history_immutable
  BEFORE UPDATE OR DELETE ON deal_status_history
  FOR EACH ROW EXECUTE FUNCTION reject_deal_status_history_mutation();

INSERT INTO checklist_templates(id,template_code,version_no,name,deal_type,status,approved_at) VALUES
('47000000-0000-0000-0000-000000000001','R2-SALE',1,'Sale completion checklist','sale','approved',NOW()),
('47000000-0000-0000-0000-000000000002','R2-RENTAL',1,'Rental completion checklist','rental','approved',NOW()),
('47000000-0000-0000-0000-000000000003','R2-OFFPLAN',1,'Off-plan completion checklist','off_plan','approved',NOW()),
('47000000-0000-0000-0000-000000000004','R2-COM-SALE',1,'Commercial sale completion checklist','commercial_sale','approved',NOW()),
('47000000-0000-0000-0000-000000000005','R2-COM-RENT',1,'Commercial rental completion checklist','commercial_rental','approved',NOW());

INSERT INTO checklist_template_items(id,template_id,item_code,label,responsible_role,required,evidence_required,display_order) VALUES
('47100000-0000-0000-0000-000000000001','47000000-0000-0000-0000-000000000001','PARTIES','Buyer and seller details verified','sales_agent',TRUE,TRUE,1),
('47100000-0000-0000-0000-000000000002','47000000-0000-0000-0000-000000000001','TERMS','Accepted terms and completion date confirmed','sales_agent',TRUE,TRUE,2),
('47100000-0000-0000-0000-000000000003','47000000-0000-0000-0000-000000000001','MANAGER_REVIEW','Manager completion review','manager',TRUE,TRUE,3),
('47100000-0000-0000-0000-000000000004','47000000-0000-0000-0000-000000000002','PARTIES','Tenant and landlord details verified','sales_agent',TRUE,TRUE,1),
('47100000-0000-0000-0000-000000000005','47000000-0000-0000-0000-000000000002','TENANCY','Tenancy terms and dates confirmed','sales_agent',TRUE,TRUE,2),
('47100000-0000-0000-0000-000000000006','47000000-0000-0000-0000-000000000002','MANAGER_REVIEW','Manager completion review','manager',TRUE,TRUE,3),
('47100000-0000-0000-0000-000000000007','47000000-0000-0000-0000-000000000003','PARTIES','Buyer and developer details verified','sales_agent',TRUE,TRUE,1),
('47100000-0000-0000-0000-000000000008','47000000-0000-0000-0000-000000000003','SPA','Reservation/SPA milestones confirmed','sales_agent',TRUE,TRUE,2),
('47100000-0000-0000-0000-000000000009','47000000-0000-0000-0000-000000000003','MANAGER_REVIEW','Manager completion review','manager',TRUE,TRUE,3),
('47100000-0000-0000-0000-000000000010','47000000-0000-0000-0000-000000000004','PARTIES','Buyer and seller organisations verified','sales_agent',TRUE,TRUE,1),
('47100000-0000-0000-0000-000000000011','47000000-0000-0000-0000-000000000004','TERMS','Commercial sale terms confirmed','sales_agent',TRUE,TRUE,2),
('47100000-0000-0000-0000-000000000012','47000000-0000-0000-0000-000000000004','DIRECTOR_REVIEW','Director-designated commercial review','director',TRUE,TRUE,3),
('47100000-0000-0000-0000-000000000013','47000000-0000-0000-0000-000000000005','PARTIES','Tenant and landlord organisations verified','sales_agent',TRUE,TRUE,1),
('47100000-0000-0000-0000-000000000014','47000000-0000-0000-0000-000000000005','TERMS','Commercial tenancy terms confirmed','sales_agent',TRUE,TRUE,2),
('47100000-0000-0000-0000-000000000015','47000000-0000-0000-0000-000000000005','DIRECTOR_REVIEW','Director-designated commercial review','director',TRUE,TRUE,3);

ALTER TABLE document_links DROP CONSTRAINT document_links_entity_type_check;
ALTER TABLE document_links ADD CONSTRAINT document_links_entity_type_check CHECK (
  entity_type IN ('Contact','Lead','Activity','Listing','Proposal','ContactChannel','Opportunity','Offer','OfferRevision','Booking','Deal','DealChecklist')
);

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun',
  'Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview',
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus',
  'Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus'
));
