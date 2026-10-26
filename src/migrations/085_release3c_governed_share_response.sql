-- NYSA CORE Release 3C local governed share/response integration.
-- Locally implemented after Gate 2 approval; migration remains unapplied to every environment.
-- No recipient value, message body, public token, credential, provider data, owner data or authority
-- data is introduced by the governed path.

-- Persist only the fail-closed decision needed by the share-time preflight. Connected communication
-- attempts, provider events, outbox processing and delivery remain Release 3D.
CREATE TABLE communication_policy_decisions (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  contact_channel_id UUID REFERENCES contact_channels(id),
  actor_id UUID NOT NULL REFERENCES brokers(id),
  channel TEXT NOT NULL CHECK (channel='whatsapp'),
  purpose TEXT NOT NULL CHECK (purpose='transactional_share'),
  policy_version TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('allowed','denied')),
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reason_codes)='array'),
  actor_authorized SMALLINT NOT NULL CHECK (actor_authorized IN (0,1)),
  channel_eligible SMALLINT NOT NULL CHECK (channel_eligible IN (0,1)),
  consent_permits SMALLINT NOT NULL CHECK (consent_permits IN (0,1)),
  restriction_clear SMALLINT NOT NULL CHECK (restriction_clear IN (0,1)),
  subject_eligible SMALLINT NOT NULL CHECK (subject_eligible IN (0,1)),
  consent_evidence_reference TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  evidence_hash CHAR(64) NOT NULL UNIQUE CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until>evaluated_at),
  CHECK ((outcome='allowed' AND contact_channel_id IS NOT NULL AND actor_authorized=1 AND channel_eligible=1 AND consent_permits=1
    AND restriction_clear=1 AND subject_eligible=1 AND jsonb_array_length(reason_codes)=0)
    OR (outcome='denied' AND (actor_authorized=0 OR channel_eligible=0 OR consent_permits=0
      OR restriction_clear=0 OR subject_eligible=0) AND jsonb_array_length(reason_codes)>0))
);
CREATE INDEX communication_policy_decisions_opportunity_idx
  ON communication_policy_decisions(opportunity_id,evaluated_at DESC);
CREATE TRIGGER communication_policy_decisions_immutable BEFORE UPDATE OR DELETE ON communication_policy_decisions
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- Governed rows reuse the Release 2.6 share header. Legacy contact-bearing shares remain readable;
-- their existing columns become nullable only so new governed rows can contain no contact values.
ALTER TABLE opportunity_property_shares
  ALTER COLUMN recipient_phone DROP NOT NULL,
  ALTER COLUMN recipient_name DROP NOT NULL,
  ALTER COLUMN customer_message DROP NOT NULL,
  ALTER COLUMN public_token_hash DROP NOT NULL,
  ALTER COLUMN public_expires_at DROP NOT NULL,
  ADD COLUMN governed_contract_version TEXT,
  ADD COLUMN preflight_version TEXT,
  ADD COLUMN matching_run_id UUID REFERENCES inventory_matching_runs(id),
  ADD COLUMN requirement_id UUID REFERENCES lead_requirements(id),
  ADD COLUMN requirement_version_no INTEGER CHECK (requirement_version_no IS NULL OR requirement_version_no>0),
  ADD COLUMN request_fingerprint CHAR(64),
  ADD COLUMN shortlist_evidence_hash CHAR(64),
  ADD COLUMN preflight_evidence_hash CHAR(64),
  ADD COLUMN policy_decision_id UUID REFERENCES communication_policy_decisions(id),
  ADD COLUMN template_reference TEXT,
  ADD COLUMN prepared_at TIMESTAMPTZ,
  ADD COLUMN preflight_expires_at TIMESTAMPTZ,
  ADD COLUMN governed_status TEXT CHECK (governed_status IN ('prepared_not_sent','cancelled')),
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version>0);

ALTER TABLE opportunity_property_shares ADD CONSTRAINT opportunity_property_shares_governed_shape_ck CHECK (
  (governed_contract_version IS NULL AND preflight_version IS NULL AND governed_status IS NULL)
  OR
  (governed_contract_version='r3c-customer-shortlist-v1'
    AND preflight_version='r3c-governed-share-preflight-v1'
    AND matching_run_id IS NOT NULL AND requirement_id IS NOT NULL AND requirement_version_no IS NOT NULL
    AND request_fingerprint ~ '^[a-f0-9]{64}$'
    AND shortlist_evidence_hash ~ '^[a-f0-9]{64}$' AND preflight_evidence_hash ~ '^[a-f0-9]{64}$'
    AND policy_decision_id IS NOT NULL AND NULLIF(BTRIM(template_reference),'') IS NOT NULL
    AND prepared_at IS NOT NULL AND preflight_expires_at>prepared_at AND governed_status IS NOT NULL
    AND status='prepared' AND channel='whatsapp'
    AND recipient_phone IS NULL AND recipient_name IS NULL AND recipient_agency IS NULL
    AND customer_message IS NULL AND public_token_hash IS NULL AND public_expires_at IS NULL)
);
CREATE UNIQUE INDEX opportunity_property_shares_governed_shortlist_uq
  ON opportunity_property_shares(shortlist_evidence_hash)
  WHERE governed_contract_version IS NOT NULL;
CREATE UNIQUE INDEX opportunity_property_shares_governed_request_uq
  ON opportunity_property_shares(request_fingerprint)
  WHERE governed_contract_version IS NOT NULL;
CREATE UNIQUE INDEX opportunity_property_shares_governed_preflight_uq
  ON opportunity_property_shares(preflight_evidence_hash)
  WHERE governed_contract_version IS NOT NULL;
CREATE INDEX opportunity_property_shares_governed_opportunity_idx
  ON opportunity_property_shares(opportunity_id,prepared_at DESC)
  WHERE governed_contract_version IS NOT NULL;

CREATE FUNCTION prevent_governed_property_share_fact_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.governed_contract_version IS NOT NULL AND ROW(
    NEW.opportunity_id,NEW.channel,NEW.governed_contract_version,NEW.preflight_version,
    NEW.matching_run_id,NEW.requirement_id,NEW.requirement_version_no,NEW.request_fingerprint,NEW.shortlist_evidence_hash,
    NEW.preflight_evidence_hash,NEW.policy_decision_id,NEW.template_reference,NEW.prepared_at,
    NEW.preflight_expires_at,NEW.created_by,NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.opportunity_id,OLD.channel,OLD.governed_contract_version,OLD.preflight_version,
    OLD.matching_run_id,OLD.requirement_id,OLD.requirement_version_no,OLD.request_fingerprint,OLD.shortlist_evidence_hash,
    OLD.preflight_evidence_hash,OLD.policy_decision_id,OLD.template_reference,OLD.prepared_at,
    OLD.preflight_expires_at,OLD.created_by,OLD.created_at
  ) THEN RAISE EXCEPTION 'Governed property-share facts are immutable'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_property_shares_governed_immutable_facts
  BEFORE UPDATE ON opportunity_property_shares FOR EACH ROW
  EXECUTE FUNCTION prevent_governed_property_share_fact_mutation();

ALTER TABLE opportunity_property_share_items
  ADD COLUMN matching_candidate_id UUID REFERENCES inventory_matching_candidates(id),
  ADD COLUMN match_decision_id UUID REFERENCES inventory_match_decisions(id),
  ADD COLUMN property_reference TEXT,
  ADD COLUMN sequence_no INTEGER CHECK (sequence_no IS NULL OR sequence_no BETWEEN 1 AND 6),
  ADD COLUMN shortlist_property_evidence_hash CHAR(64),
  ADD COLUMN eligibility_checked_at TIMESTAMPTZ,
  ADD COLUMN eligibility_evidence_hash CHAR(64);
ALTER TABLE opportunity_property_share_items ADD CONSTRAINT opportunity_property_share_items_governed_shape_ck CHECK (
  (matching_candidate_id IS NULL AND match_decision_id IS NULL AND sequence_no IS NULL
    AND shortlist_property_evidence_hash IS NULL AND eligibility_checked_at IS NULL
    AND eligibility_evidence_hash IS NULL)
  OR
  (matching_candidate_id IS NOT NULL AND match_decision_id IS NOT NULL
    AND listing_id IS NOT NULL AND external_property_id IS NULL
    AND NULLIF(BTRIM(property_reference),'') IS NOT NULL AND sequence_no BETWEEN 1 AND 6
    AND shortlist_property_evidence_hash ~ '^[a-f0-9]{64}$'
    AND eligibility_checked_at IS NOT NULL AND eligibility_evidence_hash ~ '^[a-f0-9]{64}$')
);
CREATE UNIQUE INDEX opportunity_property_share_items_governed_sequence_uq
  ON opportunity_property_share_items(share_id,sequence_no) WHERE sequence_no IS NOT NULL;
CREATE UNIQUE INDEX opportunity_property_share_items_governed_candidate_uq
  ON opportunity_property_share_items(share_id,matching_candidate_id) WHERE matching_candidate_id IS NOT NULL;

CREATE FUNCTION prevent_governed_property_share_item_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.matching_candidate_id IS NOT NULL OR NEW.matching_candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'Governed property-share items are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER opportunity_property_share_items_governed_immutable
  BEFORE UPDATE OR DELETE ON opportunity_property_share_items FOR EACH ROW
  EXECUTE FUNCTION prevent_governed_property_share_item_mutation();

-- Exact local events only. Release 3C writes prepared/cancelled; connected/provider events are not
-- represented until Release 3D supplies their independently reviewed evidence contract.
CREATE TABLE opportunity_property_share_events (
  id UUID PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES opportunity_property_shares(id),
  share_item_id UUID REFERENCES opportunity_property_share_items(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('prepared','cancelled')),
  source TEXT NOT NULL CHECK (source='crm_local'),
  occurred_at TIMESTAMPTZ NOT NULL,
  actor_id UUID NOT NULL REFERENCES brokers(id),
  evidence_hash CHAR(64) NOT NULL UNIQUE CHECK (evidence_hash ~ '^[a-f0-9]{64}$'),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(evidence)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX opportunity_property_share_events_share_idx
  ON opportunity_property_share_events(share_id,occurred_at,id);
CREATE TRIGGER opportunity_property_share_events_immutable BEFORE UPDATE OR DELETE ON opportunity_property_share_events
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

-- Reuse the existing immutable matching-feedback ledger for property-level customer responses.
ALTER TABLE inventory_match_feedback
  ADD COLUMN share_item_id UUID REFERENCES opportunity_property_share_items(id),
  ADD COLUMN response_policy_version TEXT,
  ADD COLUMN response_source TEXT CHECK (response_source IN ('manual_fallback')),
  ADD COLUMN response_evidence_hash CHAR(64),
  ADD COLUMN not_suitable_reason_code TEXT CHECK (not_suitable_reason_code IN (
    'price_or_budget','location_or_community','layout_or_size','condition_or_timing',
    'payment_terms','amenities_or_features','other_governed_reason'
  )),
  ADD COLUMN preference_impact TEXT CHECK (preference_impact IN ('property_only','review_required','confirmed_change')),
  ADD COLUMN preference_change_detail TEXT;
ALTER TABLE inventory_match_feedback ADD CONSTRAINT inventory_match_feedback_governed_response_shape_ck CHECK (
  (share_item_id IS NULL AND response_policy_version IS NULL AND response_source IS NULL
    AND response_evidence_hash IS NULL AND not_suitable_reason_code IS NULL
    AND preference_impact IS NULL AND preference_change_detail IS NULL)
  OR
  (share_item_id IS NOT NULL AND response_policy_version='r3c-customer-shortlist-v1'
    AND response_source='manual_fallback' AND response_evidence_hash ~ '^[a-f0-9]{64}$'
    AND feedback_source='customer_reported'
    AND ((outcome<>'not_suitable' AND not_suitable_reason_code IS NULL
      AND preference_impact IS NULL AND preference_change_detail IS NULL)
      OR (outcome='not_suitable' AND not_suitable_reason_code IS NOT NULL
        AND preference_impact IS NOT NULL
        AND ((preference_impact='property_only' AND preference_change_detail IS NULL)
          OR (preference_impact IN ('review_required','confirmed_change')
            AND NULLIF(BTRIM(preference_change_detail),'') IS NOT NULL)))))
);
CREATE UNIQUE INDEX inventory_match_feedback_response_evidence_uq
  ON inventory_match_feedback(response_evidence_hash) WHERE response_evidence_hash IS NOT NULL;
CREATE INDEX inventory_match_feedback_share_item_idx
  ON inventory_match_feedback(share_item_id,occurred_at DESC) WHERE share_item_id IS NOT NULL;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN ('general','proposal_correction','customer_response_follow_up'));

CREATE TABLE customer_response_task_provenance (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id),
  match_feedback_id UUID NOT NULL UNIQUE REFERENCES inventory_match_feedback(id),
  share_id UUID NOT NULL REFERENCES opportunity_property_shares(id),
  share_item_id UUID NOT NULL REFERENCES opportunity_property_share_items(id),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id),
  property_match_id UUID NOT NULL REFERENCES property_matches(id),
  translation_policy_version TEXT NOT NULL CHECK (translation_policy_version='r3c-next-action-v1'),
  response_evidence_hash CHAR(64) NOT NULL UNIQUE CHECK (response_evidence_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX customer_response_task_provenance_opportunity_idx
  ON customer_response_task_provenance(opportunity_id,created_at DESC);
CREATE TRIGGER customer_response_task_provenance_immutable BEFORE UPDATE OR DELETE ON customer_response_task_provenance
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
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus',
  'Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication',
  'TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement',
  'MarketingCampaign','CampaignMapping','PartnerOrganization','InventoryOrganizationLink',
  'CommunicationPolicyDecision','OpportunityPropertyShareEvent','CustomerResponseTaskProvenance'
));

GRANT SELECT,INSERT ON communication_policy_decisions TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON opportunity_property_shares TO nysareal_nysar2app;
GRANT SELECT,INSERT ON opportunity_property_share_items TO nysareal_nysar2app;
GRANT SELECT,INSERT ON opportunity_property_share_events TO nysareal_nysar2app;
GRANT SELECT,INSERT ON inventory_match_feedback TO nysareal_nysar2app;
GRANT SELECT,INSERT ON customer_response_task_provenance TO nysareal_nysar2app;
