import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayMetaStatus,normalizeSegmentDraft,recipientDecision,validateCampaignDraft,validateMaterialDraft,validateRecipientImport,validateTemplateDraft,workspaceHash} from '../src/whatsapp-workspace-domain.js';

test('template drafts require declared variables and remain number-independent',()=>{
  const valid=validateTemplateDraft({name:'Project brochure follow-up',languageCode:'en_US',category:'marketing',bodyText:'Hello {{name}}, here is {{project_name}}.',variableNames:['name','project_name']});
  assert.equal(valid.valid,true);assert.equal(valid.contentHash.length,64);
  assert.deepEqual(validateTemplateDraft({name:'Test',languageCode:'en',category:'marketing',bodyText:'Hello {{name}}',variableNames:[]}).errors,['Declare template variable: name']);
  assert.equal(displayMetaStatus('not_submitted'),'Not submitted');
});

test('materials, segments and draft campaigns are validated without dispatch data',()=>{
  assert.equal(validateMaterialDraft({title:'Marina floor plans',materialType:'floor_plan'}).valid,true);
  const segment=normalizeSegmentDraft({name:'Marina documented consent',definition:{areasAny:['Dubai Marina'],consentStatus:'documented'}});
  assert.equal(segment.valid,true);assert.deepEqual(segment.value.definition.areasAny,['Dubai Marina']);
  const campaign=validateCampaignDraft({name:'Marina launch',purpose:'Share approved project details',segmentId:'segment',templateVersionId:'template',materialIds:['one','one','two']});
  assert.equal(campaign.valid,true);assert.deepEqual(campaign.value.materialIds,['one','two']);assert.equal('send' in campaign.value,false);
});

test('recipient CSV rows require name and E.164 phone and duplicates require decisions',()=>{
  const existingPhones=new Map([['+971561066469',{kind:'customer',id:'customer-1',reference:'NYSA-CUS-1'}]]),review=validateRecipientImport({originalFileName:'review.csv',existingPhones,rows:[{name:'Test Customer',phone:'+971 56 106 6469',consentStatus:'documented',consentEvidenceRef:'signed-form'},{name:'Invalid',phone:'0561066469'}]});
  assert.equal(review.valid,true);assert.equal(review.review.rows[0].action,'review_required');assert.equal(review.review.rows[1].action,'invalid');
  assert.match(recipientDecision(review.review.rows[0],{}).error,/choose Link/);
  assert.deepEqual(recipientDecision(review.review.rows[0],{disposition:'linked'}),{include:true,disposition:'linked',error:null});
});

test('workspace hash is stable across object key order',()=>{
  assert.equal(workspaceHash({b:2,a:1}),workspaceHash({a:1,b:2}));
});

test('DEV258 route and UI expose no send or Meta-submission action',()=>{
  const route=fs.readFileSync(new URL('../src/routes/whatsapp-workspace.js',import.meta.url),'utf8'),ui=fs.readFileSync(new URL('../public/whatsapp-workspace-ui.js',import.meta.url),'utf8'),migration=fs.readFileSync(new URL('../src/migrations/162_whatsapp_stage_b_workspaces.sql',import.meta.url),'utf8');
  assert.doesNotMatch(route,/\/send(?:['"/]|$)|submit-to-meta|provider-template/i);
  assert.doesNotMatch(ui,/data-(?:send|meta-submit)|Send campaign|Submit to Meta/i);
  assert.match(ui,/Sending: unavailable/);assert.match(ui,/Meta: Not submitted/);
  assert.match(migration,/no provider-dispatch or provider-submission path/i);
});
