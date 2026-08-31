import { buildShareResponseMis } from '/modules/share-response-mis-domain.js';

const now = '2026-08-08T10:00:00.000Z';
const approvedPackage = {
  packageRef: 'SHARE-SYN-001',
  opportunityRef: 'OPP-SYN-001',
  brokerRef: 'BROKER-SYN-001',
  preparedAt: '2026-08-08T06:00:00.000Z',
  status: 'prepared_not_sent',
  propertyRefs: ['NYSA-SYN-001', 'NYSA-SYN-002']
};

const evidenceEvents = [
  { packageRef: 'SHARE-SYN-001', type: 'shared', occurredAt: '2026-08-08T06:10:00.000Z', evidenceRef: 'EVENT-SYN-SHARED-001' },
  { packageRef: 'SHARE-SYN-001', type: 'delivered', occurredAt: '2026-08-08T06:11:00.000Z', evidenceRef: 'EVENT-SYN-DELIVERED-001' },
  { packageRef: 'SHARE-SYN-001', type: 'opened', occurredAt: '2026-08-08T06:25:00.000Z', evidenceRef: 'EVENT-SYN-OPENED-001' },
  { packageRef: 'SHARE-SYN-001', propertyRef: 'NYSA-SYN-001', type: 'responded', responseType: 'viewing_requested', occurredAt: '2026-08-08T07:00:00.000Z', evidenceRef: 'EVENT-SYN-RESPONSE-001' },
  { packageRef: 'SHARE-SYN-001', propertyRef: 'NYSA-SYN-001', type: 'viewing_requested', occurredAt: '2026-08-08T07:00:00.000Z', evidenceRef: 'EVENT-SYN-VIEWING-001' }
];

const governedTask = {
  taskRef: 'TASK-SYN-001',
  sourceEvidenceRef: 'EVENT-SYN-RESPONSE-001',
  subject: 'Coordinate property viewing',
  status: 'open',
  dueAt: '2026-08-08T11:00:00.000Z'
};

const datasets = {
  prepared: { packages: [approvedPackage], events: [], tasks: [] },
  gap: { packages: [approvedPackage], events: evidenceEvents, tasks: [] },
  tracked: { packages: [approvedPackage], events: evidenceEvents, tasks: [governedTask] }
};

const labels = {
  prepared: 'Prepared', shared: 'Shared', delivered: 'Delivered', opened: 'Opened',
  responded: 'Responded', viewingRequested: 'Viewing requested', converted: 'Converted'
};

function render() {
  const result = buildShareResponseMis({ ...datasets[document.querySelector('#dataset').value], now });
  document.querySelector('#metrics').innerHTML = Object.entries(labels).map(([key, label]) => `
    <article><span>${label}</span><strong>${result.metrics[key]}</strong></article>
  `).join('');

  document.querySelector('#audit').innerHTML = result.rows.map(row => `
    <article class="audit-card">
      <div class="card-head"><div><span>${row.packageRef}</span><h2>Two broker-selected properties</h2></div><strong class="pill ${row.lifecycleState}">${row.lifecycleState.replaceAll('_', ' ')}</strong></div>
      <dl>
        <div><dt>Opportunity</dt><dd>${row.opportunityRef}</dd></div>
        <div><dt>Properties</dt><dd>${row.propertyRefs.join(' · ')}</dd></div>
        <div><dt>Last evidenced activity</dt><dd>${row.latestAt}</dd></div>
      </dl>
      <div class="timeline">
        ${['shared','delivered','opened','responded','viewing_requested','converted'].map(type => `<span class="${row.exactStates[type] ? 'evidenced' : ''}">${type.replaceAll('_',' ')}</span>`).join('')}
      </div>
      <p class="note">Unfilled stages have no evidence and are not inferred.</p>
    </article>
  `).join('');

  const responses = result.rows.flatMap(row => row.propertyResponses);
  document.querySelector('#follow-up').innerHTML = responses.length ? responses.map(item => `
    <article class="follow-card ${item.followUpState}">
      <span>${item.propertyRef}</span>
      <h3>${item.responseType.replaceAll('_', ' ')}</h3>
      <p>Immutable response evidence: ${item.evidenceRef}</p>
      <strong>${item.followUpState === 'missing_authoritative_task' ? 'GAP — no authoritative CRM Task' : `${item.task.subject} · ${item.followUpState}`}</strong>
    </article>
  `).join('') : `<article class="empty"><strong>No customer response evidenced</strong><p>The package is prepared but not sent. No broker follow-up is due.</p></article>`;
}

document.querySelector('#dataset').addEventListener('change', render);
render();
