import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WA_STAGE_B_MAX_IMPORT_ROWS,assertStageBDispatchDisabled,campaignCommand,normalize360dialogTemplates,
  normalizeAudienceSegmentDefinition,normalizeWhatsAppPhone,recipientEligibility,recipientMatchesSegment,
  reviewWhatsAppRecipientRows,templateEligibility
} from '../src/whatsapp-campaign-domain.js';

test('Stage B recipient review requires name and E.164 phone and never invents consent',()=>{
  const result=reviewWhatsAppRecipientRows([{name:'Prospect One',phone:'+971 50 000 0001',email:'ONE@EXAMPLE.TEST',requirements:{businessType:'Sale'}}]);
  assert.equal(result.counts.ready,1);assert.equal(result.rows[0].phone,'+971500000001');assert.equal(result.rows[0].email,'one@example.test');
  assert.equal(result.rows[0].consentStatus,'not_documented');assert.deepEqual(recipientEligibility(result.rows[0]),{eligible:false,reason:'consent_not_documented'});
  assert.throws(()=>reviewWhatsAppRecipientRows(new Array(WA_STAGE_B_MAX_IMPORT_ROWS+1).fill({name:'x',phone:'+971500000001'})),/1 to 5000/);
});

test('Stage B duplicate review identifies within-file and existing matches without merging',()=>{
  const existing=new Map([['+971500000002',{kind:'contact',id:'customer-1'}]]),result=reviewWhatsAppRecipientRows([
    {name:'A',phone:'+971500000001'},{name:'B',phone:'+971500000001'},{name:'C',phone:'+971500000002'}
  ],{existingPhones:existing});
  assert.deepEqual(result.rows.map(row=>row.action),['ready','review_required','review_required']);
  assert.equal(result.rows[1].duplicateInFile,1);assert.equal(result.rows[2].existingMatch.id,'customer-1');
});

test('documented consent requires evidence and STOP state remains ineligible',()=>{
  const invalid=reviewWhatsAppRecipientRows([{name:'A',phone:'+971500000003',consentStatus:'documented'}]);
  assert.equal(invalid.rows[0].action,'invalid');
  assert.deepEqual(recipientEligibility({phone:'+971500000003',consentStatus:'withdrawn',consentEvidenceRef:'evt-1'}),{eligible:false,reason:'suppressed'});
  assert.deepEqual(recipientEligibility({phone:'+971500000003',consentStatus:'documented',consentEvidenceRef:'agreement-1'}),{eligible:true,reason:'eligible'});
});

test('saved audience definitions accept only bounded governed filters',()=>{
  const definition=normalizeAudienceSegmentDefinition({sources:['event'],tagsAny:['investor'],areasAny:['Dubai Marina'],consentStatus:'documented',budgetMin:1000000});
  assert.equal(recipientMatchesSegment({source:'event',tags:['investor'],consentStatus:'documented',requirements:{areas:['Dubai Marina'],budgetMax:2500000}},definition),true);
  assert.equal(recipientMatchesSegment({source:'event',tags:['investor'],consentStatus:'not_documented',requirements:{areas:['Dubai Marina'],budgetMax:2500000}},definition),false);
  assert.throws(()=>normalizeAudienceSegmentDefinition({sql:'1=1'}),/Unsupported segment filter/);
});

test('360dialog template sync normalizes provider state and enforces five-minute freshness',()=>{
  const syncedAt='2026-11-01T08:00:00.000Z',templates=normalize360dialogTemplates({waba_templates:[{id:'t1',name:'nysa_launch',language:'en',status:'APPROVED',category:'MARKETING',components:[]}]},{syncedAt});
  assert.equal(templates[0].status,'approved');
  assert.deepEqual(templateEligibility(templates[0],{now:Date.parse('2026-11-01T08:04:59.000Z')}),{eligible:true,reason:'eligible'});
  assert.deepEqual(templateEligibility(templates[0],{now:Date.parse('2026-11-01T08:05:01.000Z')}),{eligible:false,reason:'template_catalogue_stale'});
});

test('campaign approval preserves Agent draft and Manager or Director review separation',()=>{
  const draft={id:'c1',status:'draft',preparedBy:'agent-1',ownerTeamId:'team-1'};
  const pending=campaignCommand(draft,'submit',{actorId:'agent-1',actorRole:'sales_agent'});assert.equal(pending.status,'pending_approval');
  assert.throws(()=>campaignCommand(pending,'approve',{actorId:'agent-1',actorRole:'sales_agent'}),/Manager or Director/);
  assert.equal(campaignCommand(pending,'approve',{actorId:'manager-1',actorRole:'manager',managedTeamIds:['team-1'],activeApproverCount:2}).status,'approved');
  const self={...pending,preparedBy:'director-1'};
  assert.throws(()=>campaignCommand(self,'approve',{actorId:'director-1',actorRole:'director',activeApproverCount:2}),/Independent reviewer/);
  assert.equal(campaignCommand(self,'approve',{actorId:'director-1',actorRole:'director',activeApproverCount:1}).status,'approved');
});

test('Stage B foundation contains no dispatch implementation',()=>{
  assert.equal(normalizeWhatsAppPhone('0500000001'),null);
  assert.throws(()=>assertStageBDispatchDisabled(),/WA_STAGE_B_DISPATCH_NOT_IMPLEMENTED/);
});
