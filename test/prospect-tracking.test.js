import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceProspectRetry, answeredCallStatus, validateProspectNextStep } from '../src/prospect-tracking.js';

test('next step is required and must agree with the outcome', () => {
  assert.match(validateProspectNextStep({ outcome: 'answered' }).error, /exactly one/);
  assert.match(validateProspectNextStep({ outcome: 'interested', nextStep: 'retry_cadence' }).error, /Schedule follow-up, Continue to conversion/);
  assert.match(validateProspectNextStep({ outcome: 'declined', nextStep: 'close_not_interested' }).error, /reason/);
  assert.equal(validateProspectNextStep({ outcome: 'invalid_number', nextStep: 'close_wrong_number' }).step, 'close_wrong_number');
});

test('Answered calls apply the approved status for each next step', () => {
  for (const [current, step, expected] of [
    ['not_contacted', 'follow_up', 'call_back'],
    ['no_answer', 'follow_up', 'call_back'],
    ['interested', 'follow_up', 'interested'],
    ['not_contacted', 'convert', 'call_back'],
    ['no_answer', 'convert', 'call_back'],
    ['call_back', 'convert', 'call_back'],
    ['interested', 'convert', 'interested'],
    ['not_interested', 'convert', 'not_interested'],
    ['interested', 'close_not_interested', 'not_interested'],
    ['interested', 'close_dnc', 'do_not_contact'],
    ['interested', 'close_wrong_number', 'do_not_contact'],
    ['do_not_contact', 'follow_up', 'do_not_contact'],
    ['converted', 'follow_up', 'converted'],
  ]) {
    assert.equal(answeredCallStatus(current, step), expected, current + ' / ' + step);
  }

  const { error } = validateProspectNextStep({ outcome: 'answered', nextStep: 'retry_cadence' });
  assert.match(error, /Schedule follow-up, Close as not interested, Close as do not contact, Close as wrong number, Continue to conversion/);
  assert.doesNotMatch(error, /Retry by cadence/);
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
