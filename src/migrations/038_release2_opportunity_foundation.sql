CREATE TABLE opportunity_number_counters (
  period_code CHAR(6) PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE opportunities (
  id UUID PRIMARY KEY,
  opportunity_reference TEXT NOT NULL UNIQUE,
  lead_id UUID NOT NULL REFERENCES leads(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  requirement_id UUID NOT NULL REFERENCES lead_requirements(id),
  qualification_assessment_id UUID NOT NULL REFERENCES qualification_assessments(id),
  listing_id UUID REFERENCES listings(id),
  assigned_team_id UUID REFERENCES teams(id),
  owner_id UUID NOT NULL REFERENCES brokers(id),
  title TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Sale','Rental','Off-plan','Commercial')),
  stage TEXT NOT NULL DEFAULT 'Requirements' CHECK (stage IN (
    'Requirements','Matching','Viewing','Offer','Negotiation','Booking','Closed Won','Closed Lost'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  next_action TEXT NOT NULL,
  next_action_due_at TIMESTAMPTZ NOT NULL,
  lost_reason_code TEXT,
  lost_reason TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_from_legacy_stage TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT opportunities_r2_1_enabled_stage_ck CHECK (stage IN ('Requirements','Matching','Closed Lost')),
  CHECK (stage <> 'Closed Lost' OR (lost_reason_code IS NOT NULL AND lost_reason IS NOT NULL)),
  CHECK (stage NOT IN ('Closed Won','Closed Lost') OR closed_at IS NOT NULL)
);

CREATE INDEX opportunities_lead_idx ON opportunities(lead_id,created_at DESC);
CREATE INDEX opportunities_owner_stage_idx ON opportunities(owner_id,stage,next_action_due_at);
CREATE INDEX opportunities_team_stage_idx ON opportunities(assigned_team_id,stage,next_action_due_at);
CREATE UNIQUE INDEX opportunities_open_listing_pursuit_uq
  ON opportunities(lead_id,listing_id,transaction_type)
  WHERE listing_id IS NOT NULL AND stage NOT IN ('Closed Won','Closed Lost');
CREATE UNIQUE INDEX opportunities_open_unselected_pursuit_uq
  ON opportunities(lead_id,transaction_type)
  WHERE listing_id IS NULL AND stage='Requirements';

CREATE TABLE opportunity_stage_history (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason_code TEXT,
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT opportunity_history_r2_1_enabled_stage_ck CHECK (
    (from_stage IS NULL OR from_stage IN ('Requirements','Matching','Closed Lost'))
    AND to_stage IN ('Requirements','Matching','Closed Lost')
  )
);
CREATE INDEX opportunity_stage_history_opportunity_idx
  ON opportunity_stage_history(opportunity_id,changed_at DESC);

CREATE TABLE opportunity_attribution (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL UNIQUE REFERENCES opportunities(id),
  originating_lead_id UUID NOT NULL REFERENCES leads(id),
  source TEXT NOT NULL,
  campaign_code TEXT,
  external_source_id TEXT,
  source_page TEXT,
  source_form TEXT,
  originating_listing_id UUID REFERENCES listings(id),
  attribution_basis TEXT NOT NULL DEFAULT 'original_enquiry'
    CHECK (attribution_basis='original_enquiry'),
  provenance_snapshot JSONB NOT NULL,
  provenance_hash CHAR(64) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX opportunity_attribution_campaign_idx
  ON opportunity_attribution(campaign_code) WHERE campaign_code IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_release2_immutable_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Release 2 opportunity evidence is immutable';
END;
$$;
CREATE TRIGGER opportunity_attribution_immutable
  BEFORE UPDATE OR DELETE ON opportunity_attribution
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

CREATE TRIGGER opportunity_stage_history_immutable
  BEFORE UPDATE OR DELETE ON opportunity_stage_history
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

CREATE TABLE opportunity_participants (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  broker_id UUID NOT NULL REFERENCES brokers(id),
  participation_role TEXT NOT NULL CHECK (participation_role IN ('owner','listing_executive','manager','support')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  added_by UUID NOT NULL REFERENCES brokers(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  UNIQUE(opportunity_id,broker_id,participation_role)
);
CREATE INDEX opportunity_participants_broker_idx
  ON opportunity_participants(broker_id,opportunity_id) WHERE active;

CREATE TABLE r2_legacy_lead_review (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL UNIQUE REFERENCES leads(id),
  legacy_stage TEXT NOT NULL CHECK (legacy_stage IN ('Viewing','Negotiation','Won','Lost')),
  review_reason TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','linked_after_review','no_opportunity_required','deferred')),
  linked_opportunity_id UUID REFERENCES opportunities(id),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (review_status <> 'linked_after_review' OR linked_opportunity_id IS NOT NULL)
);

INSERT INTO r2_legacy_lead_review(id,lead_id,legacy_stage,review_reason)
SELECT md5('r2-legacy-lead:' || id::text)::uuid,id,stage,
  CASE stage
    WHEN 'Won' THEN 'A lead stage alone cannot create an authoritative deal'
    WHEN 'Lost' THEN 'Review whether the loss belongs to the lead or a distinct property pursuit'
    ELSE 'Review property and requirement evidence before explicitly creating an opportunity'
  END
FROM leads
WHERE stage IN ('Viewing','Negotiation','Won','Lost')
ON CONFLICT (lead_id) DO NOTHING;

CREATE VIEW r2_opportunity_reconciliation AS
SELECT
  (SELECT COUNT(*) FROM leads WHERE stage IN ('Viewing','Negotiation','Won','Lost')) AS legacy_review_population,
  (SELECT COUNT(*) FROM r2_legacy_lead_review) AS review_ledger_population,
  (SELECT COUNT(*) FROM opportunities) AS opportunity_population,
  (SELECT COUNT(*) FROM opportunities WHERE stage NOT IN ('Closed Won','Closed Lost')) AS active_opportunity_population,
  (SELECT COUNT(*) FROM opportunity_attribution) AS attribution_population;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun',
  'Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','R2LegacyLeadReview'
));
