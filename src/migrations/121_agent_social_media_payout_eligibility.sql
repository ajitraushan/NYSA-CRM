-- DEV-190: effective-dated Agent social-media payout eligibility.
-- Eligibility is maintained by a full Administrator and resolved on the
-- commission receipt date. Absence of a row means not eligible.

CREATE TABLE agent_social_media_payout_status_versions (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES brokers(id),
  status TEXT NOT NULL CHECK(status IN ('active','inactive')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  reason TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(reason))>=10),
  evidence_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(evidence_reference))>=3),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE INDEX agent_social_media_payout_status_effective_idx
  ON agent_social_media_payout_status_versions(agent_id,effective_from,effective_to);

CREATE FUNCTION prevent_agent_social_media_status_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM agent_social_media_payout_status_versions existing
    WHERE existing.agent_id=NEW.agent_id AND existing.id<>NEW.id
      AND existing.effective_from<COALESCE(NEW.effective_to,'infinity'::date)
      AND NEW.effective_from<COALESCE(existing.effective_to,'infinity'::date)
  ) THEN RAISE EXCEPTION 'An Agent social-media status already covers this effective period'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agent_social_media_status_no_overlap
  BEFORE INSERT OR UPDATE OF agent_id,effective_from,effective_to
  ON agent_social_media_payout_status_versions FOR EACH ROW
  EXECUTE FUNCTION prevent_agent_social_media_status_overlap();

ALTER TABLE agent_payout_calculations
  ADD COLUMN social_media_status_version_id UUID REFERENCES agent_social_media_payout_status_versions(id),
  ADD COLUMN social_media_bonus_percent NUMERIC(7,4) NOT NULL DEFAULT 0
    CHECK(social_media_bonus_percent IN (0,5));

-- Policy maintenance now presents the two approved business methods. Historical
-- progressive policies remain readable, while new quarterly-achieved policies
-- settle any increased entitlement as an auditable true-up on the crossing Deal.
ALTER TABLE commission_payout_policy_versions DROP CONSTRAINT commission_payout_policy_versions_trigger_method_check;
ALTER TABLE commission_payout_policy_versions ADD CONSTRAINT commission_payout_policy_versions_trigger_method_check
  CHECK(trigger_method IN ('attained_trigger','progressive_trigger','quarter_achieved_rate'));
ALTER TABLE agent_payout_adjustment_versions DROP CONSTRAINT agent_payout_adjustment_versions_trigger_method_check;
ALTER TABLE agent_payout_adjustment_versions ADD CONSTRAINT agent_payout_adjustment_versions_trigger_method_check
  CHECK(trigger_method IN ('attained_trigger','progressive_trigger','quarter_achieved_rate'));
ALTER TABLE agent_payout_calculations DROP CONSTRAINT agent_payout_calculations_trigger_method_check;
ALTER TABLE agent_payout_calculations ADD CONSTRAINT agent_payout_calculations_trigger_method_check
  CHECK(trigger_method IN ('attained_trigger','progressive_trigger','quarter_achieved_rate'));
ALTER TABLE agent_payout_calculations DROP CONSTRAINT agent_payout_calculations_company_retained_amount_check;
ALTER TABLE agent_payout_calculation_bands DROP CONSTRAINT agent_payout_calculation_bands_company_retained_amount_check;

DO $$ DECLARE prior_expression TEXT; BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression FROM pg_constraint
    WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression || ') OR entity_type = ''AgentSocialMediaPayoutStatus'')';
END $$;

GRANT SELECT,INSERT,UPDATE ON agent_social_media_payout_status_versions TO nysareal_nysar2app;
