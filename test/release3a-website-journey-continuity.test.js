import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
const route=read('src/routes/website-intake.js');
const migration=read('src/migrations/072_release3a_website_journey_continuity.sql');

test('R3A-WEBSITE-JOURNEY-65 carries the advisory journey into Property Selection',()=>{
  assert.match(bridge,/var activeJourneyKey = ''/);
  assert.match(bridge,/sessionStorage\.getItem\(journeyStorageKey\)/);
  assert.match(bridge,/rememberJourneyKey\(payload\.lead_key\)/);
  assert.match(bridge,/clearJourneyKey\(\)/);
  assert.match(bridge,/journey_key: activeJourneyKey/);
  assert.match(bridge,/form_code: 'ai_property_selection_v1'/);
  assert.doesNotMatch(bridge,/form_code: 'ai_advisory_v1',[\s\S]{0,500}title: 'AI investment shortlist enquiry'/);
});

test('R3A-WEBSITE-JOURNEY-65 maps an opaque journey key without changing event idempotency',()=>{
  assert.match(plugin,/\$journey_key = self::clean\(\$source\['journey_key'\] \?\? '', 120\)/);
  assert.match(plugin,/'journeyKey' => \$journey_key/);
  assert.match(plugin,/'journeyKey' => \$lead_key/);
  assert.match(plugin,/'journeyKey' => self::clean\(\$intermediate\['journeyKey'\] \?\? '', 120\)/);
  assert.match(plugin,/\$event_id = 'wp-enquiry-' .*\$intermediate\['sourceRecordKey'\]/);
});

test('R3A-WEBSITE-JOURNEY-65 reuses only the same Customers accepted advisory Lead',()=>{
  assert.match(route,/b\.form==='ai_property_selection_v1'/);
  assert.match(route,/e\.journey_key=\$1 AND e\.status='accepted'/);
  assert.match(route,/l\.contact_id=\$2/);
  assert.match(route,/SELECT \* FROM leads WHERE id=\$1 FOR UPDATE/);
  assert.match(route,/reusedJourneyLead:true/);
  assert.match(route,/journey_enriched/);
});

test('R3A-WEBSITE-JOURNEY-65 versions requirements and persists indexed journey evidence',()=>{
  assert.match(route,/UPDATE lead_requirements SET superseded_at=NOW\(\)/);
  assert.match(route,/versionNo=Number\(current\.versionNo\)\+1/);
  assert.match(route,/requirementVersion:versionNo/);
  assert.match(route,/journey_key[,\)]/);
  assert.match(migration,/ADD COLUMN journey_key TEXT/);
  assert.match(migration,/website_intake_events_journey_idx/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/);
});

test('R3A-WEBSITE-JOURNEY-65 packages a CRM-Test-only idempotent dev.108 deployment',()=>{
  const deploy=read('release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev108-complete.sh');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.108','PREVIOUS_VERSION=2.1.0-dev.107','PREVIOUS_MIGRATION=071_release3a_advisory_customer360_evidence.sql','LATEST_MIGRATION=072_release3a_website_journey_continuity.sql','EXPECTED_PACKAGE=nysa-core-r3a-advisory-journey-continuity-dev108.zip','72|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged']) assert.match(deploy,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
