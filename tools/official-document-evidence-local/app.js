import { prepareOfficialDocumentEvidence, verifyOfficialDocumentEvidence, evidenceForStepRequirement } from '/modules/official-document-evidence-domain.js';
import { evaluateStepDocumentRequirements } from '/modules/document-governance-mapper-domain.js';
import { predefinedWorkflowSteps, createOfficialDocumentTypeDraft, activateOfficialDocumentType, createStepDocumentRuleDraft, activateStepDocumentRule } from '/modules/official-document-config-domain.js';

const contextHash = 'a'.repeat(64);
const fileHash = 'b'.repeat(64);
const now = '2026-08-09T08:00:00.000Z';
const adminRef = 'ADMIN-SYN-1';
const workflowSteps = predefinedWorkflowSteps();
const documents = [
  { code: 'dld_contract_a', label: 'Contract A', issuer: 'Dubai REST', acceptedStatus: 'official_captured', expiryTracked: false, version: 1, status: 'active' },
  { code: 'dld_contract_b', label: 'Contract B', issuer: 'Dubai REST', acceptedStatus: 'official_captured', expiryTracked: false, version: 1, status: 'active' },
  { code: 'dld_contract_f', label: 'Contract F / MOU', issuer: 'Dubai REST', acceptedStatus: 'official_captured', expiryTracked: false, version: 1, status: 'active' },
  { code: 'developer_e_noc', label: 'Developer e-NOC', issuer: 'Developer / Dubai REST', acceptedStatus: 'external_verified', expiryTracked: true, version: 1, status: 'active' }
];
const rules = [
  activeRule('external_listing', 'dld_contract_a', 'required', 'Obtain official seller-to-broker marketing authority'),
  activeRule('buyer_representation', 'dld_contract_b', 'required', 'Obtain official buyer-to-broker representation evidence'),
  activeRule('sale_agreement', 'dld_contract_f', 'required', 'Obtain the executed official seller-buyer contract'),
  activeRule('transfer', 'dld_contract_f', 'required', 'Executed sale agreement evidence'),
  activeRule('transfer', 'developer_e_noc', 'required', 'Current developer transfer evidence')
];
let pendingDocument = null;
let pendingRule = null;

function activeRule(stepCode, documentType, level, reason) {
  const step = workflowSteps.find(item => item.stepCode === stepCode);
  const document = documents.find(item => item.code === documentType);
  return { ruleRef: `${stepCode}-${documentType}-v1`, stepCode, stepLabel: step.label, documentType, documentLabel: document.label, level, reason, acceptedStatuses: [document.acceptedStatus], version: 1, status: 'active', immutable: true };
}

const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

function profileFor(stepCode) {
  const step = workflowSteps.find(item => item.stepCode === stepCode);
  return { stepCode, label: step.label, version: 1, status: 'active', requirements: rules.filter(item => item.status === 'active' && item.stepCode === stepCode).map(item => ({ documentType: item.documentType, label: item.documentLabel, level: item.level, reason: item.reason, acceptedStatuses: item.acceptedStatuses })) };
}

function buildEvidence(type, state, index) {
  if (state === 'missing') return null;
  const definition = documents.find(item => item.code === type);
  const prepared = prepareOfficialDocumentEvidence({
    documentType: type,
    documentDefinition: definition,
    officialReference: `OFFICIAL-SYN-${index + 1}`,
    issuerReference: `${definition.issuer.toUpperCase().replaceAll(' ', '-')}-SYN`,
    issuedAt: '2026-08-08T09:00:00.000Z',
    expiresAt: state === 'expired' ? '2026-08-09T07:00:00.000Z' : (definition.expiryTracked ? '2027-01-01T00:00:00.000Z' : null),
    file: { fileName: `${type}-synthetic.pdf`, mediaType: 'application/pdf', fileSizeBytes: 245000, fileHash },
    links: { inventoryRef: 'NYSA-INV-SYN-018', dealRef: type === 'dld_contract_a' || type === 'dld_contract_b' ? null : 'DEAL-SYN-018' },
    contextHash: state === 'wrong' ? 'c'.repeat(64) : contextHash,
    uploadedByRef: 'AGENT-SYN-1', previousVersions: [], now: '2026-08-09T06:00:00.000Z'
  }).evidence;
  if (state === 'pending' || state === 'expired' || state === 'wrong') return prepared;
  return verifyOfficialDocumentEvidence({ evidence: prepared, decision: state === 'returned' ? 'returned' : 'verified', reason: state === 'returned' ? 'Official reference does not match the supplied case' : '', verifierRef: 'MANAGER-SYN-1', now });
}

function renderAgent() {
  const profile = profileFor(document.querySelector('#step').value);
  const state = document.querySelector('#state').value;
  const versions = profile.requirements.map((requirement, index) => buildEvidence(requirement.documentType, state, index)).filter(Boolean);
  const result = evaluateStepDocumentRequirements({ stepProfile: profile, evidence: versions.map(evidenceForStepRequirement), contextHash, now });
  document.querySelector('#gate').innerHTML = `<article><div><span>Current agent step</span><strong>${escapeHtml(result.label)}</strong></div><div><span>Completion gate</span><strong class="${result.stepCanComplete ? 'good' : 'bad'}">${result.stepCanComplete ? 'May complete' : 'Blocked by official-document evidence'}</strong></div><small>No workflow status is changed by this local review.</small></article>`;
  document.querySelector('#requirements').innerHTML = result.requirements.length ? result.requirements.map(row => `<article class="requirement ${row.state}"><span>${escapeHtml(row.level)}</span><h2>${escapeHtml(row.label)}</h2><p>${escapeHtml(row.reason)}</p><strong>${escapeHtml(row.state.replaceAll('_', ' '))}</strong><p>${escapeHtml(row.nextAction)}</p>${row.taskAdvice ? `<small>Advise existing CRM Task: ${escapeHtml(row.taskAdvice.subject)} · not created</small>` : '<small>Verified for this exact case</small>'}</article>`).join('') : '<article class="empty">No document requirement is active for this step.</article>';
  const latest = versions[0];
  document.querySelector('#record').innerHTML = latest ? `<article><dl><div><dt>Official reference</dt><dd>${escapeHtml(latest.officialReference)}</dd></div><div><dt>Issuer</dt><dd>${escapeHtml(latest.issuerReference)}</dd></div><div><dt>Private PDF</dt><dd>${escapeHtml(latest.file.fileName)} · ${Math.ceil(latest.file.fileSizeBytes / 1024)} KB</dd></div><div><dt>SHA-256</dt><dd><code>${latest.file.fileHash}</code></dd></div><div><dt>Inventory link</dt><dd>${escapeHtml(latest.links.inventoryRef || 'Not applicable')}</dd></div><div><dt>Deal link</dt><dd>${escapeHtml(latest.links.dealRef || 'Not applicable')}</dd></div><div><dt>Evidence status</dt><dd>${escapeHtml(latest.status.replaceAll('_', ' '))}</dd></div><div><dt>Storage key</dt><dd>Private · never exposed</dd></div></dl></article>` : '<article class="empty"><strong>No official document uploaded</strong><p>Obtain it from the authorized issuer, then upload and link the exact PDF.</p></article>';
  document.querySelector('#history').innerHTML = versions.length ? versions.map(item => `<article><strong>Version ${item.version}</strong><span>${escapeHtml(item.evidenceRef)}</span><span>${escapeHtml(item.status.replaceAll('_', ' '))}</span><span>Immutable: Yes</span><span>Supersedes: ${escapeHtml(item.supersedesEvidenceRef || 'None')}</span></article>`).join('') : '<article class="empty">No evidence version exists.</article>';
}

function renderAdmin() {
  document.querySelector('#catalogue').innerHTML = documents.map(item => `<article><div><strong>${escapeHtml(item.label)}</strong><code>${escapeHtml(item.code)}</code></div><span>${escapeHtml(item.issuer)}</span><span>${escapeHtml(item.acceptedStatus.replaceAll('_', ' '))}</span><b>${item.expiryTracked ? 'Expiry tracked' : 'No expiry rule'}</b></article>`).join('');
  document.querySelector('#rules').innerHTML = rules.map(item => `<article><div><strong>${escapeHtml(item.stepLabel)}</strong><code>${escapeHtml(item.stepCode)}</code></div><span>${escapeHtml(item.documentLabel)}</span><span>${escapeHtml(item.level)}</span><b>Active · v${item.version}</b></article>`).join('');
  document.querySelector('#rule-step').innerHTML = workflowSteps.map(item => `<option value="${item.stepCode}">${escapeHtml(item.label)}</option>`).join('');
  document.querySelector('#rule-document').innerHTML = documents.filter(item => item.status === 'active').map(item => `<option value="${item.code}">${escapeHtml(item.label)}</option>`).join('');
  const currentStep = document.querySelector('#step').value;
  document.querySelector('#step').innerHTML = workflowSteps.map(item => `<option value="${item.stepCode}"${item.stepCode === currentStep ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  renderAgent();
}

function showMessage(target, errors) {
  target.innerHTML = `<div class="validation bad">${errors.map(error => `<span>${escapeHtml(error)}</span>`).join('')}</div>`;
}

document.querySelector('#create-document').addEventListener('click', () => {
  const result = createOfficialDocumentTypeDraft({ code: document.querySelector('#doc-code').value, label: document.querySelector('#doc-label').value, issuer: document.querySelector('#doc-issuer').value, acceptedStatus: document.querySelector('#doc-status').value, expiryTracked: document.querySelector('#doc-expiry').checked, createdByRef: adminRef, now }, documents);
  if (!result.valid) return showMessage(document.querySelector('#document-draft'), result.errors);
  pendingDocument = result.draft;
  document.querySelector('#document-draft').innerHTML = `<div class="draft"><div><strong>Draft ready: ${escapeHtml(pendingDocument.label)}</strong><span>${escapeHtml(pendingDocument.code)} · immutable v1</span></div><button id="activate-document">Activate document</button></div>`;
  document.querySelector('#activate-document').addEventListener('click', () => { documents.push(activateOfficialDocumentType({ draft: pendingDocument, approvedByRef: adminRef, now })); pendingDocument = null; document.querySelector('#document-draft').innerHTML = '<div class="validation good">Document activated and available for association.</div>'; renderAdmin(); });
});

document.querySelector('#create-rule').addEventListener('click', () => {
  const result = createStepDocumentRuleDraft({ stepCode: document.querySelector('#rule-step').value, documentType: document.querySelector('#rule-document').value, level: document.querySelector('#rule-level').value, reason: document.querySelector('#rule-reason').value, createdByRef: adminRef, now }, documents, rules);
  if (!result.valid) return showMessage(document.querySelector('#rule-draft'), result.errors);
  pendingRule = result.draft;
  document.querySelector('#rule-draft').innerHTML = `<div class="draft"><div><strong>Association ready</strong><span>${escapeHtml(pendingRule.documentLabel)} → ${escapeHtml(pendingRule.stepLabel)}</span></div><button id="activate-rule">Activate association</button></div>`;
  document.querySelector('#activate-rule').addEventListener('click', () => { rules.push(activateStepDocumentRule({ draft: pendingRule, activeDocuments: documents, approvedByRef: adminRef, now })); pendingRule = null; document.querySelector('#rule-draft').innerHTML = '<div class="validation good">Association activated and visible in Agent View.</div>'; renderAdmin(); });
});

document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === button));
  document.querySelector('#admin-panel').classList.toggle('hidden', button.dataset.tab !== 'admin');
  document.querySelector('#agent-panel').classList.toggle('hidden', button.dataset.tab !== 'agent');
  if (button.dataset.tab === 'agent') renderAgent();
}));
document.querySelector('#step').addEventListener('change', renderAgent);
document.querySelector('#state').addEventListener('change', renderAgent);
renderAdmin();
