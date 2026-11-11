import assert from 'node:assert/strict';
import test from 'node:test';
import { digestDeliveryTransition, previousProspectWorkingDay } from '../src/prospect-digest-smtp.js';
import { prospectCsvCell, prospectDashboardFilters } from '../src/prospect-dashboard.js';

test('dashboard period rolls over at Dubai midnight and validates custom bounds', () => {
  const day = prospectDashboardFilters({}, new Date('2026-11-11T20:01:00Z'));
  assert.equal(day.from, '2026-11-12');
  assert.equal(prospectDashboardFilters({ period:'week' },new Date('2026-11-11T20:01:00Z')).from,'2026-11-09');
  assert.match(prospectDashboardFilters({ period:'custom',from:'2026-01-01',to:'2026-05-01' }).error,/92 days/);
  assert.equal(prospectCsvCell('=CMD()'),'"\'=CMD()"');
  assert.equal(prospectCsvCell('A "name"'),'"A ""name"""');
});

test('digest Monday reports Saturday and retries definite failures once', () => {
  assert.equal(previousProspectWorkingDay('2026-11-16',[1,2,3,4,5,6]),'2026-11-14');
  assert.equal(digestDeliveryTransition({state:'retryable'},1),'retry');
  assert.equal(digestDeliveryTransition({state:'retryable'},2),'failed');
  assert.equal(digestDeliveryTransition({state:'review'},1),'review');
  assert.equal(digestDeliveryTransition({state:'accepted'},1),'accepted');
});
