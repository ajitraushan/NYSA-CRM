import crypto from 'node:crypto';

export const COMMISSION_PAYOUT_POLICY_VERSION='r5-commission-receipt-realtime-payout-v1';
const money=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const percent=value=>Number(Number(value).toFixed(4));
const isoDate=value=>{
  const text=String(value||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw new Error('A valid date is required');
  const date=new Date(`${text}T00:00:00.000Z`);
  if(Number.isNaN(date.valueOf())||date.toISOString().slice(0,10)!==text)throw new Error('A valid date is required');
  return date;
};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?
  Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
export const payoutFingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

export function validatePayoutSlabs(input=[]){
  const slabs=input.map((row,index)=>({displayOrder:index+1,lowerAmount:money(row.lowerAmount),
    upperAmount:row.upperAmount===null||row.upperAmount===''||row.upperAmount===undefined?null:money(row.upperAmount),
    agentPercent:percent(row.agentPercent)}));
  const errors=[];
  if(!slabs.length)errors.push('At least one payout slab is required');
  slabs.forEach((slab,index)=>{
    if(!Number.isFinite(slab.lowerAmount)||slab.lowerAmount<0)errors.push(`Slab ${index+1} lower amount is invalid`);
    if(slab.upperAmount!==null&&(!Number.isFinite(slab.upperAmount)||slab.upperAmount<=slab.lowerAmount))errors.push(`Slab ${index+1} upper amount must exceed its lower amount`);
    if(!Number.isFinite(slab.agentPercent)||slab.agentPercent<0||slab.agentPercent>100)errors.push(`Slab ${index+1} agent percentage must be between 0 and 100`);
    if(index===0&&slab.lowerAmount!==0)errors.push('The first payout slab must start at zero');
    if(index>0&&slab.lowerAmount!==slabs[index-1].upperAmount)errors.push(`Slab ${index+1} must start where the prior slab ends`);
    if(index<slabs.length-1&&slab.upperAmount===null)errors.push('Only the final payout slab may have no upper amount');
    if(index===slabs.length-1&&slab.upperAmount!==null)errors.push('The final payout slab must remain open-ended');
  });
  return{valid:errors.length===0,errors,slabs};
}

export function validatePayoutPolicy(input={}){
  const triggerMethod=String(input.triggerMethod||'');
  const checked=validatePayoutSlabs(input.slabs);
  const errors=[...checked.errors];
  if(!['attained_trigger','progressive_trigger'].includes(triggerMethod))errors.push('Select attained-trigger or progressive-trigger calculation');
  if(!/^[A-Z]{3}$/.test(String(input.currency||'')))errors.push('A three-letter uppercase currency is required');
  if(String(input.reason||'').trim().length<10)errors.push('A meaningful policy reason is required');
  try{isoDate(input.effectiveFrom);}catch{errors.push('A valid effective-from date is required');}
  if(input.effectiveTo){try{if(isoDate(input.effectiveTo)<=isoDate(input.effectiveFrom))errors.push('Effective-to must be after effective-from');}catch{errors.push('A valid effective-to date is required');}}
  return{valid:errors.length===0,errors,value:{policyCode:String(input.policyCode||'agent_commission').trim(),currency:String(input.currency||''),
    effectiveFrom:String(input.effectiveFrom||'').slice(0,10),effectiveTo:input.effectiveTo?String(input.effectiveTo).slice(0,10):null,
    triggerMethod,reason:String(input.reason||'').trim(),slabs:checked.slabs}};
}

export function workingDayDeadline(receiptDate){
  const cursor=isoDate(receiptDate),counted=[];
  while(counted.length<3){cursor.setUTCDate(cursor.getUTCDate()+1);const day=cursor.getUTCDay();if(day!==0&&day!==6)counted.push(cursor.toISOString().slice(0,10));}
  return{receiptDate:String(receiptDate).slice(0,10),countedWorkingDates:counted,releaseDueDate:counted[2],timezone:'Asia/Dubai',weekendDays:['Saturday','Sunday']};
}

export function receiptQuarterKey(receiptDate){
  const date=isoDate(receiptDate),quarter=Math.floor(date.getUTCMonth()/3)+1;
  return`${date.getUTCFullYear()}-Q${quarter}`;
}

export function calculateExpectedCommission({agreedValue,buyerCommissionPercent,buyerCommissionMinimum=0,
  sellerCommissionPercent,sellerCommissionMinimum=0,referralAmount=0,referralSettlementBasis='none',currency='AED'}={}){
  const value=money(agreedValue),components=[];
  if(!Number.isFinite(value)||value<=0)throw new Error('A positive Deal agreed value is required');
  const add=(side,rate,minimum)=>{if(rate===null||rate===undefined||rate==='')return;const pct=percent(rate),min=money(minimum||0);if(pct<0||pct>100||min<0)throw new Error(`${side} commission terms are invalid`);const percentageResult=money(value*pct/100);components.push({representedSide:side,commissionPercent:pct,commissionMinimum:min,percentageResult,expectedAmount:Math.max(percentageResult,min)});};
  add('buyer',buyerCommissionPercent,buyerCommissionMinimum);add('seller',sellerCommissionPercent,sellerCommissionMinimum);
  if(!components.length)throw new Error('At least one represented-side commission term is required');
  const gross=money(components.reduce((sum,item)=>sum+item.expectedAmount,0)),referral=money(referralAmount||0);
  if(referral<0||referral>gross)throw new Error('Referral amount cannot exceed expected gross commission');
  if(referral===0&&referralSettlementBasis!=='none')throw new Error('Zero referral amount must use settlement basis none');
  if(referral>0&&!['deducted_before_company_receipt','payable_from_company_receipt'].includes(referralSettlementBasis))throw new Error('Select how the referral is settled');
  const expectedCompanyReceipt=money(gross-(referralSettlementBasis==='deducted_before_company_receipt'?referral:0));
  return{policyVersion:COMMISSION_PAYOUT_POLICY_VERSION,currency,agreedValue:value,components,expectedGrossAmount:gross,
    referralAmount:referral,referralSettlementBasis,expectedCompanyReceipt,
    fingerprint:payoutFingerprint({currency,agreedValue:value,components,referral,referralSettlementBasis,expectedCompanyReceipt})};
}

export function reconcileCommissionReceipt({expectedCompanyReceipt,receipts=[]}={}){
  const active=new Map(),reversed=new Map();
  for(const entry of receipts){const amount=money(entry.amount);if(!(amount>0))throw new Error('Receipt and reversal amounts must be positive');if(entry.entryType==='receipt')active.set(entry.id,{...entry,amount});else if(entry.entryType==='reversal'){if(!entry.reversesReceiptId||!active.has(entry.reversesReceiptId))throw new Error('A reversal must reference a contributing receipt');reversed.set(entry.reversesReceiptId,money((reversed.get(entry.reversesReceiptId)||0)+amount));}else throw new Error('Unsupported receipt entry type');}
  const contributing=[];let actual=0;
  for(const [id,entry] of active){const remaining=money(entry.amount-(reversed.get(id)||0));if(remaining<0)throw new Error('A reversal cannot exceed its receipt');if(remaining>0){actual=money(actual+remaining);contributing.push({...entry,remainingAmount:remaining});}}
  if(!contributing.length)throw new Error('At least one unreversed receipt is required');
  const receiptDate=contributing.map(x=>String(x.receivedDate).slice(0,10)).sort().at(-1),expected=money(expectedCompanyReceipt);
  return{confirmedActualReceived:actual,expectedCompanyReceipt:expected,varianceAmount:money(actual-expected),receiptDate,
    contributingReceiptIds:contributing.map(x=>x.id).sort(),aggregateFingerprint:payoutFingerprint(contributing.map(x=>({id:x.id,remainingAmount:x.remainingAmount,receivedDate:x.receivedDate}))) };
}

export function allocateDealAgentCredit({confirmedActualReceived,externalReferralAmount=0,referralSettlementBasis='none',
  originatingAgentId,servicingAgentId,originatingAgentSplitPercent,servicingAgentSplitPercent,currency='AED'}={}){
  const actual=money(confirmedActualReceived),referral=money(externalReferralAmount||0),originating=percent(originatingAgentSplitPercent),servicing=percent(servicingAgentSplitPercent);
  if(!(actual>0))throw new Error('Confirmed actual commission received is required');
  if(!originatingAgentId||!servicingAgentId)throw new Error('The governed originating and servicing agents are required');
  if(originating+servicing!==100)throw new Error('Deal Originating-agent split % and Servicing-agent split % must total 100');
  const internal=money(actual-(referralSettlementBasis==='payable_from_company_receipt'?referral:0));if(!(internal>0))throw new Error('Internal credited commission must remain positive');
  const roles=[{agentId:originatingAgentId,role:'originating',percentage:originating},{agentId:servicingAgentId,role:'servicing',percentage:servicing}],byAgent=new Map();
  for(const role of roles){const current=byAgent.get(role.agentId)||{agentId:role.agentId,originatingPercent:0,servicingPercent:0,totalCreditPercent:0,creditedAmount:0};current[`${role.role}Percent`]=role.percentage;current.totalCreditPercent=percent(current.totalCreditPercent+role.percentage);byAgent.set(role.agentId,current);}
  const lines=[...byAgent.values()];let assigned=0;lines.forEach((line,index)=>{line.creditedAmount=index===lines.length-1?money(internal-assigned):money(internal*line.totalCreditPercent/100);assigned=money(assigned+line.creditedAmount);});
  return{currency,confirmedActualReceived:actual,externalReferralAmount:referral,referralSettlementBasis,internalCreditedAmount:internal,lines,
    sourceSplit:{originatingAgentSplitPercent:originating,servicingAgentSplitPercent:servicing},fingerprint:payoutFingerprint({actual,referral,referralSettlementBasis,originatingAgentId,servicingAgentId,originating,servicing,lines})};
}

function containingSlab(slabs,value){return slabs.find(s=>value>=s.lowerAmount&&(s.upperAmount===null||value<s.upperAmount));}
export function calculateRealtimePayout({agentId,dealReference,currency='AED',receiptDate,priorCumulativeAmount=0,currentCreditedAmount,
  triggerMethod,slabs,policyVersionId,adjustmentVersionId=null}={}){
  const checked=validatePayoutSlabs(slabs);if(!checked.valid)throw new Error(checked.errors[0]);
  if(!['attained_trigger','progressive_trigger'].includes(triggerMethod))throw new Error('A supported payout trigger method is required');
  const prior=money(priorCumulativeAmount),current=money(currentCreditedAmount),resulting=money(prior+current);if(prior<0||!(current>0))throw new Error('Payout cumulative amounts are invalid');
  const bands=[];
  if(triggerMethod==='attained_trigger'){
    const slab=containingSlab(checked.slabs,resulting);if(!slab)throw new Error('No payout slab covers the resulting cumulative commission');
    const agentPayout=money(current*slab.agentPercent/100);bands.push({...slab,portionAmount:current,agentPayoutAmount:agentPayout,companyRetainedAmount:money(current-agentPayout)});
  }else{
    for(const slab of checked.slabs){const start=Math.max(prior,slab.lowerAmount),end=Math.min(resulting,slab.upperAmount??resulting);if(end<=start)continue;const portion=money(end-start),agentPayout=money(portion*slab.agentPercent/100);bands.push({...slab,portionAmount:portion,agentPayoutAmount:agentPayout,companyRetainedAmount:money(portion-agentPayout)});}
    const allocated=money(bands.reduce((sum,x)=>sum+x.portionAmount,0));if(allocated!==current)throw new Error('Progressive payout bands do not cover the complete Deal credit');
  }
  const agentPayoutAmount=money(bands.reduce((sum,x)=>sum+x.agentPayoutAmount,0)),companyRetainedAmount=money(current-agentPayoutAmount),deadline=workingDayDeadline(receiptDate);
  return{policyVersion:COMMISSION_PAYOUT_POLICY_VERSION,agentId,dealReference,currency,quarterKey:receiptQuarterKey(receiptDate),priorCumulativeAmount:prior,
    currentCreditedAmount:current,resultingCumulativeAmount:resulting,triggerMethod,policyVersionId,adjustmentVersionId,bands,
    agentPayoutAmount,companyRetainedAmount,...deadline,resolvedPlanFingerprint:payoutFingerprint({triggerMethod,slabs:checked.slabs,policyVersionId,adjustmentVersionId}),
    cumulativeContextFingerprint:payoutFingerprint({agentId,currency,receiptDate,prior,current,dealReference})};
}

export const mayViewPayoutWorkspace=broker=>broker?.jobRole==='director';
export const mayMaintainPayoutPolicy=broker=>broker?.role==='admin';
export const mayDraftPayoutPolicy=broker=>broker?.role==='admin'||broker?.jobRole==='admin_assistant';
