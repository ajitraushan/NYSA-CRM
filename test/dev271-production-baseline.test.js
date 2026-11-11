import assert from 'node:assert/strict';
import test from 'node:test';
import { productionBaseline, validateProductionRegistration } from '../tools/production-prospect-readonly-preflight.mjs';

test('Production baseline is pinned to accepted DEV270 identity and counts', () => {
  assert.deepEqual(productionBaseline('5c1c350151d6ace33377b33526e2bfedf4ae8f6b'),
    {version:'2.1.0-dev.270',migrations:171,tables:307,triggers:111,runtimeFiles:503});
  assert.equal(productionBaseline('b6e013c51f46be482858e733160fa7e675ff3106').runtimeFiles,392);
  assert.throws(() => productionBaseline('f'.repeat(40)), /Unsupported Production baseline/);
});

test('Production registration rejects either digest enable flag', () => {
  const environment={PGDATABASE:'nysareal_nysacrm',PGUSER:'nysareal_nysacrmapp',PGPASSWORD:'synthetic'};
  assert.doesNotThrow(() => validateProductionRegistration(environment));
  for(const flag of ['PROSPECT_DIGEST_EMAIL_ENABLED','PROSPECT_DIGEST_SCHEDULE_ENABLED']) {
    assert.throws(() => validateProductionRegistration({...environment,[flag]:'true'}), /must be off/);
  }
});
