ALTER TABLE opportunities DROP CONSTRAINT opportunities_r2_1_enabled_stage_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_r2_2_enabled_stage_ck
  CHECK (stage IN ('Requirements','Matching','Viewing','Closed Lost'));

ALTER TABLE opportunity_stage_history DROP CONSTRAINT opportunity_history_r2_1_enabled_stage_ck;
ALTER TABLE opportunity_stage_history ADD CONSTRAINT opportunity_history_r2_2_enabled_stage_ck CHECK (
  (from_stage IS NULL OR from_stage IN ('Requirements','Matching','Viewing','Closed Lost'))
  AND to_stage IN ('Requirements','Matching','Viewing','Closed Lost')
);

CREATE TABLE property_matches (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  requirement_id UUID NOT NULL REFERENCES lead_requirements(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  match_source TEXT NOT NULL CHECK (match_source IN ('manual','rule')),
  fit_status TEXT NOT NULL CHECK (fit_status IN ('strong_fit','partial_fit','exception')),
  rationale TEXT NOT NULL,
  exceptions TEXT,
  shortlist_status TEXT NOT NULL DEFAULT 'considering'
    CHECK (shortlist_status IN ('considering','shortlisted','rejected')),
  shortlisted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES brokers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  UNIQUE(opportunity_id,listing_id),
  CHECK (shortlist_status <> 'shortlisted' OR shortlisted_at IS NOT NULL),
  CHECK (shortlist_status <> 'rejected' OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL))
);
CREATE INDEX property_matches_opportunity_idx ON property_matches(opportunity_id,shortlist_status,created_at);

CREATE TABLE property_match_history (
  id UUID PRIMARY KEY,
  property_match_id UUID NOT NULL REFERENCES property_matches(id),
  from_status TEXT,
  to_status TEXT NOT NULL CHECK (to_status IN ('considering','shortlisted','rejected')),
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX property_match_history_match_idx ON property_match_history(property_match_id,changed_at);
CREATE TRIGGER property_match_history_immutable BEFORE UPDATE OR DELETE ON property_match_history
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

CREATE TABLE viewings (
  id UUID PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  property_match_id UUID NOT NULL REFERENCES property_matches(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  organizer_id UUID NOT NULL REFERENCES brokers(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  location TEXT NOT NULL,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  outcome TEXT,
  feedback TEXT,
  follow_up_action TEXT,
  follow_up_due_at TIMESTAMPTZ,
  calendar_uid TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES brokers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (ends_at > starts_at),
  CHECK (status <> 'completed' OR (outcome IS NOT NULL AND feedback IS NOT NULL)),
  CHECK ((follow_up_action IS NULL) = (follow_up_due_at IS NULL))
);
CREATE INDEX viewings_opportunity_idx ON viewings(opportunity_id,starts_at DESC);

CREATE TABLE viewing_attendees (
  id UUID PRIMARY KEY,
  viewing_id UUID NOT NULL REFERENCES viewings(id),
  contact_id UUID REFERENCES contacts(id),
  broker_id UUID REFERENCES brokers(id),
  guest_name TEXT,
  attendee_role TEXT NOT NULL CHECK (attendee_role IN ('customer','agent','listing_executive','owner','guest')),
  invitation_status TEXT NOT NULL DEFAULT 'planned'
    CHECK (invitation_status IN ('planned','invited','accepted','declined')),
  attendance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (attendance_status IN ('pending','attended','absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (num_nonnulls(contact_id,broker_id,guest_name)=1)
);
CREATE INDEX viewing_attendees_viewing_idx ON viewing_attendees(viewing_id);

CREATE TABLE viewing_status_history (
  id UUID PRIMARY KEY,
  viewing_id UUID NOT NULL REFERENCES viewings(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID NOT NULL REFERENCES brokers(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX viewing_status_history_viewing_idx ON viewing_status_history(viewing_id,changed_at);
CREATE TRIGGER viewing_status_history_immutable BEFORE UPDATE OR DELETE ON viewing_status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings',
  'ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence',
  'QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun',
  'Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview',
  'PropertyMatch','Viewing'
));
