import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script=readFileSync(new URL('../release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev94-complete.sh',import.meta.url),'utf8');

test('Release 3A dev.94 CRM Test deployment is checksum-bound, baseline-safe and environment-isolated',()=>{
  for(const marker of [
    'EXPECTED_ROOT=/home/nysareal/nysa-core-dashboard-dd6262a-stage',
    'EXPECTED_DATABASE=nysareal_nysa_r2_rehearsal',
    'EXPECTED_VERSION=2.1.0-dev.94',
    'DEV79_BASELINE_MIGRATION=059_release26_inventory_owner_and_activation.sql',
    'BASELINE_MIGRATION=061_dev90_reference_and_status_governance.sql',
    'LATEST_MIGRATION=067_release3a_lead_recovery_cases.sql',
    'checksum manifest must identify exactly',
    'ZIP contains an absolute, traversal, or Windows-backslash path',
    'load_stable_database_environment',
    'Backups completed:',
    'expected exactly one new CRM Test worker',
    'Production and R2 clone snapshots: unchanged'
  ])assert.match(script,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const migration of ['062_release3a_customer_action_suggestions.sql','063_release3a_trusted_intake_evidence.sql','064_release3a_website_profile_evidence.sql','065_release3a_campaign_governance.sql','066_release3a_duplicate_lead_review.sql','067_release3a_lead_recovery_cases.sql'])assert.match(script,new RegExp(migration));
  assert.match(script,/refusing non-CRM-Test application root/);
  assert.match(script,/unexpected CRM Test migration baseline/);
  assert.match(script,/dev\.79\/migration 059 or dev\.91-dev\.93\/migration 061/);
  assert.match(script,/protected_migrations=\("\$DEV79_BASELINE_MIGRATION"\)/);
  assert.match(script,/if \[\[ "\$baseline_kind" != "dev79" \]\]; then protected_migrations\+=\(060_consolidated_lead_opportunity_remediation\.sql "\$BASELINE_MIGRATION"\); fi/);
  assert.match(script,/refusing to terminate unverified live PID/);
  assert.match(script,/chmod -R u\+rwX "\$APP_ROOT\/public" "\$APP_ROOT\/src"/);
  assert.match(script,/deployment_confirmed=1/);
  assert.match(script,/Correct the precise failure above before rerunning/);
  assert.doesNotMatch(script,/<\(/);
});
