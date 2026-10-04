import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('leave submission is atomic, retry-safe and routes to the maintained Line Manager',()=>{
  const route=read('src/routes/agent-leave.js'),ui=read('public/agent-leave-ui.js');
  assert.match(route,/post\('\/crm\/my-leave-applications\/submit'/);
  assert.match(route,/reason=\$7 AND COALESCE\(evidence_reference,''\)=\$8 AND status='draft' ORDER BY created_at DESC LIMIT 1 FOR UPDATE/);
  assert.match(route,/activeLineManager\(employment,app\.applicantId,client\)/);
  assert.match(route,/employment\.reportingManagerId/);
  assert.doesNotMatch(route,/FROM brokers[^;]+ORDER BY created_at LIMIT 1/);
  assert.match(ui,/api\('\/crm\/my-leave-applications\/submit'/);
  assert.match(ui,/form\.dataset\.idempotencyKey/);
  assert.doesNotMatch(ui,/const created=await api\('\/crm\/my-leave-applications'/);
});

test('purchased Lead classification is pinned on both Lead and Requirement',()=>{
  const route=read('src/routes/purchased-data-import.js');
  assert.match(route,/loadActiveClassificationCatalogue\(client\)/);
  assert.match(route,/validateClassificationSelection\(classificationCatalogue/);
  assert.match(route,/INSERT INTO leads\([^`]+customer_objective,market_stage_requirement,property_segment_requirement,classification_version,classification_catalogue_version_id,classification_mapping_evidence,created_by/s);
  assert.match(route,/INSERT INTO lead_requirements\([^`]+classification_catalogue_version_id,classification_mapping_evidence/s);
  assert.doesNotMatch(route,/classification_version\)\s*\n\s*VALUES[^`]+purchased-data-v1/s);
});

test('expired assignment cannot return to the same Agent self-claim queue',()=>{
  const route=read('src/routes/lead-operations.js'),ui=read('public/app.js');
  assert.match(route,/prior\.agent_id[\s\S]+IS DISTINCT FROM/);
  assert.match(route,/expired from your assignment and must be reassigned by a Manager or Director/);
  assert.match(ui,/My assigned Leads/);
  assert.match(ui,/Company-visible Leads/);
});

test('operational KPI cards no longer render Prior or null comparisons',()=>{
  const ui=read('public/app.js'),domain=read('src/dashboard-domain.js');
  assert.doesNotMatch(ui,/dashboard-asof'\)\.textContent=`[^`]*Prior/);
  assert.doesNotMatch(ui,/dashboard-kpis'\)\.innerHTML=[^;]+Prior/);
  assert.match(domain,/Assignment offers awaiting acceptance/);
  assert.match(domain,/Recycled reassignment claims are not included/);
});

test('DEV214 business references and Inventory titles remain covered',()=>{
  const offer=read('public/offer-ui.js'),deal=read('public/deal-ui.js'),opportunity=read('src/routes/opportunities.js');
  for(const marker of ['opportunityReference','inventoryReference','inventoryHeadline'])assert.ok(offer.includes(marker)||deal.includes(marker)||opportunity.includes(marker),`${marker} must remain in the transaction projection`);
});

test('DEV216 deployment remains CRM-Test-only and package-provenance locked',()=>{
  const deploy=read('scripts/deploy-crm-test-dev216.sh');
  assert.match(deploy,/EXPECTED_VERSION=2\.1\.0-dev\.216/);assert.match(deploy,/PREVIOUS_VERSION=2\.1\.0-dev\.215/);
  assert.match(deploy,/nysa-core-2\.1\.0-dev\.216-origin\.zip/);assert.match(deploy,/RELEASE_PROVENANCE\.json/);assert.match(deploy,/RUNTIME_MANIFEST\.sha256/);
  assert.match(deploy,/PRODUCTION_ROOT=\/home\/nysareal\/nysa-crm/);assert.match(deploy,/R2_CLONE_ROOT=\/home\/nysareal\/nysa-r2-prod-clone/);assert.match(deploy,/Production and R2 clone snapshots: unchanged/);
});
