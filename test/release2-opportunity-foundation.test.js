import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('Release 2 opportunity migration is additive immutable and reconciliation-first',()=>{
  const migrations=readdirSync(join(root,'src','migrations')).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(migrations.at(-1),'043_activity_google_meet.sql');
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
  assert.match(routes,/buildOpportunityAttribution/);
  assert.match(routes,/expectedVersion/);
  assert.match(routes,/version=version\+1/);
  assert.match(routes,/automaticConversion:false/);
  assert.match(domain,/Release 2\.2/);
});

test('opportunity workspace is separate and states the Release 1.1 compatibility boundary',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html');
  for(const contract of ['Opportunity pipeline','Release 1.1 remains unchanged','No lead stage or historical record is converted automatically','Start property opportunity','Ready to start the property search','Confirm the customer requirement','Set the first customer action','Original attribution · immutable','Legacy lead review ledger','Automatic conversion:'])assert.match(ui,new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/openOpportunityWorkspace/);
  assert.match(ui,/openOpportunityDetail/);
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
