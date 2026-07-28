import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('Release 2 opportunity migration is additive immutable and reconciliation-first',()=>{
  const migrations=readdirSync(join(root,'src','migrations')).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1),'055_release26_transaction_inventory_finance.sql');
  const sql=read('src/migrations/038_release2_opportunity_foundation.sql');
  for(const contract of ['CREATE TABLE opportunities','CREATE TABLE opportunity_stage_history','CREATE TABLE opportunity_attribution','CREATE TABLE opportunity_participants','CREATE TABLE r2_legacy_lead_review','CREATE VIEW r2_opportunity_reconciliation'])assert.match(sql,new RegExp(contract));
  assert.match(sql,/opportunity_attribution_immutable/);
  assert.match(sql,/opportunity_stage_history_immutable/);
  assert.match(sql,/opportunities_r2_1_enabled_stage_ck/);
  assert.match(sql,/prevent_release2_immutable_evidence_mutation/);
  assert.match(sql,/opportunities_open_listing_pursuit_uq/);
  assert.match(sql,/opportunities_open_unselected_pursuit_uq/);
  assert.match(sql,/WHERE stage IN \('Viewing','Negotiation','Won','Lost'\)/);
  assert.doesNotMatch(sql,/UPDATE leads SET stage/i);
  assert.doesNotMatch(sql,/INSERT INTO opportunities[\s\S]*SELECT[\s\S]*FROM leads/i);
});

test('opportunity API requires qualification scope attribution and optimistic concurrency',()=>{
  const routes=read('src/routes/opportunities.js'),domain=read('src/opportunity-domain.js'),server=read('src/server.js');
  assert.match(server,/opportunityRoutes/);
  assert.match(routes,/canCreateOpportunity/);
  assert.match(routes,/current structured requirement is required/);
  assert.match(routes,/recorded qualification assessment is required/);
  assert.match(domain,/genuine opportunity for NYSA to serve/);
  assert.match(routes,/buildOpportunityAttribution/);
  assert.match(routes,/expectedVersion/);
  assert.match(routes,/version=version\+1/);
  assert.match(routes,/automaticConversion:false/);
  assert.match(domain,/Release 2\.3A/);
});

test('opportunity workspace makes the active pursuit primary and preserves the source Lead boundary',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html'),routes=read('src/routes/opportunities.js');
  for(const contract of ['Opportunity pipeline','Opportunity is the active tracking record','Source Lead history','Open opportunity','Create opportunity','Qualification and requirements are complete','Confirm qualification and requirements','Confirm the service opportunity','Set the first customer action','Original attribution · immutable','Legacy lead review ledger','Automatic conversion:','More actions: correct or close Opportunity','Return to Requirements','Close Opportunity as Lost','Historical Lead stage (not an appointment)','No confirmed viewing is recorded in this Opportunity yet','confirmed appointment'])assert.match(ui,new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/openOpportunityWorkspace/);
  assert.match(ui,/data-tab="opportunities">Opportunities/);
  assert.match(ui,/currentTab === 'opportunities' \? renderOpportunities\(\)/);
  assert.match(ui,/function openOpportunityWorkspace\(\)\{switchTab\('opportunities'\);\}/);
  assert.match(ui,/async function renderOpportunities\(\)/);
  assert.match(ui,/class="opportunity-register"/);
  assert.match(ui,/openOpportunityDetail/);
  for(const contract of ['confirmedViewings','confirmed-viewing-summary','Open Viewing &amp; feedback','Schedule another viewing','Confirm another viewing','detailTitle.textContent=opportunity.contactName'])assert.match(ui,new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(ui,/Schedule another property viewing/);
  assert.match(routes,/This viewing is already confirmed\. Review the confirmed viewing before scheduling another/);
  assert.match(ui,/openCreateOpportunity\(lead,listings,o,operatingContext\)/);
  assert.match(ui,/function openCreateOpportunity\(lead,listings,parent,operatingContext\)/);
  assert.match(read('src/routes/crm.js'),/the connected Lead stage is retained as history/);
  assert.match(styles,/\.opportunity-safety-note/);
  assert.match(styles,/\.opportunity-table/);
});

test('governed documents record approved defaults and frozen Release 1.1 behavior',()=>{
  const scope=read('docs/RELEASE_2_SCOPE.md'),decisions=read('docs/DECISIONS.md'),status=read('docs/CURRENT_STATUS.md');
  assert.match(decisions,/D-038/);
  assert.match(scope,/Release 1\.1 compatibility invariant/);
  assert.match(scope,/remains unchanged unless the NYSA owner explicitly/);
  assert.match(status,/R2\.0\/R2\.1 build/);
});
