import test from 'node:test';
import assert from 'node:assert/strict';
import {
  complianceFingerprint,complianceTaskPlan,deriveComplianceState,evaluateComplianceGate,
  normalizeReminderOffsets,resolveComplianceMatrix,transactionFamily,validateComplianceReview,
  validateGenericEvidence,validateRequirementDraft
} from '../src/document-compliance-domain.js';

const rule={id:'rule-v1',requirementId:'rule',status:'active',label:'Buyer identity',transactionFamily:'sale',partyRole:'buyer',partyKind:'individual',gateCode:'before_approval',requirementLevel:'required',evidenceAuthority:'generic_document',reviewRequired:true,expiryMode:'required',reminderOffsetsDays:[0,7,14,30]};
const deal={id:'deal-1',dealType:'sale',version:2,checklistId:'check-1',ownerId:'agent-1'};
const buyer={id:'party-1',partyRole:'buyer',contactId:'contact-1',effectiveFrom:'2026-08-14T00:00:00.000Z'};

test('sale and lease Deal types map to the frozen matrix families',()=>{
  assert.equal(transactionFamily('sale'),'sale');assert.equal(transactionFamily('off_plan'),'sale');assert.equal(transactionFamily('commercial_sale'),'sale');assert.equal(transactionFamily('rental'),'lease');assert.equal(transactionFamily('commercial_rental'),'lease');assert.equal(transactionFamily('other'),null);
});

test('requirement draft accepts exact generic evidence configuration',()=>{
  const result=validateRequirementDraft({requirementCode:'buyer_identity',label:'Buyer identity',businessReason:'Approved identity evidence',transactionFamily:'sale',partyRole:'buyer',partyKind:'individual',gateCode:'before_approval',requirementLevel:'required',evidenceAuthority:'generic_document',documentType:'identity_document',reviewRequired:true,expiryMode:'required',reminderOffsetsDays:[0,7,14,30],effectiveFrom:'2026-08-14T00:00:00Z'});assert.equal(result.valid,true);assert.deepEqual(result.value.reminderOffsetsDays,[0,7,14,30]);
});

test('requirement draft fails closed on mixed generic and official authority',()=>{
  const result=validateRequirementDraft({requirementCode:'buyer_identity',label:'Buyer identity',businessReason:'Approved identity evidence',transactionFamily:'sale',partyRole:'buyer',partyKind:'individual',gateCode:'before_approval',requirementLevel:'required',evidenceAuthority:'generic_document',documentType:'identity_document',officialDefinitionId:'official',officialDefinitionVersionId:'official-v1',expiryMode:'required',reminderOffsetsDays:[0,7],effectiveFrom:'2026-08-14'});assert.equal(result.valid,false);assert.match(result.errors.join(' '),/Generic evidence/);
});

test('reminder offsets normalize, sort and reject unsafe values',()=>{
  assert.deepEqual(normalizeReminderOffsets([30,7,0,14,7]),[0,7,14,30]);assert.equal(normalizeReminderOffsets([-1,7]),null);assert.equal(normalizeReminderOffsets([0,366]),null);
});

test('matrix resolution creates exact party instances and deterministic context',()=>{
  const first=resolveComplianceMatrix({deal,parties:[buyer],requirements:[rule]}),second=resolveComplianceMatrix({deal:{...deal,version:99},parties:[buyer],requirements:[rule]});assert.equal(first.valid,true);assert.equal(first.instances.length,1);assert.equal(first.instances[0].dealPartyId,buyer.id);assert.equal(first.partyContextHash,second.partyContextHash);assert.equal(first.requestFingerprint,second.requestFingerprint);
});

test('matrix resolution reports unpromoted transaction counterparties without an evidence instance',()=>{
  const result=resolveComplianceMatrix({deal,parties:[{id:'party-x',partyRole:'buyer',transactionCounterpartyId:'counterparty-1'}],requirements:[rule]});assert.equal(result.instances.length,0);assert.equal(result.unsupportedParties[0].state,'governed_party_required');
});

test('matrix resolution keeps advisory and required rules separate',()=>{
  const result=resolveComplianceMatrix({deal,parties:[buyer],requirements:[rule,{...rule,id:'rule-v2',requirementId:'rule-2',label:'Buyer address',requirementLevel:'advisory'}]});assert.deepEqual(result.instances.map(x=>x.requirementLevel).sort(),['advisory','required']);
});

test('generic evidence requires valid chronology and idempotency',()=>{
  assert.equal(validateGenericEvidence({requirementInstanceId:'instance',issuedAt:'2026-08-01',expiresAt:'2027-08-01',idempotencyKey:'request-123'},'2026-08-14').valid,true);assert.equal(validateGenericEvidence({requirementInstanceId:'instance',issuedAt:'2026-08-20',idempotencyKey:'short'},'2026-08-14').valid,false);
});

test('review contract requires confirmation and meaningful adverse reason',()=>{
  assert.equal(validateComplianceReview({decision:'accepted',reviewConfirmation:true}).valid,true);assert.equal(validateComplianceReview({decision:'returned',reason:'too short',reviewConfirmation:true}).valid,false);assert.equal(validateComplianceReview({decision:'accepted',reviewConfirmation:false}).valid,false);
});

test('derived generic states cover missing pending accepted and returned',()=>{
  const instance={...rule};assert.equal(deriveComplianceState({instance}),'missing');assert.equal(deriveComplianceState({instance,evidence:{expiresAt:null}}),'pending_review');assert.equal(deriveComplianceState({instance,evidence:{expiresAt:null},review:{decision:'accepted'}}),'accepted');assert.equal(deriveComplianceState({instance,evidence:{expiresAt:null},review:{decision:'returned'}}),'returned');
});

test('derived expiry state moves through expiring and expired',()=>{
  const instance={...rule};assert.equal(deriveComplianceState({instance,evidence:{expiresAt:'2026-08-30'},review:{decision:'accepted'},now:'2026-08-14'}),'expiring');assert.equal(deriveComplianceState({instance,evidence:{expiresAt:'2026-08-14'},review:{decision:'accepted'},now:'2026-08-14'}),'expired');
});

test('official state is consumed rather than copied or recalculated',()=>{
  assert.equal(deriveComplianceState({instance:{...rule,evidenceAuthority:'official_document'},officialState:'accepted'}),'accepted');assert.equal(deriveComplianceState({instance:{...rule,evidenceAuthority:'official_document'},officialState:'pending_review'}),'pending_review');
});

test('context mismatch overrides otherwise accepted evidence',()=>{
  assert.equal(deriveComplianceState({instance:rule,evidence:{},review:{decision:'accepted'},contextMatches:false}),'context_mismatch');
});

test('required incomplete evidence blocks only its exact gate while advisory does not',()=>{
  const blocked=evaluateComplianceGate({gateCode:'before_approval',instances:[{id:'1',label:'Required',partyRole:'buyer',gateCode:'before_approval',requirementLevel:'required',state:'missing'},{id:'2',label:'Advisory',partyRole:'buyer',gateCode:'before_approval',requirementLevel:'advisory',state:'missing'},{id:'3',label:'Later',partyRole:'buyer',gateCode:'before_close_won',requirementLevel:'required',state:'missing'}]});assert.equal(blocked.canProceed,false);assert.equal(blocked.blocking.length,1);assert.equal(evaluateComplianceGate({gateCode:'before_close_won',instances:[{gateCode:'before_close_won',requirementLevel:'required',state:'expiring'}]}).canProceed,true);
});

test('follow-up plan contains safe metadata and existing Task type',()=>{
  const plan=complianceTaskPlan({instance:{label:'Buyer identity',partyRole:'buyer',dealReference:'DEAL-100',responsibleAgentId:'agent-1'},reason:'missing',now:'2026-08-14T00:00:00Z'});assert.equal(plan.taskType,'document_compliance_follow_up');assert.equal(plan.assigneeId,'agent-1');assert.match(plan.subject,/Buyer identity/);assert.doesNotMatch(JSON.stringify(plan),/passport|storage_key|phone|email/i);
});

test('canonical fingerprint is stable across key order',()=>{assert.equal(complianceFingerprint({b:2,a:1}),complianceFingerprint({a:1,b:2}));});
