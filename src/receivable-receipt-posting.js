import {one,many,execute,uuid,audit} from './db.js';
import {resolveOpportunityReceiptProof} from './commission-proof.js';
import {allocateDealAgentCredit,payoutFingerprint} from './commission-payout-domain.js';
import {badRequest,decimal,dubaiToday,paymentSplit} from './receivables-domain.js';

export async function lockOpportunityFinance(opportunityId,client){
  if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(opportunityId||''))throw badRequest('Valid Opportunity identifier required');
  await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[`finance-opportunity:${opportunityId}`],client);
  const opportunity=await one('SELECT id,opportunity_reference FROM opportunities WHERE id=$1',[opportunityId],client);
  if(!opportunity)throw badRequest('Opportunity not found',404);
  return opportunity;
}
async function confirmRecordedInvoicePayments(item,actor,evidenceReference,collectionId,client){
  const payment=await one(`SELECT c.net_commission_cents::bigint AS cents,c.received_date::text AS receipt_date,i.commission_cents::bigint AS expected_cents
    FROM commission_receivable_collections c JOIN commission_receivable_invoices i ON i.id=c.invoice_id WHERE c.id=$1`,[collectionId],client);
  if(Number(payment?.cents)<=0)return null;
  const deal=await one(`SELECT d.id,d.version,d.deal_reference,o.version AS opportunity_version,o.originating_agent_split_percent,o.servicing_agent_split_percent,
    COALESCE(l.originating_agent_id,o.buyer_side_agent_id,o.owner_id) AS originating_agent_id,
    COALESCE(d.owner_id,o.inventory_side_agent_id,o.owner_id) AS servicing_agent_id
    FROM deals d JOIN opportunities o ON o.id=d.opportunity_id LEFT JOIN listings l ON l.id=d.listing_id
    WHERE d.opportunity_id=$1 AND d.status='closed_won' ORDER BY d.closed_at DESC,d.id DESC LIMIT 1`,[item.opportunityId],client);
  await execute("UPDATE deal_commission_receipt_confirmations SET status='superseded' WHERE id IN (SELECT id FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1 AND status='confirmed')",[item.opportunityId],client);
  const latest=await one('SELECT COALESCE(MAX(version_number),0)::int AS n FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1',[item.opportunityId],client);
  const confirmationId=uuid(),expectedAmount=decimal(Number(payment.expectedCents)),actualAmount=decimal(Number(payment.cents)),varianceAmount=decimal(Number(payment.cents)-Number(payment.expectedCents));
  const fingerprint=payoutFingerprint({basis:'recorded_invoice_payment',opportunityId:item.opportunityId,collectionId,expectedCents:Number(payment.expectedCents),actualCents:Number(payment.cents),receiptDate:payment.receiptDate});
  const confirmation=await one(`INSERT INTO deal_commission_receipt_confirmations(id,confirmation_reference,opportunity_id,deal_id,expectation_version_id,expectation_basis,
    version_number,deal_version,receipt_date,currency,expected_company_receipt,confirmed_actual_received,variance_amount,aggregate_fingerprint,idempotency_key,status,reason,evidence_reference,confirmed_by)
    VALUES($1,$2,$3,$4,NULL,'issued_invoices',$5,$6,$7,'AED',$8,$9,$10,$11,$12,'confirmed',$13,$14,$15) RETURNING *`,
    [confirmationId,`CONF-AR-${collectionId}`,item.opportunityId,deal?.id||null,Number(latest.n)+1,deal?.version||null,payment.receiptDate,expectedAmount,actualAmount,varianceAmount,fingerprint,
      `ar-confirmation:${collectionId}`,'Automatically confirmed when the invoice payment was recorded',evidenceReference,actor.id],client);
  await audit('DealCommissionReceiptConfirmation',confirmationId,'confirmed_from_invoice_payment',actor.id,{opportunityId:item.opportunityId,collectionId,expectedCents:Number(payment.expectedCents),actualCents:Number(payment.cents)},client);
  if(!deal)return confirmation;
  const expectation=await one("SELECT * FROM deal_commission_expectation_versions WHERE deal_id=$1 AND status='frozen' ORDER BY version_number DESC LIMIT 1",[deal.id],client);
  const applied=await one("SELECT COALESCE(SUM(external_referral_amount),0) AS amount FROM deal_agent_credit_versions WHERE deal_id=$1 AND source_collection_id IS NOT NULL AND status<>'superseded'",[deal.id],client);
  const referralTotal=Number(expectation?.referralAmount||0),remainingReferral=Math.max(0,referralTotal-Number(applied.amount||0));
  const settlement=expectation?.referralSettlementBasis||'none',currentReferral=settlement==='none'?0:Math.min(actualAmount,remainingReferral);
  let allocation;try{allocation=allocateDealAgentCredit({confirmedActualReceived:actualAmount,externalReferralAmount:currentReferral,referralSettlementBasis:settlement,
    originatingAgentId:deal.originatingAgentId,servicingAgentId:deal.servicingAgentId,originatingAgentSplitPercent:deal.originatingAgentSplitPercent,
    servicingAgentSplitPercent:deal.servicingAgentSplitPercent,currency:'AED'});}catch(error){
    await audit('DealAgentCredit',deal.id,'payment_credit_pending_setup',actor.id,{opportunityId:item.opportunityId,collectionId,reason:error.message},client);return confirmation;
  }
  const creditLatest=await one('SELECT COALESCE(MAX(version_number),0)::int AS n FROM deal_agent_credit_versions WHERE deal_id=$1',[deal.id],client),creditId=uuid();
  await execute(`INSERT INTO deal_agent_credit_versions(id,credit_reference,deal_id,receipt_confirmation_id,source_collection_id,version_number,source_opportunity_version,
    source_originating_split_percent,source_servicing_split_percent,currency,confirmed_actual_received,external_referral_amount,referral_settlement_basis,
    internal_credited_amount,source_context_fingerprint,idempotency_key,status,created_by,frozen_by,frozen_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'AED',$10,$11,$12,$13,$14,$15,'frozen',$16,$16,NOW())`,
    [creditId,`CREDIT-AR-${collectionId}`,deal.id,confirmationId,collectionId,Number(creditLatest.n)+1,deal.opportunityVersion,
      deal.originatingAgentSplitPercent,deal.servicingAgentSplitPercent,allocation.confirmedActualReceived,allocation.externalReferralAmount,
      allocation.referralSettlementBasis,allocation.internalCreditedAmount,allocation.fingerprint,`ar-credit:${collectionId}`,actor.id],client);
  for(const line of allocation.lines)await execute(`INSERT INTO deal_agent_credit_lines(id,credit_version_id,agent_id,originating_percent,servicing_percent,total_credit_percent,credited_amount)
    VALUES($1,$2,$3,$4,$5,$6,$7)`,[uuid(),creditId,line.agentId,line.originatingPercent,line.servicingPercent,line.totalCreditPercent,line.creditedAmount],client);
  await audit('DealAgentCredit',creditId,'created_from_invoice_payment',actor.id,{opportunityId:item.opportunityId,collectionId,lineCount:allocation.lines.length,internalCreditedAmount:allocation.internalCreditedAmount},client);
  return{...confirmation,creditId};
}
export async function postInvoicePayment(item,body,actor,cents,receivedDate,financeReference,evidenceReference,client){
  await lockOpportunityFinance(item.opportunityId,client);
  const previous=await one(`SELECT COALESCE(SUM(c.net_commission_cents),0) AS net,
    COUNT(*) FILTER(WHERE c.net_commission_cents IS NULL)::int AS legacy
    FROM commission_receivable_collections c WHERE c.invoice_id=$1
    AND NOT EXISTS(SELECT 1 FROM commission_receivable_reversals r WHERE r.collection_id=c.id)`,[item.id],client);
  if(previous.legacy)throw badRequest('This invoice contains legacy unlinked collections; Finance must reconcile them before adding another payment.',409);
  const split=paymentSplit(item,cents,Number(previous.net));
  const method=String(body.receiptMethod||'').trim();
  if(!['bank_transfer','cheque','card','other_confirmed'].includes(method))throw badRequest('Select the actual payment method');
  const proof=await resolveOpportunityReceiptProof(item.opportunityId,body.proofId,client);
  const evidence=proof?.proofReference||evidenceReference;
  if(evidence.length<3)throw badRequest('Select commission proof or enter its evidence reference');
  const normalized=financeReference.toLowerCase().replace(/\s+/g,'');
  // This common lock and the ledger's unique reference also protect direct receipt entry.
  await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`receipt-bank:AED:${normalized}`],client);
  if(await one("SELECT id FROM commission_receivable_collections WHERE LOWER(regexp_replace(finance_reference,'\\s','','g'))=$1",[normalized],client))
    throw badRequest('This payment reference already exists on an invoice. Do not record it twice.',409);
  if(await one("SELECT id FROM deal_commission_receipts WHERE currency='AED' AND normalized_finance_reference=$1 AND entry_type='receipt'",[normalized],client))
    throw badRequest('This payment reference already exists in Finance Receipts. Do not enter it again; reconcile the existing receipt.',409);
  const collectionId=uuid(),receiptId=split.netCommissionCents?uuid():null;
  if(receiptId){
    await execute(`INSERT INTO deal_commission_receipts(id,receipt_reference,opportunity_id,entry_type,amount,currency,
      received_date,receipt_method,finance_reference,normalized_finance_reference,evidence_reference,evidence_fingerprint,idempotency_key,recorded_by,proof_id)
      VALUES($1,$2,$3,'receipt',$4,'AED',$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [receiptId,`AR-RCPT-${collectionId}`,item.opportunityId,decimal(split.netCommissionCents),receivedDate,method,financeReference,normalized,evidence,
        payoutFingerprint({collectionId,invoiceId:item.id,opportunityId:item.opportunityId,...split}),`ar-collection:${collectionId}`,actor.id,proof?.id||null],client);
    await audit('DealCommissionReceipt',receiptId,'recorded_from_invoice',actor.id,{invoiceId:item.id,collectionId,opportunityId:item.opportunityId,grossCents:cents,...split},client);
  }
  await execute(`INSERT INTO commission_receivable_collections(id,invoice_id,amount_cents,received_date,finance_reference,
    evidence_reference,created_by,opportunity_id,net_commission_cents,vat_cents,commission_receipt_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [collectionId,item.id,cents,receivedDate,financeReference,evidence,actor.id,item.opportunityId,split.netCommissionCents,split.vatCents,receiptId],client);
  const receiptConfirmation=split.netCommissionCents?await confirmRecordedInvoicePayments(item,actor,evidence,collectionId,client):null;
  return{collectionId,commissionReceiptId:receiptId,receiptConfirmationId:receiptConfirmation?.id||null,...split};
}
export async function reverseInvoicePayment(entry,item,reason,actor,client){
  if(entry.netCommissionCents==null)throw badRequest('Legacy unlinked collection requires reviewed Finance reconciliation',409);
  await lockOpportunityFinance(item.opportunityId,client);
  // Do not silently reverse money already used for agent credits/payouts.
  if(await one("SELECT v.id FROM deal_agent_credit_versions v JOIN deals d ON d.id=v.deal_id WHERE d.opportunity_id=$1 AND v.status='frozen' UNION ALL SELECT p.id FROM agent_payout_calculations p JOIN deals d ON d.id=p.deal_id WHERE d.opportunity_id=$1 AND p.status<>'reversed' LIMIT 1",[item.opportunityId],client))
    throw badRequest('This receipt supports frozen agent credit. Director must resolve the credit/payout before payment reversal.',409);
  const reversalId=uuid(),receiptId=Number(entry.netCommissionCents)>0?uuid():null;
  if(receiptId){
    const original=await one('SELECT * FROM deal_commission_receipts WHERE id=$1 FOR UPDATE',[entry.commissionReceiptId],client);
    if(await one("SELECT id FROM deal_commission_receipts WHERE reverses_receipt_id=$1",[original.id],client))
      throw badRequest('The linked Finance receipt has already been corrected; reconcile before retrying',409);
    const ref=`AR-REV-${reversalId}`;
    await execute(`INSERT INTO deal_commission_receipts(id,receipt_reference,opportunity_id,entry_type,reverses_receipt_id,amount,currency,
      received_date,receipt_method,finance_reference,normalized_finance_reference,evidence_reference,evidence_fingerprint,idempotency_key,reason,recorded_by,proof_id)
      VALUES($1,$2,$3,'reversal',$4,$5,'AED',$6,$7,$2,$8,$9,$10,$11,$12,$13,$14)`,
      [receiptId,ref,item.opportunityId,original.id,original.amount,dubaiToday(),original.receiptMethod,ref.toLowerCase(),original.evidenceReference,
        payoutFingerprint({reversalId,collectionId:entry.id,reason}),`ar-reversal:${reversalId}`,reason,actor.id,original.proofId],client);
    await audit('DealCommissionReceipt',receiptId,'reversed_from_invoice',actor.id,{invoiceId:item.id,collectionId:entry.id,reversesReceiptId:original.id,reason},client);
  }
  await execute('INSERT INTO commission_receivable_reversals(id,collection_id,reason,created_by,commission_receipt_id) VALUES($1,$2,$3,$4,$5)',
    [reversalId,entry.id,reason,actor.id,receiptId],client);
  return{reversalId,commissionReceiptId:receiptId};
}
