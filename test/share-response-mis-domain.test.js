import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareResponseMis, SHARE_RESPONSE_MIS_POLICY_VERSION } from '../src/share-response-mis-domain.js';

const now = '2026-08-08T10:00:00.000Z';
const packageRecord = {
  packageRef: 'SHARE-SYN-001', opportunityRef: 'OPP-SYN-001', brokerRef: 'BROKER-SYN-001',
  preparedAt: '2026-08-08T06:00:00.000Z', status: 'prepared_not_sent',
  propertyRefs: ['NYSA-SYN-001', 'NYSA-SYN-002']
};
const events = [
  { packageRef: 'SHARE-SYN-001', type: 'shared', occurredAt: '2026-08-08T06:10:00.000Z', evidenceRef: 'EV-SHARED' },
  { packageRef: 'SHARE-SYN-001', type: 'opened', occurredAt: '2026-08-08T06:25:00.000Z', evidenceRef: 'EV-OPENED' },
  { packageRef: 'SHARE-SYN-001', propertyRef: 'NYSA-SYN-001', type: 'responded', responseType: 'interested', occurredAt: '2026-08-08T07:00:00.000Z', evidenceRef: 'EV-RESPONSE' }
];

test('approved Module 3 package remains prepared and not sent without event evidence', () => {
  const result = buildShareResponseMis({ packages: [packageRecord], events: [], tasks: [], now });
  assert.equal(result.policyVersion, SHARE_RESPONSE_MIS_POLICY_VERSION);
  assert.equal(result.classification, 'synthetic_local_not_integrated');
  assert.deepEqual(result.metrics, {
    prepared: 1, shared: 0, delivered: 0, opened: 0, responded: 0,
    viewingRequested: 0, converted: 0, missingFollowUp: 0, overdueFollowUp: 0
  });
  assert.equal(result.rows[0].lifecycleState, 'prepared_not_sent');
  assert.deepEqual(result.rows[0].propertyRefs, packageRecord.propertyRefs);
});

test('MIS counts only exact evidenced events and does not infer missing stages', () => {
  const result = buildShareResponseMis({ packages: [packageRecord], events, tasks: [], now });
  assert.equal(result.metrics.shared, 1);
  assert.equal(result.metrics.delivered, 0);
  assert.equal(result.metrics.opened, 1);
  assert.equal(result.metrics.responded, 1);
  assert.equal(result.rows[0].exactStates.delivered, false);
});

test('each property response exposes a missing authoritative Task', () => {
  const result = buildShareResponseMis({ packages: [packageRecord], events, tasks: [], now });
  assert.equal(result.metrics.missingFollowUp, 1);
  assert.equal(result.rows[0].propertyResponses[0].propertyRef, 'NYSA-SYN-001');
  assert.equal(result.rows[0].propertyResponses[0].followUpState, 'missing_authoritative_task');
});

test('response reconciles to one existing CRM Task without creating a parallel queue', () => {
  const tasks = [{ taskRef: 'TASK-SYN-001', sourceEvidenceRef: 'EV-RESPONSE', subject: 'Follow up on customer interest', status: 'open', dueAt: '2026-08-08T11:00:00.000Z' }];
  const result = buildShareResponseMis({ packages: [packageRecord], events, tasks, now });
  assert.equal(result.metrics.missingFollowUp, 0);
  assert.equal(result.rows[0].propertyResponses[0].task.taskRef, 'TASK-SYN-001');
  assert.equal(result.rows[0].propertyResponses[0].followUpState, 'open');
});

test('unknown properties, duplicate evidence and non-prepared inputs fail closed', () => {
  assert.throws(() => buildShareResponseMis({ packages: [{ ...packageRecord, status: 'shared' }], events: [], tasks: [], now }), /prepared_not_sent/);
  assert.throws(() => buildShareResponseMis({ packages: [packageRecord], events: [{ ...events[2], propertyRef: 'UNKNOWN' }], tasks: [], now }), /not in the package/);
  assert.throws(() => buildShareResponseMis({ packages: [packageRecord], events: [events[0], { ...events[1], evidenceRef: events[0].evidenceRef }], tasks: [], now }), /evidenceRef must be unique/);
});
