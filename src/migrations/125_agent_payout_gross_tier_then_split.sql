-- DEV-195: make the governed calculation order explicit:
-- company gross commission -> achieved payout tier -> originating/servicing split.
-- Existing rows retain their legacy basis marker and are never rewritten.
ALTER TABLE agent_payout_calculations
  ADD COLUMN calculation_basis_version TEXT NOT NULL DEFAULT 'legacy_split_then_tier'
    CHECK(calculation_basis_version IN ('legacy_split_then_tier','gross_tier_then_split_v1')),
  ADD COLUMN current_gross_commission_amount NUMERIC(18,2),
  ADD COLUMN prior_gross_commission_amount NUMERIC(18,2),
  ADD COLUMN resulting_gross_commission_amount NUMERIC(18,2),
  ADD COLUMN agent_share_percent NUMERIC(7,4),
  ADD CONSTRAINT agent_payout_gross_tier_split_basis_ck CHECK(
    calculation_basis_version='legacy_split_then_tier'
    OR (current_gross_commission_amount>0 AND prior_gross_commission_amount>=0
      AND resulting_gross_commission_amount=prior_gross_commission_amount+current_gross_commission_amount
      AND agent_share_percent>0 AND agent_share_percent<=100
      AND current_credited_amount=ROUND(current_gross_commission_amount*agent_share_percent/100,2))
  );
