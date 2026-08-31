import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('DEF-092 opens all six Opportunity stages as focused pages with explicit actions',()=>{
  const app=read('public/app.js'),css=read('public/index.html');
  for(const stage of ['inventory','viewing','offer','negotiation','booking','deal']){
    assert.match(app,new RegExp(`${stage}:'`));
  }
  for(const marker of ['opportunity-stage-page','Back to Opportunity','Save as draft','Draft history','data-stage-save','showFlowStep=step','Open one stage at a time'])assert.match(app,new RegExp(marker));
  assert.match(css,/\.opportunity-stage-page\{position:fixed;inset:0/);
  assert.match(css,/\.opportunity-stage-page-body>\[data-flow-pane\]\{display:block!important/);
  assert.doesNotMatch(app,/showFlowStep\(deals\.length/);
  assert.match(app,/const propertySection=inventorySelectionSection/);
  assert.doesNotMatch(app,/propertySection=contentSections\.find\(section=>\$\('h3',section\)\?\.textContent==='Explainable property shortlist'/);
});

test('DEF-092 stage draft API creates immutable actor-scoped numbered versions',()=>{
  const route=read('src/routes/opportunities.js'),migration=read('src/migrations/107_dev169_versioned_opportunity_stage_drafts.sql');
  for(const marker of [
    "r.get('/crm/opportunities/:id/stage-drafts/:stageCode'",
    "r.post('/crm/opportunities/:id/stage-drafts/:stageCode'",
    "r.post('/crm/opportunities/:id/stage-drafts/:stageCode/finalize'",
    'canWriteOpportunity(req.broker,opportunity)',
    'created_by=$3','MAX(version_no)','draft_version_created',
    'This Opportunity changed after the stage workspace was opened'
  ])assert.ok(route.includes(marker),`missing ${marker}`);
  assert.match(migration,/CREATE TABLE opportunity_stage_draft_versions/);
  assert.match(migration,/UNIQUE\(opportunity_id,stage_code,created_by,version_no\)/);
  assert.match(migration,/CHECK\(jsonb_typeof\(payload\)='object'\)/);
  assert.match(migration,/CREATE TABLE opportunity_stage_draft_finalizations/);
  assert.match(route,/draft_finalized/);
  assert.doesNotMatch(route,/UPDATE opportunity_stage_draft_versions/);
});

test('DEF-092 draft capture excludes files and final Save retains governed form submissions',()=>{
  const app=read('public/app.js');
  assert.match(app,/control\.type!=='file'/);
  assert.match(app,/Files must be selected again when you return/);
  assert.match(app,/form\.requestSubmit\(\)/);
  for(const form of ['#property-match-form','#viewing-create-form','#offer-create-form','.offer-event-form','#booking-create-form','#deal-create-form'])assert.ok(app.includes(form),`missing governed form ${form}`);
});
