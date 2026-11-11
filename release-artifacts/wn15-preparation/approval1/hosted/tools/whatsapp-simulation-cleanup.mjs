import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256=/^[0-9a-f]{64}$/i;
const PRECEDENCE=['wrong_number','dncr','do_not_contact','opt_out'];
const numeric=value=>Number(value||0);
const sorted=items=>[...items].map(String).sort();
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,Object.keys(value).sort());

export function validateRunId(value){
  const runId=String(value||'').trim();
  if(!UUID.test(runId))throw new Error('A valid exact simulation run UUID is required');
  return runId;
}

export function removeRunEvidenceFromRestrictions(restrictions,evidenceReferences){
  const exact=new Set(evidenceReferences),source=restrictions&&typeof restrictions==='object'&&!Array.isArray(restrictions)?restrictions:{};
  const retained={},removed=[];
  for(const [type,value] of Object.entries(source)){
    if(value&&exact.has(value.evidenceReference))removed.push(type);
    else retained[type]=value;
  }
  const strongest=PRECEDENCE.find(type=>retained[type]?.active===true)||null;
  return{retained,removed:removed.sort(),strongest};
}

export function assertScopeMatches(observed,approved){
  if(observed.runId!==approved.runId)throw new Error(`Cleanup run mismatch: expected ${approved.runId}, observed ${observed.runId}`);
  if(observed.scopeFingerprint!==approved.scopeFingerprint)throw new Error(`Cleanup scope fingerprint mismatch: expected ${approved.scopeFingerprint}, observed ${observed.scopeFingerprint}`);
  const expected=stable(approved.counts),actual=stable(observed.counts);
  if(actual!==expected)throw new Error(`Cleanup count mismatch: expected ${expected}, observed ${actual}`);
}

export function validateCleanupProof({remainingGeneratedRows,retainedRun,retainedProviderEvents},scope){
  const nonzero=Object.entries(remainingGeneratedRows).filter(([,value])=>value!==0);
  if(nonzero.length)throw new Error(`Run-scoped cleanup verification failed: ${JSON.stringify(Object.fromEntries(nonzero))}`);
  if(retainedRun.length!==1||retainedRun[0].status!=='cleaned'||!retainedRun[0].cleaned_at)throw new Error('Run-scoped cleanup did not retain exactly one cleaned run record');
  if(retainedProviderEvents!==scope.counts.providerEvents)throw new Error(`Provider-event retention mismatch: expected ${scope.counts.providerEvents}, observed ${retainedProviderEvents}`);
  return{remainingGeneratedRows,retainedEvidence:{runRecords:1,providerEvents:retainedProviderEvents,status:'cleaned'}};
}

async function rows(client,text,params=[]){return (await client.query(text,params)).rows;}
async function count(client,text,params=[]){return numeric((await client.query(text,params)).rows[0]?.count);}

export async function collectCleanupScope(client,rawRunId){
  const runId=validateRunId(rawRunId),runRows=await rows(client,'SELECT id,created_by,status FROM wa_simulation_runs WHERE id=$1',[runId]);
  if(runRows.length!==1)throw new Error(`Simulation run ${runId} was not found exactly once`);
  const events=await rows(client,'SELECT id,provider_event_id FROM wa_simulated_provider_events WHERE simulation_run_id=$1 ORDER BY id',[runId]);
  const evidenceReferences=events.map(row=>`SIM-${row.provider_event_id}`),conversations=await rows(client,'SELECT id,lead_id,contact_id FROM wa_conversations WHERE simulated=TRUE AND simulation_run_id=$1 ORDER BY id',[runId]);
  const conversationIds=conversations.map(row=>row.id),leadIds=sorted(new Set(conversations.map(row=>row.lead_id).filter(Boolean))),contactIds=sorted(new Set(conversations.map(row=>row.contact_id).filter(Boolean)));
  const suppressions=evidenceReferences.length?await rows(client,`SELECT s.normalized_phone,s.restrictions
    FROM wa_contact_suppressions s WHERE EXISTS(
      SELECT 1 FROM jsonb_each(s.restrictions) item WHERE item.value->>'evidenceReference'=ANY($1::text[])
    ) ORDER BY s.normalized_phone`,[evidenceReferences]):[];
  const suppressionRestrictions=suppressions.reduce((total,row)=>total+removeRunEvidenceFromRestrictions(row.restrictions,evidenceReferences).removed.length,0);
  const counts={
    runs:1,
    providerEvents:events.length,
    conversations:conversations.length,
    messages:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_conversation_messages WHERE conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    notifications:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_inbox_notifications WHERE conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    assignmentHistory:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_conversation_assignment_history WHERE conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    campaignRecipientLinks:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_campaign_approval_recipients WHERE simulated_conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    leads:leadIds.length,
    contacts:contactIds.length,
    suppressionRows:suppressions.length,
    suppressionRestrictions,
    retainedAuditRows:events.length?await count(client,`SELECT COUNT(*)::int AS count FROM audit_log
      WHERE details->>'providerEventId'=ANY($1::text[])`,[events.map(row=>row.provider_event_id)]):0
  };
  const identity={runId,eventIds:sorted(events.map(row=>row.id)),providerEventIds:sorted(events.map(row=>row.provider_event_id)),conversationIds:sorted(conversationIds),leadIds,contactIds,suppressionEvidenceHashes:sorted(evidenceReferences.map(sha256))};
  return{runId,createdBy:runRows[0].created_by,status:runRows[0].status,counts,scopeFingerprint:sha256(JSON.stringify(identity)),identity,evidenceReferences,suppressions};
}

async function proveCleanup(client,scope){
  const conversationIds=scope.identity.conversationIds,leadIds=scope.identity.leadIds,contactIds=scope.identity.contactIds,evidenceReferences=scope.evidenceReferences;
  const remainingGeneratedRows={
    conversations:await count(client,'SELECT COUNT(*)::int AS count FROM wa_conversations WHERE simulation_run_id=$1',[scope.runId]),
    messages:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_conversation_messages WHERE conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    notifications:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_inbox_notifications WHERE conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    assignmentHistory:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_conversation_assignment_history WHERE conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    campaignRecipientLinks:conversationIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM wa_campaign_approval_recipients WHERE simulated_conversation_id=ANY($1::uuid[])',[conversationIds]):0,
    leads:leadIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM leads WHERE id=ANY($1::uuid[])',[leadIds]):0,
    contacts:contactIds.length?await count(client,'SELECT COUNT(*)::int AS count FROM contacts WHERE id=ANY($1::uuid[])',[contactIds]):0,
    suppressionRestrictions:evidenceReferences.length?await count(client,`SELECT COUNT(*)::int AS count FROM wa_contact_suppressions s,
      LATERAL jsonb_each(s.restrictions) item WHERE item.value->>'evidenceReference'=ANY($1::text[])`,[evidenceReferences]):0
  };
  const retainedRun=await rows(client,'SELECT id,status,cleaned_at FROM wa_simulation_runs WHERE id=$1',[scope.runId]);
  const retainedProviderEvents=await count(client,'SELECT COUNT(*)::int AS count FROM wa_simulated_provider_events WHERE simulation_run_id=$1',[scope.runId]);
  return validateCleanupProof({remainingGeneratedRows,retainedRun,retainedProviderEvents},scope);
}

export async function applyCleanup(client,scope,approvedDryRunSha256){
  const locked=(await rows(client,'SELECT id FROM wa_simulation_runs WHERE id=$1 FOR UPDATE',[scope.runId])).length;
  if(locked!==1)throw new Error('Simulation run could not be locked exactly once');
  const observed=await collectCleanupScope(client,scope.runId);
  assertScopeMatches(observed,scope);
  if(observed.counts.campaignRecipientLinks!==0)throw new Error(`Run-scoped cleanup refuses ${observed.counts.campaignRecipientLinks} campaign recipient link(s); no campaign rows are approved for deletion or modification`);
  let removedSuppressionRestrictions=0;
  for(const row of observed.suppressions){
    const change=removeRunEvidenceFromRestrictions(row.restrictions,observed.evidenceReferences);
    removedSuppressionRestrictions+=change.removed.length;
    if(!change.strongest)await client.query('DELETE FROM wa_contact_suppressions WHERE normalized_phone=$1',[row.normalized_phone]);
    else{
      const active=change.retained[change.strongest];
      await client.query(`UPDATE wa_contact_suppressions SET suppression_type=$1,evidence_reference=$2,recorded_by=$3,
        recorded_at=$4,audit_expires_at=$5,restrictions=$6,updated_at=NOW() WHERE normalized_phone=$7`,
      [change.strongest,active.evidenceReference,active.recordedBy,active.recordedAt,active.auditExpiresAt,change.retained,row.normalized_phone]);
    }
  }
  if(removedSuppressionRestrictions!==scope.counts.suppressionRestrictions)throw new Error(`Suppression cleanup count mismatch: expected ${scope.counts.suppressionRestrictions}, observed ${removedSuppressionRestrictions}`);
  const conversationIds=scope.identity.conversationIds;
  if(conversationIds.length){
    await client.query('DELETE FROM wa_conversation_assignment_history WHERE conversation_id=ANY($1::uuid[])',[conversationIds]);
    await client.query('DELETE FROM wa_conversations WHERE id=ANY($1::uuid[])',[conversationIds]);
  }
  if(scope.identity.leadIds.length)await client.query('DELETE FROM leads WHERE id=ANY($1::uuid[])',[scope.identity.leadIds]);
  if(scope.identity.contactIds.length)await client.query('DELETE FROM contacts WHERE id=ANY($1::uuid[])',[scope.identity.contactIds]);
  const deletedCounts={
    conversations:scope.counts.conversations,messages:scope.counts.messages,notifications:scope.counts.notifications,
    assignmentHistory:scope.counts.assignmentHistory,leads:scope.counts.leads,contacts:scope.counts.contacts,
    suppressionRestrictions:scope.counts.suppressionRestrictions
  };
  await client.query(`UPDATE wa_simulation_runs SET status='cleaned',cleaned_at=NOW(),
    result=COALESCE(result,'{}'::jsonb)||$2::jsonb WHERE id=$1`,[scope.runId,JSON.stringify({runScopedCleanup:true,deletedCounts,providerEventsRetained:scope.counts.providerEvents})]);
  const proof=await proveCleanup(client,scope);
  await client.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
    VALUES($1,'WhatsAppSimulationRun',$2,'run_scoped_cleanup_completed',$3,$4::jsonb)`,[
    crypto.randomUUID(),scope.runId,scope.createdBy,JSON.stringify({runId:scope.runId,dryRunSha256:approvedDryRunSha256,deletedCounts,scopeFingerprint:scope.scopeFingerprint,...proof,auditEvidenceRetained:true})
  ]);
  return{runId:scope.runId,deletedCounts,scopeFingerprint:scope.scopeFingerprint,...proof,auditEvidenceRetained:true};
}

const parseArgs=argv=>Object.fromEntries(argv.reduce((items,item,index,list)=>{
  if(item.startsWith('--'))items.push([item.slice(2),list[index+1]&&!list[index+1].startsWith('--')?list[index+1]:true]);
  return items;
},[]));
async function fileHash(file){return sha256(await fs.readFile(file));}
async function writeReceipt(file,receipt){
  const target=path.resolve(String(file||''));
  if(!file)throw new Error('--receipt is required');
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,`${JSON.stringify(receipt,null,2)}\n`,{flag:'wx'});
  return{path:target,sha256:await fileHash(target)};
}

export async function main(argv=process.argv.slice(2)){
  const args=parseArgs(argv),runId=validateRunId(args.run),mode=String(args.mode||'');
  if(!['dry-run','apply'].includes(mode))throw new Error('--mode must be dry-run or apply');
  if(!args['app-root'])throw new Error('--app-root is required');
  const appRoot=await fs.realpath(path.resolve(String(args['app-root'])));
  const dbModule=path.join(appRoot,'src','db.js');
  const dbModuleStat=await fs.stat(dbModule).catch(()=>null);
  if(!dbModuleStat?.isFile())throw new Error(`CRM database module is missing at ${dbModule}`);
  const {db,closeDatabase}=await import(pathToFileURL(dbModule).href);
  try{
    if(mode==='dry-run'){
      const client=await db.connect();let scope;
      try{await client.query('BEGIN TRANSACTION READ ONLY');scope=await collectCleanupScope(client,runId);await client.query('ROLLBACK');}
      catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
      const receipt={schema:'nysa.wn15.cleanup-dry-run.v1',mode,generatedAt:new Date().toISOString(),appRoot,runId:scope.runId,status:scope.status,counts:scope.counts,scopeFingerprint:scope.scopeFingerprint};
      const written=await writeReceipt(args.receipt,receipt);
      process.stdout.write(`${JSON.stringify({...receipt,receiptPath:written.path,receiptSha256:written.sha256},null,2)}\n`);
      return receipt;
    }
    const dryRunFile=path.resolve(String(args['dry-run-receipt']||'')),expectedHash=String(args['dry-run-sha256']||'').toLowerCase();
    if(!args['dry-run-receipt']||!SHA256.test(expectedHash))throw new Error('Apply requires --dry-run-receipt and its 64-character --dry-run-sha256');
    const observedHash=await fileHash(dryRunFile);
    if(observedHash!==expectedHash)throw new Error(`Dry-run receipt hash mismatch: expected ${expectedHash}, observed ${observedHash}`);
    const approved=JSON.parse(await fs.readFile(dryRunFile,'utf8'));
    if(approved.schema!=='nysa.wn15.cleanup-dry-run.v1'||approved.mode!=='dry-run')throw new Error('Dry-run receipt schema is invalid');
    const client=await db.connect();let result;
    try{
      await client.query('BEGIN');
      const scope=await collectCleanupScope(client,runId);
      const approvedScope={runId:approved.runId,counts:approved.counts,scopeFingerprint:approved.scopeFingerprint};
      assertScopeMatches(scope,approvedScope);
      result=await applyCleanup(client,scope,expectedHash);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
    const receipt={schema:'nysa.wn15.cleanup-apply.v1',mode,generatedAt:new Date().toISOString(),appRoot,...result};
    const written=await writeReceipt(args.receipt,receipt);
    process.stdout.write(`${JSON.stringify({...receipt,receiptPath:written.path,receiptSha256:written.sha256},null,2)}\n`);
    return receipt;
  }finally{await closeDatabase();}
}

const invokedPath=process.argv[1]?path.resolve(process.argv[1]):null;
if(invokedPath&&invokedPath===path.resolve(fileURLToPath(import.meta.url)))await main();
