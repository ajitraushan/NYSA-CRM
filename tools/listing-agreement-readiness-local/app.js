import { evaluateListingAgreementReadiness } from '/modules/listing-agreement-readiness-domain.js';

const now = '2026-08-08T10:00:00.000Z';
const inventory = { inventoryRef: 'NYSA-INV-SYN-018', snapshotVersion: 'INV-SNAPSHOT-SYN-7', askingPrice: 1950000, currency: 'AED', verificationStatus: 'verified', availabilityStatus: 'Available' };
const authority = { partyRef: 'PARTY-SYN-018', authorityEvidenceRef: 'AUTH-SYN-018-V2', authorityStatus: 'verified', validUntil: '2026-12-31T23:59:59.000Z' };
const terms = { approvedTemplateRef: 'LISTING-AGREEMENT-TEMPLATE-SYN-V1', mandateType: 'exclusive', validFrom: '2026-08-08T00:00:00.000Z', validUntil: '2026-11-08T00:00:00.000Z', askingPrice: 1950000, currency: 'AED', marketingChannels: ['property_finder', 'company_website'], specialTermsReviewed: true };
const draft = { draftRef: 'AGREEMENT-DRAFT-SYN-018', draftVersion: '1', inventorySnapshotVersion: 'INV-SNAPSHOT-SYN-7', templateRef: 'LISTING-AGREEMENT-TEMPLATE-SYN-V1', preparedAt: '2026-08-08T08:00:00.000Z' };
const signed = { agreementRef: 'AGREEMENT-SYN-018', draftRef: 'AGREEMENT-DRAFT-SYN-018', documentHash: 'a'.repeat(64), signedAt: '2026-08-08T09:00:00.000Z', partyRef: 'PARTY-SYN-018', authorityEvidenceRef: 'AUTH-SYN-018-V2', templateRef: 'LISTING-AGREEMENT-TEMPLATE-SYN-V1', validFrom: '2026-08-08T00:00:00.000Z', validUntil: '2026-11-08T00:00:00.000Z' };
const publicationReady = { status: 'ready', evidenceRef: 'PUBLICATION-READINESS-SYN-018-V4' };

const scenarios = {
  missing: { inventory, partyAuthority: { ...authority, authorityEvidenceRef: '', authorityStatus: 'unverified' }, controlledTerms: terms, publicationReadiness: publicationReady },
  ready: { inventory, partyAuthority: authority, controlledTerms: terms, publicationReadiness: publicationReady },
  signature: { inventory, partyAuthority: authority, controlledTerms: terms, draftEvidence: draft, publicationReadiness: publicationReady },
  signedBlocked: { inventory, partyAuthority: authority, controlledTerms: terms, draftEvidence: draft, signedEvidence: signed, publicationReadiness: { status: 'blocked', evidenceRef: 'PUBLICATION-READINESS-SYN-018-V4' } },
  eligible: { inventory, partyAuthority: authority, controlledTerms: terms, draftEvidence: draft, signedEvidence: signed, publicationReadiness: publicationReady }
};

const title = value => value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

function render() {
  const result = evaluateListingAgreementReadiness({ ...scenarios[document.querySelector('#scenario').value], now });
  document.querySelector('#summary').innerHTML = `
    <article><span>Internal Inventory</span><strong class="good">Maintainable</strong><small>Agreement is not a prerequisite</small></article>
    <article><span>Agreement workflow</span><strong>${title(result.agreement.state)}</strong><small>${result.agreement.missingInputs.length} missing input(s)</small></article>
    <article><span>External listing gate</span><strong class="${result.externalListingGate.eligible ? 'good' : 'bad'}">${result.externalListingGate.eligible ? 'Eligible — not published' : 'Blocked'}</strong><small>Publication performed: No</small></article>`;

  const evidenceGroups = [
    ['Maintained Inventory snapshot', [['Inventory reference', result.inventoryFacts.inventoryRef], ['Snapshot version', result.inventoryFacts.snapshotVersion], ['Asking price', `${result.inventoryFacts.currency} ${result.inventoryFacts.askingPrice?.toLocaleString()}`], ['Verification', result.inventoryFacts.verificationStatus]]],
    ['Represented party and authority', [['Party reference', result.authorityFacts.partyRef || 'Unavailable'], ['Authority evidence', result.authorityFacts.authorityEvidenceRef || 'Unavailable'], ['Authority status', result.authorityFacts.authorityStatus || 'Unavailable'], ['Valid until', result.authorityFacts.validUntil || 'Unavailable']]],
    ['Agent-controlled completion', [['Approved template', result.controlledTerms.approvedTemplateRef], ['Mandate type', title(result.controlledTerms.mandateType)], ['Agreement period', `${result.controlledTerms.validFrom} — ${result.controlledTerms.validUntil}`], ['Marketing scope', result.controlledTerms.marketingChannels.map(title).join(' · ')], ['Special terms', result.controlledTerms.specialTermsReviewed ? 'Reviewed' : 'Pending']]],
    ['Signed-agreement evidence', [['Draft evidence', result.agreement.draftAccepted ? 'Accepted' : 'Not captured / accepted'], ['Signed evidence', result.agreement.signedEvidenceAccepted ? 'Accepted' : 'Not captured / accepted'], ['Document content', 'Not displayed in this local module']]]
  ];
  document.querySelector('#evidence').innerHTML = evidenceGroups.map(([heading, rows]) => `<article><h2>${heading}</h2>${rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</article>`).join('');

  const blockers = [...result.agreement.missingInputs, ...result.agreement.signedBlockers, ...result.externalListingGate.blockers]
    .filter((item, index, all) => all.findIndex(candidate => candidate.code === item.code) === index);
  document.querySelector('#gate').innerHTML = `<p class="eyebrow">DECISION GATE</p><h2>${result.externalListingGate.eligible ? 'Evidence complete' : 'External listing remains blocked'}</h2><p>${result.externalListingGate.eligible ? 'Both required evidence gates pass. This prototype still performs no publication.' : 'Complete or correct the governed evidence below. Internal Inventory work may continue.'}</p><ul>${blockers.length ? blockers.map(item => `<li>${item.label}</li>`).join('') : '<li class="clear">No blocker evidenced</li>'}</ul><div class="boundary"><strong>Always unchanged here</strong><span>Inventory status</span><span>Owner/authority records</span><span>Portal publication state</span></div>`;
}

document.querySelector('#scenario').addEventListener('change', render);
render();
