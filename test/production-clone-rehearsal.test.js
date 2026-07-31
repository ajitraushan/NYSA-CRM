import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const script=readFileSync(
  resolve(
    root,
    'release-artifacts/release-2/r2.6/production-candidate/rehearse-production-db026-to-r2-6-dev79-clone-only.sh'
  ),
  'utf8'
);

test('production-clone rehearsal is bound to the verified application and database baseline',()=>{
  assert.match(script,/EXPECTED_APP_BASELINE=1\.1\.0/);
  assert.match(script,/EXPECTED_BASELINE=026_routing_rule_governance\.sql/);
  assert.match(script,/EXPECTED_R11_FINAL=037_listing_mapping_governance\.sql/);
  assert.match(script,/EXPECTED_FINAL=059_release26_inventory_owner_and_activation\.sql/);
  assert.match(script,/before_version=.*package\.json/);
  assert.match(script,/\[\[ "\$before_version" == "\$EXPECTED_APP_BASELINE" \]\]/);
});

test('production-clone rehearsal applies and verifies the complete 027 through 059 chain',()=>{
  assert.match(script,/awk '\$0 >= "027_" && \$0 <= "059~"/);
  assert.match(script,/\[\[ "\$migration_count" == 33/);
  assert.match(script,/"\$release11_after" == 11/);
  assert.match(script,/"\$release2_after" == 22/);
});

test('production-clone rehearsal retains environment and target isolation guards',()=>{
  assert.match(script,/R2_6_CLONE_ONLY/);
  assert.match(script,/PRODUCTION_ROOT=\/home\/nysareal\/nysa-crm/);
  assert.match(script,/CRM_TEST_ROOT=\/home\/nysareal\/nysa-core-dashboard-dd6262a-stage/);
  assert.match(script,/Clone worker database identity does not match the explicit arguments/);
  assert.match(script,/Production and CRM Test were not modified/);
});
