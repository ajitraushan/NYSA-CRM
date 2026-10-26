-- UAT-033: Developer-level brokerage arrangements and property-specific listing NOCs.

CREATE TABLE developer_brokerage_arrangement_versions (
  id UUID PRIMARY KEY,
  partner_version_id UUID NOT NULL REFERENCES partner_organization_versions(id),
  version_number INTEGER NOT NULL CHECK (version_number>0),
  arrangement_reference TEXT NOT NULL CHECK (CHAR_LENGTH(BTRIM(arrangement_reference))>=3),
  scope TEXT NOT NULL CHECK (CHAR_LENGTH(BTRIM(scope))>=10),
  effective_from DATE NOT NULL,
  effective_to DATE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  status TEXT NOT NULL CHECK (status IN ('pending_verification','active','rejected','superseded','retired')),
  supersedes_version_id UUID REFERENCES developer_brokerage_arrangement_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  UNIQUE(partner_version_id,version_number),
  CHECK (effective_to IS NULL OR effective_to>=effective_from),
  CHECK ((reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL)),
  CHECK (reviewed_by IS NULL OR reviewed_by<>created_by)
);
CREATE UNIQUE INDEX developer_brokerage_arrangement_active_uq
  ON developer_brokerage_arrangement_versions(partner_version_id) WHERE status='active';
CREATE UNIQUE INDEX developer_brokerage_arrangement_open_uq
  ON developer_brokerage_arrangement_versions(partner_version_id) WHERE status='pending_verification';

CREATE TABLE property_listing_noc_versions (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  partner_version_id UUID NOT NULL REFERENCES partner_organization_versions(id),
  version_number INTEGER NOT NULL CHECK (version_number>0),
  noc_reference TEXT NOT NULL CHECK (CHAR_LENGTH(BTRIM(noc_reference))>=3),
  issued_at DATE NOT NULL,
  expires_at DATE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  status TEXT NOT NULL CHECK (status IN ('pending_verification','active','rejected','superseded','retired')),
  supersedes_version_id UUID REFERENCES property_listing_noc_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  UNIQUE(listing_id,partner_version_id,version_number),
  CHECK (expires_at IS NULL OR expires_at>=issued_at),
  CHECK ((reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL)),
  CHECK (reviewed_by IS NULL OR reviewed_by<>created_by)
);
CREATE UNIQUE INDEX property_listing_noc_active_uq
  ON property_listing_noc_versions(listing_id,partner_version_id) WHERE status='active';
CREATE UNIQUE INDEX property_listing_noc_open_uq
  ON property_listing_noc_versions(listing_id,partner_version_id) WHERE status='pending_verification';
CREATE INDEX property_listing_noc_listing_idx ON property_listing_noc_versions(listing_id,created_at DESC);

ALTER TABLE document_links DROP CONSTRAINT IF EXISTS document_links_entity_type_check;
ALTER TABLE document_links ADD CONSTRAINT document_links_entity_type_check CHECK (
  entity_type IN ('Contact','Lead','Activity','Listing','Proposal','ContactChannel','Opportunity','Offer','OfferRevision','Booking','Deal','DealChecklist','Company')
);

CREATE FUNCTION prevent_developer_arrangement_fact_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Developer authority evidence is immutable'; END IF;
  IF ROW(OLD.id,OLD.partner_version_id,OLD.version_number,OLD.arrangement_reference,OLD.scope,OLD.effective_from,
      OLD.effective_to,OLD.document_version_id,OLD.supersedes_version_id,OLD.created_by,OLD.created_at)
    IS DISTINCT FROM ROW(NEW.id,NEW.partner_version_id,NEW.version_number,NEW.arrangement_reference,NEW.scope,NEW.effective_from,
      NEW.effective_to,NEW.document_version_id,NEW.supersedes_version_id,NEW.created_by,NEW.created_at) THEN
    RAISE EXCEPTION 'Developer authority evidence facts are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER developer_arrangement_immutable BEFORE UPDATE OR DELETE ON developer_brokerage_arrangement_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_developer_arrangement_fact_mutation();

CREATE FUNCTION prevent_property_listing_noc_fact_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Developer authority evidence is immutable'; END IF;
  IF ROW(OLD.id,OLD.listing_id,OLD.partner_version_id,OLD.version_number,OLD.noc_reference,OLD.issued_at,
      OLD.expires_at,OLD.document_version_id,OLD.supersedes_version_id,OLD.created_by,OLD.created_at)
    IS DISTINCT FROM ROW(NEW.id,NEW.listing_id,NEW.partner_version_id,NEW.version_number,NEW.noc_reference,NEW.issued_at,
      NEW.expires_at,NEW.document_version_id,NEW.supersedes_version_id,NEW.created_by,NEW.created_at) THEN
    RAISE EXCEPTION 'Developer authority evidence facts are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER property_listing_noc_immutable BEFORE UPDATE OR DELETE ON property_listing_noc_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_property_listing_noc_fact_mutation();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings','ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion',
  'LeadAssignment','LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence','QualificationModel','QualificationAssessment',
  'RegulatoryAssumption','FinancialScenario','PropertyMedia','PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun',
  'Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview','PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent',
  'Offer','OfferRevision','OfferReplacementAction','NegotiationEvent','Booking','BookingStatus','Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification',
  'ExternalListingPublication','TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement','MarketingCampaign','CampaignMapping',
  'PartnerOrganization','InventoryOrganizationLink','CommunicationPolicyDecision','OpportunityPropertyShareEvent','CustomerResponseTaskProvenance','OfficialDocumentDefinition','OfficialDocumentStepRule',
  'OfficialDocumentEvidence','OfficialDocumentFollowup','MarketCommunity','DldCommunityMapping','DldMarketSourceBatch','DldMarketObservation','InventoryMarketIntelligenceSnapshot',
  'CommissionPayoutPolicy','AgentPayoutAdjustment','DealCommissionExpectation','DealCommissionReceipt','DealCommissionReceiptConfirmation','DealCommissionVarianceDecision','DealAgentCredit',
  'AgentPayoutCalculation','AgentPayoutRelease','AgentEmployment','LeavePolicy','LeaveApplication','LeaveDecision','LeaveBalance','DocumentComplianceRequirement','DocumentComplianceSnapshot',
  'DocumentComplianceEvidence','DocumentComplianceFollowup','MarketingMaterialType','MarketingChannelRule','MarketingMaterial','MarketingMaterialVersion','MarketingMaterialReview',
  'MarketingMaterialTaskProvenance','DeveloperBrokerageArrangement','PropertyListingNoc'
));

GRANT SELECT,INSERT,UPDATE ON developer_brokerage_arrangement_versions TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON property_listing_noc_versions TO nysareal_nysar2app;
