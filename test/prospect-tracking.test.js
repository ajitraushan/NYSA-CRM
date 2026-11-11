import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceProspectRetry, validateProspectNextStep } from '../src/prospect-tracking.js';

test('next step is required and must agree with the outcome', () => {
  assert.match(validateProspectNextStep({ outcome: 'answered' }).error, /exactly one/);
  assert.match(validateProspectNextStep({ outcome: 'interested', nextStep: 'retry_cadence' }).error, /incompatible/);
  assert.match(validateProspectNextStep({ outcome: 'declined', nextStep: 'close_not_interested' }).error, /reason/);
  assert.equal(validateProspectNextStep({ outcome: 'invalid_number', nextStep: 'close_wrong_number' }).step, 'close_wrong_number');
});

test('initial call plus three retries skips Sunday, parks after retry three and resets on connection', () => {
  const policy = { retryGaps: [1, 2, 4], workingDays: [1, 2, 3, 4, 5, 6], parkOnExhaustion: true };
  let at = new Date('2026-11-14T05:00:00Z');
  for (const [index, date] of ['2026-11-16', '2026-11-18', '2026-11-23'].entries()) {
    const result = advanceProspectRetry({ previousAttempts: index, outcome: 'no_answer', step: 'retry_cadence', at, policy });
    assert.equal(result.nextAt.toISOString(), date + 'T05:00:00.000Z');
    at = result.nextAt;
  }
  const last = advanceProspectRetry({ previousAttempts: 3, outcome: 'no_answer', step: 'retry_cadence', at, policy });
  assert.equal(last.nextAt, null);
  assert.deepEqual(last.parkedAt, at);
  assert.deepEqual(advanceProspectRetry({ previousAttempts: 4, outcome: 'answered', step: 'follow_up', at, policy }),
    { attempts: 0, nextAt: null, parkedAt: null });
});
