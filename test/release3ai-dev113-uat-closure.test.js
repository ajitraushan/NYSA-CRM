import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('approved email exceptions enter the manager assignment queue even before a team is selected',()=>{
  const operations=read('src/routes/lead-operations.js');
  const intake=read('src/routes/website-intake.js');
  assert.doesNotMatch(operations,/if\(!teams\.length\)return res\.json\(\{leads:\[\]\}\)/);
  assert.match(operations,/l\.assigned_team_id=ANY\(\$\$\{params\.length\}::uuid\[\]\)/);
  assert.match(operations,/l\.assigned_team_id IS NULL AND l\.source='Website'/);
  assert.match(operations,/approved_event\.status='accepted' AND approved_event\.resolution='approve_email_only'/);
  assert.match(intake,/Approved website email exception awaiting Manager team assignment/);
});

test('Advisory and Property Selection remain distinct evidence types',()=>{
  const route=read('src/routes/website-intake.js');
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(route,/function advisoryEvidenceFacts\(b\)\{\s*if\(b\?\.form!=='ai_advisory_v1'\)return \[\]/);
  assert.match(bridge,/if \(isPropertyResult\) \{\s*delete payload\.advisory_evidence;\s*delete payload\.advisory_summary;/);
  assert.match(plugin,/'advisoryEvidence' => \$is_advisory \? self::advisory_answer_evidence\(\$source\) : array\(\)/);
  assert.match(plugin,/'advisorySummary' => \$is_advisory \? self::advisory_summary_evidence\(\$source\) : array\(\)/);
  assert.match(plugin,/'recommendationRun' => \$is_property/);
});

test('canonical same-journey budget code governs amounts while raw website evidence is retained',()=>{
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(bridge,/nysa_crm_advisory_budget_code/);
  assert.match(bridge,/rememberJourneyBudgetCode\(advisoryAnswers\.budget\)/);
  assert.match(bridge,/payload\.journey_budget_code = activeJourneyBudgetCode/);
  assert.match(bridge,/journey_budget_code: activeJourneyBudgetCode/);
  assert.match(plugin,/'b_2_5' => array\('min' => 2000000, 'max' => 5000000\)/);
  assert.match(plugin,/\$budget = self::parse_budget\(\$journey_budget_code \?: \(\$source\['budget'\] \?\? ''\)\)/);
  assert.match(plugin,/\$budget_text = \$journey_budget_code \?: self::first_answer/);
  assert.match(plugin,/'raw' => self::safe_source_data\(\$source\)/);
});

test('UTM behavior is unchanged in this closure candidate',()=>{
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  for(const field of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])assert.match(bridge,new RegExp(`params\\.get\\('${field}'\\)`));
});

test('dev.113 candidate is checksum-bound, rerunnable and CRM-Test-only',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(plugin,/Version: 1\.9\.4/);assert.match(plugin,/VERSION = '1\.9\.4'/);assert.match(plugin,/nysa-wordpress-bridge-1\.9\.4/);
  const deploy=read('release-artifacts/release-3/r3a/deploy-crm-test-r3ai-dev113-uat-closure.sh');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.113','PREVIOUS_VERSION=2.1.0-dev.112','EXPECTED_PACKAGE=nysa-core-r3ai-uat-closure-dev113.zip','LATEST_MIGRATION=074_release3ai_governed_website_routing.sql','74|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged'])assert.match(deploy,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
