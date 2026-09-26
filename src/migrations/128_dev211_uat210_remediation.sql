-- DEV211: governed remediation of the confirmed DEV210 UAT register.

ALTER TABLE viewings ADD COLUMN IF NOT EXISTS inventory_assignment_id UUID REFERENCES inventory_assignments(id);
UPDATE viewings v SET inventory_assignment_id=(
  SELECT candidate.id FROM inventory_assignments candidate
  WHERE candidate.opportunity_id=v.opportunity_id AND candidate.property_match_id=v.property_match_id
    AND candidate.listing_id=v.listing_id AND candidate.created_at<=v.created_at
  ORDER BY candidate.created_at DESC LIMIT 1
) WHERE v.listing_id IS NOT NULL AND v.inventory_assignment_id IS NULL
  AND EXISTS (
    SELECT 1 FROM inventory_assignments candidate
    WHERE candidate.opportunity_id=v.opportunity_id AND candidate.property_match_id=v.property_match_id
      AND candidate.listing_id=v.listing_id AND candidate.created_at<=v.created_at
  );
CREATE INDEX IF NOT EXISTS viewings_assignment_idx ON viewings(inventory_assignment_id,updated_at DESC);

ALTER TABLE offers ADD COLUMN IF NOT EXISTS inventory_assignment_id UUID REFERENCES inventory_assignments(id);
UPDATE offers f SET inventory_assignment_id=(
  SELECT candidate.id FROM inventory_assignments candidate
  WHERE candidate.opportunity_id=f.opportunity_id AND candidate.listing_id=f.listing_id
    AND candidate.created_at<=f.created_at
  ORDER BY candidate.created_at DESC LIMIT 1
) WHERE f.listing_id IS NOT NULL AND f.inventory_assignment_id IS NULL
  AND EXISTS (
    SELECT 1 FROM inventory_assignments candidate
    WHERE candidate.opportunity_id=f.opportunity_id AND candidate.listing_id=f.listing_id
      AND candidate.created_at<=f.created_at
  );
CREATE INDEX IF NOT EXISTS offers_assignment_idx ON offers(inventory_assignment_id,created_at DESC);

ALTER TABLE purchased_data_import_batches ADD COLUMN IF NOT EXISTS excluded_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchased_data_import_rows DROP CONSTRAINT IF EXISTS purchased_data_import_rows_outcome_check;
ALTER TABLE purchased_data_import_rows ADD CONSTRAINT purchased_data_import_rows_outcome_check
  CHECK(outcome IN ('created','linked','skipped','excluded','review_required','invalid','failed'));

CREATE TABLE customer_change_requests (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','cancelled')),
  current_values JSONB NOT NULL,
  proposed_values JSONB NOT NULL,
  change_reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES brokers(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES brokers(id),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  applied_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  CHECK((status='pending' AND decided_by IS NULL AND decided_at IS NULL) OR
    (status<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX customer_change_requests_one_pending_uq ON customer_change_requests(contact_id) WHERE status='pending';
CREATE INDEX customer_change_requests_review_idx ON customer_change_requests(status,requested_at,id);

CREATE TABLE deal_cancellation_requests (
  id UUID PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','cancelled')),
  reason_code TEXT NOT NULL CHECK(reason_code IN('customer_withdrew','finance_failed','legal_or_compliance','seller_or_landlord_withdrew','terms_not_agreed','reservation_expired','other')),
  reason TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES brokers(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES brokers(id),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  deal_version INTEGER NOT NULL CHECK(deal_version>0),
  CHECK((status='pending' AND decided_by IS NULL AND decided_at IS NULL) OR
    (status<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX deal_cancellation_requests_one_pending_uq ON deal_cancellation_requests(deal_id) WHERE status='pending';
CREATE INDEX deal_cancellation_requests_review_idx ON deal_cancellation_requests(status,requested_at,id);

ALTER TABLE communication_policy_decisions DROP CONSTRAINT IF EXISTS communication_policy_decisions_check;
ALTER TABLE communication_policy_decisions DROP CONSTRAINT IF EXISTS communication_policy_decisions_outcome_check;
ALTER TABLE communication_policy_decisions ADD CONSTRAINT communication_policy_decisions_outcome_check
  CHECK(outcome IN('allowed','denied','preparation_only'));
ALTER TABLE communication_policy_decisions ADD CONSTRAINT communication_policy_decisions_evidence_check CHECK(
  (outcome='allowed' AND contact_channel_id IS NOT NULL AND actor_authorized=1 AND channel_eligible=1 AND consent_permits=1 AND restriction_clear=1 AND subject_eligible=1)
  OR (outcome='denied')
  OR (outcome='preparation_only' AND actor_authorized=1 AND subject_eligible=1)
);

DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression
  FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK ((' || prior_expression ||
    ') OR entity_type IN (''CustomerChangeRequest'',''DealCancellationRequest''))';
END $$;

GRANT SELECT,INSERT,UPDATE ON customer_change_requests,deal_cancellation_requests TO nysareal_nysar2app;
