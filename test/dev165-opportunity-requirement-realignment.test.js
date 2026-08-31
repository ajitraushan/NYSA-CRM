import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('dev.165 exposes a governed exact-version alignment action without rewriting prior matching evidence',()=>{
  const route=read('src/routes/opportunities.js'),matching=read('src/routes/governed-matching.js'),migration=read('src/migrations/106_dev165_opportunity_requirement_realignment.sql');
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  assert.match(route,/current broker-confirmed Requirement is required before alignment/);
  assert.match(route,/acknowledgeStaleMatching/);
  assert.match(route,/requirement_version_aligned/);
  assert.match(route,/INSERT INTO inventory_assignment_events/);
  assert.match(route,/INSERT INTO property_match_history/);
  assert.match(matching,/WHERE opportunity_id=\$1 AND requirement_id=\$2 AND listing_id=\$3 FOR UPDATE/);
  assert.match(migration,/DROP CONSTRAINT IF EXISTS property_matches_opportunity_id_listing_id_key/);
  assert.match(migration,/UNIQUE INDEX IF NOT EXISTS property_matches_opportunity_requirement_listing_uq/);
  assert.doesNotMatch(route,/DELETE FROM (property_matches|inventory_matching_runs|inventory_matching_candidates)/i);
});

test('dev.165 alignment UI states the stale-record impact and requires explicit review',()=>{
  const app=read('public/app.js'),context=read('src/routes/crm.js');
  assert.match(context,/staleMatchCount/);
  assert.match(context,/activeAssignmentCount/);
  assert.match(context,/canWriteOpportunity/);
  assert.match(app,/Opportunity uses an older Requirement Version/);
  assert.match(app,/will remain as rejected history/);
  assert.match(app,/Review and align/);
});
