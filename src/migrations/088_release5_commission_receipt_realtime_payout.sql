-- Release 5 local implementation: governed commission receipt and real-time agent payout.
-- This additive migration is intentionally unapplied during Gate 3 local review.

CREATE TABLE commission_payout_policy_versions (
  id UUID PRIMARY KEY,
  policy_code TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK(version_number>0),
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  effective_from DATE NOT NULL,
  effective_to DATE,
  trigger_method TEXT NOT NULL CHECK(trigger_method IN ('attained_trigger','progressive_trigger')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','superseded','retired')),
  reason TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(reason))>=10),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id),
  activated_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id),
  retired_at TIMESTAMPTZ,
  retirement_reason TEXT,
  UNIQUE(policy_code,version_number),
  CHECK(effective_to IS NULL OR effective_to>effective_from),
  CHECK(status='draft' OR (activated_by IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND CHAR_LENGTH(BTRIM(retirement_reason))>=10))
);
CREATE INDEX commission_payout_policy_effective_idx
  ON commission_payout_policy_versions(currency,effective_from,effective_to,status);

CREATE TABLE commission_payout_policy_slabs (
  id UUID PRIMARY KEY,
  policy_version_id UUID NOT NULL REFERENCES commission_payout_policy_versions(id),
  display_order INTEGER NOT NULL CHECK(display_order>0),
  lower_amount NUMERIC(18,2) NOT NULL CHECK(lower_amount>=0),
  upper_amount NUMERIC(18,2),
  agent_percent NUMERIC(7,4) NOT NULL CHECK(agent_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(policy_version_id,display_order),
  UNIQUE(policy_version_id,lower_amount),
  CHECK(upper_amount IS NULL OR upper_amount>lower_amount)
);

CREATE TABLE agent_payout_adjustment_versions (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES brokers(id),
  base_policy_version_id UUID NOT NULL REFERENCES commission_payout_policy_versions(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  effective_from DATE NOT NULL,
  effective_to DATE,
  trigger_method TEXT NOT NULL CHECK(trigger_method IN ('attained_trigger','progressive_trigger')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','superseded','retired')),
  reason TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(reason))>=10),
  evidence_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(evidence_reference))>=3),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id),
  activated_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id),
  retired_at TIMESTAMPTZ,
  retirement_reason TEXT,
  UNIQUE(agent_id,currency,version_number),
  CHECK(effective_to IS NULL OR effective_to>effective_from),
  CHECK(status='draft' OR (activated_by IS NOT NULL AND activated_at IS NOT NULL)),
  CHECK(status<>'retired' OR (retired_by IS NOT NULL AND retired_at IS NOT NULL AND CHAR_LENGTH(BTRIM(retirement_reason))>=10))
);
CREATE INDEX agent_payout_adjustment_effective_idx
  ON agent_payout_adjustment_versions(agent_id,currency,effective_from,effective_to,status);

CREATE TABLE agent_payout_adjustment_slabs (
  id UUID PRIMARY KEY,
  adjustment_version_id UUID NOT NULL REFERENCES agent_payout_adjustment_versions(id),
  display_order INTEGER NOT NULL CHECK(display_order>0),
  lower_amount NUMERIC(18,2) NOT NULL CHECK(lower_amount>=0),
  upper_amount NUMERIC(18,2),
  agent_percent NUMERIC(7,4) NOT NULL CHECK(agent_percent BETWEEN 0 AND 100),
  company_lower_amount NUMERIC(18,2),
  company_upper_amount NUMERIC(18,2),
  company_agent_percent NUMERIC(7,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(adjustment_version_id,display_order),
  UNIQUE(adjustment_version_id,lower_amount),
  CHECK(upper_amount IS NULL OR upper_amount>lower_amount)
);

CREATE TABLE deal_commission_expectation_versions (
  id UUID PRIMARY KEY,
  expectation_reference TEXT NOT NULL UNIQUE,
  deal_id UUID NOT NULL REFERENCES deals(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  deal_version INTEGER NOT NULL CHECK(deal_version>0),
  opportunity_version INTEGER NOT NULL CHECK(opportunity_version>0),
  deal_type TEXT NOT NULL,
  agreed_value NUMERIC(18,2) NOT NULL CHECK(agreed_value>0),
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  expected_gross_amount NUMERIC(18,2) NOT NULL CHECK(expected_gross_amount>=0),
  partner_organization_version_id UUID REFERENCES partner_organization_versions(id),
  referral_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(referral_amount>=0),
  referral_settlement_basis TEXT NOT NULL DEFAULT 'none'
    CHECK(referral_settlement_basis IN ('none','deducted_before_company_receipt','payable_from_company_receipt')),
  expected_company_receipt NUMERIC(18,2) NOT NULL CHECK(expected_company_receipt>=0),
  source_context_fingerprint CHAR(64) NOT NULL CHECK(source_context_fingerprint ~ '^[a-f0-9]{64}$'),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','frozen','superseded')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frozen_by UUID REFERENCES brokers(id),
  frozen_at TIMESTAMPTZ,
  UNIQUE(deal_id,version_number),
  UNIQUE(deal_id,source_context_fingerprint),
  CHECK((referral_amount=0 AND referral_settlement_basis='none' AND partner_organization_version_id IS NULL)
    OR (referral_amount>0 AND referral_settlement_basis<>'none' AND partner_organization_version_id IS NOT NULL)),
  CHECK(expected_company_receipt=CASE WHEN referral_settlement_basis='deducted_before_company_receipt'
    THEN expected_gross_amount-referral_amount ELSE expected_gross_amount END),
  CHECK(status='draft' OR (frozen_by IS NOT NULL AND frozen_at IS NOT NULL))
);
CREATE UNIQUE INDEX deal_commission_one_frozen_uq
  ON deal_commission_expectation_versions(deal_id) WHERE status='frozen';

CREATE TABLE deal_commission_expectation_components (
  id UUID PRIMARY KEY,
  expectation_version_id UUID NOT NULL REFERENCES deal_commission_expectation_versions(id),
  represented_side TEXT NOT NULL CHECK(represented_side IN ('buyer','seller')),
  commission_percent NUMERIC(7,4) NOT NULL CHECK(commission_percent BETWEEN 0 AND 100),
  commission_minimum NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(commission_minimum>=0),
  percentage_result NUMERIC(18,2) NOT NULL CHECK(percentage_result>=0),
  expected_amount NUMERIC(18,2) NOT NULL CHECK(expected_amount>=0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(expectation_version_id,represented_side),
  CHECK(expected_amount>=commission_minimum)
);

CREATE TABLE deal_commission_receipts (
  id UUID PRIMARY KEY,
  receipt_reference TEXT NOT NULL UNIQUE,
  deal_id UUID NOT NULL REFERENCES deals(id),
  entry_type TEXT NOT NULL CHECK(entry_type IN ('receipt','reversal')),
  reverses_receipt_id UUID REFERENCES deal_commission_receipts(id),
  amount NUMERIC(18,2) NOT NULL CHECK(amount>0),
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  received_date DATE NOT NULL,
  receipt_method TEXT NOT NULL CHECK(receipt_method IN ('bank_transfer','cheque','card','other_confirmed')),
  finance_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(finance_reference))>=3),
  normalized_finance_reference TEXT NOT NULL,
  evidence_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(evidence_reference))>=3),
  evidence_fingerprint CHAR(64) NOT NULL CHECK(evidence_fingerprint ~ '^[a-f0-9]{64}$'),
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT,
  recorded_by UUID NOT NULL REFERENCES brokers(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(currency,normalized_finance_reference,entry_type),
  UNIQUE(deal_id,evidence_fingerprint),
  CHECK((entry_type='receipt' AND reverses_receipt_id IS NULL) OR
        (entry_type='reversal' AND reverses_receipt_id IS NOT NULL AND CHAR_LENGTH(BTRIM(reason))>=10))
);
CREATE INDEX deal_commission_receipts_deal_idx ON deal_commission_receipts(deal_id,received_date,recorded_at);

CREATE TABLE deal_commission_receipt_confirmations (
  id UUID PRIMARY KEY,
  confirmation_reference TEXT NOT NULL UNIQUE,
  deal_id UUID NOT NULL REFERENCES deals(id),
  expectation_version_id UUID NOT NULL REFERENCES deal_commission_expectation_versions(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  deal_version INTEGER NOT NULL CHECK(deal_version>0),
  receipt_date DATE NOT NULL,
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  expected_company_receipt NUMERIC(18,2) NOT NULL CHECK(expected_company_receipt>=0),
  confirmed_actual_received NUMERIC(18,2) NOT NULL CHECK(confirmed_actual_received>0),
  variance_amount NUMERIC(18,2) NOT NULL,
  aggregate_fingerprint CHAR(64) NOT NULL CHECK(aggregate_fingerprint ~ '^[a-f0-9]{64}$'),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('confirmed','reversed','superseded')),
  reason TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(reason))>=10),
  evidence_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(evidence_reference))>=3),
  confirmed_by UUID NOT NULL REFERENCES brokers(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id,version_number),
  CHECK(variance_amount=confirmed_actual_received-expected_company_receipt)
);
CREATE UNIQUE INDEX deal_commission_one_current_confirmation_uq
  ON deal_commission_receipt_confirmations(deal_id) WHERE status='confirmed';

CREATE TABLE deal_commission_variance_decisions (
  id UUID PRIMARY KEY,
  confirmation_id UUID NOT NULL UNIQUE REFERENCES deal_commission_receipt_confirmations(id),
  decision TEXT NOT NULL CHECK(decision IN ('approved','returned')),
  reason TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(reason))>=10),
  evidence_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(evidence_reference))>=3),
  request_fingerprint CHAR(64) NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
  decided_by UUID NOT NULL REFERENCES brokers(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE deal_agent_credit_versions (
  id UUID PRIMARY KEY,
  credit_reference TEXT NOT NULL UNIQUE,
  deal_id UUID NOT NULL REFERENCES deals(id),
  receipt_confirmation_id UUID NOT NULL REFERENCES deal_commission_receipt_confirmations(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  source_opportunity_version INTEGER NOT NULL CHECK(source_opportunity_version>0),
  source_originating_split_percent NUMERIC(7,4) NOT NULL CHECK(source_originating_split_percent BETWEEN 0 AND 100),
  source_servicing_split_percent NUMERIC(7,4) NOT NULL CHECK(source_servicing_split_percent BETWEEN 0 AND 100),
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  confirmed_actual_received NUMERIC(18,2) NOT NULL CHECK(confirmed_actual_received>0),
  external_referral_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(external_referral_amount>=0),
  referral_settlement_basis TEXT NOT NULL DEFAULT 'none'
    CHECK(referral_settlement_basis IN ('none','deducted_before_company_receipt','payable_from_company_receipt')),
  internal_credited_amount NUMERIC(18,2) NOT NULL CHECK(internal_credited_amount>0),
  is_exception BOOLEAN NOT NULL DEFAULT FALSE,
  exception_reason TEXT,
  evidence_reference TEXT,
  source_context_fingerprint CHAR(64) NOT NULL CHECK(source_context_fingerprint ~ '^[a-f0-9]{64}$'),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','frozen','superseded')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  frozen_by UUID REFERENCES brokers(id),
  frozen_at TIMESTAMPTZ,
  UNIQUE(deal_id,version_number),
  CHECK(source_originating_split_percent+source_servicing_split_percent=100),
  CHECK(internal_credited_amount=confirmed_actual_received-
    CASE WHEN referral_settlement_basis='payable_from_company_receipt' THEN external_referral_amount ELSE 0 END),
  CHECK(NOT is_exception OR (CHAR_LENGTH(BTRIM(exception_reason))>=10 AND evidence_reference IS NOT NULL)),
  CHECK(status='draft' OR (frozen_by IS NOT NULL AND frozen_at IS NOT NULL))
);
CREATE UNIQUE INDEX deal_agent_credit_one_frozen_uq
  ON deal_agent_credit_versions(deal_id) WHERE status='frozen';

CREATE TABLE deal_agent_credit_lines (
  id UUID PRIMARY KEY,
  credit_version_id UUID NOT NULL REFERENCES deal_agent_credit_versions(id),
  agent_id UUID NOT NULL REFERENCES brokers(id),
  originating_percent NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK(originating_percent BETWEEN 0 AND 100),
  servicing_percent NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK(servicing_percent BETWEEN 0 AND 100),
  total_credit_percent NUMERIC(7,4) NOT NULL CHECK(total_credit_percent>0 AND total_credit_percent<=100),
  credited_amount NUMERIC(18,2) NOT NULL CHECK(credited_amount>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(credit_version_id,agent_id),
  CHECK(total_credit_percent=originating_percent+servicing_percent)
);

CREATE TABLE agent_payout_calculations (
  id UUID PRIMARY KEY,
  payout_reference TEXT NOT NULL UNIQUE,
  credit_line_id UUID NOT NULL REFERENCES deal_agent_credit_lines(id),
  agent_id UUID NOT NULL REFERENCES brokers(id),
  deal_id UUID NOT NULL REFERENCES deals(id),
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  receipt_date DATE NOT NULL,
  quarter_key CHAR(7) NOT NULL CHECK(quarter_key ~ '^[0-9]{4}-Q[1-4]$'),
  prior_cumulative_amount NUMERIC(18,2) NOT NULL CHECK(prior_cumulative_amount>=0),
  current_credited_amount NUMERIC(18,2) NOT NULL CHECK(current_credited_amount>0),
  resulting_cumulative_amount NUMERIC(18,2) NOT NULL CHECK(resulting_cumulative_amount>0),
  trigger_method TEXT NOT NULL CHECK(trigger_method IN ('attained_trigger','progressive_trigger')),
  policy_version_id UUID NOT NULL REFERENCES commission_payout_policy_versions(id),
  adjustment_version_id UUID REFERENCES agent_payout_adjustment_versions(id),
  resolved_plan_fingerprint CHAR(64) NOT NULL CHECK(resolved_plan_fingerprint ~ '^[a-f0-9]{64}$'),
  cumulative_context_fingerprint CHAR(64) NOT NULL CHECK(cumulative_context_fingerprint ~ '^[a-f0-9]{64}$'),
  agent_payout_amount NUMERIC(18,2) NOT NULL CHECK(agent_payout_amount>=0),
  company_retained_amount NUMERIC(18,2) NOT NULL CHECK(company_retained_amount>=0),
  release_due_date DATE NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'calculated' CHECK(status IN ('calculated','approved','released','reversed','adjusted')),
  calculated_by UUID NOT NULL REFERENCES brokers(id),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(credit_line_id),
  CHECK(resulting_cumulative_amount=prior_cumulative_amount+current_credited_amount),
  CHECK(current_credited_amount=agent_payout_amount+company_retained_amount)
);
CREATE INDEX agent_payout_cumulative_idx
  ON agent_payout_calculations(agent_id,quarter_key,currency,receipt_date,payout_reference)
  WHERE status NOT IN ('reversed');
CREATE INDEX agent_payout_due_idx ON agent_payout_calculations(status,release_due_date);

CREATE TABLE agent_payout_calculation_bands (
  id UUID PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES agent_payout_calculations(id),
  display_order INTEGER NOT NULL CHECK(display_order>0),
  slab_lower_amount NUMERIC(18,2) NOT NULL CHECK(slab_lower_amount>=0),
  slab_upper_amount NUMERIC(18,2),
  portion_amount NUMERIC(18,2) NOT NULL CHECK(portion_amount>0),
  agent_percent NUMERIC(7,4) NOT NULL CHECK(agent_percent BETWEEN 0 AND 100),
  agent_payout_amount NUMERIC(18,2) NOT NULL CHECK(agent_payout_amount>=0),
  company_retained_amount NUMERIC(18,2) NOT NULL CHECK(company_retained_amount>=0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(calculation_id,display_order),
  CHECK(slab_upper_amount IS NULL OR slab_upper_amount>slab_lower_amount),
  CHECK(portion_amount=agent_payout_amount+company_retained_amount)
);

CREATE TABLE agent_payout_decision_events (
  id UUID PRIMARY KEY,
  calculation_id UUID NOT NULL REFERENCES agent_payout_calculations(id),
  decision TEXT NOT NULL CHECK(decision IN ('approved','returned')),
  reason TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(reason))>=10),
  evidence_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(evidence_reference))>=3),
  request_fingerprint CHAR(64) NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
  decided_by UUID NOT NULL REFERENCES brokers(id),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(calculation_id,request_fingerprint)
);
CREATE UNIQUE INDEX agent_payout_one_approval_uq
  ON agent_payout_decision_events(calculation_id) WHERE decision='approved';

CREATE TABLE agent_payout_release_events (
  id UUID PRIMARY KEY,
  release_reference TEXT NOT NULL UNIQUE,
  calculation_id UUID NOT NULL REFERENCES agent_payout_calculations(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('release','release_reversal')),
  reverses_release_id UUID REFERENCES agent_payout_release_events(id),
  released_amount NUMERIC(18,2) NOT NULL CHECK(released_amount>0),
  released_at TIMESTAMPTZ NOT NULL,
  evidence_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(evidence_reference))>=3),
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT,
  recorded_by UUID NOT NULL REFERENCES brokers(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((event_type='release' AND reverses_release_id IS NULL) OR
        (event_type='release_reversal' AND reverses_release_id IS NOT NULL AND CHAR_LENGTH(BTRIM(reason))>=10))
);
CREATE UNIQUE INDEX agent_payout_one_release_uq
  ON agent_payout_release_events(calculation_id) WHERE event_type='release';

CREATE FUNCTION validate_commission_slab_set() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE slab_count INTEGER; invalid_count INTEGER;
BEGIN
  IF NEW.status<>'active' OR OLD.status='active' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='commission_payout_policy_versions' THEN
    SELECT COUNT(*) INTO slab_count FROM commission_payout_policy_slabs WHERE policy_version_id=NEW.id;
    SELECT COUNT(*) INTO invalid_count FROM (
      SELECT lower_amount,upper_amount,display_order,
        LAG(upper_amount) OVER(ORDER BY display_order) AS prior_upper
      FROM commission_payout_policy_slabs WHERE policy_version_id=NEW.id
    ) s WHERE (display_order=1 AND lower_amount<>0)
      OR (display_order>1 AND lower_amount IS DISTINCT FROM prior_upper)
      OR (upper_amount IS NULL AND display_order<>(SELECT MAX(display_order) FROM commission_payout_policy_slabs WHERE policy_version_id=NEW.id));
  ELSE
    SELECT COUNT(*) INTO slab_count FROM agent_payout_adjustment_slabs WHERE adjustment_version_id=NEW.id;
    SELECT COUNT(*) INTO invalid_count FROM (
      SELECT lower_amount,upper_amount,display_order,
        LAG(upper_amount) OVER(ORDER BY display_order) AS prior_upper
      FROM agent_payout_adjustment_slabs WHERE adjustment_version_id=NEW.id
    ) s WHERE (display_order=1 AND lower_amount<>0)
      OR (display_order>1 AND lower_amount IS DISTINCT FROM prior_upper)
      OR (upper_amount IS NULL AND display_order<>(SELECT MAX(display_order) FROM agent_payout_adjustment_slabs WHERE adjustment_version_id=NEW.id));
  END IF;
  IF slab_count=0 OR invalid_count>0 THEN RAISE EXCEPTION 'Active payout structures require a complete contiguous slab set beginning at zero'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_policy_validate_slabs BEFORE UPDATE OF status ON commission_payout_policy_versions
  FOR EACH ROW EXECUTE FUNCTION validate_commission_slab_set();
CREATE TRIGGER agent_adjustment_validate_slabs BEFORE UPDATE OF status ON agent_payout_adjustment_versions
  FOR EACH ROW EXECUTE FUNCTION validate_commission_slab_set();

CREATE FUNCTION prevent_active_payout_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE conflict_id UUID;
BEGIN
  IF NEW.status<>'active' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME='commission_payout_policy_versions' THEN
    SELECT id INTO conflict_id FROM commission_payout_policy_versions
      WHERE id<>NEW.id AND currency=NEW.currency AND status='active'
        AND effective_from<COALESCE(NEW.effective_to,'infinity'::date)
        AND NEW.effective_from<COALESCE(effective_to,'infinity'::date) LIMIT 1;
  ELSE
    SELECT id INTO conflict_id FROM agent_payout_adjustment_versions
      WHERE id<>NEW.id AND agent_id=NEW.agent_id AND currency=NEW.currency AND status='active'
        AND effective_from<COALESCE(NEW.effective_to,'infinity'::date)
        AND NEW.effective_from<COALESCE(effective_to,'infinity'::date) LIMIT 1;
  END IF;
  IF conflict_id IS NOT NULL THEN RAISE EXCEPTION 'An active payout version already covers this effective period'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER commission_policy_no_overlap BEFORE INSERT OR UPDATE OF status,effective_from,effective_to
  ON commission_payout_policy_versions FOR EACH ROW EXECUTE FUNCTION prevent_active_payout_overlap();
CREATE TRIGGER agent_adjustment_no_overlap BEFORE INSERT OR UPDATE OF status,effective_from,effective_to
  ON agent_payout_adjustment_versions FOR EACH ROW EXECUTE FUNCTION prevent_active_payout_overlap();

CREATE FUNCTION protect_payout_configuration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status TEXT;
BEGIN
  IF TG_TABLE_NAME='commission_payout_policy_slabs' THEN
    SELECT status INTO parent_status FROM commission_payout_policy_versions WHERE id=COALESCE(OLD.policy_version_id,NEW.policy_version_id);
  ELSE
    SELECT status INTO parent_status FROM agent_payout_adjustment_versions WHERE id=COALESCE(OLD.adjustment_version_id,NEW.adjustment_version_id);
  END IF;
  IF parent_status<>'draft' THEN RAISE EXCEPTION 'Activated payout configuration is immutable'; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER commission_policy_slabs_draft_only BEFORE UPDATE OR DELETE ON commission_payout_policy_slabs
  FOR EACH ROW EXECUTE FUNCTION protect_payout_configuration();
CREATE TRIGGER agent_adjustment_slabs_draft_only BEFORE UPDATE OR DELETE ON agent_payout_adjustment_slabs
  FOR EACH ROW EXECUTE FUNCTION protect_payout_configuration();

CREATE FUNCTION reject_immutable_finance_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Commission and payout evidence is immutable; use a governed reversal or adjustment'; END $$;
CREATE TRIGGER commission_expectation_components_immutable BEFORE UPDATE OR DELETE ON deal_commission_expectation_components FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER commission_receipts_immutable BEFORE UPDATE OR DELETE ON deal_commission_receipts FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER commission_confirmations_immutable BEFORE UPDATE OR DELETE ON deal_commission_receipt_confirmations FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER commission_variance_decisions_immutable BEFORE UPDATE OR DELETE ON deal_commission_variance_decisions FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER deal_agent_credit_lines_immutable BEFORE UPDATE OR DELETE ON deal_agent_credit_lines FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER payout_bands_immutable BEFORE UPDATE OR DELETE ON agent_payout_calculation_bands FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER payout_decisions_immutable BEFORE UPDATE OR DELETE ON agent_payout_decision_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();
CREATE TRIGGER payout_releases_immutable BEFORE UPDATE OR DELETE ON agent_payout_release_events FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_mutation();

CREATE FUNCTION enforce_commission_receipt_before_close_won() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ready_confirmation UUID;
BEGIN
  IF NEW.status='closed_won' AND OLD.status IS DISTINCT FROM 'closed_won' THEN
    SELECT c.id INTO ready_confirmation
    FROM deal_commission_receipt_confirmations c
    JOIN deal_commission_expectation_versions e ON e.id=c.expectation_version_id
    WHERE c.deal_id=NEW.id AND c.status='confirmed' AND c.deal_version=OLD.version AND e.status='frozen'
      AND (c.variance_amount=0 OR EXISTS(
        SELECT 1 FROM deal_commission_variance_decisions v WHERE v.confirmation_id=c.id AND v.decision='approved'))
    LIMIT 1;
    IF ready_confirmation IS NULL THEN
      RAISE EXCEPTION 'Confirmed actual commission receipt is required before Close Won';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER deals_commission_receipt_close_gate BEFORE UPDATE OF status ON deals
  FOR EACH ROW EXECUTE FUNCTION enforce_commission_receipt_before_close_won();

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK(entity_type IN (
  'Listing','ListingApprovalPolicy','ListingIntake','ListingMappingVersion','ListingValueMapping','Comment','Broker','Invitation','Team','TeamMembership','Contact','ContactChannel','ContactMerge',
  'Company','CompanyRole','MarketingAgreement','Lead','Activity','ActivityCorrection','ValueBrief','OrganizationSettings','ValueSet','ValueDefinition','WorkflowTransition','Document','DocumentVersion','LeadAssignment',
  'LeadRequirement','LeadStage','Task','LeadConversion','SlaPolicy','RoutingRule','Area','WebsiteIntake','ConsentEvidence','QualificationModel','QualificationAssessment','RegulatoryAssumption','FinancialScenario','PropertyMedia',
  'PropertyMediaApprovalPolicy','Proposal','ProposalVersion','DashboardTarget','DashboardExport','SavedDashboardView','AiAssistanceRun','Opportunity','OpportunityStage','OpportunityAttribution','OpportunityParticipant','OpportunityAssignment','R2LegacyLeadReview',
  'PropertyMatch','Viewing','CalendarConnection','ViewingCalendarEvent','Offer','OfferRevision','NegotiationEvent','Booking','BookingStatus','Deal','DealParty','DealChecklist','DealChecklistItem','DealStatus','InventoryVerification','ExternalListingPublication',
  'TransactionCounterparty','ExternalProperty','OpportunityPropertyShare','InventoryCounterparty','InventoryAgreement','MarketingCampaign','CampaignMapping','PartnerOrganization','InventoryOrganizationLink','CommunicationPolicyDecision','OpportunityPropertyShareEvent','CustomerResponseTaskProvenance',
  'OfficialDocumentDefinition','OfficialDocumentStepRule','OfficialDocumentEvidence','OfficialDocumentFollowup','MarketCommunity','DldCommunityMapping','DldMarketSourceBatch','DldMarketObservation','InventoryMarketIntelligenceSnapshot',
  'CommissionPayoutPolicy','AgentPayoutAdjustment','DealCommissionExpectation','DealCommissionReceipt','DealCommissionReceiptConfirmation','DealCommissionVarianceDecision','DealAgentCredit','AgentPayoutCalculation','AgentPayoutRelease'
));

GRANT SELECT,INSERT,UPDATE ON commission_payout_policy_versions,commission_payout_policy_slabs,
  agent_payout_adjustment_versions,agent_payout_adjustment_slabs,deal_commission_expectation_versions,
  deal_commission_expectation_components,deal_commission_receipts,deal_commission_receipt_confirmations,
  deal_commission_variance_decisions,deal_agent_credit_versions,deal_agent_credit_lines,
  agent_payout_calculations,agent_payout_calculation_bands,agent_payout_decision_events,
  agent_payout_release_events TO nysareal_nysar2app;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO nysareal_nysar2app;
