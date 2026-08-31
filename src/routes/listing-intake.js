import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { audit, execute, many, one, transaction, uuid } from '../db.js';
import { requireAuth } from '../auth.js';
import { isMappingException, validateListingIntakePayload } from '../listing-intake-domain.js';
import { applyListingMappings } from '../listing-mapping-domain.js';
import { inspectInventoryDuplicate,inventoryDuplicateError } from '../inventory-duplicate-gate.js';

const r=Router(),MAX_BODY_BYTES=524288,MAX_CLOCK_SKEW_MS=5*60*1000;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const safeEqual=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);};

function providerConfiguration(provider){
  let secrets={},actors={};
  try{secrets=JSON.parse(process.env.LISTING_INTAKE_PROVIDER_SECRETS||'{}');}catch{}
  try{actors=JSON.parse(process.env.LISTING_INTAKE_PROVIDER_ACTORS||'{}');}catch{}
  return{secret:secrets[provider]||process.env.LISTING_INTAKE_SECRET||'',actorId:actors[provider]||process.env.LISTING_INTAKE_ACTOR_ID||''};
}
function authenticate(req,provider){
  if(String(req.headers['x-nysa-provider']||'').toLowerCase()!==provider)return{status:401,error:'Authenticated provider does not match the event provider'};
  const {secret}=providerConfiguration(provider),timestamp=String(req.headers['x-nysa-timestamp']||''),signature=String(req.headers['x-nysa-signature']||'').replace(/^sha256=/,'');
  if(secret.length<32)return{status:503,error:'Listing intake is not configured for this provider'};
  const time=Number(timestamp);if(!Number.isFinite(time)||Math.abs(Date.now()-time)>MAX_CLOCK_SKEW_MS)return{status:401,error:'Invalid or expired request authentication'};
  const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.${req.rawBody||''}`).digest('hex');
  return safeEqual(signature,expected)?null:{status:401,error:'Invalid or expired request authentication'};
}
async function assignedActor(provider){
  const {actorId}=providerConfiguration(provider);
  return actorId?one("SELECT id FROM brokers WHERE id=$1 AND status='active' AND role IN ('admin','internal_broker') AND (role='admin' OR job_role IN ('listing_agent','manager','admin_assistant'))",[actorId]):null;
}
async function translateProviderPayload(payload={},options={}){
  const provider=String(payload.provider||'').trim().toLowerCase(),versionCode=String(payload.mappingVersion||'').trim();
  if(!provider||!versionCode)return{payload,mappingVersionId:null,applied:[]};
  const version=options.currentActive
    ?await one("SELECT id,version_code FROM listing_mapping_versions WHERE provider_code=$1 AND status='active'",[provider])
    :await one("SELECT id,version_code FROM listing_mapping_versions WHERE provider_code=$1 AND version_code=$2 AND status='active'",[provider,versionCode]);
  if(!version){const governed=await one('SELECT id FROM listing_mapping_versions WHERE provider_code=$1 LIMIT 1',[provider]);return governed?{payload,mappingVersionId:null,applied:[],error:'The provider mapping version is not Active',code:'UNMAPPED_MAPPING_VERSION'}:{payload,mappingVersionId:null,applied:[]};}
  const entries=await many('SELECT field_code,external_value,core_value FROM listing_value_mappings WHERE version_id=$1',[version.id]);
  const translated=applyListingMappings(payload,entries);translated.payload.mappingVersion=version.versionCode;
  return{...translated,mappingVersionId:version.id};
}
async function recordRejected(value,payloadHash,actor,status,code,detail,mappingVersionId=null){
  try{return await one(`INSERT INTO listing_intake_events(id,event_id,provider_code,source_kind,external_record_id,mapping_version,received_mapping_version,mapping_version_id,payload_hash,received_payload_hash,payload,received_payload,status,error_code,error_detail,assigned_to,processed_at)
    VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$8,$9,$9,$10,$11,$12,$13,NOW()) RETURNING *`,[uuid(),value.eventId,value.provider,value.sourceKind,value.externalRecordId,value.mappingVersion,mappingVersionId,payloadHash,value,status,code,detail,actor.id]);}
  catch(error){if(error.code==='23505')return null;throw error;}
}
async function processEventWithClient(event,value,actor,mappingContext={},client){
    await execute('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',[value.provider,value.externalRecordId],client);
    const area=await one('SELECT id,business_label FROM areas WHERE stable_code=$1 AND active=1',[value.listing.areaCode],client);
    if(!area){await execute("UPDATE listing_intake_events SET status='unmapped',error_code='UNMAPPED_AREA',error_detail=$1,processed_at=NOW() WHERE id=$2",[`No active Area is mapped to ${value.listing.areaCode}`,event.id],client);return{status:'unmapped',eventId:event.eventId,error:'Area code requires mapping'};}
    const duplicate=await one('SELECT id,workflow_status FROM listings WHERE source_provider=$1 AND external_record_id=$2 AND deleted_at IS NULL',[value.provider,value.externalRecordId],client);
    if(duplicate){await execute("UPDATE listing_intake_events SET status='duplicate_review',duplicate_listing_id=$1,error_code='DUPLICATE_EXTERNAL_RECORD',error_detail='Existing NYSA inventory requires review; no fields were overwritten',processed_at=NOW() WHERE id=$2",[duplicate.id,event.id],client);await audit('ListingIntake',event.id,'duplicate_review',actor.id,{existingListingId:duplicate.id,eventId:event.eventId},client);return{status:'duplicate_review',eventId:event.eventId,existingListingId:duplicate.id,error:'Existing inventory requires review; no listing was created or overwritten'};}
    const b=value.listing,id=uuid();
    if(value.sourceKind==='import'){
      const identityResult=await inspectInventoryDuplicate({...b,areaId:area.id},{client});
      const identityError=inventoryDuplicateError(identityResult);
      if(identityError){await execute(`UPDATE listing_intake_events SET status='duplicate_review',duplicate_listing_id=$1,error_code=$2,error_detail=$3,processed_at=NOW() WHERE id=$4`,
        [identityResult.match?.id||null,identityError.code,identityError.error,event.id],client);await audit('ListingIntake',event.id,'duplicate_review',actor.id,
        {existingListingId:identityResult.match?.id||null,eventId:event.eventId,reasonCode:identityError.code},client);return{status:'duplicate_review',eventId:event.eventId,
        existingListingId:identityResult.match?.id||null,inventoryReference:identityResult.match?.inventoryReference||null,error:identityError.error};}
    }
    const listing=await one(`INSERT INTO listings(id,inventory_headline,project,developer,area,area_id,community,unit_reference,building,property_type,bedrooms,size_sqft,price,reference_price,currency,payment_plan_type,
      down_payment_percent,on_handover_percent,post_handover_years,payment_plan_notes,handover_date,handover_status,handover_expected_date,exclusivity_tier,posted_by,contact,notes,
      portal_status,workflow_status,source_kind,source_provider,external_record_id,source_mapping_version,source_mapping_version_id,responsible_agent_id,originating_agent_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'blocked','draft',$28,$29,$30,$31,$32,$33,$34) RETURNING *`,
      [id,b.inventoryHeadline||b.project,b.project,b.developer,area.businessLabel,area.id,b.community,b.unitReference,b.building,b.propertyType,b.bedrooms,b.sizeSqft,b.price,b.referencePrice,b.currency,b.paymentPlanType,b.downPaymentPercent,b.onHandoverPercent,b.postHandoverYears,b.paymentPlanNotes,b.handoverDate,b.handoverStatus,b.handoverExpectedDate,b.exclusivityTier,actor.id,b.contact,b.notes,value.sourceKind,value.provider,value.externalRecordId,value.mappingVersion,mappingContext.mappingVersionId||null,b.responsibleAgentId||actor.id,b.originatingAgentId||actor.id],client);
    await execute(`INSERT INTO inventory_agent_assignment_history(id,listing_id,originating_agent_id,to_responsible_agent_id,source_kind,source_reference,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[uuid(),listing.id,listing.originatingAgentId,listing.responsibleAgentId,value.sourceKind,
      value.externalRecordId,'Initial Inventory attribution resolved from governed intake',actor.id],client);
    let ownerPartyId=null;
    if(b.owner){
      ownerPartyId=uuid();
      await one(`INSERT INTO inventory_counterparties(id,listing_id,party_role,party_type,display_name,phone,email,source,authority_evidence,identity_snapshot,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) RETURNING id`,[ownerPartyId,listing.id,b.owner.partyRole,b.owner.partyType,b.owner.displayName,
        b.owner.phone,b.owner.email,b.owner.source,b.owner.authorityEvidence,JSON.stringify({sourceKind:value.sourceKind,provider:value.provider,externalRecordId:value.externalRecordId,
          mappingVersion:value.mappingVersion,displayName:b.owner.displayName,partyRole:b.owner.partyRole,partyType:b.owner.partyType,phone:b.owner.phone,email:b.owner.email}),actor.id],client);
      await audit('InventoryCounterparty',ownerPartyId,'created_from_intake',actor.id,{listingId:listing.id,sourceKind:value.sourceKind,provider:value.provider,
        externalRecordId:value.externalRecordId,partyRole:b.owner.partyRole,partyType:b.owner.partyType},client);
    }
    await execute("UPDATE listing_intake_events SET status='accepted',listing_id=$1,error_code=NULL,error_detail=NULL,processed_at=NOW() WHERE id=$2",[listing.id,event.id],client);
    await audit('Listing',listing.id,'draft_created',actor.id,{sourceKind:value.sourceKind,provider:value.provider,externalRecordId:value.externalRecordId,eventId:value.eventId,mappingVersion:value.mappingVersion,mappingVersionId:mappingContext.mappingVersionId||null,appliedMappings:mappingContext.applied||[],ownerPartyId},client);
    await audit('ListingIntake',event.id,'accepted',actor.id,{listingId:listing.id,eventId:value.eventId},client);
    if(!listing.inventoryReference)throw new Error('CORE did not generate the required Inventory reference');
    return{status:'accepted',eventId:value.eventId,listingId:listing.id,inventoryReference:listing.inventoryReference,ownerPartyId};
}
async function processEvent(event,value,actor,mappingContext={}){
  return transaction(client=>processEventWithClient(event,value,actor,mappingContext,client));
}

r.post('/intake/listings',async(req,res)=>{
  if(Buffer.byteLength(req.rawBody||'')>MAX_BODY_BYTES)return res.status(413).json({error:'Listing intake body is too large'});
  const raw=req.body||{},provider=String(raw.provider||'').trim().toLowerCase(),auth=authenticate(req,provider);if(auth)return res.status(auth.status).json({error:auth.error});
  const actor=await assignedActor(provider);if(!actor)return res.status(503).json({error:'Listing intake has no active NYSA reviewer for this provider'});
  const translated=await translateProviderPayload(raw),checked=translated.error?{error:translated.error,code:translated.code}:validateListingIntakePayload(translated.payload);
  if(checked.error){
    const metadata={eventId:String(raw.eventId||'').trim(),provider,sourceKind:['integration','import'].includes(raw.sourceKind)?raw.sourceKind:'integration',externalRecordId:String(raw.externalRecordId||'').trim(),mappingVersion:String(raw.mappingVersion||'').trim(),listing:raw.listing||{}};
    if(metadata.eventId&&metadata.externalRecordId&&metadata.mappingVersion){
      const payloadHash=hash(req.rawBody||''),existing=await one('SELECT * FROM listing_intake_events WHERE provider_code=$1 AND event_id=$2',[provider,metadata.eventId]);
      if(existing)return res.status(409).json({error:'Event is already in the controlled intake queue',status:existing.status});
      await recordRejected(metadata,payloadHash,actor,isMappingException(checked.code)?'unmapped':'failed',checked.code,checked.error,translated.mappingVersionId);
    }
    return res.status(400).json({error:checked.error,code:checked.code});
  }
  const value=checked.value;
  const payloadHash=hash(req.rawBody||''),existing=await one('SELECT * FROM listing_intake_events WHERE provider_code=$1 AND event_id=$2',[value.provider,value.eventId]);
  if(existing){if((existing.receivedPayloadHash||existing.payloadHash)!==payloadHash)return res.status(409).json({error:'Event identifier was already used with different data'});if(existing.status==='accepted')return res.json({status:'accepted',eventId:existing.eventId,listingId:existing.listingId,idempotent:true});return res.status(409).json({error:'Event is already in the controlled intake queue',status:existing.status});}
  const event=await one(`INSERT INTO listing_intake_events(id,event_id,provider_code,source_kind,external_record_id,mapping_version,received_mapping_version,mapping_version_id,payload_hash,received_payload_hash,payload,received_payload,status,assigned_to)
    VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,$8,$9,$10,'processing',$11) ON CONFLICT(provider_code,event_id) DO NOTHING RETURNING *`,[uuid(),value.eventId,value.provider,value.sourceKind,value.externalRecordId,value.mappingVersion,translated.mappingVersionId,payloadHash,value,raw,actor.id]);
  if(!event){const raced=await one('SELECT * FROM listing_intake_events WHERE provider_code=$1 AND event_id=$2',[value.provider,value.eventId]),same=(raced?.receivedPayloadHash||raced?.payloadHash)===payloadHash;if(same&&raced.status==='accepted')return res.json({status:'accepted',eventId:raced.eventId,listingId:raced.listingId,idempotent:true});return res.status(409).json({error:same?'Event is already being processed or queued':'Event identifier was already used with different data',status:raced?.status});}
  try{const result=await processEvent(event,value,actor,translated);return res.status(result.status==='accepted'?201:409).json(result);}
  catch(error){await execute("UPDATE listing_intake_events SET status='failed',error_code='PROCESSING_FAILED',error_detail='Processing failed; review server diagnostics by event ID',processed_at=NOW() WHERE id=$1",[event.id]);throw error;}
});

function queueAccess(req,res,next){if(req.broker.role!=='admin'&&!['listing_agent','manager','admin_assistant'].includes(req.broker.jobRole))return res.status(403).json({error:'Listing intake queue is outside your role'});next();}
r.get('/listing-intake',requireAuth,queueAccess,async(req,res)=>{
  const params=[],where=[];
  if(req.broker.jobRole==='manager'&&req.broker.role!=='admin'){params.push(req.broker.managedTeamIds||[]);where.push(`b.team_id=ANY($${params.length}::uuid[])`);}
  else if(req.broker.role!=='admin'&&req.broker.jobRole!=='admin_assistant'){params.push(req.broker.id);where.push(`e.assigned_to=$${params.length}`);}
  if(['processing','accepted','failed','unmapped','duplicate_review'].includes(req.query.status)){params.push(req.query.status);where.push(`e.status=$${params.length}`);}
  const events=await many(`SELECT e.id,e.event_id,e.provider_code,e.source_kind,e.external_record_id,e.mapping_version,e.received_mapping_version,e.status,e.error_code,e.error_detail,e.listing_id,e.duplicate_listing_id,e.attempt_count,e.received_at,e.processed_at,b.name AS assigned_to_name
    FROM listing_intake_events e JOIN brokers b ON b.id=e.assigned_to ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY e.received_at DESC LIMIT 200`,params);
  res.json({events});
});
r.post('/listing-intake/:provider/:eventId/replay',requireAuth,queueAccess,async(req,res)=>{
  const current=await one(`SELECT e.*,b.team_id AS assigned_team_id FROM listing_intake_events e JOIN brokers b ON b.id=e.assigned_to
    WHERE e.provider_code=$1 AND e.event_id=$2`,[req.params.provider,req.params.eventId]);if(!current)return res.status(404).json({error:'Listing intake event not found'});
  if(!['failed','unmapped'].includes(current.status))return res.status(409).json({error:'Only failed or unmapped events can be corrected and replayed'});
  if(req.broker.role!=='admin'&&req.broker.jobRole==='manager'&&!(req.broker.managedTeamIds||[]).includes(String(current.assignedTeamId||'')))return res.status(403).json({error:'This intake exception is outside your managed team'});
  if(req.broker.role!=='admin'&&!['manager','admin_assistant'].includes(req.broker.jobRole)&&current.assignedTo!==req.broker.id)return res.status(403).json({error:'This intake exception is assigned to another reviewer'});
  const candidate={...(current.payload||{}),...(req.body||{}),eventId:current.eventId,provider:current.providerCode,externalRecordId:current.externalRecordId},translated=await translateProviderPayload(candidate,{currentActive:true});
  const checked=translated.error?{error:translated.error,code:translated.code}:validateListingIntakePayload(translated.payload);if(checked.error)return res.status(400).json({error:checked.error,code:checked.code});
  const event=await one("UPDATE listing_intake_events SET status='processing',payload=$1,payload_hash=$2,mapping_version=$3,mapping_version_id=$4,attempt_count=attempt_count+1,replayed_by=$5,error_code=NULL,error_detail=NULL,processed_at=NULL WHERE id=$6 RETURNING *",[checked.value,hash(JSON.stringify(checked.value)),checked.value.mappingVersion,translated.mappingVersionId,req.broker.id,current.id]);
  try{const result=await processEvent(event,checked.value,{id:current.assignedTo},translated);return res.status(result.status==='accepted'?200:409).json(result);}
  catch(error){await execute("UPDATE listing_intake_events SET status='failed',error_code='PROCESSING_FAILED',error_detail='Replay failed; review server diagnostics by event ID',processed_at=NOW() WHERE id=$1",[event.id]);throw error;}
});

export { authenticate, processEvent, processEventWithClient, providerConfiguration, translateProviderPayload };
export default r;
