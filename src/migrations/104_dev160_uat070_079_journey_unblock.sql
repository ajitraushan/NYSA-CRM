-- dev.160: UAT-070 through UAT-079 journey, recovery, building and qualification corrections.

ALTER TABLE password_reset_requests
  ADD COLUMN IF NOT EXISTS delivery_method TEXT,
  ADD COLUMN IF NOT EXISTS delivery_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_recorded_by UUID REFERENCES brokers(id);

ALTER TABLE password_reset_requests DROP CONSTRAINT IF EXISTS password_reset_requests_delivery_method_check;
ALTER TABLE password_reset_requests ADD CONSTRAINT password_reset_requests_delivery_method_check
  CHECK (delivery_method IS NULL OR delivery_method='manual_approved_private_channel');

ALTER TABLE qualification_models DROP CONSTRAINT IF EXISTS qualification_models_model_code_version_key;
DROP INDEX IF EXISTS qualification_models_model_code_version_uq;
CREATE UNIQUE INDEX qualification_models_model_code_objective_version_uq
  ON qualification_models(model_code,COALESCE(customer_objective,''),version);

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
  'OfficialDocumentEvidence','OfficialDocumentFollowup','MarketCommunity','DldCommunityMapping','DldMarketSourceBatch','DldMarketObservation','InventoryMarketIntelligenceSnapshot','InventoryBuilding',
  'CommissionPayoutPolicy','AgentPayoutAdjustment','DealCommissionExpectation','DealCommissionReceipt','DealCommissionReceiptConfirmation','DealCommissionVarianceDecision','DealAgentCredit',
  'AgentPayoutCalculation','AgentPayoutRelease','AgentEmployment','LeavePolicy','LeaveApplication','LeaveDecision','LeaveBalance','DocumentComplianceRequirement','DocumentComplianceSnapshot',
  'DocumentComplianceEvidence','DocumentComplianceFollowup','MarketingMaterialType','MarketingChannelRule','MarketingMaterial','MarketingMaterialVersion','MarketingMaterialReview',
  'MarketingMaterialTaskProvenance','DeveloperBrokerageArrangement','PropertyListingNoc'
));
