import { governedDocumentCatalog, prepareGovernedDocumentAssembly } from '/modules/governed-document-assembly-domain.js';

const hash = character => character.repeat(64);
const snapshot = (ref, facts, character='a') => ({ ref, version: 'v1', hash: hash(character), asOf: '2026-08-08T10:00:00.000Z', facts });
const sources = {
  organization: snapshot('ORG-SYN-1', { legalName: 'NYSA Real Estate — Synthetic', licenceReference: 'LICENCE-SYN-1' }, '1'),
  agent: snapshot('AGENT-SYN-1', { brokerReference: 'BROKER-SYN-1' }, '2'),
  seller_authority: snapshot('PARTY-SYN-SELLER-1', { partyReference: 'SELLER-SYN-1', authorityEvidenceReference: 'AUTH-SYN-1' }, '3'),
  inventory: snapshot('INV-SYN-18', { inventoryReference: 'NYSA-INV-SYN-018', propertyDescription: 'Synthetic two-bedroom apartment', askingPrice: 'AED 1,950,000', titleEvidenceReference: 'TITLE-SYN-18' }, '4'),
  commercial_terms: snapshot('TERMS-SYN-1', { mandateType: 'Exclusive', commissionTerms: 'Approved synthetic commission terms' }, '5'),
  customer: snapshot('CUSTOMER-SYN-1', { customerReference: 'CUSTOMER-SYN-1', displayName: 'Synthetic Customer One', identityStatus: 'Verified synthetic identity' }, '6'),
  requirement: snapshot('REQ-SYN-1', { requirementReference: 'REQ-SYN-1-V3', purchaseObjective: 'Primary residence', budget: 'AED 2,000,000' }, '7'),
  accepted_offer: snapshot('OFFER-SYN-1', { amount: 'AED 1,900,000', revisionReference: 'OFFER-SYN-1-R2' }, '8'),
  booking: snapshot('BOOKING-SYN-1', { bookingReference: 'BOOKING-SYN-1', status: 'Confirmed' }, '9'),
  deal_terms: snapshot('DEAL-SYN-1', { targetCompletion: '2026-10-15', additionalTerms: 'Approved synthetic additional terms' }, 'b'),
  consent_terms: snapshot('CONSENT-SYN-1', { scope: 'NYSA property updates', channels: 'Email · WhatsApp', effectiveDate: '2026-08-08', expiryDate: '2027-02-08' }, 'c'),
  developer: snapshot('DEVELOPER-SYN-1', { developerReference: 'DEVELOPER-SYN-1' }, 'd'),
  transfer_context: snapshot('TRANSFER-SYN-1', { transferReference: 'TRANSFER-SYN-1' }, 'e')
};
const templateProfile = { id: 'NYSA-MARKETING-CONSENT-SYN', version: '1', hash: hash('f'), status: 'approved' };
const externalEvidence = { evidenceReference: 'ENOC-SYN-1', issuerReference: 'DEVELOPER-SYN-1', documentHash: hash('9'), issuedAt: '2026-08-08T09:00:00.000Z', sourceInventoryVersion: 'v1' };
const catalog = governedDocumentCatalog();
const typeSelect = document.querySelector('#document-type');
typeSelect.innerHTML = catalog.map(item => `<option value="${item.code}">${item.label}</option>`).join('');

const modeLabel = mode => ({ official_system_preparation: 'Official-system preparation', core_generated: 'CORE-generated template', external_evidence_capture: 'External evidence capture', definition_required: 'Definition required' }[mode]);
document.querySelector('#catalog').innerHTML = catalog.map(item => `<button data-type="${item.code}"><strong>${item.label}</strong><span>${modeLabel(item.mode)}</span></button>`).join('');

function valueText(value){return Array.isArray(value)?value.join(' · '):String(value??'Unavailable');}
async function render(){
  const documentType=typeSelect.value,state=document.querySelector('#review-state').value,workingSources=structuredClone(sources),profile=catalog.find(item=>item.code===documentType);
  if(state==='missing'&&profile.requiredSources.length)delete workingSources[profile.requiredSources[0]];
  const evidence=documentType==='developer_e_noc'&&state==='external'?externalEvidence:null;
  const result=await prepareGovernedDocumentAssembly({documentType,sources:workingSources,templateProfile,externalEvidence:evidence,now:'2026-08-08T10:00:00.000Z'});
  document.querySelectorAll('[data-type]').forEach(button=>button.classList.toggle('active',button.dataset.type===documentType));
  document.querySelector('#heading').innerHTML=`<p class="eyebrow">${modeLabel(result.mode).toUpperCase()}</p><h2>${result.label}</h2><p>${result.purpose}</p>`;
  document.querySelector('#mapping').innerHTML=result.fieldMap.length?result.fieldMap.map(field=>`<div class="map-row"><span>${field.outputField.replaceAll('_',' ')}</span><strong>${valueText(field.value)}</strong><small>${field.sourceCode.replaceAll('_',' ')} · ${field.sourceVersion||'missing'} · ${field.editability}</small></div>`).join(''):'<div class="empty">No field map is enabled until the document meaning is confirmed.</div>';
  const ready=!result.missing.length,official=result.mode==='official_system_preparation',generated=result.mode==='core_generated';
  document.querySelector('#outcome').innerHTML=`<p class="eyebrow">CONTROLLED OUTCOME</p><h2>${result.status.replaceAll('_',' ')}</h2><p>${official?'CORE prepares the immutable data packet; the official contract remains in Dubai REST.':generated?'An approved NYSA template can be rendered only after review; this local page creates no PDF.':result.mode==='external_evidence_capture'?'CORE tracks and captures the issuer document; it does not generate it.':'Owner definition is required before this type is enabled.'}</p>${result.missing.length?`<ul>${result.missing.map(item=>`<li>${item.label}</li>`).join('')}</ul>`:'<div class="pass">All required synthetic evidence is present</div>'}<div class="manifest"><span>Manifest SHA-256</span><code>${result.manifestHash||'Not created while blocked'}</code></div><div class="boundaries"><strong>Always blocked locally</strong><span>Official contract generation: No</span><span>PDF generation: No</span><span>Submission or delivery: No</span><span>CRM write: No</span></div>`;
}
document.querySelectorAll('[data-type]').forEach(button=>button.addEventListener('click',()=>{typeSelect.value=button.dataset.type;render();}));
typeSelect.addEventListener('change',render);document.querySelector('#review-state').addEventListener('change',render);document.querySelector('#prepare').addEventListener('click',render);render();
