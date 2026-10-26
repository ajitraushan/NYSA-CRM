-- Release 3B local completion: exact Inventory transaction authority, deterministic
-- matching v2, immutable declaration assessments and governed Property Match origin.

CREATE FUNCTION nysa_text_array_has_duplicates(items TEXT[]) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(cardinality(items),0) <> COALESCE((SELECT COUNT(DISTINCT item) FROM unnest(items) item),0)
$$;

ALTER TABLE listings ADD COLUMN transaction_types TEXT[];
ALTER TABLE listings ADD CONSTRAINT listings_transaction_types_ck CHECK (
  transaction_types IS NULL OR (
    cardinality(transaction_types)>0
    AND transaction_types <@ ARRAY['Sale','Rental','Off-plan','Commercial']::TEXT[]
    AND NOT nysa_text_array_has_duplicates(transaction_types)
  )
);

ALTER TABLE lead_requirements
  ADD COLUMN size_sqft_min NUMERIC(14,2),
  ADD COLUMN size_sqft_max NUMERIC(14,2),
  ADD CONSTRAINT lead_requirements_size_range_ck CHECK (
    (size_sqft_min IS NULL OR size_sqft_min>=0)
    AND (size_sqft_max IS NULL OR size_sqft_max>=0)
    AND (size_sqft_min IS NULL OR size_sqft_max IS NULL OR size_sqft_max>=size_sqft_min)
  );

ALTER TABLE lead_requirement_website_conflicts
  DROP CONSTRAINT IF EXISTS lead_requirement_website_conflicts_field_code_check;
ALTER TABLE lead_requirement_website_conflicts
  ADD CONSTRAINT lead_requirement_website_conflicts_field_code_check CHECK(field_code IN(
    'business_line','purpose','property_types','areas','budget_min','budget_max','funding_method',
    'bedrooms_min','bedrooms_max','size_sqft_min','size_sqft_max','timeline_code','declared_priorities',
    'must_haves','preferences','exclusions','acceptable_trade_offs'
  ));

ALTER TABLE inventory_matching_candidates
  DROP CONSTRAINT IF EXISTS inventory_matching_candidates_eligibility_status_check,
  DROP CONSTRAINT IF EXISTS inventory_matching_candidates_check;
ALTER TABLE inventory_matching_candidates
  ADD CONSTRAINT inventory_matching_candidates_eligibility_status_check
    CHECK(eligibility_status IN('eligible','needs_clarification','excluded')),
  ADD CONSTRAINT inventory_matching_candidates_v2_shape_ck CHECK (
    (eligibility_status IN('eligible','needs_clarification') AND presented_rank IS NOT NULL AND score IS NOT NULL)
    OR (eligibility_status='excluded' AND presented_rank IS NULL AND score IS NULL)
  );

ALTER TABLE property_matches DROP CONSTRAINT IF EXISTS property_matches_match_source_check;
ALTER TABLE property_matches ADD CONSTRAINT property_matches_match_source_check
  CHECK(match_source IN('manual','rule','governed'));

INSERT INTO matching_policy_versions(policy_version,lifecycle_status,eligibility_definition,ranking_definition,activated_at)
VALUES(
  'r3b-eligibility-ranking-v2','active',
  '{"statuses":["eligible","needs_clarification","excluded"],"availabilityMaximumAgeDays":7,"requiresTransactionType":true,"mustHavesAndExclusionsRequireAssessment":true,"noLegacyInference":true}'::jsonb,
  '{"scoreMaximum":100,"weights":{"budget":25,"areaCommunity":20,"propertyType":15,"bedrooms":15,"size":10,"fundingPayment":5,"timelineHandover":5,"assessedPreferences":5},"tieBreak":["score_desc","missing_count_asc","inventory_reference_asc"],"aiRequired":false}'::jsonb,
  '2026-08-14T00:00:00Z'
);

CREATE TABLE inventory_match_candidate_assessments (
  id UUID PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES inventory_matching_candidates(id),
  previous_assessment_id UUID REFERENCES inventory_match_candidate_assessments(id),
  sequence_no INTEGER NOT NULL CHECK(sequence_no>0),
  declaration_kind TEXT NOT NULL CHECK(declaration_kind IN('must_have','exclusion','preference','acceptable_trade_off')),
  declaration_index INTEGER NOT NULL CHECK(declaration_index>=0),
  declaration_text TEXT NOT NULL CHECK(LENGTH(BTRIM(declaration_text))>0),
  declaration_hash CHAR(64) NOT NULL CHECK(declaration_hash ~ '^[a-f0-9]{64}$'),
  result TEXT NOT NULL CHECK(result IN('met','not_met','missing','not_assessed')),
  evidence_kind TEXT NOT NULL CHECK(evidence_kind IN('inventory_fact','customer_confirmation','broker_review')),
  evidence_reference TEXT,
  assessment_notes TEXT NOT NULL CHECK(LENGTH(BTRIM(assessment_notes))>0),
  assessed_by UUID NOT NULL REFERENCES brokers(id),
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id,declaration_kind,declaration_index,sequence_no),
  UNIQUE(previous_assessment_id),
  CHECK((sequence_no=1 AND previous_assessment_id IS NULL) OR (sequence_no>1 AND previous_assessment_id IS NOT NULL))
);
CREATE INDEX inventory_match_candidate_assessments_current_idx
  ON inventory_match_candidate_assessments(candidate_id,declaration_kind,declaration_index,sequence_no DESC);
CREATE TRIGGER inventory_match_candidate_assessments_immutable
  BEFORE UPDATE OR DELETE ON inventory_match_candidate_assessments
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

CREATE TABLE property_match_governed_origins (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  property_match_id UUID NOT NULL UNIQUE REFERENCES property_matches(id),
  matching_run_id UUID NOT NULL REFERENCES inventory_matching_runs(id),
  candidate_id UUID NOT NULL UNIQUE REFERENCES inventory_matching_candidates(id),
  shortlist_decision_id UUID NOT NULL UNIQUE REFERENCES inventory_match_decisions(id),
  policy_version TEXT NOT NULL REFERENCES matching_policy_versions(policy_version),
  promotion_fingerprint CHAR(64) NOT NULL UNIQUE CHECK(promotion_fingerprint ~ '^[a-f0-9]{64}$'),
  inventory_checked_at TIMESTAMPTZ NOT NULL,
  inventory_eligibility JSONB NOT NULL,
  assessment_snapshot JSONB NOT NULL,
  assessment_evidence_hash CHAR(64) NOT NULL CHECK(assessment_evidence_hash ~ '^[a-f0-9]{64}$'),
  promoted_by UUID NOT NULL REFERENCES brokers(id),
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX property_match_governed_origins_request_candidate_uq
  ON property_match_governed_origins(request_id,candidate_id);
CREATE INDEX property_match_governed_origins_run_idx ON property_match_governed_origins(matching_run_id,promoted_at DESC);
CREATE TRIGGER property_match_governed_origins_immutable
  BEFORE UPDATE OR DELETE ON property_match_governed_origins
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT,INSERT ON inventory_match_candidate_assessments TO nysareal_nysar2app;
GRANT SELECT,INSERT ON property_match_governed_origins TO nysareal_nysar2app;
