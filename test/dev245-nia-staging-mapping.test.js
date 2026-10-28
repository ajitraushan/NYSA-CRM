import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV245 NIA bridge maps the approved structured requirement fields',()=>{
  const plugin=read('integrations/wordpress/nysa-core-lead-bridge/nysa-core-lead-bridge.php');
  assert.match(plugin,/Version: 1\.1\.0/);
  assert.match(plugin,/nia-core-bridge-1\.1\.0/);
  for(const value of ["'apartment' => 'Apartment'","'villa' => 'Villa'","'townhouse' => 'Townhouse'","'land' => 'Land'"])assert.ok(plugin.includes(value));
  for(const field of ["'purpose' => $purpose","'timelineCode' => $timeline_codes[$timing_code]","'bedroomsMin' => $bedrooms_min","'bedroomsMax' => $bedrooms_max"])assert.ok(plugin.includes(field));
  assert.match(plugin,/\$readiness_preferences/);
  assert.match(plugin,/\$location_priorities/);
  assert.match(plugin,/'intakeCompleteness' => \$completed \? 'complete' : 'partial'/);
});

test('DEV245 NIA bridge preserves raw answers while keeping location criteria out of governed Areas',()=>{
  const plugin=read('integrations/wordpress/nysa-core-lead-bridge/nysa-core-lead-bridge.php');
  assert.match(plugin,/'answers' => \$answers/);
  assert.match(plugin,/'profile' => is_array\(\$raw\['profile'\]/);
  assert.match(plugin,/'requirement' => is_array\(\$raw\['requirement'\]/);
  assert.match(plugin,/'normalization' => \$normalization/);
  assert.match(plugin,/'areas' => \[\]/);
  assert.match(plugin,/'declaredPriorities' => array_values\(array_unique\(array_merge\(\$confidence, \$location_priorities\)\)\)/);
});

test('DEV245 CORE retains valid email, uses the dedicated NIA actor and leaves ownership unassigned',()=>{
  const route=read('src/routes/website-intake.js'),env=read('.env.example');
  assert.match(route,/const trustedEmail=identity\.email\|\|null/);
  assert.match(route,/NIA_INTAKE_ACTOR_ID/);
  assert.match(route,/System – NIA Intake/);
  assert.match(route,/role='viewer' AND can_post=0/);
  assert.match(route,/const actor=await intakeActor\(b\.form\)/);
  assert.match(route,/rule\?\.teamId\|\|null,null,'unassigned'/);
  assert.match(env,/NIA_INTAKE_ACTOR_ID=replace_with_nia_service_actor_uuid/);
});

test('DEV245 deployment remains CRM Test/staging-only, backup-bound and provenance-checked',()=>{
  const deploy=read('integrations/wordpress/staging-overrides/deploy-dev245-crm-test.mjs');
  const staging=read('integrations/wordpress/staging-overrides/deploy-dev245-staging.mjs');
  const actor=read('integrations/wordpress/staging-overrides/configure-dev245-nia-actor.mjs');
  for(const marker of ['crm-test.nysarealty.com','2.1.0-dev.245','156_nonvoice_unassigned_response_queue.sql','nysa.release-provenance.v1','ORIGINAL_VALUES_CHANGED','PRODUCTION_CHANGED'])assert.match(deploy,new RegExp(marker.replaceAll('.','\\.')));
  assert.match(deploy,/crm-test-dev243-pre-/);assert.match(deploy,/NIA_INTAKE_ACTOR_ID/);assert.match(deploy,/System – NIA Intake/);
  assert.match(staging,/https:\/\/staging\.nysarealty\.com/);assert.match(staging,/Version: 1\.1\.0/);assert.match(staging,/STAGING_PLUGIN_BASELINE/);
  assert.match(actor,/role:'viewer'/);assert.match(actor,/canPost:false/);assert.match(actor,/passwordDiscarded:true/);
  for(const source of [deploy,staging,actor])assert.doesNotMatch(source,/https:\/\/crm\.nysarealty\.com|\/home\/nysareal\/nysa-crm\//);
});
