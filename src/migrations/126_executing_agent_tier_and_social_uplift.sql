-- DEV-196: the executing Agent owns the achieved tier. Gross receipt is counted
-- once for that executing Agent; the resulting Agent pool is then split.
ALTER TABLE agent_payout_calculations
  DROP CONSTRAINT IF EXISTS agent_payout_calculations_calculation_basis_version_check;

ALTER TABLE agent_payout_calculations
  ADD CONSTRAINT agent_payout_calculation_basis_version_ck CHECK(
    calculation_basis_version IN ('legacy_split_then_tier','gross_tier_then_split_v1','executing_agent_received_gross_v1')
  ),
  ADD COLUMN tier_agent_id UUID REFERENCES brokers(id),
  ADD COLUMN social_media_uplift_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT agent_payout_executing_tier_basis_ck CHECK(
    calculation_basis_version<>'executing_agent_received_gross_v1'
    OR tier_agent_id IS NOT NULL
  ),
  ADD CONSTRAINT agent_payout_social_uplift_basis_ck CHECK(
    social_media_bonus_percent=0 OR social_media_uplift_eligible
  );

CREATE INDEX agent_payout_tier_agent_quarter_idx
  ON agent_payout_calculations(tier_agent_id,quarter_key,currency)
  WHERE calculation_basis_version='executing_agent_received_gross_v1' AND status<>'reversed';
