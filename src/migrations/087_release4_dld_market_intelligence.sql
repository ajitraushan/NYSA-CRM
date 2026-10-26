CREATE TABLE market_communities (
  id UUID PRIMARY KEY,stable_code TEXT NOT NULL UNIQUE CHECK (stable_code ~ '^[a-z][a-z0-9_]*$'),
  area_id UUID NOT NULL REFERENCES areas(id),created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(id,area_id)
);
CREATE TABLE market_community_versions (
  id UUID PRIMARY KEY,community_id UUID NOT NULL,area_id UUID NOT NULL REFERENCES areas(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),business_label TEXT NOT NULL,normalized_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','superseded','retired')),
  created_by UUID NOT NULL REFERENCES brokers(id),approved_by UUID REFERENCES brokers(id),approved_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id),retired_at TIMESTAMPTZ,retirement_reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(community_id,area_id) REFERENCES market_communities(id,area_id),UNIQUE(community_id,version_number),UNIQUE(id,community_id),
  CHECK(status NOT IN ('active','superseded','retired') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND LENGTH(BTRIM(retirement_reason))>=10))
);
CREATE UNIQUE INDEX market_community_one_draft_uq ON market_community_versions(community_id) WHERE status='draft';
CREATE UNIQUE INDEX market_community_one_active_uq ON market_community_versions(community_id) WHERE status='active';
CREATE UNIQUE INDEX market_community_active_label_area_uq ON market_community_versions(area_id,normalized_label) WHERE status='active';
ALTER TABLE listings ADD COLUMN community_id UUID REFERENCES market_communities(id);
CREATE INDEX listings_community_id_idx ON listings(community_id);

CREATE TABLE dld_community_mapping_versions (
  id UUID PRIMARY KEY,source_dataset_ref TEXT NOT NULL,source_area_ref TEXT,source_area_label TEXT NOT NULL,
  normalized_source_identity TEXT NOT NULL,community_id UUID NOT NULL,community_version_id UUID NOT NULL,
  version_number INTEGER NOT NULL CHECK(version_number>0),status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','superseded','retired')),
  reason TEXT NOT NULL CHECK(LENGTH(BTRIM(reason))>=10),created_by UUID NOT NULL REFERENCES brokers(id),
  approved_by UUID REFERENCES brokers(id),approved_at TIMESTAMPTZ,retired_by UUID REFERENCES brokers(id),retired_at TIMESTAMPTZ,
  retirement_reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(community_version_id,community_id) REFERENCES market_community_versions(id,community_id),
  UNIQUE(source_dataset_ref,normalized_source_identity,version_number),UNIQUE(id,community_id),
  CHECK(status NOT IN ('active','superseded','retired') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND LENGTH(BTRIM(retirement_reason))>=10))
);
CREATE UNIQUE INDEX dld_mapping_one_draft_uq ON dld_community_mapping_versions(source_dataset_ref,normalized_source_identity) WHERE status='draft';
CREATE UNIQUE INDEX dld_mapping_one_active_source_uq ON dld_community_mapping_versions(source_dataset_ref,normalized_source_identity) WHERE status='active';

CREATE TABLE dld_market_source_batches (
  id UUID PRIMARY KEY,batch_reference TEXT NOT NULL UNIQUE,document_id UUID NOT NULL REFERENCES documents(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),source_dataset_ref TEXT NOT NULL,
  source_format TEXT NOT NULL CHECK(source_format IN ('dubai_pulse_api_csv','dubailand_website_csv')),
  source_file_sha256 CHAR(64) NOT NULL CHECK(source_file_sha256 ~ '^[a-f0-9]{64}$'),
  preview_fingerprint CHAR(64) NOT NULL CHECK(preview_fingerprint ~ '^[a-f0-9]{64}$'),idempotency_key TEXT NOT NULL UNIQUE,
  source_row_count INTEGER NOT NULL CHECK(source_row_count>0),accepted_row_count INTEGER NOT NULL CHECK(accepted_row_count>=0),
  rejected_row_count INTEGER NOT NULL CHECK(rejected_row_count>=0),period_start DATE,period_end DATE,
  status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN ('staged','accepted','rejected','retired')),decision_reason TEXT,
  created_by UUID NOT NULL REFERENCES brokers(id),decided_by UUID REFERENCES brokers(id),decided_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id),retired_at TIMESTAMPTZ,retirement_reason TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_dataset_ref,source_file_sha256),CHECK(accepted_row_count+rejected_row_count=source_row_count),
  CHECK(period_end IS NULL OR period_start IS NULL OR period_end>=period_start),
  CHECK(status='staged' OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND LENGTH(BTRIM(decision_reason))>=10)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND LENGTH(BTRIM(retirement_reason))>=10))
);
CREATE TABLE dld_market_source_rows (
  id UUID PRIMARY KEY,batch_id UUID NOT NULL REFERENCES dld_market_source_batches(id),source_row_number INTEGER NOT NULL CHECK(source_row_number>=2),
  source_record_ref TEXT,source_row_sha256 CHAR(64) NOT NULL CHECK(source_row_sha256 ~ '^[a-f0-9]{64}$'),
  outcome TEXT NOT NULL CHECK(outcome IN ('eligible','rejected')),rejection_reasons TEXT[] NOT NULL DEFAULT '{}',canonical_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(batch_id,source_row_number),
  CHECK((outcome='eligible' AND canonical_payload IS NOT NULL AND CARDINALITY(rejection_reasons)=0) OR
    (outcome='rejected' AND CARDINALITY(rejection_reasons)>0))
);
CREATE INDEX dld_market_source_rows_batch_outcome_idx ON dld_market_source_rows(batch_id,outcome,source_row_number);
CREATE TABLE dld_market_observations (
  id UUID PRIMARY KEY,observation_reference TEXT NOT NULL UNIQUE,batch_id UUID NOT NULL REFERENCES dld_market_source_batches(id),
  source_row_id UUID NOT NULL UNIQUE REFERENCES dld_market_source_rows(id),source_dataset_ref TEXT NOT NULL,source_record_ref TEXT NOT NULL,
  source_area_ref TEXT,source_area_label TEXT NOT NULL,transaction_at DATE NOT NULL,transaction_type TEXT NOT NULL CHECK(transaction_type='sale'),
  property_type TEXT NOT NULL,project_source_ref TEXT,project_name TEXT,building_name TEXT,bedrooms TEXT,price NUMERIC(18,2) NOT NULL CHECK(price>0),
  size_sqft NUMERIC(18,4) NOT NULL CHECK(size_sqft>0),price_per_sqft NUMERIC(18,4) NOT NULL CHECK(price_per_sqft>0),
  source_row_sha256 CHAR(64) NOT NULL CHECK(source_row_sha256 ~ '^[a-f0-9]{64}$'),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_dataset_ref,source_record_ref)
);
CREATE INDEX dld_market_observations_comparable_idx ON dld_market_observations(transaction_at,property_type,source_area_label);

CREATE TABLE inventory_market_intelligence_snapshots (
  id UUID PRIMARY KEY,snapshot_reference TEXT NOT NULL UNIQUE,listing_id UUID NOT NULL REFERENCES listings(id),
  listing_context_hash CHAR(64) NOT NULL CHECK(listing_context_hash ~ '^[a-f0-9]{64}$'),community_id UUID NOT NULL,
  community_version_id UUID NOT NULL,mapping_version_id UUID NOT NULL,policy_version TEXT NOT NULL,as_of TIMESTAMPTZ NOT NULL,
  report_fingerprint CHAR(64) NOT NULL CHECK(report_fingerprint ~ '^[a-f0-9]{64}$'),deterministic_report JSONB NOT NULL,
  narrative TEXT NOT NULL CHECK(LENGTH(BTRIM(narrative))>=20),created_by UUID NOT NULL REFERENCES brokers(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(community_version_id,community_id) REFERENCES market_community_versions(id,community_id),
  FOREIGN KEY(mapping_version_id,community_id) REFERENCES dld_community_mapping_versions(id,community_id),UNIQUE(listing_id,report_fingerprint)
);
CREATE TABLE inventory_market_intelligence_review_events (
  id UUID PRIMARY KEY,snapshot_id UUID NOT NULL UNIQUE REFERENCES inventory_market_intelligence_snapshots(id),
  decision TEXT NOT NULL CHECK(decision IN ('customer_ready','returned','rejected')),reason TEXT,reviewer_id UUID NOT NULL REFERENCES brokers(id),
  request_fingerprint CHAR(64) NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(decision='customer_ready' OR LENGTH(BTRIM(reason))>=10)
);

CREATE FUNCTION reject_dld_source_row_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'DLD source rows are immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER dld_source_rows_immutable BEFORE UPDATE OR DELETE ON dld_market_source_rows FOR EACH ROW EXECUTE FUNCTION reject_dld_source_row_mutation();
CREATE FUNCTION enforce_dld_observation_immutability() RETURNS trigger AS $$ DECLARE batch_status TEXT; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'DLD market observations are immutable'; END IF;
  SELECT status INTO batch_status FROM dld_market_source_batches WHERE id=NEW.batch_id;
  IF batch_status<>'accepted' THEN RAISE EXCEPTION 'Only an accepted DLD batch may create observations'; END IF; RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER dld_observations_immutable BEFORE INSERT OR UPDATE OR DELETE ON dld_market_observations FOR EACH ROW EXECUTE FUNCTION enforce_dld_observation_immutability();
CREATE FUNCTION reject_market_snapshot_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Market intelligence snapshots and reviews are immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER market_snapshots_immutable BEFORE UPDATE OR DELETE ON inventory_market_intelligence_snapshots FOR EACH ROW EXECUTE FUNCTION reject_market_snapshot_mutation();
CREATE TRIGGER market_snapshot_reviews_immutable BEFORE UPDATE OR DELETE ON inventory_market_intelligence_review_events FOR EACH ROW EXECUTE FUNCTION reject_market_snapshot_mutation();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK(entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings','ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence','QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun','Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview',
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus','Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication',
  'TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement','MarketingCampaign','CampaignMapping','PartnerOrganization','InventoryOrganizationLink','CommunicationPolicyDecision','OpportunityPropertyShareEvent','CustomerResponseTaskProvenance',
  'OfficialDocumentDefinition','OfficialDocumentStepRule','OfficialDocumentEvidence','OfficialDocumentFollowup','MarketCommunity','DldCommunityMapping','DldMarketSourceBatch','DldMarketObservation','InventoryMarketIntelligenceSnapshot'
));
GRANT SELECT,INSERT,UPDATE ON market_communities,market_community_versions,dld_community_mapping_versions,dld_market_source_batches TO nysareal_nysar2app;
GRANT SELECT,INSERT ON dld_market_source_rows,dld_market_observations,inventory_market_intelligence_snapshots,inventory_market_intelligence_review_events TO nysareal_nysar2app;
