import {one,many,execute,transaction,uuid,audit} from './db.js';
import {mayRecordFinanceReceipt,resolveOpportunityReceiptProof} from './commission-proof.js';
import {lockOpportunityFinance} from './receivable-receipt-posting.js';
import {badRequest,dateOnly,dubaiToday,moneyCents,decimal} from './receivables-domain.js';
import {payoutFingerprint,reconcileCommissionReceipt} from './commission-payout-domain.js';

const text=(v,label,min=3)=>{const s=String(v??'').trim();if(s.length<min||s.length>1000)throw badRequest(`${label} is required`);return s;};
const authority=req=>{if(!mayRecordFinanceReceipt(req.broker))throw badRequest('Finance receipt authority required',403);};
export async function opportunityFinanceContext(id,client){
  if(!/^[a-f0-9-]{36}$/i.test(id||''))throw badRequest('Valid Opportunity identifier required');
  const o=await one(`SELECT id,opportunity_reference,stage,transaction_type,originating_agent_split_percent,servicing_agent_split_percent
    FROM opportunities WHERE id=$1`,[id],client);
  if(!o)throw badRequest('Opportunity not found',404);
  const expectations=await many(`SELECT e.* FROM deal_commission_expectation_versions e JOIN deals d ON d.id=e.deal_id
    WHERE d.opportunity_id=$1 AND e.status='frozen' ORDER BY e.frozen_at DESC`,[id],client);
  const invoices=await one(`SELECT COUNT(*)::int AS n,COALESCE(SUM(i.commission_cents),0) AS cents
    FROM commission_receivable_invoices i JOIN commission_receivable_schedules s ON s.id=i.schedule_id
    WHERE s.opportunity_id=$1 AND i.state='issued'`,[id],client);
  // A single governed expectation is optional, never a Deal prerequisite for Finance.
  const expectation=expectations.length===1?expectations[0]:null;
  if(expectation&&expectation.currency!=='AED')throw badRequest('This receivables workflow supports AED only',409);
  return {opportunity:o,expectation,expectedCompanyReceipt:expectation?Number(expectation.expectedCompanyReceipt):Number(invoices.cents)/100,
    expectationBasis:expectation?'frozen_expectation':'issued_invoices',issuedInvoiceCount:invoices.n,currency:'AED'};
}
export async function opportunityReceipts(id,client){
  return many(`SELECT r.*,r.received_date::text AS received_date,i.invoice_reference,o.opportunity_reference
    FROM opportunity_commission_receipts r JOIN opportunities o ON o.id=r.finance_opportunity_id
    LEFT JOIN commission_receivable_collections c ON c.commission_receipt_id=r.id
    LEFT JOIN commission_receivable_reversals rv ON rv.commission_receipt_id=r.id
    LEFT JOIN commission_receivable_collections original ON original.id=rv.collection_id
    LEFT JOIN commission_receivable_invoices i ON i.id=COALESCE(c.invoice_id,original.invoice_id)
    WHERE r.finance_opportunity_id=$1 ORDER BY r.recorded_at,r.id`,[id],client);
}
export async function recordOpportunityReceipt(id,body,actor){
  const key=text(body.idempotencyKey,'Stable idempotency key',8),cents=moneyCents(body.amount,'Amount received');
  if(cents<=0)throw badRequest('Positive receipt amount required');
  const receivedDate=dateOnly(body.receivedDate,'Receipt date');if(receivedDate>dubaiToday())throw badRequest('Receipt date cannot be in the future');
  const reference=text(body.financeReference,'Finance reference'),method=text(body.receiptMethod,'Payment method');
  if(!['bank_transfer','cheque','card','other_confirmed'].includes(method))throw badRequest('Valid payment method required');
  return transaction(async client=>{
    await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commission-receipt:${key}`],client);
    await lockOpportunityFinance(id,client);
    const proof=await resolveOpportunityReceiptProof(id,body.proofId,client),evidence=proof?.proofReference||text(body.evidenceReference,'Evidence reference');
    const fingerprint=payoutFingerprint({opportunityId:id,cents,receivedDate,reference,method,evidence,actorId:actor.id});
    const old=await one('SELECT * FROM deal_commission_receipts WHERE idempotency_key=$1',[key],client);
    if(old){if(old.evidenceFingerprint!==fingerprint)throw badRequest('Receipt key belongs to different details',409);return{receipt:old,replayed:true};}
    const normalized=reference.toLowerCase().replace(/\s+/g,'');
    await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`receipt-bank:AED:${normalized}`],client);
    if(await one("SELECT id FROM deal_commission_receipts WHERE currency='AED' AND normalized_finance_reference=$1 AND entry_type='receipt' UNION ALL SELECT id FROM commission_receivable_collections WHERE LOWER(regexp_replace(finance_reference,'\\s','','g'))=$1 LIMIT 1",[normalized],client))throw badRequest('Payment already recorded. Do not enter it twice.',409);
    const receiptId=uuid(),receipt=await one(`INSERT INTO deal_commission_receipts(id,receipt_reference,opportunity_id,entry_type,amount,currency,received_date,
      receipt_method,finance_reference,normalized_finance_reference,evidence_reference,evidence_fingerprint,idempotency_key,recorded_by,proof_id)
      VALUES($1,$2,$3,'receipt',$4,'AED',$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [receiptId,`RCPT-${receiptId}`,id,decimal(cents),receivedDate,method,reference,normalized,evidence,fingerprint,key,actor.id,proof?.id||null],client);
    await audit('DealCommissionReceipt',receiptId,'recorded',actor.id,{opportunityId:id,amountCents:cents,proofId:proof?.id||null},client);
    return{receipt};
  });
}
export async function confirmOpportunityReceipts(id,body,actor){
  const key=text(body.idempotencyKey,'Stable idempotency key',8),reason=text(body.reason,'Confirmation reason',10),evidence=text(body.evidenceReference,'Evidence reference');
  return transaction(async client=>{
    await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commission-confirmation:${key}`],client);
    await lockOpportunityFinance(id,client);
    const old=await one('SELECT * FROM opportunity_commission_confirmations WHERE idempotency_key=$1',[key],client);
    if(old){if(old.financeOpportunityId!==id||old.confirmedBy!==actor.id||old.reason!==reason||old.evidenceReference!==evidence)throw badRequest('Confirmation key belongs to different details',409);return{confirmation:old,replayed:true};}
    const context=await opportunityFinanceContext(id,client);
    if(!context.expectation&&!context.issuedInvoiceCount)throw badRequest('Record the Opportunity invoice before reconciling its receipts',409);
    const receipts=await opportunityReceipts(id,client);
    if(receipts.some(r=>r.currency!=='AED'))throw badRequest('Mixed-currency Opportunity receipts require reviewed reconciliation',409);
    let calc;try{calc=reconcileCommissionReceipt({expectedCompanyReceipt:context.expectedCompanyReceipt,receipts});}catch(e){throw badRequest(e.message,409);}
    await execute("UPDATE deal_commission_receipt_confirmations SET status='superseded' WHERE id IN (SELECT id FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1 AND status='confirmed')",[id],client);
    const latest=await one('SELECT COALESCE(MAX(version_number),0)::int AS n FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1',[id],client);
    const deal=context.expectation?await one('SELECT id,version FROM deals WHERE id=$1',[context.expectation.dealId],client):null,confirmationId=uuid();
    const confirmation=await one(`INSERT INTO deal_commission_receipt_confirmations(id,confirmation_reference,opportunity_id,deal_id,expectation_version_id,expectation_basis,
      version_number,deal_version,receipt_date,currency,expected_company_receipt,confirmed_actual_received,variance_amount,aggregate_fingerprint,idempotency_key,status,reason,evidence_reference,confirmed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'AED',$10,$11,$12,$13,$14,'confirmed',$15,$16,$17) RETURNING *`,
      [confirmationId,`CONF-${confirmationId}`,id,deal?.id||null,context.expectation?.id||null,context.expectationBasis,latest.n+1,deal?.version||null,calc.receiptDate,
        calc.expectedCompanyReceipt,calc.confirmedActualReceived,calc.varianceAmount,calc.aggregateFingerprint,key,reason,evidence,actor.id],client);
    await audit('DealCommissionReceiptConfirmation',confirmationId,'confirmed',actor.id,{opportunityId:id,expectationBasis:context.expectationBasis,actualReceived:calc.confirmedActualReceived},client);
    return{confirmation};
  });
}
export function registerOpportunityFinance(r){
  r.get('/finance/commission-opportunities',async(req,res)=>{
    authority(req);const q=String(req.query.q||'').trim().slice(0,100);
    const opportunities=await many(`SELECT o.id,o.opportunity_reference,o.stage,'AED' AS currency,
      (SELECT COUNT(*)::int FROM opportunity_commission_proofs p WHERE p.finance_opportunity_id=o.id) AS proof_count,
      (SELECT c.confirmed_actual_received FROM opportunity_commission_confirmations c WHERE c.finance_opportunity_id=o.id AND c.status='confirmed' ORDER BY c.confirmed_at DESC LIMIT 1) AS confirmed_actual_received
      FROM opportunities o WHERE ($1='' OR o.opportunity_reference ILIKE '%'||$1||'%') ORDER BY o.created_at DESC,o.id LIMIT 100`,[q]);
    res.json({opportunities,limit:100});
  });
  r.get('/finance/opportunities/:id/commission',async(req,res)=>{
    authority(req);const context=await opportunityFinanceContext(req.params.id),receipts=await opportunityReceipts(req.params.id);
    const confirmations=await many('SELECT *,receipt_date::text AS receipt_date FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1 ORDER BY confirmed_at DESC,id',[req.params.id]);
    res.json({...context,receipts,confirmations});
  });
  for(const [suffix,work] of [['commission-receipts',recordOpportunityReceipt],['commission-receipt-confirmations',confirmOpportunityReceipts]]){
    r.post('/finance/opportunities/:id/'+suffix,async(req,res)=>{authority(req);const result=await work(req.params.id,req.body||{},req.broker);res.status(result.replayed?200:201).json(result);});
  }
}
