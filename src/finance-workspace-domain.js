import {hasInternalCrmIdentity} from './crm-policy.js';
export const mayReadFinanceQueues=broker=>hasInternalCrmIdentity(broker)&&['accountant','director'].includes(broker.jobRole);
export function queuePage(query={}){const page=Number(query.page??1),size=Number(query.size??25);if(!Number.isInteger(page)||page<1||!Number.isInteger(size)||![25,50].includes(size))throw Object.assign(new Error('Use page >= 1 and size 25 or 50'),{statusCode:400});return{page,size,offset:(page-1)*size,q:String(query.q||'').trim().slice(0,100)};}
export function queueFilters(query={}){
 const invalid=message=>{throw Object.assign(new Error(message),{statusCode:400});};
 for(const key of ['agentId','teamId'])if(query[key]&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query[key]))invalid('A valid filter record identifier is required');
 for(const key of ['from','to'])if(query[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(query[key])||!Number.isFinite(Date.parse(query[key]))||new Date(query[key]).toISOString().slice(0,10)!==query[key]))invalid('Use a valid calendar date');
 if(query.from&&query.to&&query.from>query.to)invalid('From date must precede To date');
 if(query.currency&&!/^[A-Z]{3}$/.test(query.currency))invalid('Use a three-letter currency code');
 if(query.quarter&&!/^\d{4}-Q[1-4]$/.test(query.quarter))invalid('Use a quarter such as 2026-Q4');
}
const invoiceBase=`SELECT i.id,o.opportunity_reference AS reference,s.payer_name AS party,s.currency,i.invoice_reference,i.invoice_date::text,i.due_date::text,i.total_cents/100.0 AS amount,
 COALESCE(receipts.amount_cents,0)/100.0 AS collected,i.state
 FROM commission_receivable_invoices i JOIN commission_receivable_schedules s ON s.id=i.schedule_id JOIN opportunities o ON o.id=s.opportunity_id
 LEFT JOIN (SELECT c.invoice_id,SUM(c.amount_cents) AS amount_cents FROM commission_receivable_collections c WHERE NOT EXISTS(SELECT 1 FROM commission_receivable_reversals r WHERE r.collection_id=c.id) GROUP BY c.invoice_id) receipts ON receipts.invoice_id=i.id`;
const batchBase=`SELECT ba.id,ba.batch_reference AS reference,ba.currency,ba.payment_status,ba.status,ba.submitted_at::text AS date,ba.payment_date::text,ba.payment_reference,
 ARRAY_AGG(DISTINCT p.agent_id) AS agent_ids,COUNT(*)::int AS row_count,COUNT(DISTINCT p.agent_id)::int AS agent_count,
 COALESCE(SUM(p.agent_payout_amount),0) AS amount,
 MIN(p.release_due_date)::text AS due_date
 FROM commission_payment_batches ba JOIN commission_payment_batch_items bi ON bi.batch_id=ba.id JOIN agent_payout_calculations p ON p.id=bi.calculation_id WHERE bi.status=ANY($1::text[]) GROUP BY ba.id`;
// Match the maintained commission terms used by calculateExpectedCommission.
// A frozen expectation remains authoritative; incomplete terms stay unknown.
const awaitingAmount=`COALESCE(e.expected_company_receipt,CASE WHEN d.agreed_value>0
 AND (o.buyer_commission_percent IS NOT NULL OR o.seller_commission_percent IS NOT NULL)
 AND COALESCE(o.buyer_commission_percent,0) BETWEEN 0 AND 100 AND COALESCE(o.seller_commission_percent,0) BETWEEN 0 AND 100
 AND COALESCE(o.buyer_commission_minimum,0)>=0 AND COALESCE(o.seller_commission_minimum,0)>=0 THEN
 (CASE WHEN o.buyer_commission_percent IS NULL THEN 0 ELSE GREATEST(ROUND(d.agreed_value*o.buyer_commission_percent/100,2),COALESCE(o.buyer_commission_minimum,0)) END)
 +(CASE WHEN o.seller_commission_percent IS NULL THEN 0 ELSE GREATEST(ROUND(d.agreed_value*o.seller_commission_percent/100,2),COALESCE(o.seller_commission_minimum,0)) END) END)`;
export function queueDefinition(category,broker){
 if(!hasInternalCrmIdentity(broker))throw Object.assign(new Error('NYSA business staff access required'),{statusCode:403});
 const finance=mayReadFinanceQueues(broker);
 if(!finance&&!category.startsWith('advice-'))throw Object.assign(new Error('Finance authority required'),{statusCode:403});
 if(category.startsWith('advice-')){const status=category.slice(7),states={generated:['generated'],pending:['pending','generating'],failed:['failed']}[status];if(!states)throw Object.assign(new Error('Unknown category'),{statusCode:400});return{sql:`SELECT a.id,ARRAY[a.agent_id] AS agent_ids,'NYSA-PA-'||EXTRACT(YEAR FROM a.created_at AT TIME ZONE 'Asia/Dubai')::text||'-'||LPAD(a.advice_number::text,GREATEST(6,LENGTH(a.advice_number::text)),'0') AS reference,b.name AS party,a.currency,(a.input_snapshot->>'total')::numeric AS amount,a.status,a.created_at::text AS date,ba.batch_reference FROM agent_payout_advices a JOIN brokers b ON b.id=a.agent_id JOIN commission_payment_batches ba ON ba.id=a.batch_id WHERE a.status=ANY($1::text[]) AND ($2::uuid IS NULL OR a.agent_id=$2)`,params:[states,finance?null:broker.id]};}
 if(category==='invoice-awaiting')return{sql:`SELECT o.id,o.opportunity_reference AS reference,c.full_name AS party,d.currency,d.closed_at::text AS date,${awaitingAmount} AS amount FROM opportunities o JOIN leads l ON l.id=o.lead_id JOIN contacts c ON c.id=l.contact_id JOIN LATERAL(SELECT id,currency,closed_at,agreed_value FROM deals WHERE opportunity_id=o.id AND status='closed_won' ORDER BY closed_at DESC,id DESC LIMIT 1)d ON TRUE LEFT JOIN LATERAL(SELECT expected_company_receipt FROM deal_commission_expectation_versions WHERE deal_id=d.id AND status='frozen' ORDER BY version_number DESC,id DESC LIMIT 1)e ON TRUE WHERE o.stage='Closed Won' AND NOT EXISTS(SELECT 1 FROM commission_receivable_schedules s JOIN commission_receivable_invoices i ON i.schedule_id=s.id WHERE s.opportunity_id=o.id AND i.state NOT IN ('cancelled','superseded'))`,params:[]};
 if(category==='invoice-changes')return{sql:`SELECT a.id,i.invoice_reference AS reference,s.payer_name AS party,s.currency,i.total_cents/100.0 AS amount,a.status,a.requested_at::text AS date,i.id AS invoice_id FROM commission_receivable_adjustment_requests a JOIN commission_receivable_invoices i ON i.id=a.invoice_id JOIN commission_receivable_schedules s ON s.id=i.schedule_id`,params:[]};
 if(category==='invoice-issued')return{sql:`SELECT * FROM (${invoiceBase}) v WHERE state='issued'`,params:[]};
 const collections={'collection-unpaid':'collected=0 AND amount>0','collection-part':'collected>0 AND collected<amount','collection-overdue':"collected<amount AND due_date<(NOW() AT TIME ZONE 'Asia/Dubai')::date::text",'collection-paid':'collected>=amount'};
 if(collections[category])return{sql:`SELECT *,amount-collected AS balance FROM (${invoiceBase}) v WHERE state='issued' AND ${collections[category]}`,params:[]};
 if(category==='payout-ready')return{sql:`SELECT p.id,ARRAY[p.agent_id] AS agent_ids,p.payout_reference AS reference,b.name AS party,p.currency,p.agent_payout_amount AS amount,p.release_due_date::text AS due_date,p.receipt_date::text AS date FROM agent_payout_calculations p JOIN brokers b ON b.id=p.agent_id WHERE p.status='calculated' AND NOT EXISTS(SELECT 1 FROM commission_payment_batch_items bi WHERE bi.calculation_id=p.id AND bi.status IN ('submitted','approved'))`,params:[]};
 if(category==='payout-prepare')return{sql:`SELECT l.id,ARRAY[l.agent_id] AS agent_ids,b.name AS party,o.opportunity_reference AS reference,v.currency,l.credited_amount AS amount,c.receipt_date::text AS date,
 EXISTS(SELECT 1 FROM commission_payout_policy_versions policy WHERE policy.currency=v.currency AND policy.status='active' AND policy.effective_from<=c.receipt_date AND (policy.effective_to IS NULL OR policy.effective_to>c.receipt_date)) AS policy_ready
 FROM deal_agent_credit_lines l JOIN deal_agent_credit_versions v ON v.id=l.credit_version_id JOIN deal_commission_receipt_confirmations c ON c.id=v.receipt_confirmation_id JOIN deals d ON d.id=v.deal_id JOIN opportunities o ON o.id=d.opportunity_id JOIN brokers b ON b.id=l.agent_id WHERE v.status='frozen' AND d.status='closed_won' AND NOT EXISTS(SELECT 1 FROM agent_payout_calculations p WHERE p.credit_line_id=l.id)`,params:[]};
 const batchStates={'payout-pending':['submitted'],'payout-approved':['approved'],'payout-paid':['paid']};
 if(batchStates[category])return{sql:`SELECT * FROM (${batchBase}) v WHERE amount>0 AND ${category==='payout-paid'?"payment_status='paid'":category==='payout-approved'?"payment_status='awaiting_payment' AND status IN ('approved','partially_approved')":"status IN ('submitted','partially_approved')"}`,params:[batchStates[category]]};
 if(category==='statements')return{sql:`SELECT MIN(p.id::text)::uuid AS id,p.agent_id,ARRAY[p.agent_id] AS agent_ids,b.name AS party,p.quarter_key AS reference,MIN(p.receipt_date)::text AS date,p.currency,SUM(p.agent_payout_amount) AS amount,COALESCE(SUM(releases.paid),0) AS collected FROM agent_payout_calculations p JOIN brokers b ON b.id=p.agent_id LEFT JOIN(SELECT calculation_id,SUM(CASE WHEN event_type='release' THEN released_amount ELSE -released_amount END) AS paid FROM agent_payout_release_events GROUP BY calculation_id) releases ON releases.calculation_id=p.id WHERE p.status<>'reversed' GROUP BY p.agent_id,b.name,p.quarter_key,p.currency`,params:[]};
 throw Object.assign(new Error('Unknown work category'),{statusCode:400});
}
