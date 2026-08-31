import crypto from 'node:crypto';

const clean=value=>String(value??'').trim();
const code=value=>clean(value).toLowerCase();
const date=value=>{const parsed=value?new Date(value):null;return parsed&&!Number.isNaN(parsed.getTime())?parsed:null;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;

export const materialFingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

export function validateMaterialTypeDraft(input={}){
  const value={stableCode:code(input.stableCode),label:clean(input.label),description:clean(input.description),scopeType:code(input.scopeType||'property')};
  const errors=[];
  if(!/^[a-z][a-z0-9_]{2,39}$/.test(value.stableCode))errors.push('Stable material type code must be lowercase snake case');
  if(value.label.length<3)errors.push('Material type label is required');
  if(value.description.length<10)errors.push('Material type description must explain its use');
  if(!['property','corporate','either'].includes(value.scopeType))errors.push('Material scope type is invalid');
  return{valid:!errors.length,errors,value};
}

export function validateChannelRuleDraft(input={}){
  const permitRequirement=code(input.permitRequirement||'none'),approverRoute=code(input.approverRoute||'manager_or_director');
  const value={materialTypeId:clean(input.materialTypeId),materialTypeVersionId:clean(input.materialTypeVersionId),channelCode:code(input.channelCode),regionCode:code(input.regionCode),campaignRequired:Boolean(input.campaignRequired),listingRequired:Boolean(input.listingRequired),approvedMediaRequired:Boolean(input.approvedMediaRequired),permitRequirement,requiredDisclosureCodes:[...new Set((input.requiredDisclosureCodes||[]).map(code).filter(Boolean))].sort(),approverRoute,defaultValidityDays:Number(input.defaultValidityDays||30),expiryReminderDays:[...new Set((input.expiryReminderDays||[]).map(Number))].sort((a,b)=>b-a)};
  const errors=[];
  if(!value.materialTypeId||!value.materialTypeVersionId)errors.push('Material type and exact version are required');
  if(!/^[a-z][a-z0-9_]{1,39}$/.test(value.channelCode))errors.push('Channel code is invalid');
  if(!/^[a-z][a-z0-9_-]{1,39}$/.test(value.regionCode))errors.push('Region code is invalid');
  if(!['none','current_inventory_permit','verified_official_evidence','either'].includes(permitRequirement))errors.push('Permit requirement is invalid');
  if(!['manager','director','manager_or_director'].includes(approverRoute))errors.push('Approver route is invalid');
  if(!Number.isInteger(value.defaultValidityDays)||value.defaultValidityDays<1||value.defaultValidityDays>366)errors.push('Default validity must be 1 to 366 days');
  if(value.expiryReminderDays.some(x=>!Number.isInteger(x)||x<0||x>365))errors.push('Expiry reminders must be 0 to 365 days');
  return{valid:!errors.length,errors,value};
}

export function resolveMaterialApprover({route,submitterId,managerId,directorId,selectedApproverId}){
  const allowed=route==='manager'?[managerId]:route==='director'?[directorId]:[managerId,directorId];
  const approverId=selectedApproverId||allowed.find(Boolean);
  if(!['manager','director','manager_or_director'].includes(route))throw new Error('Active approval route is invalid');
  if(!approverId||!allowed.filter(Boolean).includes(approverId))throw new Error('Selected approver is not eligible for this route');
  if(approverId===submitterId)throw new Error('Self-approval is prohibited for Manager and Director submissions');
  return{approverId,approverRole:approverId===directorId?'director':'manager',routingReason:`configured_${route}`};
}

export function mayReviewMaterial({broker,request,submitterId}){
  if(!broker||!request)return false;
  if(broker.role==='admin')return true;
  if(broker.id===submitterId||broker.id!==request.assignedApproverId)return false;
  if(request.assignedApproverRole==='director')return broker.jobRole==='director';
  return request.assignedApproverRole==='manager'&&broker.jobRole==='manager'&&(!request.assignedTeamId||(broker.managedTeamIds||[]).map(String).includes(String(request.assignedTeamId)));
}

export function evaluateMaterialPreflight({rule,material,documentVersion,media=[],officialEvidence=[],permit,disclosureCodes=[],now=Date.now()}){
  const blockers=[],current=value=>!value||Date.parse(value)>now;
  if(!rule||rule.status!=='active')blockers.push('active_rule_required');
  if(!documentVersion||documentVersion.immutable!==1)blockers.push('immutable_final_document_required');
  if(rule?.listingRequired&&!material?.listingId)blockers.push('listing_required');
  if(rule?.campaignRequired&&!material?.campaignId)blockers.push('campaign_required');
  if(rule?.approvedMediaRequired&&!media.length)blockers.push('approved_media_required');
  for(const item of media)if(item.approvalStatus!=='approved'||!item.usageRightsConfirmed||!current(item.rightsExpiresAt))blockers.push('media_rights_not_current');
  const disclosures=new Set(disclosureCodes.map(code));for(const required of rule?.requiredDisclosureCodes||[])if(!disclosures.has(code(required)))blockers.push(`disclosure_missing:${code(required)}`);
  const permitCurrent=Boolean(permit?.reference)&&current(permit?.expiresAt),officialCurrent=officialEvidence.some(item=>item.reviewDecision==='verified'&&current(item.expiresAt));
  if(rule?.permitRequirement==='current_inventory_permit'&&!permitCurrent)blockers.push('current_inventory_permit_required');
  if(rule?.permitRequirement==='verified_official_evidence'&&!officialCurrent)blockers.push('verified_official_evidence_required');
  if(rule?.permitRequirement==='either'&&!permitCurrent&&!officialCurrent)blockers.push('current_permit_or_official_evidence_required');
  return{canSubmit:!blockers.length,blockers:[...new Set(blockers)]};
}

export function effectiveReleaseUntil({approvedAt,requestedReleaseUntil,defaultValidityDays=30,campaignEndsAt,mediaRightsExpiries=[],permitExpiresAt,officialEvidenceExpiries=[]}){
  const approved=date(approvedAt);if(!approved)throw new Error('Approval time is required');
  const defaultEnd=new Date(approved.getTime()+Number(defaultValidityDays)*86400000);
  const candidates=[requestedReleaseUntil,defaultEnd,campaignEndsAt,...mediaRightsExpiries,permitExpiresAt,...officialEvidenceExpiries].map(date).filter(Boolean);
  return new Date(Math.min(...candidates.map(x=>x.getTime()))).toISOString();
}

export function deriveReleaseEligibility({reviewStatus,releaseFrom,releaseUntil,dependenciesCurrent=true,withdrawn=false,now=Date.now()}){
  if(withdrawn||reviewStatus==='withdrawn')return{status:'withdrawn',reason:'withdrawn'};
  if(reviewStatus!=='approved')return{status:'blocked',reason:'channel_not_approved'};
  if(!dependenciesCurrent)return{status:'stale',reason:'dependency_changed'};
  const start=date(releaseFrom),end=date(releaseUntil);
  if(start&&start.getTime()>now)return{status:'scheduled',reason:'release_window_not_started'};
  if(end&&end.getTime()<=now)return{status:'expired',reason:'release_window_ended'};
  return{status:'released_for_use',reason:'all_current_checks_passed'};
}

export function aggregateMaterialStatus(statuses=[]){
  if(statuses.length&&statuses.every(x=>x==='approved'))return'approved';
  if(statuses.some(x=>x==='approved'))return'partially_approved';
  if(statuses.some(x=>x==='pending'))return'submitted';
  if(statuses.some(x=>x==='returned'))return'returned';
  if(statuses.length&&statuses.every(x=>['rejected','withdrawn'].includes(x)))return statuses.every(x=>x==='withdrawn')?'withdrawn':'rejected';
  return'submitted';
}

export function validateReviewDecision(input={}){
  const value={decision:code(input.decision),reason:clean(input.reason)};const errors=[];
  if(!['approved','returned','rejected','withdrawn'].includes(value.decision))errors.push('Review decision is invalid');
  if(value.decision!=='approved'&&value.reason.length<5)errors.push('A meaningful decision reason is required');
  return{valid:!errors.length,errors,value,requestFingerprint:materialFingerprint(value)};
}
