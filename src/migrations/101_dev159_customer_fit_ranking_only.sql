-- Customer fit affects explainable ranking only. Operational Inventory governance
-- remains the eligibility boundary. Prior matching policies remain immutable evidence.

INSERT INTO matching_policy_versions(
  policy_version,lifecycle_status,eligibility_definition,ranking_definition,activated_at
)
VALUES(
  'r3b-operational-eligibility-fit-ranking-v3','active',
  '{"statuses":["eligible","needs_clarification","excluded"],"operationalEligibilityOnly":true,"operationalBlocks":["deleted","workflow_not_approved","verification_not_trusted","effective_status_missing","not_available","verification_expired","availability_expired","transaction_type_missing","transaction_type_mismatch"],"customerFitNeverExcludes":true,"customerFitCriteria":["budget","areaCommunity","propertyType","bedrooms","size","fundingPayment","timelineHandover","customerDeclarations"],"noLegacyInference":true}'::jsonb,
  '{"scoreMaximum":100,"weights":{"budget":25,"areaCommunity":20,"propertyType":15,"bedrooms":15,"size":10,"fundingPayment":5,"timelineHandover":5,"customerDeclarations":5},"customerFitVariancesRemainSelectable":true,"tieBreak":["score_desc","missing_count_asc","inventory_reference_asc"],"aiAssistance":"advisory_explanation_only"}'::jsonb,
  '2026-08-21T00:00:00Z'
);
