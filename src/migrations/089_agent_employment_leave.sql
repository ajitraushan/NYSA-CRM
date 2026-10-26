-- Release 6 workforce administration proposal. Keep unapplied until separately authorized.
CREATE TABLE leave_types (
  id UUID PRIMARY KEY,
  type_code TEXT NOT NULL UNIQUE CHECK(type_code~'^[a-z0-9_]{3,40}$'),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE leave_type_versions (
  id UUID PRIMARY KEY,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  version_no INTEGER NOT NULL CHECK(version_no>0),
  label TEXT NOT NULL,
  paid_classification TEXT NOT NULL CHECK(paid_classification IN('paid','unpaid')),
  evidence_required BOOLEAN NOT NULL DEFAULT FALSE,
  restricted_evidence BOOLEAN NOT NULL DEFAULT TRUE,
  minimum_units NUMERIC(6,2) NOT NULL DEFAULT .5 CHECK(minimum_units>=.5),
  maximum_units NUMERIC(6,2) CHECK(maximum_units IS NULL OR maximum_units>=minimum_units),
  notice_days INTEGER NOT NULL DEFAULT 0 CHECK(notice_days>=0),
  allow_negative_balance BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','superseded','retired')),
  reason TEXT NOT NULL CHECK(length(trim(reason))>=10),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id), activated_at TIMESTAMPTZ,
  UNIQUE(leave_type_id,version_no),
  CHECK(effective_to IS NULL OR effective_to>=effective_from)
);

CREATE TABLE leave_policy_versions (
  id UUID PRIMARY KEY,
  policy_code TEXT NOT NULL CHECK(policy_code~'^[a-z0-9_]{3,40}$'),
  version_no INTEGER NOT NULL CHECK(version_no>0),
  name TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  decision_due_working_days INTEGER NOT NULL DEFAULT 2 CHECK(decision_due_working_days BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','superseded','retired')),
  reason TEXT NOT NULL CHECK(length(trim(reason))>=10),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id), activated_at TIMESTAMPTZ,
  UNIQUE(policy_code,version_no), CHECK(effective_to IS NULL OR effective_to>=effective_from)
);

CREATE TABLE leave_policy_entitlements (
  id UUID PRIMARY KEY,
  policy_version_id UUID NOT NULL REFERENCES leave_policy_versions(id),
  leave_type_version_id UUID NOT NULL REFERENCES leave_type_versions(id),
  display_order INTEGER NOT NULL CHECK(display_order>0),
  annual_units NUMERIC(7,2) NOT NULL CHECK(annual_units>=0),
  carry_forward_units NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK(carry_forward_units>=0),
  allow_negative_balance BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(policy_version_id,leave_type_version_id), UNIQUE(policy_version_id,display_order)
);

CREATE TABLE agent_employments (
  id UUID PRIMARY KEY,
  broker_id UUID NOT NULL UNIQUE REFERENCES brokers(id),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agent_employment_versions (
  id UUID PRIMARY KEY,
  employment_id UUID NOT NULL REFERENCES agent_employments(id),
  version_no INTEGER NOT NULL CHECK(version_no>0),
  employment_status TEXT NOT NULL CHECK(employment_status IN('active','leave','ended')),
  effective_from DATE NOT NULL, effective_to DATE,
  start_date DATE NOT NULL, end_date DATE,
  reporting_manager_id UUID NOT NULL REFERENCES brokers(id),
  work_pattern_code TEXT NOT NULL DEFAULT 'mon_fri' CHECK(work_pattern_code IN('mon_fri')),
  policy_version_id UUID NOT NULL REFERENCES leave_policy_versions(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','superseded','retired')),
  reason TEXT NOT NULL CHECK(length(trim(reason))>=10),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id), activated_at TIMESTAMPTZ,
  UNIQUE(employment_id,version_no),
  CHECK(effective_to IS NULL OR effective_to>=effective_from), CHECK(end_date IS NULL OR end_date>=start_date)
);

CREATE TABLE leave_applications (
  id UUID PRIMARY KEY,
  application_reference TEXT NOT NULL UNIQUE,
  employment_id UUID NOT NULL REFERENCES agent_employments(id),
  applicant_id UUID NOT NULL REFERENCES brokers(id),
  employment_version_id UUID NOT NULL REFERENCES agent_employment_versions(id),
  policy_version_id UUID NOT NULL REFERENCES leave_policy_versions(id),
  leave_type_version_id UUID NOT NULL REFERENCES leave_type_versions(id),
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  start_portion TEXT NOT NULL DEFAULT 'full' CHECK(start_portion IN('full','half')),
  end_portion TEXT NOT NULL DEFAULT 'full' CHECK(end_portion IN('full','half')),
  working_units NUMERIC(7,2) NOT NULL CHECK(working_units>=.5),
  reason TEXT NOT NULL CHECK(length(trim(reason))>=5), evidence_reference TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','submitted','approved','rejected','withdrawn','cancelled','routing_required','cancellation_requested')),
  approver_id UUID REFERENCES brokers(id), routing_reason TEXT,
  approval_cycle INTEGER NOT NULL DEFAULT 0 CHECK(approval_cycle>=0), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ, withdrawn_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(end_date>=start_date), CHECK(approver_id IS NULL OR approver_id<>applicant_id)
);
CREATE INDEX leave_applications_applicant_idx ON leave_applications(applicant_id,created_at DESC);
CREATE INDEX leave_applications_approver_idx ON leave_applications(approver_id,status,submitted_at);

CREATE TABLE leave_application_decisions (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES leave_applications(id),
  application_version INTEGER NOT NULL,
  approval_cycle INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN('approved','rejected','cancellation_approved','cancellation_rejected')),
  reason TEXT NOT NULL CHECK(length(trim(reason))>=5),
  balance_before NUMERIC(9,2) NOT NULL, balance_after NUMERIC(9,2) NOT NULL,
  decided_by UUID NOT NULL REFERENCES brokers(id), decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT NOT NULL UNIQUE, UNIQUE(application_id,approval_cycle)
);

CREATE TABLE leave_balance_ledger (
  id UUID PRIMARY KEY,
  employment_id UUID NOT NULL REFERENCES agent_employments(id),
  policy_version_id UUID NOT NULL REFERENCES leave_policy_versions(id),
  leave_type_version_id UUID NOT NULL REFERENCES leave_type_versions(id),
  application_id UUID REFERENCES leave_applications(id),
  decision_id UUID REFERENCES leave_application_decisions(id),
  movement_type TEXT NOT NULL CHECK(movement_type IN('entitlement_credit','carry_forward_credit','approved_leave_debit','cancellation_reversal','governed_adjustment')),
  units NUMERIC(9,2) NOT NULL CHECK(units<>0), balance_after NUMERIC(9,2) NOT NULL,
  reason TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX leave_balance_ledger_balance_idx ON leave_balance_ledger(employment_id,leave_type_version_id,created_at,id);

ALTER TABLE tasks ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE tasks ADD COLUMN leave_application_id UUID REFERENCES leave_applications(id);
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK(task_type IN('general','proposal_correction','customer_response_follow_up','leave_approval'));
ALTER TABLE tasks ADD CONSTRAINT tasks_context_check CHECK(
  (task_type='leave_approval' AND leave_application_id IS NOT NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type<>'leave_approval' AND leave_application_id IS NULL AND lead_id IS NOT NULL AND contact_id IS NOT NULL)
);
CREATE UNIQUE INDEX tasks_one_open_leave_approval_idx ON tasks(leave_application_id)
  WHERE task_type='leave_approval' AND status IN('open','in_progress');

CREATE TABLE leave_application_task_links (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES leave_applications(id), application_version INTEGER NOT NULL,
  approval_cycle INTEGER NOT NULL, task_id UUID NOT NULL UNIQUE REFERENCES tasks(id),
  approver_id UUID NOT NULL REFERENCES brokers(id), routing_reason TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(request_fingerprint~'^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(application_id,approval_cycle)
);

CREATE FUNCTION reject_leave_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Leave decision and balance evidence is immutable; use a governed reversal'; END $$;
CREATE TRIGGER leave_decisions_immutable BEFORE UPDATE OR DELETE ON leave_application_decisions FOR EACH ROW EXECUTE FUNCTION reject_leave_evidence_mutation();
CREATE TRIGGER leave_balance_immutable BEFORE UPDATE OR DELETE ON leave_balance_ledger FOR EACH ROW EXECUTE FUNCTION reject_leave_evidence_mutation();
CREATE TRIGGER leave_task_links_immutable BEFORE UPDATE OR DELETE ON leave_application_task_links FOR EACH ROW EXECUTE FUNCTION reject_leave_evidence_mutation();

CREATE FUNCTION prohibit_leave_self_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE applicant UUID;
BEGIN
  SELECT applicant_id INTO applicant FROM leave_applications WHERE id=NEW.application_id;
  IF applicant=NEW.decided_by THEN RAISE EXCEPTION 'Self-approval is prohibited'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER leave_decision_no_self_approval BEFORE INSERT ON leave_application_decisions FOR EACH ROW EXECUTE FUNCTION prohibit_leave_self_approval();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK(entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge','Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings','ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment','LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence','QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia','PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun','Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview','PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus','Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication','TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement','MarketingCampaign','CampaignMapping','PartnerOrganization','InventoryOrganizationLink','CommunicationPolicyDecision','OpportunityPropertyShareEvent','CustomerResponseTaskProvenance','OfficialDocumentDefinition','OfficialDocumentStepRule','OfficialDocumentEvidence','OfficialDocumentFollowup','MarketCommunity','DldCommunityMapping','DldMarketSourceBatch','DldMarketObservation','InventoryMarketIntelligenceSnapshot','CommissionPayoutPolicy','AgentPayoutAdjustment','DealCommissionExpectation','DealCommissionReceipt','DealCommissionReceiptConfirmation','DealCommissionVarianceDecision','DealAgentCredit','AgentPayoutCalculation','AgentPayoutRelease','AgentEmployment','LeavePolicy','LeaveApplication','LeaveDecision','LeaveBalance'
));

GRANT SELECT,INSERT,UPDATE ON leave_types,leave_type_versions,leave_policy_versions,leave_policy_entitlements,
  agent_employments,agent_employment_versions,leave_applications,tasks TO nysareal_nysar2app;
GRANT SELECT,INSERT ON leave_application_decisions,leave_balance_ledger,leave_application_task_links TO nysareal_nysar2app;
