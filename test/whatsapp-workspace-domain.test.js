import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayMetaStatus,normalizeMetaTemplateName,normalizeSegmentDraft,recipientDecision,validateCampaignDraft,validateMaterialDraft,validateRecipientImport,validateTemplateDraft,workspaceHash} from '../src/whatsapp-workspace-domain.js';
import {classifyWhatsAppSuppression,normalizeAudienceSegmentDefinition,recipientMatchesSegment,uniqueSegmentPhoneCount} from '../src/whatsapp-campaign-domain.js';

test('template drafts require declared variables and remain number-independent',()=>{
  const valid=validateTemplateDraft({name:'project_brochure_follow_up',languageCode:'en_US',category:'marketing',headerType:'text',headerText:'Hello {{name}}',bodyText:'Here are the approved details for {{project_name}} today.',variableNames:['name','project_name'],variableSamples:{name:'Amal',project_name:'Marina Vista'},buttons:[{type:'quick_reply',text:'Send brochure'},{type:'url',text:'View project',url:'https://nysarealty.com/go/{{1}}',sampleValue:'marina_vista'}]});
  assert.equal(valid.valid,true);assert.equal(valid.contentHash.length,64);
  assert.ok(valid.value.buttons.some(button=>button.type==='quick_reply'&&button.text==='Stop promotions'));
  assert.ok(validateTemplateDraft({name:'test',languageCode:'en',category:'marketing',bodyText:'Hello {{name}}',variableNames:[]}).errors.includes('Declare template variable: name'));
  assert.equal(displayMetaStatus('not_submitted'),'Not submitted');
});

test('template components enforce Meta-ready names, counters, samples, media and buttons',()=>{
  const invalid=validateTemplateDraft({name:'Project Launch',languageCode:'en',category:'marketing',headerType:'image',bodyText:'Hello {{name}}',variableNames:['name'],variableSamples:{name:''},buttons:[{type:'url',text:'This button label is much too long',url:'http://example.com/{{1}}/bad'}]});
  assert.equal(invalid.valid,false);
  assert.equal(invalid.value.name,'project_launch');
  assert.equal(normalizeMetaTemplateName('  Marina Project--Launch 2026! '),'marina_project_launch_2026');
  assert.ok(invalid.errors.includes('Select header media from the Materials catalogue'));
  assert.ok(invalid.errors.includes('Sample value is required for variable: name'));
  assert.ok(invalid.errors.includes('Button text must not exceed 25 characters'));
  assert.ok(invalid.errors.includes('The dynamic URL variable {{1}} must be at the end'));
  assert.ok(invalid.errors.includes('URL buttons must use HTTPS'));
  assert.equal(validateTemplateDraft({name:'valid_name',languageCode:'en',category:'marketing',bodyText:'12345',buttons:[{type:'url',text:'One',url:'https://nysarealty.com/one'},{type:'url',text:'Two',url:'https://nysarealty.com/two'},{type:'url',text:'Three',url:'https://nysarealty.com/three'}]}).errors.includes('A template may contain at most 2 URL buttons'),true);
  assert.equal(validateTemplateDraft({name:'valid_name',languageCode:'en',category:'utility',bodyText:'Please call us.',buttons:[{type:'phone_number',text:'Call NYSA',phoneNumber:'+97145550000'}]}).valid,true);
});

test('materials, segments and draft campaigns are validated without dispatch data',()=>{
  assert.equal(validateMaterialDraft({title:'Marina floor plans',materialType:'floor_plan'}).valid,true);
  const segment=normalizeSegmentDraft({name:'Marina verified consent',definition:{areasAny:['Dubai Marina'],transactionTypes:['Sale'],bedroomsMin:1.5,bedroomsMax:2.5,consentStatus:'verified'}});
  assert.equal(segment.valid,true);assert.deepEqual(segment.value.definition.areasAny,['Dubai Marina']);
  assert.equal(recipientMatchesSegment({phone:'+971500000001',consentStatus:'verified',requirements:{areas:['Dubai Marina'],transactionType:'Sale',bedrooms:2.5}},segment.value.definition),true);
  assert.equal(uniqueSegmentPhoneCount([{phone:'+971500000001',consentStatus:'verified',requirements:{areas:['Dubai Marina'],transactionType:'Sale',bedrooms:2.5}},{phone:'+971500000001',consentStatus:'verified',requirements:{areas:['Dubai Marina'],transactionType:'Sale',bedrooms:2.5}}],segment.value.definition),1);
  assert.deepEqual(normalizeAudienceSegmentDefinition({businessTypes:['Rental']}).transactionTypes,['Rental']);
  assert.equal(classifyWhatsAppSuppression('UNSUBSCRIBE'),'opt_out');
  assert.equal(classifyWhatsAppSuppression('إلغاء الاشتراك'),'opt_out');
  assert.equal(classifyWhatsAppSuppression('wrong number'),'wrong_number');
  const campaign=validateCampaignDraft({name:'Marina launch',purpose:'Share approved project details',segmentId:'segment',templateVersionId:'template',materialIds:['one','one','two'],scheduledAt:'2026-11-24T10:00:00+04:00',budgetAed:500});
  assert.equal(campaign.valid,true);assert.deepEqual(campaign.value.materialIds,['one','two']);assert.equal('send' in campaign.value,false);
});

test('recipient CSV rows require name and E.164 phone and duplicates require decisions',()=>{
  const existingPhones=new Map([['+971561066469',{kind:'customer',id:'customer-1',reference:'NYSA-CUS-1'}]]),review=validateRecipientImport({originalFileName:'review.xlsx',existingPhones,rows:[{name:'Test Customer',phone:'+971 56 106 6469',consentStatus:'verified',consentEvidenceRef:'signed-form'},{name:'Invalid',phone:'0561066469'}]});
  assert.equal(review.valid,true);assert.equal(review.review.rows[0].action,'review_required');assert.equal(review.review.rows[1].action,'invalid');
  assert.match(recipientDecision(review.review.rows[0],{}).error,/choose Link/);
  assert.deepEqual(recipientDecision(review.review.rows[0],{disposition:'linked'}),{include:true,disposition:'linked',error:null});
});

test('workspace hash is stable across object key order',()=>{
  assert.equal(workspaceHash({b:2,a:1}),workspaceHash({a:1,b:2}));
});

test('DEV259a route and UI expose governed WhatsApp workspaces without send, Meta submission or DEV259b calling',()=>{
  const route=fs.readFileSync(new URL('../src/routes/whatsapp-workspace.js',import.meta.url),'utf8'),ui=fs.readFileSync(new URL('../public/whatsapp-workspace-ui.js',import.meta.url),'utf8'),componentMigration=fs.readFileSync(new URL('../src/migrations/163_whatsapp_template_components.sql',import.meta.url),'utf8'),workspaceMigration=fs.readFileSync(new URL('../src/migrations/164_whatsapp_dev259a_workspaces.sql',import.meta.url),'utf8'),correctionMigration=fs.readFileSync(new URL('../src/migrations/165_whatsapp_dev259a_review_corrections.sql',import.meta.url),'utf8');
  assert.doesNotMatch(route,/\/send(?:['"/]|$)|submit-to-meta|provider-template/i);
  assert.doesNotMatch(ui,/data-(?:send|meta-submit)|Send campaign|Submit to Meta/i);
  assert.match(ui,/Sending: unavailable/);assert.match(ui,/Meta: Not submitted/);
  assert.match(ui,/Live WhatsApp preview/);assert.match(ui,/maxlength="1024"/);assert.match(ui,/https:\/\/nysarealty\.com\/go\/\{\{1\}\}/);assert.match(ui,/Conversation inbox/);assert.match(ui,/\.xlsx/);
  assert.match(ui,/Meta name: <code data-normalized-template-name>/);assert.match(ui,/spaces and unsupported characters are converted to underscores/);
  assert.match(route,/team_memberships tm/);assert.match(route,/user_role_assignments ur/);
  assert.match(route,/\['manager','director'\]\.includes\(req\.broker\.jobRole\)/);
  assert.match(ui,/teams\.length===1\?teams\[0\]\.id/);
  assert.match(componentMigration,/no provider submission or message dispatch capability/i);
  assert.match(workspaceMigration,/retention_expires_at TIMESTAMPTZ NOT NULL/);
  assert.match(workspaceMigration,/wa_conversation_assignment_history/);
  assert.doesNotMatch(workspaceMigration,/CREATE TABLE\s+(?:\w*dispatch\w*|\w*provider_message\w*|\w*outbound_job\w*)/i);
  assert.match(correctionMigration,/wa_campaign_approval_recipients/);
  assert.match(correctionMigration,/wa_contact_suppressions/);
  assert.doesNotMatch(`${route}\n${ui}\n${correctionMigration}`,/simulated calling|DEV259b|CAL0[1-4]|initiate-call|call campaign/i);
});
