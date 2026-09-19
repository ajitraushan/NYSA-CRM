-- DEV-189: consolidated Commission Payment submission and MD approval.
-- A batch groups immutable payout calculations for approval; deselected rows remain available.
DROP INDEX IF EXISTS deal_agent_credit_one_frozen_uq;
ALTER TABLE deal_agent_credit_versions ADD COLUMN source_collection_id UUID REFERENCES commission_receivable_collections(id);
CREATE UNIQUE INDEX deal_agent_credit_collection_uq ON deal_agent_credit_versions(source_collection_id)
  WHERE source_collection_id IS NOT NULL;

-- Make previously recorded invoice payments immediately available to the same payout queue.
WITH raw AS (
  SELECT c.id AS collection_id,s.opportunity_id,d.id AS deal_id,cf.id AS confirmation_id,o.version AS opportunity_version,
    o.originating_agent_split_percent AS originating_pct,o.servicing_agent_split_percent AS servicing_pct,
    COALESCE(l.originating_agent_id,o.buyer_side_agent_id,o.owner_id) AS originating_agent_id,
    COALESCE(d.owner_id,o.inventory_side_agent_id,o.owner_id) AS servicing_agent_id,
    c.net_commission_cents/100.0 AS received,
    COALESCE(e.referral_amount,0) AS referral_total,COALESCE(e.referral_settlement_basis,'none') AS settlement,
    COALESCE(SUM(c.net_commission_cents/100.0) OVER(PARTITION BY d.id ORDER BY c.received_date,c.created_at,c.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS prior_received
  FROM commission_receivable_collections c JOIN commission_receivable_invoices i ON i.id=c.invoice_id
  JOIN commission_receivable_schedules s ON s.id=i.schedule_id JOIN opportunities o ON o.id=s.opportunity_id
  JOIN deals d ON d.opportunity_id=o.id AND d.status='closed_won'
  LEFT JOIN listings l ON l.id=d.listing_id
  JOIN opportunity_commission_confirmations cf ON cf.finance_opportunity_id=o.id AND cf.status='confirmed'
  LEFT JOIN LATERAL (SELECT * FROM deal_commission_expectation_versions x WHERE x.deal_id=d.id AND x.status='frozen' ORDER BY version_number DESC LIMIT 1) e ON TRUE
  WHERE c.net_commission_cents>0 AND NOT EXISTS(SELECT 1 FROM commission_receivable_reversals r WHERE r.collection_id=c.id)
), prepared AS (
  SELECT raw.*,
    CASE WHEN settlement='none' THEN 0 ELSE GREATEST(LEAST(referral_total-prior_received,received),0) END AS allocated_referral,
    COALESCE((SELECT MAX(version_number) FROM deal_agent_credit_versions v WHERE v.deal_id=raw.deal_id),0)
      + ROW_NUMBER() OVER(PARTITION BY deal_id ORDER BY collection_id) AS version_number
  FROM raw WHERE originating_agent_id IS NOT NULL AND servicing_agent_id IS NOT NULL
    AND originating_pct+servicing_pct=100
), inserted AS (
  INSERT INTO deal_agent_credit_versions(id,credit_reference,deal_id,receipt_confirmation_id,source_collection_id,version_number,source_opportunity_version,
    source_originating_split_percent,source_servicing_split_percent,currency,confirmed_actual_received,external_referral_amount,referral_settlement_basis,
    internal_credited_amount,source_context_fingerprint,idempotency_key,status,created_by,frozen_by,frozen_at)
  SELECT gen_random_uuid(),'CREDIT-AR-'||collection_id,deal_id,confirmation_id,collection_id,version_number,opportunity_version,
    originating_pct,servicing_pct,'AED',received,allocated_referral,settlement,
    received-CASE WHEN settlement='payable_from_company_receipt' THEN allocated_referral ELSE 0 END,
    md5(collection_id::text||':'||received::text)||md5(deal_id::text||':'||allocated_referral::text),
    'ar-credit:'||collection_id,'frozen',
    (SELECT created_by FROM commission_receivable_collections WHERE id=collection_id),
    (SELECT created_by FROM commission_receivable_collections WHERE id=collection_id),NOW()
  FROM prepared WHERE received-CASE WHEN settlement='payable_from_company_receipt' THEN allocated_referral ELSE 0 END>0
  ON CONFLICT(source_collection_id) WHERE source_collection_id IS NOT NULL DO NOTHING
  RETURNING id,source_collection_id
)
INSERT INTO deal_agent_credit_lines(id,credit_version_id,agent_id,originating_percent,servicing_percent,total_credit_percent,credited_amount)
SELECT gen_random_uuid(),i.id,agent_id,SUM(originating_percent),SUM(servicing_percent),SUM(total_percent),
  ROUND(MAX(internal_amount)*SUM(total_percent)/100,2)
FROM inserted i JOIN prepared p ON p.collection_id=i.source_collection_id
CROSS JOIN LATERAL (VALUES
  (p.originating_agent_id,p.originating_pct,0::numeric,p.originating_pct),
  (p.servicing_agent_id,0::numeric,p.servicing_pct,p.servicing_pct)
) a(agent_id,originating_percent,servicing_percent,total_percent)
CROSS JOIN LATERAL (SELECT p.received-CASE WHEN p.settlement='payable_from_company_receipt' THEN p.allocated_referral ELSE 0 END AS internal_amount) x
WHERE total_percent>0 GROUP BY i.id,agent_id;

CREATE TABLE commission_payment_batches (
  id UUID PRIMARY KEY,
  batch_reference TEXT NOT NULL UNIQUE,
  currency CHAR(3) NOT NULL CHECK(currency=UPPER(currency)),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','partially_approved')),
  submitted_by UUID NOT NULL REFERENCES brokers(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_by UUID REFERENCES brokers(id),
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  evidence_reference TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  CHECK((status='submitted' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status<>'submitted' AND decided_by IS NOT NULL AND decided_at IS NOT NULL
      AND CHAR_LENGTH(BTRIM(decision_reason))>=10 AND CHAR_LENGTH(BTRIM(evidence_reference))>=3))
);

CREATE TABLE commission_payment_batch_items (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES commission_payment_batches(id),
  calculation_id UUID NOT NULL REFERENCES agent_payout_calculations(id),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','deferred','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id,calculation_id)
);
CREATE UNIQUE INDEX commission_payment_one_active_batch_item
  ON commission_payment_batch_items(calculation_id) WHERE status IN ('submitted','approved');
CREATE INDEX commission_payment_batch_status_idx ON commission_payment_batches(status,submitted_at);

DO $$ DECLARE prior_expression TEXT; BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression FROM pg_constraint
    WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (('
    || prior_expression || ') OR entity_type = ''CommissionPaymentBatch'')';
END $$;

GRANT SELECT,INSERT,UPDATE ON commission_payment_batches,commission_payment_batch_items TO nysareal_nysar2app;
