import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('DEV246 exposes one governed Incoming Leads workspace to Admin and Manager',()=>{
 const app=read('public/app.js'),bootstrap=read('public/bootstrap.js'),role=read('src/role-access.js'),server=read('src/server.js');
 assert.match(app,/data-tab="incomingLeads">Incoming Leads/);
 assert.match(app,/ME\.jobRole==='manager'/);
 assert.match(app,/renderIncomingLeads/);
 assert.match(bootstrap,/incoming-leads-ui\.js/);
 assert.match(role,/INCOMING_LEADS_TRIAGE:'incoming_leads\.triage'/);
 assert.match(role,/incoming-leads/);
 assert.match(server,/createIncomingLeadsRoutes/);
});

test('DEV246 register provides the agreed source campaign status date and search filters',()=>{
 const ui=read('public/incoming-leads-ui.js'),route=read('src/routes/incoming-leads.js');
 for(const marker of ['Contact Form','NIA','Meta Instant Forms','Other','All campaigns','Unmapped campaign','No campaign','New','Unassigned','Needs review','Failed','Assigned','Today','Last 7 days','Custom dates','Search customer or reference'])assert.match(ui,new RegExp(marker));
 for(const marker of ['contact_form','nia','meta','campaign_mapping_status','governed_campaign_name','source_event_id','lead_reference','Asia/Dubai'])assert.match(route,new RegExp(marker));
 assert.match(route,/DISTINCT ON \(COALESCE\(e\.journey_key,e\.event_id\)\)/);
 assert.match(route,/canManageUnassignedResponses/);
 assert.match(route,/listUnassignedResponseOwners/);
});

test('DEV246 keeps customer details minimized and assignment separated from canonical ownership',()=>{
 const ui=read('public/incoming-leads-ui.js'),route=read('src/routes/incoming-leads.js');
 assert.match(route,/maskEmail/);assert.match(route,/maskPhone/);
 assert.doesNotMatch(ui,/received_payload|field_data|encrypted_payload/);
 assert.match(ui,/does not send WhatsApp, email or AI messages/);
 assert.match(ui,/without changing the canonical Lead owner or team/);
 assert.match(ui,/\/crm\/lead-response\/\$\{encodeURIComponent\(row\.response_case_id\)\}\/assign-owner/);
});

test('DEV246 persists non-customer Meta campaign metadata and maps it to governed campaigns',()=>{
 const migration=read('src/migrations/157_incoming_leads_campaign_register.sql'),meta=read('src/meta-lead-retrieval.js');
 for(const marker of ['external_campaign_code','external_campaign_name','external_adset_code','external_adset_name','external_ad_code','external_ad_name','campaign_mapping_status'])assert.match(migration,new RegExp(marker));
 assert.match(meta,/campaign_id,campaign_name/);
 assert.match(meta,/LOWER\(m\.source_code\)='meta'/);
 assert.match(meta,/campaignMapping\?\.campaign_id/);
 assert.match(meta,/campaign_id\)/);
});
