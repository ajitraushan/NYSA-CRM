-- Recording an invoice payment is the Accountant's confirmation of cleared funds.
-- Backfill current invoice-linked payments so Finance does not ask for duplicate confirmation.
WITH invoice_opportunities AS (
  SELECT DISTINCT s.opportunity_id FROM commission_receivable_collections c
  JOIN commission_receivable_invoices i ON i.id=c.invoice_id
  JOIN commission_receivable_schedules s ON s.id=i.schedule_id
  WHERE c.net_commission_cents>0 AND NOT EXISTS(SELECT 1 FROM commission_receivable_reversals r WHERE r.collection_id=c.id)
)
UPDATE deal_commission_receipt_confirmations c SET status='superseded'
WHERE c.id IN (SELECT x.id FROM opportunity_commission_confirmations x JOIN invoice_opportunities t ON t.opportunity_id=x.finance_opportunity_id WHERE x.status='confirmed');

WITH invoice_totals AS (
  SELECT s.opportunity_id,
    SUM(c.net_commission_cents)::bigint AS actual_cents,
    MAX(c.received_date) AS receipt_date,
    (ARRAY_AGG(c.created_by ORDER BY c.created_at DESC,c.id DESC))[1] AS confirmed_by,
    (ARRAY_AGG(c.evidence_reference ORDER BY c.created_at DESC,c.id DESC))[1] AS evidence_reference,
    (SELECT COALESCE(SUM(ii.commission_cents),0)::bigint FROM commission_receivable_invoices ii
      JOIN commission_receivable_schedules ss ON ss.id=ii.schedule_id
      WHERE ss.opportunity_id=s.opportunity_id AND ii.state='issued') AS expected_cents
  FROM commission_receivable_collections c
  JOIN commission_receivable_invoices i ON i.id=c.invoice_id
  JOIN commission_receivable_schedules s ON s.id=i.schedule_id
  WHERE c.net_commission_cents>0 AND NOT EXISTS(SELECT 1 FROM commission_receivable_reversals r WHERE r.collection_id=c.id)
  GROUP BY s.opportunity_id
)
INSERT INTO deal_commission_receipt_confirmations(id,confirmation_reference,opportunity_id,deal_id,expectation_version_id,expectation_basis,
  version_number,deal_version,receipt_date,currency,expected_company_receipt,confirmed_actual_received,variance_amount,aggregate_fingerprint,
  idempotency_key,status,reason,evidence_reference,confirmed_by)
SELECT gen_random_uuid(),'CONF-AR-BACKFILL-'||t.opportunity_id,t.opportunity_id,d.id,NULL,'issued_invoices',
  COALESCE((SELECT MAX(x.version_number) FROM opportunity_commission_confirmations x WHERE x.finance_opportunity_id=t.opportunity_id),0)+1,
  d.version,t.receipt_date,'AED',t.expected_cents/100.0,t.actual_cents/100.0,(t.actual_cents-t.expected_cents)/100.0,
  md5(t.opportunity_id::text||':'||t.expected_cents||':'||t.actual_cents)||md5('invoice-payment:'||t.receipt_date::text),
  'ar-auto-backfill:'||t.opportunity_id,'confirmed','Automatically confirmed from previously recorded invoice payments',t.evidence_reference,t.confirmed_by
FROM invoice_totals t
LEFT JOIN LATERAL (SELECT id,version FROM deals WHERE opportunity_id=t.opportunity_id AND status='closed_won' ORDER BY closed_at DESC,id DESC LIMIT 1) d ON TRUE
ON CONFLICT(idempotency_key) DO NOTHING;
