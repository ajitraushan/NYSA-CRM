-- Migration: 090_release6_customer_transaction_document_compliance.sql
-- Release 6 customer and transaction document compliance.
-- Additive only. Intentionally unapplied outside disposable local test databases.

CREATE TABLE document_compliance_requirements (
  id UUID PRIMARY KEY,
  requirement_code TEXT NOT NULL UNIQUE CHECK(requirement_code~'^[a-z][a-z0-9_]*$'),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE FUNCTION valid_compliance_reminder_offsets(offsets INTEGER[]) RETURNS BOOLEAN
IMMUTABLE LANGUAGE plpgsql AS $$
DECLARE item INTEGER; previous INTEGER := -1;
BEGIN
  IF offsets IS NULL OR COALESCE(array_length(offsets,1),0)=0 THEN RETURN FALSE; END IF;
  FOREACH item IN ARRAY offsets LOOP
    IF item<0 OR item>365 OR item<=previous THEN RETURN FALSE; END IF;
    previous:=item;
  END LOOP;
  RETURN TRUE;
END $$;

CREATE TABLE document_compliance_requirement_versions (
  id UUID PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES document_compliance_requirements(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  label TEXT NOT NULL CHECK(LENGTH(BTRIM(label))>=3),
  business_reason TEXT NOT NULL CHECK(LENGTH(BTRIM(business_reason))>=10),
  transaction_family TEXT NOT NULL CHECK(transaction_family IN('sale','lease')),
  party_role TEXT NOT NULL CHECK(party_role IN('buyer','seller','landlord','tenant')),
  party_kind TEXT NOT NULL CHECK(party_kind IN('individual','organization')),
  gate_code TEXT NOT NULL CHECK(gate_code IN('before_pending_approval','before_approval','before_close_won')),
  requirement_level TEXT NOT NULL CHECK(requirement_level IN('required','advisory')),
  evidence_authority TEXT NOT NULL CHECK(evidence_authority IN('generic_document','official_document')),
  document_type TEXT,
  official_definition_id UUID REFERENCES official_document_definitions(id),
  official_definition_version_id UUID REFERENCES official_document_definition_versions(id),
  review_required BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_mode TEXT NOT NULL CHECK(expiry_mode IN('not_tracked','optional','required')),
  reminder_offsets_days INTEGER[] NOT NULL DEFAULT ARRAY[0,7,14,30]::INTEGER[]
    CHECK(valid_compliance_reminder_offsets(reminder_offsets_days)),
  status TEXT NOT NULL CHECK(status IN('draft','active','superseded','retired')),
  effective_from TIMESTAMPTZ NOT NULL,
  supersedes_version_id UUID REFERENCES document_compliance_requirement_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id), activated_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id), retired_at TIMESTAMPTZ, retirement_reason TEXT,
  UNIQUE(requirement_id,version_number),
  CHECK(
    (evidence_authority='generic_document' AND LENGTH(BTRIM(COALESCE(document_type,'')))>0 AND official_definition_id IS NULL AND official_definition_version_id IS NULL) OR
    (evidence_authority='official_document' AND document_type IS NULL AND official_definition_id IS NOT NULL AND official_definition_version_id IS NOT NULL)
  ),
  CHECK(status NOT IN('active','superseded','retired') OR (activated_by IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND LENGTH(BTRIM(COALESCE(retirement_reason,'')))>=10))
);
CREATE UNIQUE INDEX document_compliance_requirement_active_uq ON document_compliance_requirement_versions(requirement_id) WHERE status='active';
CREATE UNIQUE INDEX document_compliance_requirement_draft_uq ON document_compliance_requirement_versions(requirement_id) WHERE status='draft';
CREATE UNIQUE INDEX document_compliance_active_applicability_uq ON document_compliance_requirement_versions(
  transaction_family,party_role,party_kind,gate_code,evidence_authority,
  COALESCE(document_type,''),COALESCE(official_definition_id,'00000000-0000-0000-0000-000000000000'::uuid)
) WHERE status='active';

CREATE TABLE deal_document_compliance_snapshots (
  id UUID PRIMARY KEY,
  deal_checklist_id UUID NOT NULL REFERENCES deal_checklists(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  deal_version INTEGER NOT NULL CHECK(deal_version>0),
  deal_type TEXT NOT NULL,
  transaction_family TEXT NOT NULL CHECK(transaction_family IN('sale','lease')),
  party_context_hash CHAR(64) NOT NULL CHECK(party_context_hash~'^[a-f0-9]{64}$'),
  resolver_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN('active','superseded')),
  supersedes_snapshot_id UUID REFERENCES deal_document_compliance_snapshots(id),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(request_fingerprint~'^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX deal_document_compliance_snapshot_active_uq ON deal_document_compliance_snapshots(deal_checklist_id) WHERE status='active';
CREATE INDEX deal_document_compliance_snapshot_deal_idx ON deal_document_compliance_snapshots(deal_id,created_at DESC);

CREATE TABLE deal_document_requirement_instances (
  id UUID PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES deal_document_compliance_snapshots(id),
  deal_checklist_id UUID NOT NULL REFERENCES deal_checklists(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  deal_party_id UUID NOT NULL REFERENCES deal_parties(id),
  requirement_id UUID NOT NULL REFERENCES document_compliance_requirements(id),
  requirement_version_id UUID NOT NULL REFERENCES document_compliance_requirement_versions(id),
  party_role TEXT NOT NULL CHECK(party_role IN('buyer','seller','landlord','tenant')),
  party_kind TEXT NOT NULL CHECK(party_kind IN('individual','organization')),
  gate_code TEXT NOT NULL CHECK(gate_code IN('before_pending_approval','before_approval','before_close_won')),
  requirement_level TEXT NOT NULL CHECK(requirement_level IN('required','advisory')),
  evidence_authority TEXT NOT NULL CHECK(evidence_authority IN('generic_document','official_document')),
  label TEXT NOT NULL,
  responsible_agent_id UUID NOT NULL REFERENCES brokers(id),
  instance_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(instance_fingerprint~'^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(snapshot_id,deal_party_id,requirement_version_id)
);
CREATE INDEX deal_document_requirement_instances_deal_idx ON deal_document_requirement_instances(deal_id,gate_code,deal_party_id);

CREATE TABLE document_compliance_evidence_versions (
  id UUID PRIMARY KEY,
  evidence_reference TEXT NOT NULL UNIQUE,
  requirement_instance_id UUID NOT NULL REFERENCES deal_document_requirement_instances(id),
  document_version_id UUID NOT NULL UNIQUE REFERENCES document_versions(id),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  supersedes_evidence_id UUID REFERENCES document_compliance_evidence_versions(id),
  uploaded_by UUID NOT NULL REFERENCES brokers(id), uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_fingerprint CHAR(64) NOT NULL CHECK(request_fingerprint~'^[a-f0-9]{64}$'),
  CHECK(expires_at IS NULL OR expires_at>issued_at)
);
CREATE INDEX document_compliance_evidence_instance_idx ON document_compliance_evidence_versions(requirement_instance_id,uploaded_at DESC);

CREATE TABLE document_compliance_evidence_review_events (
  id UUID PRIMARY KEY,
  evidence_id UUID NOT NULL UNIQUE REFERENCES document_compliance_evidence_versions(id),
  decision TEXT NOT NULL CHECK(decision IN('accepted','returned','rejected')),
  reason TEXT,
  reviewer_id UUID NOT NULL REFERENCES brokers(id),
  admin_direct BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_fingerprint CHAR(64) NOT NULL CHECK(request_fingerprint~'^[a-f0-9]{64}$'),
  CHECK(decision='accepted' OR LENGTH(BTRIM(COALESCE(reason,'')))>=10)
);

CREATE TABLE document_compliance_official_evidence_links (
  id UUID PRIMARY KEY,
  requirement_instance_id UUID NOT NULL REFERENCES deal_document_requirement_instances(id),
  official_evidence_id UUID NOT NULL REFERENCES official_document_evidence_versions(id),
  context_fingerprint CHAR(64) NOT NULL CHECK(context_fingerprint~'^[a-f0-9]{64}$'),
  link_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(link_fingerprint~'^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requirement_instance_id,official_evidence_id)
);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK(task_type IN(
  'general','proposal_correction','customer_response_follow_up','leave_approval','document_compliance_follow_up'
));
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_context_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_context_check CHECK(
  (task_type='leave_approval' AND leave_application_id IS NOT NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type<>'leave_approval' AND leave_application_id IS NULL AND lead_id IS NOT NULL AND contact_id IS NOT NULL)
);

CREATE TABLE document_compliance_followup_task_links (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id),
  requirement_instance_id UUID NOT NULL REFERENCES deal_document_requirement_instances(id),
  generic_evidence_id UUID REFERENCES document_compliance_evidence_versions(id),
  official_evidence_id UUID REFERENCES official_document_evidence_versions(id),
  followup_reason TEXT NOT NULL CHECK(followup_reason IN('missing','returned','rejected','expiring','expired')),
  reminder_offset_days INTEGER NOT NULL CHECK(reminder_offset_days BETWEEN 0 AND 365),
  cycle_number INTEGER NOT NULL CHECK(cycle_number>0),
  due_at TIMESTAMPTZ NOT NULL,
  request_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(request_fingerprint~'^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(generic_evidence_id IS NULL OR official_evidence_id IS NULL),
  UNIQUE(requirement_instance_id,followup_reason,reminder_offset_days,cycle_number)
);

CREATE FUNCTION reject_document_compliance_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Document compliance evidence is immutable; create a governed replacement'; END $$;
CREATE TRIGGER deal_document_requirement_instances_immutable BEFORE UPDATE OR DELETE ON deal_document_requirement_instances FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();
CREATE TRIGGER document_compliance_evidence_immutable BEFORE UPDATE OR DELETE ON document_compliance_evidence_versions FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();
CREATE TRIGGER document_compliance_reviews_immutable BEFORE UPDATE OR DELETE ON document_compliance_evidence_review_events FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();
CREATE TRIGGER document_compliance_official_links_immutable BEFORE UPDATE OR DELETE ON document_compliance_official_evidence_links FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();
CREATE TRIGGER document_compliance_task_links_immutable BEFORE UPDATE OR DELETE ON document_compliance_followup_task_links FOR EACH ROW EXECUTE FUNCTION reject_document_compliance_evidence_mutation();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK(entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge','Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings','ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment','LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence','QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia','PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun','Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview','PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus','Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication','TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement','MarketingCampaign','CampaignMapping','PartnerOrganization','InventoryOrganizationLink','CommunicationPolicyDecision','OpportunityPropertyShareEvent','CustomerResponseTaskProvenance','OfficialDocumentDefinition','OfficialDocumentStepRule','OfficialDocumentEvidence','OfficialDocumentFollowup','MarketCommunity','DldCommunityMapping','DldMarketSourceBatch','DldMarketObservation','InventoryMarketIntelligenceSnapshot','CommissionPayoutPolicy','AgentPayoutAdjustment','DealCommissionExpectation','DealCommissionReceipt','DealCommissionReceiptConfirmation','DealCommissionVarianceDecision','DealAgentCredit','AgentPayoutCalculation','AgentPayoutRelease','AgentEmployment','LeavePolicy','LeaveApplication','LeaveDecision','LeaveBalance','DocumentComplianceRequirement','DocumentComplianceSnapshot','DocumentComplianceEvidence','DocumentComplianceFollowup'
));

GRANT SELECT,INSERT,UPDATE ON document_compliance_requirements,document_compliance_requirement_versions,tasks TO nysareal_nysar2app;
GRANT SELECT,INSERT ON deal_document_compliance_snapshots,deal_document_requirement_instances,
  document_compliance_evidence_versions,document_compliance_evidence_review_events,
  document_compliance_official_evidence_links,document_compliance_followup_task_links TO nysareal_nysar2app;
