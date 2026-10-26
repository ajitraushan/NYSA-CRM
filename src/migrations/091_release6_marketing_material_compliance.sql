-- Release 6 Marketing Material Compliance.
-- Additive local implementation; intentionally unapplied outside a disposable local test database.

CREATE TABLE marketing_material_types (
  id UUID PRIMARY KEY,
  stable_code TEXT NOT NULL UNIQUE CHECK(stable_code~'^[a-z][a-z0-9_]{2,39}$'),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE marketing_material_type_versions (
  id UUID PRIMARY KEY,
  material_type_id UUID NOT NULL REFERENCES marketing_material_types(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  label TEXT NOT NULL CHECK(LENGTH(BTRIM(label))>=3),
  description TEXT NOT NULL CHECK(LENGTH(BTRIM(description))>=10),
  scope_type TEXT NOT NULL CHECK(scope_type IN('property','corporate','either')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','superseded','retired')),
  supersedes_version_id UUID REFERENCES marketing_material_type_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id), activated_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id), retired_at TIMESTAMPTZ, retirement_reason TEXT,
  UNIQUE(material_type_id,version_number),
  CHECK(status NOT IN('active','superseded','retired') OR (activated_by IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND LENGTH(BTRIM(COALESCE(retirement_reason,'')))>=5))
);
CREATE UNIQUE INDEX marketing_material_type_active_uq ON marketing_material_type_versions(material_type_id) WHERE status='active';
CREATE UNIQUE INDEX marketing_material_type_draft_uq ON marketing_material_type_versions(material_type_id) WHERE status='draft';

CREATE TABLE marketing_channel_rule_versions (
  id UUID PRIMARY KEY,
  material_type_id UUID NOT NULL REFERENCES marketing_material_types(id),
  material_type_version_id UUID NOT NULL REFERENCES marketing_material_type_versions(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  channel_code TEXT NOT NULL CHECK(channel_code~'^[a-z][a-z0-9_]{1,39}$'),
  region_code TEXT NOT NULL CHECK(region_code~'^[a-z][a-z0-9_-]{1,39}$'),
  campaign_required BOOLEAN NOT NULL DEFAULT FALSE,
  listing_required BOOLEAN NOT NULL DEFAULT TRUE,
  approved_media_required BOOLEAN NOT NULL DEFAULT TRUE,
  permit_requirement TEXT NOT NULL DEFAULT 'none' CHECK(permit_requirement IN('none','current_inventory_permit','verified_official_evidence','either')),
  required_disclosure_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  approver_route TEXT NOT NULL CHECK(approver_route IN('manager','director','manager_or_director')),
  default_validity_days INTEGER NOT NULL DEFAULT 30 CHECK(default_validity_days BETWEEN 1 AND 366),
  expiry_reminder_days INTEGER[] NOT NULL DEFAULT ARRAY[7,1]::INTEGER[],
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','active','superseded','retired')),
  supersedes_version_id UUID REFERENCES marketing_channel_rule_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id), activated_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id), retired_at TIMESTAMPTZ, retirement_reason TEXT,
  UNIQUE(material_type_id,channel_code,region_code,version_number),
  CHECK(status NOT IN('active','superseded','retired') OR (activated_by IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND LENGTH(BTRIM(COALESCE(retirement_reason,'')))>=5))
);
CREATE UNIQUE INDEX marketing_channel_rule_active_uq ON marketing_channel_rule_versions(material_type_id,channel_code,region_code) WHERE status='active';
CREATE UNIQUE INDEX marketing_channel_rule_draft_uq ON marketing_channel_rule_versions(material_type_id,channel_code,region_code) WHERE status='draft';

CREATE TABLE marketing_materials (
  id UUID PRIMARY KEY,
  material_reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK(LENGTH(BTRIM(title))>=3),
  listing_id UUID REFERENCES listings(id),
  campaign_id UUID REFERENCES marketing_campaigns(id),
  owner_id UUID NOT NULL REFERENCES brokers(id),
  lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK(lifecycle_status IN('draft','in_review','approved','returned','rejected','withdrawn','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX marketing_material_scope_idx ON marketing_materials(owner_id,listing_id,lifecycle_status,updated_at DESC);

CREATE TABLE marketing_material_versions (
  id UUID PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES marketing_materials(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  supersedes_version_id UUID REFERENCES marketing_material_versions(id),
  material_type_version_id UUID NOT NULL REFERENCES marketing_material_type_versions(id),
  listing_id UUID REFERENCES listings(id), campaign_id UUID REFERENCES marketing_campaigns(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  purpose TEXT NOT NULL CHECK(LENGTH(BTRIM(purpose))>=5), audience TEXT NOT NULL CHECK(LENGTH(BTRIM(audience))>=3),
  region_code TEXT NOT NULL CHECK(region_code~'^[a-z][a-z0-9_-]{1,39}$'),
  headline_snapshot TEXT, body_copy_snapshot TEXT,
  disclosure_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB CHECK(jsonb_typeof(disclosure_snapshot)='array'),
  requested_release_from TIMESTAMPTZ NOT NULL, requested_release_until TIMESTAMPTZ,
  content_hash CHAR(64) NOT NULL CHECK(content_hash~'^[a-f0-9]{64}$'),
  source_context_hash CHAR(64) NOT NULL CHECK(source_context_hash~'^[a-f0-9]{64}$'),
  request_fingerprint CHAR(64) CHECK(request_fingerprint IS NULL OR request_fingerprint~'^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','submitted','partially_approved','approved','returned','rejected','withdrawn')),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID REFERENCES brokers(id), submitted_at TIMESTAMPTZ,
  withdrawn_by UUID REFERENCES brokers(id), withdrawn_at TIMESTAMPTZ, withdrawal_reason TEXT,
  UNIQUE(material_id,version_number), UNIQUE(request_fingerprint),
  CHECK(requested_release_until IS NULL OR requested_release_until>requested_release_from),
  CHECK(status='draft' OR (submitted_by IS NOT NULL AND submitted_at IS NOT NULL AND request_fingerprint IS NOT NULL)),
  CHECK(status<>'withdrawn' OR (withdrawn_by IS NOT NULL AND withdrawn_at IS NOT NULL AND LENGTH(BTRIM(COALESCE(withdrawal_reason,'')))>=5))
);
CREATE INDEX marketing_material_versions_status_idx ON marketing_material_versions(status,submitted_at DESC);

CREATE TABLE marketing_material_media_links (
  id UUID PRIMARY KEY, version_id UUID NOT NULL REFERENCES marketing_material_versions(id),
  property_media_id UUID NOT NULL REFERENCES property_media(id),
  source_fingerprint CHAR(64) NOT NULL CHECK(source_fingerprint~'^[a-f0-9]{64}$'),
  captured_rights_expires_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(version_id,property_media_id)
);

CREATE TABLE marketing_material_official_evidence_links (
  id UUID PRIMARY KEY, version_id UUID NOT NULL REFERENCES marketing_material_versions(id),
  official_evidence_id UUID NOT NULL REFERENCES official_document_evidence_versions(id),
  requirement_code TEXT NOT NULL CHECK(requirement_code~'^[a-z][a-z0-9_]{2,79}$'),
  source_fingerprint CHAR(64) NOT NULL CHECK(source_fingerprint~'^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(version_id,official_evidence_id,requirement_code)
);

CREATE TABLE marketing_material_permit_snapshots (
  id UUID PRIMARY KEY, version_id UUID NOT NULL UNIQUE REFERENCES marketing_material_versions(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  permit_reference_hash CHAR(64) NOT NULL CHECK(permit_reference_hash~'^[a-f0-9]{64}$'),
  captured_expires_at TIMESTAMPTZ,
  source_fingerprint CHAR(64) NOT NULL CHECK(source_fingerprint~'^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE marketing_material_channel_requests (
  id UUID PRIMARY KEY, version_id UUID NOT NULL REFERENCES marketing_material_versions(id),
  rule_version_id UUID NOT NULL REFERENCES marketing_channel_rule_versions(id),
  channel_code TEXT NOT NULL, region_code TEXT NOT NULL,
  assigned_approver_role TEXT NOT NULL CHECK(assigned_approver_role IN('manager','director')),
  assigned_approver_id UUID NOT NULL REFERENCES brokers(id), assigned_team_id UUID REFERENCES teams(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','returned','rejected','withdrawn')),
  requested_release_from TIMESTAMPTZ NOT NULL, requested_release_until TIMESTAMPTZ,
  approved_release_until TIMESTAMPTZ,
  current_eligibility TEXT NOT NULL DEFAULT 'blocked' CHECK(current_eligibility IN('blocked','scheduled','released_for_use','stale','expired','withdrawn')),
  eligibility_reason_code TEXT NOT NULL DEFAULT 'channel_not_approved', eligibility_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(version_id,channel_code,region_code)
);
CREATE INDEX marketing_material_review_queue_idx ON marketing_material_channel_requests(assigned_approver_id,status,created_at);

CREATE TABLE marketing_material_review_events (
  id UUID PRIMARY KEY, channel_request_id UUID NOT NULL REFERENCES marketing_material_channel_requests(id),
  decision TEXT NOT NULL CHECK(decision IN('approved','returned','rejected','withdrawn')),
  reason TEXT, reviewer_id UUID NOT NULL REFERENCES brokers(id),
  reviewer_role TEXT NOT NULL CHECK(reviewer_role IN('manager','director','admin')),
  admin_direct BOOLEAN NOT NULL DEFAULT FALSE, reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_release_until TIMESTAMPTZ, dependency_context_hash CHAR(64) NOT NULL CHECK(dependency_context_hash~'^[a-f0-9]{64}$'),
  request_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(request_fingerprint~'^[a-f0-9]{64}$'),
  CHECK(decision='approved' OR LENGTH(BTRIM(COALESCE(reason,'')))>=5)
);
CREATE INDEX marketing_material_review_history_idx ON marketing_material_review_events(channel_request_id,reviewed_at DESC);

ALTER TABLE tasks ADD COLUMN marketing_material_version_id UUID REFERENCES marketing_material_versions(id);
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK(task_type IN(
  'general','proposal_correction','customer_response_follow_up','leave_approval','document_compliance_follow_up',
  'marketing_material_review','marketing_material_follow_up'
));
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_context_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_context_check CHECK(
  (task_type='leave_approval' AND leave_application_id IS NOT NULL AND marketing_material_version_id IS NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type IN('marketing_material_review','marketing_material_follow_up') AND marketing_material_version_id IS NOT NULL AND leave_application_id IS NULL AND lead_id IS NULL AND contact_id IS NULL) OR
  (task_type NOT IN('leave_approval','marketing_material_review','marketing_material_follow_up') AND leave_application_id IS NULL AND marketing_material_version_id IS NULL AND lead_id IS NOT NULL AND contact_id IS NOT NULL)
);
CREATE UNIQUE INDEX tasks_one_open_marketing_review_idx ON tasks(marketing_material_version_id,assignee_id)
  WHERE task_type='marketing_material_review' AND status IN('open','in_progress');

CREATE TABLE marketing_material_task_links (
  id UUID PRIMARY KEY, task_id UUID NOT NULL UNIQUE REFERENCES tasks(id),
  version_id UUID NOT NULL REFERENCES marketing_material_versions(id),
  channel_request_id UUID REFERENCES marketing_material_channel_requests(id),
  reason TEXT NOT NULL CHECK(reason IN('review','returned','approaching_expiry','stale')),
  cycle_number INTEGER NOT NULL CHECK(cycle_number>0),
  assignee_id UUID NOT NULL REFERENCES brokers(id), routing_reason TEXT NOT NULL,
  request_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(request_fingerprint~'^[a-f0-9]{64}$'),
  created_by UUID NOT NULL REFERENCES brokers(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE FUNCTION protect_marketing_material_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND OLD.status<>'draft' THEN RAISE EXCEPTION 'Submitted marketing material versions are immutable'; END IF;
  IF TG_OP='UPDATE' AND OLD.status<>'draft' AND ROW(NEW.material_id,NEW.version_number,NEW.supersedes_version_id,NEW.material_type_version_id,NEW.listing_id,NEW.campaign_id,NEW.document_version_id,NEW.purpose,NEW.audience,NEW.region_code,NEW.headline_snapshot,NEW.body_copy_snapshot,NEW.disclosure_snapshot,NEW.requested_release_from,NEW.requested_release_until,NEW.content_hash,NEW.source_context_hash,NEW.request_fingerprint,NEW.created_by,NEW.created_at,NEW.submitted_by,NEW.submitted_at) IS DISTINCT FROM ROW(OLD.material_id,OLD.version_number,OLD.supersedes_version_id,OLD.material_type_version_id,OLD.listing_id,OLD.campaign_id,OLD.document_version_id,OLD.purpose,OLD.audience,OLD.region_code,OLD.headline_snapshot,OLD.body_copy_snapshot,OLD.disclosure_snapshot,OLD.requested_release_from,OLD.requested_release_until,OLD.content_hash,OLD.source_context_hash,OLD.request_fingerprint,OLD.created_by,OLD.created_at,OLD.submitted_by,OLD.submitted_at) THEN
    RAISE EXCEPTION 'Submitted marketing material content is immutable; create a new version';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER marketing_material_version_guard BEFORE UPDATE OR DELETE ON marketing_material_versions FOR EACH ROW EXECUTE FUNCTION protect_marketing_material_version();

CREATE FUNCTION reject_marketing_material_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Marketing material evidence is immutable; create a governed replacement'; END $$;
CREATE TRIGGER marketing_media_links_immutable BEFORE UPDATE OR DELETE ON marketing_material_media_links FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();
CREATE TRIGGER marketing_official_links_immutable BEFORE UPDATE OR DELETE ON marketing_material_official_evidence_links FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();
CREATE TRIGGER marketing_permit_snapshots_immutable BEFORE UPDATE OR DELETE ON marketing_material_permit_snapshots FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();
CREATE TRIGGER marketing_review_events_immutable BEFORE UPDATE OR DELETE ON marketing_material_review_events FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();
CREATE TRIGGER marketing_task_links_immutable BEFORE UPDATE OR DELETE ON marketing_material_task_links FOR EACH ROW EXECUTE FUNCTION reject_marketing_material_evidence_mutation();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK(entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge','Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings','ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment','LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence','QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia','PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun','Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview','PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus','Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication','TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement','MarketingCampaign','CampaignMapping','PartnerOrganization','InventoryOrganizationLink','CommunicationPolicyDecision','OpportunityPropertyShareEvent','CustomerResponseTaskProvenance','OfficialDocumentDefinition','OfficialDocumentStepRule','OfficialDocumentEvidence','OfficialDocumentFollowup','MarketCommunity','DldCommunityMapping','DldMarketSourceBatch','DldMarketObservation','InventoryMarketIntelligenceSnapshot','CommissionPayoutPolicy','AgentPayoutAdjustment','DealCommissionExpectation','DealCommissionReceipt','DealCommissionReceiptConfirmation','DealCommissionVarianceDecision','DealAgentCredit','AgentPayoutCalculation','AgentPayoutRelease','AgentEmployment','LeavePolicy','LeaveApplication','LeaveDecision','LeaveBalance','DocumentComplianceRequirement','DocumentComplianceSnapshot','DocumentComplianceEvidence','DocumentComplianceFollowup','MarketingMaterialType','MarketingChannelRule','MarketingMaterial','MarketingMaterialVersion','MarketingMaterialReview','MarketingMaterialTaskProvenance'
));

GRANT SELECT,INSERT,UPDATE ON marketing_material_types,marketing_material_type_versions,
  marketing_channel_rule_versions,marketing_materials,marketing_material_versions,
  marketing_material_channel_requests,tasks TO nysareal_nysar2app;
GRANT SELECT,INSERT ON marketing_material_media_links,marketing_material_official_evidence_links,
  marketing_material_permit_snapshots,marketing_material_review_events,marketing_material_task_links TO nysareal_nysar2app;
