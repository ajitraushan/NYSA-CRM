import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
const route=read('src/routes/website-intake.js'),ui=read('public/app.js'),migration=read('src/migrations/073_release3ai_lossless_website_recommendations.sql');
test('R3AI-66 captures a completed property selection losslessly and does not assert Inventory verification',()=>{
  for(const marker of ['propertyRecommendationSnapshot','displayedText','presentedRank','matchScore','matchScoreScale','scoreLabel','matchedFactors','reasons','notEmittedByWebsite','recommendation_run'])assert.match(bridge,new RegExp(marker));
  assert.match(plugin,/recommendationRun/);assert.match(route,/recommendationEvidenceFacts/);assert.match(route,/recommendation_option_/);
  assert.match(ui,/Website AI suggestion — Inventory mapping not yet verified/);assert.doesNotMatch(route,/INSERT INTO property_matches/);
});
test('R3AI-66 retains a structured readable run and safely declares website omissions',()=>{
  assert.match(route,/not_emitted_by_website/);assert.match(route,/unavailableFields/);assert.match(ui,/No recommendation options were emitted by the website/);
  for(const marker of ['displayedLocation','displayedSummary','scoreLabel','matchedFactors','reasons','gaps','cautions','tradeOffs','notEmittedByWebsite'])assert.match(route,new RegExp(marker));
  assert.match(migration,/fact_group IN \('identity','enquiry','requirement','profile','attribution','consent','advisory','recommendation'\)/);assert.doesNotMatch(migration,/schema_migrations/);
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');assert.match(plugin,/VERSION = '1.9.4'/);
});
