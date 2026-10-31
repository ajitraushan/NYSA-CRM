import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('DEV247 exposes the governed WEB Intake Leads desk to Admin, Sales Agent and Manager',()=>{
 const app=read('public/app.js'),bootstrap=read('public/bootstrap.js'),role=read('src/role-access.js'),server=read('src/server.js');
 assert.match(app,/data-tab="incomingLeads">WEB Intake Leads/);
 assert.match(app,/\['sales_agent','manager'\]/);
 assert.match(app,/renderIncomingLeads/);
 assert.match(bootstrap,/web-intake-phase1-ui\.js/);
 assert.match(role,/INCOMING_LEADS_TRIAGE:'incoming_leads\.triage'/);
 assert.match(role,/incoming-leads/);
 assert.match(server,/createWebIntakePhase1Routes/);
});

test('DEV247 register provides source, campaign and lifecycle views',()=>{
 const ui=read('public/web-intake-phase1-ui.js'),workflow=read('src/web-intake-workflow.js');
 for(const marker of ['Contact Form','NIA','Meta Instant Forms','Other','All campaigns','Unmapped campaign','No campaign','In progress','Dropped / incomplete','Completed','Assigned','Needs attention','Escalated','Released'])assert.match(ui,new RegExp(marker));
 for(const marker of ['contact_form','nia','meta','campaign_mapping_status','source_campaign_code','chain_root_journey_id'])assert.match(workflow,new RegExp(marker));
 assert.match(workflow,/DISTINCT ON \(j\.chain_root_journey_id\)/);
});

test('DEV247 keeps identity minimized and uses atomic pickup',()=>{
 const ui=read('public/web-intake-phase1-ui.js'),workflow=read('src/web-intake-workflow.js');
 assert.match(workflow,/masked_email/);assert.match(workflow,/masked_phone/);
 assert.doesNotMatch(ui,/received_payload|field_data|encrypted_payload/);
 assert.match(ui,/WhatsApp, email, AI and voice are not active/);
 assert.match(ui,/Pick up/);
 assert.match(ui,/\/crm\/incoming-leads\/\$\{encodeURIComponent\(button\.dataset\.intakePickup\)\}\/pickup/);
 assert.match(workflow,/pg_advisory_xact_lock/);
});

test('DEV246 persists non-customer Meta campaign metadata and maps it to governed campaigns',()=>{
 const migration=read('src/migrations/157_incoming_leads_campaign_register.sql'),meta=read('src/meta-lead-retrieval.js');
 for(const marker of ['external_campaign_code','external_campaign_name','external_adset_code','external_adset_name','external_ad_code','external_ad_name','campaign_mapping_status'])assert.match(migration,new RegExp(marker));
 assert.match(meta,/campaign_id,campaign_name/);
 assert.match(meta,/LOWER\(m\.source_code\)='meta'/);
 assert.match(meta,/campaignMapping\?\.campaign_id/);
 assert.match(meta,/campaign_id\)/);
});
