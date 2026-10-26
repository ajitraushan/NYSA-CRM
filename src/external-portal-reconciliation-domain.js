export const EXTERNAL_PORTAL_RECONCILIATION_POLICY_VERSION='r4-external-portal-reconciliation-v1';
export const EXTERNAL_PORTAL_RECONCILIATION_ACTIONS=Object.freeze(['no_action','propose_create','propose_reviewed_update','propose_unpublish_review','manual_match_required','record_external_absence']);

const clean=value=>String(value??'').trim();
const normalized=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const instant=value=>{const text=clean(value);return text&&Number.isFinite(Date.parse(text))?new Date(text).toISOString():null;};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const sha256=async value=>{
  const bytes=new TextEncoder().encode(JSON.stringify(stable(value)));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
};

function internalSnapshot(value={}){
  if(!clean(value.inventoryRef))throw new Error('Internal Inventory reference is required');
  return{inventoryRef:clean(value.inventoryRef),lifecycleStatus:normalized(value.lifecycleStatus)||'active',publicationReady:value.publicationReady===true,
    mappingVersion:clean(value.mappingVersion)||null,payload:value.payload&&typeof value.payload==='object'?stable(value.payload):{},sourceVersion:clean(value.sourceVersion)||null};
}
function externalSnapshot(value={}){
  const providerCode=normalized(value.providerCode);if(!['property_finder','bayut','dubizzle'].includes(providerCode))throw new Error('Select a supported external portal');
  const status=normalized(value.status)||'not_discovered';
  if(!['not_discovered','draft','live','unpublished','deleted'].includes(status))throw new Error('External listing status is invalid');
  return{providerCode,externalListingId:clean(value.externalListingId)||null,linkedInventoryRef:clean(value.linkedInventoryRef)||null,status,
    mappingVersion:clean(value.mappingVersion)||null,payload:value.payload&&typeof value.payload==='object'?stable(value.payload):{},observedAt:instant(value.observedAt)};
}

export async function buildExternalPortalReconciliation({internal,external,evaluatedAt}){
  const at=instant(evaluatedAt);if(!at)throw new Error('evaluatedAt must be an ISO timestamp');
  const core=internalSnapshot(internal),portal=externalSnapshot(external);
  const internalPayloadHash=await sha256({mappingVersion:core.mappingVersion,payload:core.payload});
  const externalPayloadHash=portal.externalListingId?await sha256({mappingVersion:portal.mappingVersion,payload:portal.payload}):null;
  const linked=Boolean(portal.externalListingId&&portal.linkedInventoryRef===core.inventoryRef);
  const foreignOrUnlinked=Boolean(portal.externalListingId&&!linked);
  const externalAbsent=!portal.externalListingId||portal.status==='not_discovered';
  const payloadAligned=linked&&core.mappingVersion===portal.mappingVersion&&internalPayloadHash===externalPayloadHash;
  let action='no_action',reason='The linked external listing already reconciles to the governed CORE preparation.';
  if(foreignOrUnlinked){action='manual_match_required';reason='An external listing exists without an exact governed link to this Inventory.';}
  else if(linked&&['deleted','unpublished'].includes(portal.status)){action='record_external_absence';reason='External absence is evidence only and never deletes or closes Internal Inventory.';}
  else if(linked&&portal.status==='live'&&(!core.publicationReady||core.lifecycleStatus!=='active')){action='propose_unpublish_review';reason='The live external listing conflicts with current internal publication eligibility.';}
  else if(linked&&!payloadAligned){action='propose_reviewed_update';reason='The linked record differs from the current versioned CORE preparation and requires reviewed field ownership.';}
  else if(externalAbsent&&core.publicationReady&&core.lifecycleStatus==='active'){action='propose_create';reason='No linked external listing was discovered and the governed CORE preparation is ready.';}
  else if(externalAbsent){action='no_action';reason='No linked external listing exists and Internal Inventory is not eligible for a create proposal.';}
  const evidence={policyVersion:EXTERNAL_PORTAL_RECONCILIATION_POLICY_VERSION,evaluatedAt:at,internal:core,external:portal,internalPayloadHash,externalPayloadHash,linked,payloadAligned,action,reason};
  const evidenceHash=await sha256(evidence);
  return{...evidence,reconciliationId:`PORTAL-REC-${evidenceHash.slice(0,16).toUpperCase()}`,evidenceHash,
    humanReviewRequired:!['no_action'].includes(action),externalReadOnlyEvidence:true,externalWritePerformed:false,publicationPerformed:false,
    unpublicationPerformed:false,deletionPerformed:false,internalInventoryChanged:false,automaticExecutionAllowed:false,
    proposedAction:action,existingWorkItemRequest:action==='no_action'?null:{action:'create_or_update_existing_work_item',type:'external_portal_reconciliation',subjectRefs:[core.inventoryRef,portal.externalListingId].filter(Boolean),separateQueueCreated:false}};
}
