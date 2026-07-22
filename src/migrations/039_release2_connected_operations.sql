CREATE TABLE opportunity_assignment_history (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  from_team_id UUID REFERENCES teams(id),
  to_team_id UUID REFERENCES teams(id),
  from_owner_id UUID REFERENCES brokers(id),
  to_owner_id UUID NOT NULL REFERENCES brokers(id),
  change_scope TEXT NOT NULL CHECK (change_scope IN ('opportunity_only','lead_and_opportunity')),
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX opportunity_assignment_history_opportunity_idx
  ON opportunity_assignment_history(opportunity_id,changed_at DESC);

INSERT INTO opportunity_assignment_history(
  id,opportunity_id,to_team_id,to_owner_id,change_scope,reason,changed_by,changed_at
)
SELECT md5('r2-initial-opportunity-owner:' || o.id::text)::uuid,o.id,o.assigned_team_id,o.owner_id,
  'opportunity_only','Initial owner captured from the qualified lead when the opportunity was created',
  o.created_by,o.created_at
FROM opportunities o
WHERE NOT EXISTS (
  SELECT 1 FROM opportunity_assignment_history h WHERE h.opportunity_id=o.id
);

CREATE TRIGGER opportunity_assignment_history_immutable
  BEFORE UPDATE OR DELETE ON opportunity_assignment_history
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun',
  'Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview'
));
