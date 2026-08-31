import crypto from 'node:crypto';
import { fundingPaymentCompatibility } from './inventory-domain.js';

export const MATCHING_COMPLETION_POLICY_VERSION='r3b-operational-eligibility-fit-ranking-v3';
export const MATCHING_CANDIDATE_STATES=['eligible','needs_clarification','excluded'];
export const DECLARATION_KINDS=['must_have','exclusion','preference','acceptable_trade_off'];
export const ASSESSMENT_RESULTS=['met','not_met','missing','not_assessed'];
export const ASSESSMENT_EVIDENCE_KINDS=['inventory_fact','customer_confirmation','broker_review'];

// This is the single field contract consumed by both the evaluator and the SQL
// projection builder. Adding a governed fact here makes it available at every
// eligibility boundary; endpoint-specific SELECT lists are deliberately banned.
export const INVENTORY_EVALUATOR_FIELD_COLUMNS=Object.freeze({
  id:'id',inventoryReference:'inventory_reference',project:'project',currency:'currency',deletedAt:'deleted_at',workflowStatus:'workflow_status',
  verificationStatus:'verification_status',verificationExpiresAt:'verification_expires_at',
  availabilityConfirmedAt:'availability_confirmed_at',availabilityExpiresAt:'availability_expires_at',transactionTypes:'transaction_types',price:'price',
  sizeSqft:'size_sqft',area:'area',community:'community',propertyType:'property_type',bedrooms:'bedrooms',
  paymentPlanType:'payment_plan_type',handoverStatus:'handover_status'
});
export const INVENTORY_ELIGIBILITY_FIELDS=Object.freeze([
  'id','inventoryReference','deletedAt','workflowStatus','verificationStatus','effectiveStatus',
  'verificationExpiresAt','availabilityConfirmedAt','availabilityExpiresAt','transactionTypes','price','sizeSqft'
]);
export const INVENTORY_RANKING_FIELDS=Object.freeze([
  'area','community','propertyType','bedrooms','sizeSqft','price','paymentPlanType','handoverStatus'
]);
export function inventoryEvaluatorProjection(alias='l'){
  const table=String(alias||'').trim();
  if(!/^[a-z][a-z0-9_]*$/i.test(table))throw new Error('Unsafe Inventory SQL alias');
  const columns=Object.values(INVENTORY_EVALUATOR_FIELD_COLUMNS).map(column=>`${table}.${column}`);
  return [`${table}.status AS stored_status`,...columns,
    `nysa_inventory_effective_status(${table}.id) AS effective_status`,
    `nysa_inventory_effective_status(${table}.id) AS status`].join(',');
}
export function inventoryEvaluatorFacts(listing={}){
  const facts={};
  for(const field of new Set([...INVENTORY_ELIGIBILITY_FIELDS,...INVENTORY_RANKING_FIELDS]))facts[field]=listing[field];
  return facts;
}

const norm=value=>String(value??'').trim().toLocaleLowerCase();
const has=value=>value!==null&&value!==undefined&&value!==''&&(!Array.isArray(value)||value.length>0);
const number=value=>has(value)&&Number.isFinite(Number(value))?Number(value):null;
const bedroomNumber=value=>norm(value)==='studio'?0:Number.parseInt(value,10);
export const stableHash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function declarationHash(kind,index,text){return stableHash({kind,index,text:String(text||'').trim()});}

export function currentAssessmentMap(assessments=[]){
  const map=new Map();
  for(const item of assessments){const key=`${item.declarationKind}:${item.declarationIndex}`,prior=map.get(key);
    if(!prior||Number(item.sequenceNo)>Number(prior.sequenceNo))map.set(key,item);}
  return map;
}

export function declarationAssessmentReadiness(requirement={},assessments=[]){
  const current=currentAssessmentMap(assessments),items=[];
  for(const [kind,key] of [['must_have','mustHaves'],['exclusion','exclusions'],['preference','preferences'],['acceptable_trade_off','acceptableTradeOffs']]){
    (requirement[key]||[]).forEach((text,index)=>{const assessment=current.get(`${kind}:${index}`)||null;items.push({kind,index,text,hash:declarationHash(kind,index,text),assessment});});
  }
  const blockers=items.filter(item=>(item.kind==='must_have'&&(!item.assessment||item.assessment.result!=='met'))||(item.kind==='exclusion'&&(!item.assessment||item.assessment.result!=='not_met')));
  return{items,blockers,assessmentComplete:blockers.length===0,promotionReady:true};
}

export function evaluateInventoryEligibilityV2({listing={},requirement={},opportunityTransactionType=null,assessments=[],checkedAt=new Date().toISOString()}={}){
  const facts=inventoryEvaluatorFacts(listing),excluded=[],missing=[],advisories=[],at=new Date(checkedAt),transactionType=opportunityTransactionType||requirement.businessLine||null;
  const fail=(code,label,evidence)=>excluded.push({code,state:'not_met',label,evidence});
  const clarify=(code,label,evidence)=>missing.push({code,state:'missing',label,evidence});
  if(facts.deletedAt)fail('deleted','Inventory record is deleted');
  if(facts.workflowStatus!=='approved')fail('workflow_not_approved','Inventory workflow is not approved',facts.workflowStatus||null);
  if(!['verified','not_required'].includes(facts.verificationStatus))fail('verification_not_trusted','Inventory verification is not trusted',facts.verificationStatus||null);
  const effectiveStatus=facts.effectiveStatus;
  if(!effectiveStatus)clarify('effective_status_missing','Canonical Inventory status could not be derived');
  if(['Closed','Sold','Rented'].includes(effectiveStatus))fail('not_available',`Inventory status is ${effectiveStatus}`,effectiveStatus);
  if(facts.verificationExpiresAt&&new Date(facts.verificationExpiresAt)<=at)fail('verification_expired','Inventory verification has expired',facts.verificationExpiresAt);
  if(facts.availabilityExpiresAt&&new Date(facts.availabilityExpiresAt)<=at)fail('availability_expired','The recorded availability confirmation has expired',facts.availabilityExpiresAt);
  advisories.push({code:'availability_confirmation',state:'advisory',label:facts.availabilityConfirmedAt?'Reconfirm likely availability before assigning':'Availability has not previously been confirmed; confirm likely availability before assigning',evidence:facts.availabilityConfirmedAt||null});
  const transactionTypes=Array.isArray(facts.transactionTypes)?facts.transactionTypes:[];
  if(!transactionTypes.length)clarify('transaction_type_missing','Inventory transaction type must be confirmed');
  else if(transactionType&&!transactionTypes.includes(transactionType))fail('transaction_type_mismatch',`Inventory is not maintained for ${transactionType}`,transactionTypes);
  const maxBudget=number(requirement.budgetMax),price=number(facts.price);
  if(maxBudget!==null&&price!==null&&price>maxBudget)advisories.push({code:'budget_above_recorded_maximum',state:'variance',label:'Inventory price exceeds the currently recorded maximum budget; retain for deliberate customer review',evidence:{maximum:maxBudget,price,difference:price-maxBudget}});
  if((number(requirement.sizeSqftMin)!==null||number(requirement.sizeSqftMax)!==null)&&number(facts.sizeSqft)===null)advisories.push({code:'size_information_missing',state:'advisory',label:'Inventory size is not recorded; rank with missing evidence and confirm before commitment'});
  const readiness=declarationAssessmentReadiness(requirement,assessments);
  for(const blocker of readiness.blockers)advisories.push({code:`${blocker.kind}_fit_variance`,state:'variance',label:`${blocker.kind.replaceAll('_',' ')} is unconfirmed or not matched; retain for ranking and broker/customer review`,evidence:{index:blocker.index,hash:blocker.hash,result:blocker.assessment?.result||'not_assessed'}});
  const state=excluded.length?'excluded':missing.length?'needs_clarification':'eligible',reasons=[...excluded,...missing];
  const evidence={listingId:facts.id||null,inventoryReference:facts.inventoryReference||null,transactionType,transactionTypes,availabilityConfirmedAt:facts.availabilityConfirmedAt||null,availabilityExpiresAt:facts.availabilityExpiresAt||null,verificationStatus:facts.verificationStatus||null,status:effectiveStatus||null,reasons};
  return{policyVersion:MATCHING_COMPLETION_POLICY_VERSION,state,eligible:state==='eligible',reasons,advisories,checkedAt:new Date(checkedAt).toISOString(),evidence,evidenceHash:stableHash({policyVersion:MATCHING_COMPLETION_POLICY_VERSION,checkedAt:new Date(checkedAt).toISOString(),evidence,advisories})};
}

function component(code,label,weight,state,expected,actual,interpretation=null){return{code,label,weight,state,pass:state==='met',points:state==='met'?weight:0,expected,actual,interpretation};}

export function scoreInventoryCandidateV2(requirement={},listing={},assessments=[]){
  const facts=inventoryEvaluatorFacts(listing),criteria=[],minBudget=number(requirement.budgetMin),maxBudget=number(requirement.budgetMax),price=number(facts.price);
  const budgetState=price===null?'missing':minBudget===null&&maxBudget===null?'not_assessed':maxBudget!==null&&price>maxBudget?'not_met':'met',
    budgetInterpretation=budgetState==='met'&&minBudget!==null&&price<minBudget?'Below the stated target range but within affordability; broker/customer review remains visible.':budgetState==='met'?'Within the confirmed affordability ceiling.':null;
  criteria.push(component('budget','Budget',25,budgetState,[minBudget,maxBudget],price,budgetInterpretation));
  const areas=(requirement.areas||[]).map(norm);criteria.push(component('area_community','Area / Community',20,!areas.length?'not_assessed':!has(facts.area)&&!has(facts.community)?'missing':areas.includes(norm(facts.area))||areas.includes(norm(facts.community))?'met':'not_met',requirement.areas||[],facts.community||facts.area||null));
  const types=(requirement.propertyTypes||[]).map(norm);criteria.push(component('property_type','Property type',15,!types.length?'not_assessed':!has(facts.propertyType)?'missing':types.includes(norm(facts.propertyType))?'met':'not_met',requirement.propertyTypes||[],facts.propertyType||null));
  const bedrooms=bedroomNumber(facts.bedrooms),minBedrooms=number(requirement.bedroomsMin),maxBedrooms=number(requirement.bedroomsMax);criteria.push(component('bedrooms','Bedrooms',15,!Number.isFinite(bedrooms)?'missing':minBedrooms===null&&maxBedrooms===null?'not_assessed':(minBedrooms===null||bedrooms>=minBedrooms)&&(maxBedrooms===null||bedrooms<=maxBedrooms)?'met':'not_met',[minBedrooms,maxBedrooms],facts.bedrooms||null));
  const size=number(facts.sizeSqft),minSize=number(requirement.sizeSqftMin),maxSize=number(requirement.sizeSqftMax);criteria.push(component('size','Size',10,size===null?'missing':minSize===null&&maxSize===null?'not_assessed':(minSize===null||size>=minSize)&&(maxSize===null||size<=maxSize)?'met':'not_met',[minSize,maxSize],size));
  const funding=fundingPaymentCompatibility(requirement.fundingMethod,facts.paymentPlanType);criteria.push(component('funding_payment','Funding / payment',5,funding.code==='not_assessed'?'not_assessed':funding.compatible?'met':'not_met',requirement.fundingMethod||null,facts.paymentPlanType||null));
  const timelineState=!has(requirement.timelineCode)||!has(facts.handoverStatus)?'not_assessed':norm(requirement.timelineCode).includes('0_3')&&facts.handoverStatus!=='ready'?'not_met':'met';criteria.push(component('timeline_handover','Timeline / handover',5,timelineState,requirement.timelineCode||null,facts.handoverStatus||null));
  const readiness=declarationAssessmentReadiness(requirement,assessments),declarations=readiness.items,
    assessedDeclarations=declarations.filter(x=>x.assessment&&!['missing','not_assessed'].includes(x.assessment.result)),
    favourableDeclarations=assessedDeclarations.filter(x=>x.kind==='exclusion'?x.assessment.result==='not_met':x.assessment.result==='met');
  criteria.push(component('customer_declarations','Customer declarations',5,!declarations.length?'not_assessed':assessedDeclarations.length<declarations.length?'not_assessed':favourableDeclarations.length===declarations.length?'met':'not_met',declarations.length,{assessed:assessedDeclarations.length,favourable:favourableDeclarations.length}));
  const score=criteria.reduce((sum,item)=>sum+item.points,0),missingCount=criteria.filter(item=>['missing','not_assessed'].includes(item.state)).length;
  return{score,missingCount,fitLabel:score>=80?'Strong fit':score>=60?'Partial fit':'Outside key requirements',criteria,readiness};
}

export function validateCandidateAssessment(body={}){
  const declarationKind=body.declarationKind,declarationIndex=Number(body.declarationIndex),result=body.result,evidenceKind=body.evidenceKind,
    evidenceReference=typeof body.evidenceReference==='string'&&body.evidenceReference.trim()?body.evidenceReference.trim():null,
    assessmentNotes=typeof body.assessmentNotes==='string'&&body.assessmentNotes.trim()?body.assessmentNotes.trim():null,
    expectedPreviousAssessmentId=typeof body.expectedPreviousAssessmentId==='string'&&body.expectedPreviousAssessmentId.trim()?body.expectedPreviousAssessmentId.trim():null;
  if(!DECLARATION_KINDS.includes(declarationKind))return{error:'Select a valid declaration type'};
  if(!Number.isInteger(declarationIndex)||declarationIndex<0)return{error:'Select a valid declaration'};
  if(!ASSESSMENT_RESULTS.includes(result))return{error:'Select met, not met, missing or not assessed'};
  if(!ASSESSMENT_EVIDENCE_KINDS.includes(evidenceKind))return{error:'Select a valid assessment evidence type'};
  if(!assessmentNotes)return{error:'Assessment notes are required'};
  if(assessmentNotes.length>1000)return{error:'Assessment notes must be 1,000 characters or fewer'};
  return{value:{declarationKind,declarationIndex,result,evidenceKind,evidenceReference,assessmentNotes,expectedPreviousAssessmentId}};
}

export function validateGovernedPromotion(body={}){
  const expectedOpportunityVersion=Number(body.expectedOpportunityVersion),requestId=String(body.requestId||'').trim(),selections=Array.isArray(body.selections)?body.selections:[];
  if(!Number.isInteger(expectedOpportunityVersion)||expectedOpportunityVersion<1)return{error:'The current Opportunity version is required'};
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))return{error:'A valid request ID is required'};
  if(!selections.length||selections.length>6)return{error:'Select one to six reviewed properties'};
  const normalized=selections.map(item=>({runId:String(item.runId||''),candidateId:String(item.candidateId||''),shortlistDecisionId:String(item.shortlistDecisionId||'')}));
  if(normalized.some(item=>!item.runId||!item.candidateId||!item.shortlistDecisionId))return{error:'Every selection requires its exact run, candidate and shortlist decision'};
  if(new Set(normalized.map(item=>item.candidateId)).size!==normalized.length)return{error:'A candidate may be selected only once'};
  return{value:{expectedOpportunityVersion,requestId,selections:normalized}};
}
