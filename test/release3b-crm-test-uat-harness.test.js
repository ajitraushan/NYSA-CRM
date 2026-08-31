import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Release 3B CRM Test harness hard-locks host and mutation authority',()=>{
  const script=read('scripts/release3b-crm-test-uat.js');
  assert.match(script,/https:\/\/crm-test\.nysarealty\.com/);
  assert.match(script,/Refusing non-approved base URL/);
  assert.match(script,/CRM_TEST_RELEASE3B_UAT_CONFIRMED/);
  for(const name of ['NYSA_R3B_UAT_ACTOR_ID','NYSA_R3B_UAT_LEAD_ID','NYSA_R3B_UAT_INVENTORY_IDS','NYSA_R3B_UAT_PORTAL_INVENTORY_ID','NYSA_R3B_UAT_RECORD_TAG'])assert.match(script,new RegExp(name));
  assert.match(script,/not visibly tagged/);
  assert.doesNotMatch(script,/propertyfinder\.ae|bayut\.com|\/publish|\/transmit|\/send-to-portal/i);
  assert.doesNotMatch(script,/console\.log\([^)]*(password|cookie)/i);
});

test('Release 3B CRM Test harness covers governed matching and immutable evidence',()=>{
  const script=read('scripts/release3b-crm-test-uat.js');
  for(const marker of ['unresolved website conflict','evidenceHash','r3b-eligibility-v1','exclusionReasons','websiteSuggestionsIncluded','createsPropertyMatch','reservesInventory','shortlisted','deferred','rejected','expectedPreviousDecisionId','immutableEvidence','liveEligibility'])assert.match(script,new RegExp(marker,'i'));
  assert.match(script,/Run-level Inventory allowlist/);
  assert.match(script,/API has no run-level Inventory filter/);
});

test('Release 3B CRM Test harness validates portal preparation without publication',()=>{
  const script=read('scripts/release3b-crm-test-uat.js');
  for(const marker of ['propertyFinderPropertyTypes','title validation','description validation','permit reconciliation','Internal-only privacy boundary','noConnectorTransmission','connectorStatus'])assert.match(script,new RegExp(marker,'i'));
  for(const privateField of ['ownerContact','authorityEvidence','storageKey'])assert.match(script,new RegExp(privateField));
  assert.match(script,/Exactly one supplied portal Inventory/);
});

test('Release 3B CRM Test harness emits append-only JSON and Markdown reports',()=>{
  const script=read('scripts/release3b-crm-test-uat.js'),pkg=JSON.parse(read('package.json'));
  assert.match(script,/report\.json/);assert.match(script,/report\.md/);assert.match(script,/flag:'wx'/);
  assert.match(script,/mkdir\(baseRoot,\{recursive:true\}\)/);assert.match(script,/mkdir\(root,\{recursive:false\}\)/);
  assert.match(script,/automated/);assert.match(script,/known_gap/);assert.match(script,/manual/);
  assert.equal(pkg.scripts['uat:release3b:crm-test'],'node scripts/release3b-crm-test-uat.js');
  assert.match(pkg.scripts['uat:release3b:crm-test:mutate'],/--mutate/);
});
