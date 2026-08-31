import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('Advisory enrichment waits until the completed result DOM is painted',()=>{
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  assert.match(bridge,/var dispatch = function \(\) \{/);
  assert.match(bridge,/var request = completed \? Promise\.resolve\(\)\.then\(dispatch\) : dispatch\(\)/);
  assert.match(bridge,/advisory_summary = advisorySummaryEvidence/);
  for(const marker of ['.nysa-result-label','.nysa-result-title','.nysa-result-summary','.nysa-result-box','focusAreas','whatToAvoid'])assert.match(bridge,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('explicit Property Selection handoff carries the complete displayed recommendation snapshot',()=>{
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  for(const marker of ['#nysa-matches .nysa-match','.nysa-score','.nysa-subtitle','.nysa-pill','.nysa-list li','matchScoreScale','scoreLabel','displayedLocation','reasons'])assert.match(bridge,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(bridge,/recommendation_run_json: JSON\.stringify\(recommendationRun\)/);
  assert.match(plugin,/\$recommendation_run = self::decoded_array\(\$source\['recommendation_run_json'\]/);
  assert.match(plugin,/'recommendationRun' => \$is_property \? \$recommendation_run : array\(\)/);
});

test('holding period is preserved in direct and bridge Property Selection paths',()=>{
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(bridge,/holding_period: fieldValue\(text, 'Holding period'\)/);
  assert.match(plugin,/array\('holding_period', 'investment_horizon', 'horizon'\)/);
  assert.match(plugin,/\$holding_period \? 'Holding period: ' \. \$holding_period/);
});

test('governed budget remains original input while expanded website text stays in raw evidence',()=>{
  const bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(bridge,/journey_budget_code: activeJourneyBudgetCode/);
  assert.match(plugin,/\$budget = self::parse_budget\(\$journey_budget_code \?: \(\$source\['budget'\] \?\? ''\)\)/);
  assert.match(plugin,/'raw' => self::safe_source_data\(\$source\)/);
});

test('dev.114 and connector 1.9.4 are the isolated retest candidates',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  const plugin=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php');
  assert.match(plugin,/Version: 1\.9\.4/);assert.match(plugin,/VERSION = '1\.9\.4'/);assert.match(plugin,/nysa-wordpress-bridge-1\.9\.4/);
  const deploy=read('release-artifacts/release-3/r3a/deploy-crm-test-r3ai-dev114-lossless-output.sh');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.114','PREVIOUS_VERSION=2.1.0-dev.113','EXPECTED_PACKAGE=nysa-core-r3ai-lossless-output-dev114.zip','LATEST_MIGRATION=074_release3ai_governed_website_routing.sql','74|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged'])assert.match(deploy,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
