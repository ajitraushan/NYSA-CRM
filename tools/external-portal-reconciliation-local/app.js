import { buildExternalPortalReconciliation } from '/modules/external-portal-reconciliation-domain.js';

const evaluatedAt='2026-08-11T12:00:00.000Z';
const basePayload={reference:'NYSA-INV-SYN-018',price:1950000,status:'available',location:'COMM-MARINA'};
const base={inventoryRef:'NYSA-INV-SYN-018',lifecycleStatus:'active',publicationReady:true,mappingVersion:'portal-map-syn-v1',payload:basePayload,sourceVersion:'INV-SYN-V7'};
const esc=value=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]);
const label=value=>String(value).replaceAll('_',' ');
const portalName=value=>({property_finder:'Property Finder',bayut:'Bayut',dubizzle:'Dubizzle'})[value];
const bool=value=>value?'Yes':'No';
const displayTime=value=>value?new Date(value).toLocaleString('en-AE',{dateStyle:'medium',timeStyle:'short'}):'Not observed';
const external=(portal,extra={})=>({providerCode:portal,status:'not_discovered',mappingVersion:'portal-map-syn-v1',payload:{},...extra});

function scenario(name,portal){
  const linked={externalListingId:`${portal.toUpperCase()}-SYN-77`,linkedInventoryRef:base.inventoryRef,status:'live',mappingVersion:base.mappingVersion,payload:basePayload,observedAt:evaluatedAt};
  return{
    internal:name==='ineligible'?{...base,publicationReady:false}:base,
    external:external(portal,name==='aligned'?linked:name==='drift'?{...linked,payload:{...basePayload,price:1900000}}:name==='ineligible'?linked:name==='unlinked'?{...linked,externalListingId:`${portal.toUpperCase()}-SYN-99`,linkedInventoryRef:null}:name==='deleted'?{...linked,status:'deleted'}:{})
  };
}

function businessDifferences(result){
  if(!result.external.externalListingId)return['No linked portal listing was discovered.'];
  const keys=[...new Set([...Object.keys(result.internal.payload),...Object.keys(result.external.payload)])];
  const differences=keys.filter(key=>String(result.internal.payload[key]??'')!==String(result.external.payload[key]??''))
    .map(key=>`${label(key)}: CORE ${result.internal.payload[key]??'not maintained'} · Portal ${result.external.payload[key]??'not maintained'}`);
  if(result.internal.mappingVersion!==result.external.mappingVersion)differences.push(`mapping version: CORE ${result.internal.mappingVersion??'not maintained'} · Portal ${result.external.mappingVersion??'not maintained'}`);
  if(!result.linked)differences.push('The portal listing has no exact governed link to this CORE Inventory.');
  if(result.external.status==='deleted'||result.external.status==='unpublished')differences.push(`Portal status observed as ${label(result.external.status)}.`);
  if(!result.internal.publicationReady&&result.external.status==='live')differences.push('CORE publication readiness is blocked while the portal listing is live.');
  return differences.length?differences:['No business-field difference was detected.'];
}

async function render(){
  const name=document.querySelector('#scenario').value,portal=document.querySelector('#portal').value,input=scenario(name,portal);
  const result=await buildExternalPortalReconciliation({internal:input.internal,external:input.external,evaluatedAt}).catch(error=>({error:error.message}));
  if(result.error){document.querySelector('#summary').innerHTML=`<article class="error">${esc(result.error)}</article>`;return;}
  const actionLabel={no_action:'No action',propose_create:'Propose create',propose_reviewed_update:'Propose reviewed update',propose_unpublish_review:'Propose unpublish review',manual_match_required:'Manual match required',record_external_absence:'Record external absence'}[result.action];
  document.querySelector('#summary').innerHTML=`<article><div><span>Proposed outcome</span><strong>${actionLabel}</strong></div><div><span>Human review</span><strong>${bool(result.humanReviewRequired)}</strong></div><div><span>Automatic execution</span><strong>No</strong></div><div><span>Last checked</span><strong>${esc(displayTime(result.evaluatedAt))}</strong></div><small>${esc(portalName(portal))} reconciliation · ${esc(result.internal.inventoryRef)}</small></article>`;
  document.querySelector('#records').innerHTML=`<article><span>GOVERNED CORE PREPARATION</span><strong>${esc(result.internal.inventoryRef)}</strong><dl><div><dt>Lifecycle</dt><dd>${esc(result.internal.lifecycleStatus)}</dd></div><div><dt>Publication ready</dt><dd>${bool(result.internal.publicationReady)}</dd></div><div><dt>CORE source version</dt><dd>${esc(result.internal.sourceVersion??'Not maintained')}</dd></div><div><dt>Mapping version</dt><dd>${esc(result.internal.mappingVersion)}</dd></div></dl></article><article><span>READ-ONLY PORTAL OBSERVATION</span><strong>${esc(result.external.externalListingId??'No linked listing discovered')}</strong><dl><div><dt>Status</dt><dd>${esc(label(result.external.status))}</dd></div><div><dt>Governed link</dt><dd>${esc(result.external.linkedInventoryRef??'Not linked')}</dd></div><div><dt>Observed at</dt><dd>${esc(displayTime(result.external.observedAt))}</dd></div><div><dt>Mapping version</dt><dd>${esc(result.external.mappingVersion??'Not available')}</dd></div></dl></article>`;
  document.querySelector('#interpretation').innerHTML=`<strong>${actionLabel}</strong><p>${esc(result.reason)}</p><ul>${businessDifferences(result).map(value=>`<li>${esc(value)}</li>`).join('')}</ul>`;
  document.querySelector('#safety').innerHTML='<ul><li>External write performed: No</li><li>Published: No</li><li>Unpublished: No</li><li>Deleted: No</li><li>Internal Inventory changed: No</li><li>Separate queue created: No</li></ul>';
  const preview=result.action==='no_action'?'<strong>No reviewed action is needed.</strong><p>The evidence is retained; the systems already reconcile.</p>':`<strong>${actionLabel}</strong><p>This is a work-item proposal only. An authorized operator must later review field ownership, current evidence and connector-specific permission before any separately approved execution.</p><p>Work item: existing external portal reconciliation flow · No external call.</p>`;
  document.querySelector('#preview').innerHTML=`${preview}<details><summary>Technical audit details</summary><dl><div><dt>Reconciliation ID</dt><dd>${esc(result.reconciliationId)}</dd></div><div><dt>Evidence SHA-256</dt><dd>${esc(result.evidenceHash)}</dd></div><div><dt>CORE payload SHA-256</dt><dd>${esc(result.internalPayloadHash)}</dd></div><div><dt>Portal payload SHA-256</dt><dd>${esc(result.externalPayloadHash??'Not available')}</dd></div></dl></details>`;
}

document.querySelector('#scenario').addEventListener('change',render);
document.querySelector('#portal').addEventListener('change',render);
render();
