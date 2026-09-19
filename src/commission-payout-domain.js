import crypto from 'node:crypto';

export const COMMISSION_PAYOUT_POLICY_VERSION='r5-commission-receipt-realtime-payout-v1';
const money=value=>Math.round((Number(value)+Number.EPSILON)*100)/100;
const percent=value=>Number(Number(value).toFixed(4));
// pg DATE values arrive as local-midnight Date objects. Preserve their calendar
// date, rather than slicing Date.toString() or shifting through UTC.
export const commissionDateText=value=>value instanceof Date
  ?`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`
  :String(value||'').slice(0,10);
const isoDate=value=>{
  const text=commissionDateText(value);
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
  if(!['attained_trigger','progressive_trigger','quarter_achieved_rate'].includes(triggerMethod))errors.push('Select a supported payout calculation method');
  if(!/^[A-Z]{3}$/.test(String(input.currency||'')))errors.push('A three-letter uppercase currency is required');
  if(String(input.reason||'').trim().length<10)errors.push('A meaningful policy reason is required');
  try{isoDate(input.effectiveFrom);}catch{errors.push('A valid effective-from date is required');}
  if(input.effectiveTo){try{if(isoDate(input.effectiveTo)<=isoDate(input.effectiveFrom))errors.push('Effective-to must be after effective-from');}catch{errors.push('A valid effective-to date is required');}}
  return{valid:errors.length===0,errors,value:{policyCode:String(input.policyCode||'agent_commission').trim(),currency:String(input.currency||''),
    effectiveFrom:String(input.effectiveFrom||'').slice(0,10),effectiveTo:input.effectiveTo?String(input.effectiveTo).slice(0,10):null,
    triggerMethod,reason:String(input.reason||'').trim(),slabs:checked.slabs}};
}

export function applySocialMediaPayoutBonus(slabs=[],active=false){
  const checked=validatePayoutSlabs(slabs);if(!checked.valid)throw new Error(checked.errors[0]);
  return checked.slabs.map((slab,index)=>({...slab,agentPercent:active&&index<3?percent(slab.agentPercent+5):slab.agentPercent}));
}

export function workingDayDeadline(receiptDate){
  const cursor=isoDate(receiptDate),counted=[];
  while(counted.length<3){cursor.setUTCDate(cursor.getUTCDate()+1);const day=cursor.getUTCDay();if(day!==0&&day!==6)counted.push(cursor.toISOString().slice(0,10));}
  return{receiptDate:commissionDateText(receiptDate),countedWorkingDates:counted,releaseDueDate:counted[2],timezone:'Asia/Dubai',weekendDays:['Saturday','Sunday']};
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
  const receiptDate=contributing.map(x=>isoDate(x.receivedDate).toISOString().slice(0,10)).sort().at(-1),expected=money(expectedCompanyReceipt);
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

// Business wording is "up to": an exact upper boundary remains in the lower
// slab. Ordered lookup resolves the shared boundary to that lower slab.
function containingSlab(slabs,value){return slabs.find(s=>value>=s.lowerAmount&&(s.upperAmount===null||value<=s.upperAmount));}
export function calculateRealtimePayout({agentId,tierAgentId=agentId,dealReference,currency='AED',receiptDate,priorCumulativeAmount=0,currentCreditedAmount,
  priorGrossCommissionAmount=priorCumulativeAmount,currentGrossCommissionAmount=currentCreditedAmount,agentSharePercent=100,
  priorAgentCommissionBasisAmount=priorCumulativeAmount,priorBasePayoutAmount=null,
  triggerMethod,slabs,policyVersionId,adjustmentVersionId=null,socialMediaStatusVersionId=null,socialMediaBonusPercent=0}={}){
  const checked=validatePayoutSlabs(slabs);if(!checked.valid)throw new Error(checked.errors[0]);
  if(!['attained_trigger','progressive_trigger','quarter_achieved_rate'].includes(triggerMethod))throw new Error('A supported payout trigger method is required');
  const priorGross=money(priorGrossCommissionAmount),currentGross=money(currentGrossCommissionAmount),share=percent(agentSharePercent),
    current=money(currentGross*share/100),priorAgentBasis=money(priorAgentCommissionBasisAmount),resultingGross=money(priorGross+currentGross),resultingAgentBasis=money(priorAgentBasis+current);
  if(priorGross<0||!(currentGross>0)||!(current>0)||priorAgentBasis<0||share<=0||share>100)throw new Error('Gross commission, Agent split and payout cumulative amounts are invalid');
  const bands=[];let quarterTrueUpAmount=0;
  if(triggerMethod==='attained_trigger'){
    const slab=containingSlab(checked.slabs,resultingGross);if(!slab)throw new Error('No payout slab covers the resulting cumulative commission');
    const agentPayout=money(current*slab.agentPercent/100);bands.push({...slab,grossPortionAmount:currentGross,portionAmount:current,agentCommissionBasisAmount:current,agentPayoutAmount:agentPayout,companyRetainedAmount:money(current-agentPayout)});
  }else if(triggerMethod==='quarter_achieved_rate'){
    const slab=containingSlab(checked.slabs,resultingGross),priorSlab=priorGross>0?containingSlab(checked.slabs,priorGross):null;if(!slab||priorGross>0&&!priorSlab)throw new Error('No payout slab covers the cumulative commission');
    const slabIndex=checked.slabs.indexOf(slab),priorSlabIndex=priorSlab?checked.slabs.indexOf(priorSlab):-1,
      currentSocialIncrement=socialMediaBonusPercent>0&&slabIndex<3?socialMediaBonusPercent:0,
      priorSocialIncrement=socialMediaBonusPercent>0&&priorSlabIndex>=0&&priorSlabIndex<3?socialMediaBonusPercent:0,
      baseRate=slab.agentPercent-currentSocialIncrement,priorBaseRate=priorSlab?priorSlab.agentPercent-priorSocialIncrement:0,
      priorBasePaid=priorBasePayoutAmount===null?money(priorAgentBasis*priorBaseRate/100):money(priorBasePayoutAmount),
      baseQuarterIncrement=money((priorAgentBasis+current)*baseRate/100-priorBasePaid),socialCurrentPayout=money(current*currentSocialIncrement/100),
      agentPayout=money(baseQuarterIncrement+socialCurrentPayout),baseCurrentPayout=money(current*slab.agentPercent/100);
    if(agentPayout<0)throw new Error('Quarterly achieved-rate calculation cannot reduce a prior payout');
    quarterTrueUpAmount=money(agentPayout-baseCurrentPayout);
    if(quarterTrueUpAmount<0)throw new Error('Quarterly achieved-rate slabs must not reduce as cumulative commission increases');
    bands.push({...slab,grossPortionAmount:currentGross,portionAmount:current,agentCommissionBasisAmount:current,agentPayoutAmount:agentPayout,companyRetainedAmount:money(current-agentPayout)});
  }else{
    for(const slab of checked.slabs){const start=Math.max(priorGross,slab.lowerAmount),end=Math.min(resultingGross,slab.upperAmount??resultingGross);if(end<=start)continue;const grossPortion=money(end-start),agentBasis=money(grossPortion*share/100),agentPayout=money(agentBasis*slab.agentPercent/100);bands.push({...slab,grossPortionAmount:grossPortion,portionAmount:agentBasis,agentCommissionBasisAmount:agentBasis,agentPayoutAmount:agentPayout,companyRetainedAmount:money(agentBasis-agentPayout)});}
    const allocated=money(bands.reduce((sum,x)=>sum+x.grossPortionAmount,0));if(allocated!==currentGross)throw new Error('Progressive payout bands do not cover the complete company gross commission');
  }
  const agentPayoutAmount=money(bands.reduce((sum,x)=>sum+x.agentPayoutAmount,0)),companyRetainedAmount=money(current-agentPayoutAmount),deadline=workingDayDeadline(receiptDate);
  return{policyVersion:COMMISSION_PAYOUT_POLICY_VERSION,calculationBasisVersion:'executing_agent_received_gross_v1',agentId,tierAgentId,dealReference,currency,quarterKey:receiptQuarterKey(receiptDate),priorCumulativeAmount:priorAgentBasis,
    priorGrossCommissionAmount:priorGross,currentGrossCommissionAmount:currentGross,resultingGrossCommissionAmount:resultingGross,agentSharePercent:share,currentCreditedAmount:current,resultingCumulativeAmount:resultingAgentBasis,quarterTrueUpAmount,triggerMethod,policyVersionId,adjustmentVersionId,socialMediaStatusVersionId,socialMediaBonusPercent,bands,
    agentPayoutAmount,companyRetainedAmount,...deadline,resolvedPlanFingerprint:payoutFingerprint({triggerMethod,slabs:checked.slabs,policyVersionId,adjustmentVersionId,socialMediaStatusVersionId,socialMediaBonusPercent}),
    cumulativeContextFingerprint:payoutFingerprint({agentId,tierAgentId,currency,receiptDate,priorGross,priorAgentBasis,currentGross,share,current,dealReference})};
}

export function buildQuarterPayoutStatement(inputRows=[]){
  const ordered=[...inputRows].sort((a,b)=>commissionDateText(a.receiptDate).localeCompare(commissionDateText(b.receiptDate))||String(a.opportunityReference||'').localeCompare(String(b.opportunityReference||''))||String(a.payoutReference||'').localeCompare(String(b.payoutReference||'')));
  const rows=ordered.map((source,index)=>{
    const achievedRate=percent(source.achievedRate||0),socialBonus=percent(source.socialMediaBonusPercent||0),
      baseTierRate=percent(achievedRate-socialBonus),quarterTrueUp=money(source.quarterTrueUpAmount||0),
      commissionAmount=money(Number(source.agentPayoutAmount||0)-quarterTrueUp),releasedAmount=money(source.releasedAmount||0);
    return{...source,index,achievedRate,baseTierRate,commissionAmount,tierAdjustment:0,totalCommission:commissionAmount,alreadyPaid:0,
      releasedAmount,tierChanged:index>0&&baseTierRate>percent(ordered[index-1]?.achievedRate||0)-percent(ordered[index-1]?.socialMediaBonusPercent||0),adjustmentAllocations:[]};
  });
  for(let index=0;index<rows.length;index++){
    const trigger=rows[index],targetAdjustment=money(trigger.quarterTrueUpAmount||0);if(!(targetAdjustment>0))continue;
    let remaining=targetAdjustment;
    for(let priorIndex=0;priorIndex<index&&remaining>0;priorIndex++){
      const prior=rows[priorIndex],alreadyRate=percent(prior.adjustedToBaseRate??prior.baseTierRate),deltaRate=percent(trigger.baseTierRate-alreadyRate);if(!(deltaRate>0))continue;
      const calculated=money(Number(prior.currentCreditedAmount||0)*deltaRate/100),allocated=Math.min(calculated,remaining);
      if(allocated>0){prior.tierAdjustment=money(prior.tierAdjustment+allocated);prior.adjustedToBaseRate=trigger.baseTierRate;trigger.adjustmentAllocations.push({rowIndex:priorIndex,amount:allocated});remaining=money(remaining-allocated);}
    }
    if(remaining!==0)throw new Error('Tier adjustment cannot be reconciled to the earlier Deal rows');
  }
  for(const row of rows)row.totalCommission=money(row.commissionAmount+row.tierAdjustment);
  for(const trigger of rows){
    let paid=Math.min(trigger.releasedAmount,trigger.commissionAmount);trigger.alreadyPaid=money(trigger.alreadyPaid+paid);let remainder=money(trigger.releasedAmount-paid);
    for(const allocation of trigger.adjustmentAllocations){if(remainder<=0)break;const applied=Math.min(allocation.amount,remainder);rows[allocation.rowIndex].alreadyPaid=money(rows[allocation.rowIndex].alreadyPaid+applied);remainder=money(remainder-applied);}
    if(remainder>0)trigger.alreadyPaid=money(trigger.alreadyPaid+remainder);
  }
  for(const row of rows){row.amountDue=money(row.totalCommission-row.alreadyPaid);row.paymentStatus=row.amountDue<=0?'Paid':row.alreadyPaid>0?'Partially paid':String(row.status||'Prepared').replaceAll('_',' ');}
  const totalCommissionEarned=money(rows.reduce((sum,row)=>sum+row.totalCommission,0)),alreadyPaid=money(rows.reduce((sum,row)=>sum+row.alreadyPaid,0)),tierAdjustmentDue=money(rows.reduce((sum,row)=>sum+row.tierAdjustment,0)),toBePaid=money(totalCommissionEarned-alreadyPaid);
  return{rows,summary:{totalCommissionEarned,alreadyPaid,tierAdjustmentDue,toBePaid,status:toBePaid<=0?'Paid':alreadyPaid>0?'Partially paid':'Pending payment'}};
}

export const mayViewPayoutWorkspace=broker=>broker?.jobRole==='director';
export const mayMaintainPayoutPolicy=broker=>broker?.role==='admin';
export const mayDraftPayoutPolicy=broker=>broker?.role==='admin';
