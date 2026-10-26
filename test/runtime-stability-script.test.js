import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source=fs.readFileSync(new URL('../scripts/verify-crm-test-runtime-stability.sh',import.meta.url),'utf8');

test('CRM Test stability verifier checks the same PID across liveness and readiness',()=>{
  for(const marker of ['require-pf-safe','before_liveness','after_liveness','after_readiness','repeated_liveness','STABLE_CRM_TEST_WORKER_PID','RESULT=PASS'])assert.match(source,new RegExp(marker));
  assert.match(source,/\/api\/health/);
  assert.match(source,/\/api\/readiness/);
  assert.match(source,/worker changed from/);
});

test('stability verifier is exact-host read-only and contains no mutation or credential access',()=>{
  assert.match(source,/BASE_URL='https:\/\/crm-test\.nysarealty\.com'/);
  assert.doesNotMatch(source,/\bcurl\b[^\n]*(?:-X|--request|POST|PATCH|PUT|DELETE)/i);
  assert.doesNotMatch(source,/kill|restart|stop-app|start-app|authorization|cookie|api[_-]?key|secret/i);
});
