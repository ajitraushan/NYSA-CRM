-- Release 4 local integration: governed Company versions and optional Inventory organization provenance.

ALTER TABLE external_company_roles DROP CONSTRAINT IF EXISTS external_company_roles_role_code_check;
ALTER TABLE external_company_roles ADD CONSTRAINT external_company_roles_role_code_check CHECK (role_code IN (
  'developer','agency','referral_partner','service_provider','employer','supplier','corporate_client','landlord','vendor','other'
));

CREATE TABLE partner_organization_versions (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  version_number INTEGER NOT NULL CHECK (version_number>0),
  policy_version TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('developer','external_agency','referral_partner','service_provider')),
  legal_name TEXT NOT NULL CHECK (CHAR_LENGTH(BTRIM(legal_name))>=3),
  normalized_legal_name TEXT NOT NULL,
  trade_name TEXT,
  licence_reference TEXT,
  normalized_licence_reference TEXT,
  licence_issuer TEXT,
  licence_expires_at TIMESTAMPTZ,
  licence_evidence_status TEXT NOT NULL CHECK (licence_evidence_status IN ('provided','not_provided')),
  source_evidence_reference TEXT NOT NULL,
  source_evidence_sha256 CHAR(64) NOT NULL CHECK (source_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL CHECK (status IN ('duplicate_review','pending_verification','active','rejected','duplicate_closed','superseded','retired')),
  supersedes_version_id UUID REFERENCES partner_organization_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duplicate_decision TEXT CHECK (duplicate_decision IN ('use_existing','continue_distinct')),
  duplicate_company_id UUID REFERENCES companies(id),
  duplicate_reason TEXT,
  duplicate_reviewed_by UUID REFERENCES brokers(id),
  duplicate_reviewed_at TIMESTAMPTZ,
  verification_decision TEXT CHECK (verification_decision IN ('activated','rejected')),
  verification_reason TEXT,
  verified_by UUID REFERENCES brokers(id),
  verified_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id),
  retirement_reason TEXT,
  retired_at TIMESTAMPTZ,
  UNIQUE(company_id,version_number),
  CHECK ((licence_evidence_status='provided' AND licence_reference IS NOT NULL AND normalized_licence_reference IS NOT NULL)
    OR (licence_evidence_status='not_provided' AND licence_reference IS NULL AND normalized_licence_reference IS NULL)),
  CHECK (licence_reference IS NOT NULL OR (licence_issuer IS NULL AND licence_expires_at IS NULL)),
  CHECK ((duplicate_decision IS NULL AND duplicate_reason IS NULL AND duplicate_reviewed_by IS NULL AND duplicate_reviewed_at IS NULL)
    OR (duplicate_decision IS NOT NULL AND duplicate_reason IS NOT NULL AND duplicate_reviewed_by IS NOT NULL AND duplicate_reviewed_at IS NOT NULL)),
  CHECK (duplicate_decision<>'use_existing' OR duplicate_company_id IS NOT NULL),
  CHECK ((verification_decision IS NULL AND verification_reason IS NULL AND verified_by IS NULL AND verified_at IS NULL)
    OR (verification_decision IS NOT NULL AND verification_reason IS NOT NULL AND verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK (verified_by IS NULL OR verified_by<>created_by),
  CHECK ((status<>'retired' AND retired_by IS NULL AND retirement_reason IS NULL AND retired_at IS NULL)
    OR (status='retired' AND retired_by IS NOT NULL AND retirement_reason IS NOT NULL AND retired_at IS NOT NULL))
);

CREATE UNIQUE INDEX partner_organization_versions_active_uq ON partner_organization_versions(company_id) WHERE status='active';
CREATE UNIQUE INDEX partner_organization_versions_open_uq ON partner_organization_versions(company_id) WHERE status IN ('duplicate_review','pending_verification');
CREATE INDEX partner_organization_versions_name_idx ON partner_organization_versions(normalized_legal_name) WHERE status NOT IN ('duplicate_closed','retired');
CREATE INDEX partner_organization_versions_licence_idx ON partner_organization_versions(normalized_licence_reference) WHERE normalized_licence_reference IS NOT NULL AND status NOT IN ('duplicate_closed','retired');

CREATE FUNCTION prevent_partner_organization_fact_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.company_id,NEW.version_number,NEW.policy_version,NEW.classification,NEW.legal_name,NEW.normalized_legal_name,NEW.trade_name,
    NEW.licence_reference,NEW.normalized_licence_reference,NEW.licence_issuer,NEW.licence_expires_at,NEW.licence_evidence_status,
    NEW.source_evidence_reference,NEW.source_evidence_sha256,NEW.supersedes_version_id,NEW.created_by,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.company_id,OLD.version_number,OLD.policy_version,OLD.classification,OLD.legal_name,OLD.normalized_legal_name,OLD.trade_name,
    OLD.licence_reference,OLD.normalized_licence_reference,OLD.licence_issuer,OLD.licence_expires_at,OLD.licence_evidence_status,
    OLD.source_evidence_reference,OLD.source_evidence_sha256,OLD.supersedes_version_id,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION 'Governed organization version facts are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER partner_organization_versions_immutable_facts BEFORE UPDATE ON partner_organization_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_partner_organization_fact_mutation();

CREATE TABLE inventory_organization_link_events (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  relationship TEXT NOT NULL CHECK (relationship IN ('developer','listing_source_agency','referral_source')),
  action TEXT NOT NULL CHECK (action IN ('linked','replaced','unlinked')),
  partner_version_id UUID REFERENCES partner_organization_versions(id),
  supersedes_event_id UUID REFERENCES inventory_organization_link_events(id),
  reason TEXT NOT NULL CHECK (CHAR_LENGTH(BTRIM(reason))>=10),
  performed_by UUID NOT NULL REFERENCES brokers(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  policy_version TEXT NOT NULL,
  CHECK ((action='linked' AND partner_version_id IS NOT NULL AND supersedes_event_id IS NULL)
    OR (action='replaced' AND partner_version_id IS NOT NULL AND supersedes_event_id IS NOT NULL)
    OR (action='unlinked' AND partner_version_id IS NULL AND supersedes_event_id IS NOT NULL))
);
CREATE INDEX inventory_organization_link_events_stream_idx ON inventory_organization_link_events(listing_id,relationship,performed_at DESC,id DESC);

CREATE FUNCTION validate_inventory_organization_link_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE classification_value TEXT; prior inventory_organization_link_events%ROWTYPE;
BEGIN
  IF NEW.partner_version_id IS NOT NULL THEN
    SELECT classification INTO classification_value FROM partner_organization_versions WHERE id=NEW.partner_version_id AND status='active';
    IF classification_value IS NULL THEN RAISE EXCEPTION 'Only an active governed organization version can be linked'; END IF;
    IF (NEW.relationship='developer' AND classification_value<>'developer')
      OR (NEW.relationship='listing_source_agency' AND classification_value<>'external_agency')
      OR (NEW.relationship='referral_source' AND classification_value<>'referral_partner') THEN
      RAISE EXCEPTION 'Organization classification is incompatible with Inventory relationship';
    END IF;
  END IF;
  IF NEW.supersedes_event_id IS NOT NULL THEN
    SELECT * INTO prior FROM inventory_organization_link_events WHERE id=NEW.supersedes_event_id;
    IF prior.id IS NULL OR prior.listing_id<>NEW.listing_id OR prior.relationship<>NEW.relationship THEN
      RAISE EXCEPTION 'Superseded organization link must belong to the same Inventory relationship stream';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inventory_organization_link_events_validate BEFORE INSERT ON inventory_organization_link_events
  FOR EACH ROW EXECUTE FUNCTION validate_inventory_organization_link_event();

CREATE FUNCTION prevent_inventory_organization_link_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Inventory organization link events are append-only'; END $$;
CREATE TRIGGER inventory_organization_link_events_append_only BEFORE UPDATE OR DELETE ON inventory_organization_link_events
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_organization_link_mutation();

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
  'Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication',
  'TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement',
  'MarketingCampaign','CampaignMapping','PartnerOrganization','InventoryOrganizationLink'
));

GRANT SELECT,INSERT,UPDATE ON partner_organization_versions TO nysareal_nysar2app;
GRANT SELECT,INSERT ON inventory_organization_link_events TO nysareal_nysar2app;
