#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

const APPROVED_ORIGIN='https://crm-test.nysarealty.com';
const EXPECTED_VERSION='2.1.0-dev.135';
const MUTATION_CONFIRMATION='CRM_TEST_RELEASE3B_UAT_CONFIRMED';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const runTag=`NYSA-R3B-UAT-${new Date().toISOString().replace(/[-:.TZ]/g,'')}-${process.pid}`;
const checks=[];
let cookie='';

function env(name,{required=false}={}){
  const value=String(process.env[name]||'').trim();
  if(required&&!value)throw new Error(`${name} is required`);
  return value;
}
function csv(name){return [...new Set(env(name).split(',').map(x=>x.trim()).filter(Boolean))];}
function check(id,title,status,evidence,kind='automated'){
  checks.push({id,title,status,kind,evidence:String(evidence||'').replace(/[\r\n]+/g,' ').slice(0,600)});
}
function safeError(value){
  const text=typeof value==='string'?value:value?.error||value?.message||'Request failed';
  return String(text).replace(/(password|cookie|api[_ -]?key|authorization)\s*[:=]\s*\S+/ig,'$1=[REDACTED]').slice(0,300);
}
function approvedBaseUrl(raw){
  const url=new URL(raw||APPROVED_ORIGIN);
  if(url.origin!==APPROVED_ORIGIN||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))
    throw new Error(`Refusing non-approved base URL. Exact CRM Test origin required: ${APPROVED_ORIGIN}`);
  return APPROVED_ORIGIN;
}
async function request(base,path,{method='GET',body,expected}={}){
  const headers={accept:'application/json'};
  if(body!==undefined)headers['content-type']='application/json';
  if(cookie)headers.cookie=cookie;
  const response=await fetch(`${base}/api${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  const setCookie=response.headers.get('set-cookie');
  if(setCookie&&!cookie)cookie=setCookie.split(';',1)[0];
  const type=response.headers.get('content-type')||'';
  const data=type.includes('application/json')?await response.json():{error:`Unexpected ${type||'non-JSON'} response`};
  if(expected!==undefined){const allowed=Array.isArray(expected)?expected:[expected];if(!allowed.includes(response.status))throw new Error(`${method} ${path} returned ${response.status}: ${safeError(data)}`);}
  return{status:response.status,data};
}
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const arr=value=>Array.isArray(value)?value:[];

async function preflight(base,mutation){
  const health=await request(base,'/health',{expected:200}),readiness=await request(base,'/readiness',{expected:200});
  check('R3B-UAT-001','Approved CRM Test host, process liveness and database readiness','pass',`${base}; process=${health.data.process}; database=${readiness.data.database}; version=${health.data.version}`);
  check('R3B-UAT-002','Installed development baseline',health.data.version===EXPECTED_VERSION?'pass':'fail',`expected=${EXPECTED_VERSION}; actual=${health.data.version||'missing'}`);
  if(!mutation){
    check('R3B-UAT-003','Read-only preflight boundary','pass','No authenticated or mutating API was called.');
    return null;
  }
  const email=env('NYSA_R3B_UAT_EMAIL',{required:true}),password=env('NYSA_R3B_UAT_PASSWORD',{required:true});
  const login=await request(base,'/auth/login',{method:'POST',body:{email,password},expected:200});
  const actorId=env('NYSA_R3B_UAT_ACTOR_ID',{required:true});
  if(login.data?.broker?.id!==actorId)throw new Error('Authenticated actor does not match NYSA_R3B_UAT_ACTOR_ID');
  check('R3B-UAT-004','Explicit CRM-Test UAT actor','pass',`Authenticated supplied actor ${actorId}; credentials and session omitted.`);
  return login.data.broker;
}

async function validateTaggedFixtures(base,leadId,inventoryIds,tag){
  if(tag.length<3)throw new Error('NYSA_R3B_UAT_RECORD_TAG must be at least 3 characters');
  const escaped=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),marker=new RegExp(escaped,'i');
  const lead=(await request(base,`/crm/leads/${leadId}`,{expected:200})).data.lead||{};
  if(!marker.test(`${lead.leadReference||''} ${lead.title||''}`))throw new Error('Supplied Lead is not visibly tagged with NYSA_R3B_UAT_RECORD_TAG');
  const portal=(await request(base,'/external-publications',{expected:200})).data,inventories=arr(portal.inventories);
  for(const id of inventoryIds){
    const inventory=inventories.find(item=>item.id===id);
    if(!inventory)throw new Error(`Supplied UAT Inventory ${id} is outside the authenticated Inventory scope`);
    if(!marker.test(`${inventory.inventoryReference||''} ${inventory.inventoryHeadline||''}`))throw new Error(`Supplied Inventory ${id} is not visibly tagged with NYSA_R3B_UAT_RECORD_TAG`);
  }
  check('R3B-UAT-005','Visible UAT fixture tags','pass',`Supplied Lead and ${inventoryIds.length} Inventory record(s) match the explicit non-private tag; customer and owner/contact fields omitted.`);
}

async function runGovernedMatching(base,leadId,inventoryIds){
  const requirements=(await request(base,`/crm/leads/${leadId}/requirements`,{expected:200})).data.requirements||[];
  const current=requirements.find(item=>!item.supersededAt);
  if(!current){check('R3B-UAT-010','Current governed requirement','blocked','Supplied UAT Lead has no current structured requirement.');return;}
  const conflicts=arr(current.websiteConflicts),unresolved=conflicts.filter(x=>!x.resolution),correction=conflicts.filter(x=>x.resolution==='requires_new_version');
  if(unresolved.length){
    const blocked=await request(base,`/crm/leads/${leadId}/requirements/${current.id}/confirm`,{method:'POST',body:{confirmationBasis:'direct_customer',confirmationNotes:`[${runTag}] expected unresolved-conflict block`},expected:409});
    check('R3B-UAT-011','Unresolved website conflict blocks confirmation',/Resolve every declared website conflict/i.test(blocked.data.error)?'pass':'fail',safeError(blocked.data));
  }else check('R3B-UAT-011','Unresolved website conflict blocks confirmation','blocked','No unresolved conflict exists on the explicitly supplied UAT Lead; use human-reviewed tagged conflict fixture.');
  check('R3B-UAT-012','Governed requirement authority',current.confirmation&&unresolved.length===0&&correction.length===0?'pass':'blocked',`version=${current.versionNo}; confirmed=${Boolean(current.confirmation)}; unresolved=${unresolved.length}; correctionRequired=${correction.length}`);
  if(!current.confirmation||unresolved.length||correction.length){check('R3B-UAT-013','Create governed matching run','blocked','Matching authority preconditions are not satisfied; no run created.');return;}

  const created=await request(base,`/crm/leads/${leadId}/inventory-matching-runs`,{method:'POST',body:{uatTag:runTag},expected:201}),run=created.data;
  const replay=(await request(base,`/crm/leads/${leadId}/inventory-matching-runs/${run.id}`,{expected:200})).data;
  const candidates=arr(replay.candidates),eligible=candidates.filter(x=>x.eligibilityStatus==='eligible'),excluded=candidates.filter(x=>x.eligibilityStatus==='excluded');
  const deterministic=run.eligibleCount===replay.eligibleCount&&run.excludedCount===replay.excludedCount&&run.evidenceHash===replay.evidenceHash&&
    eligible.every((x,i)=>x.presentedRank===i+1)&&excluded.every(x=>x.presentedRank==null&&x.score==null&&arr(x.exclusionReasons).length>0);
  check('R3B-UAT-013','Create/read deterministic governed matching run',deterministic?'pass':'fail',`run=${run.id}; eligible=${replay.eligibleCount}; excluded=${replay.excludedCount}; ranked=${eligible.length}; exclusions=${excluded.length}`);
  check('R3B-UAT-014','Policy and replay evidence hashes',replay.policyVersion==='r3b-eligibility-v1'&&sha(replay.evidenceHash)?'pass':'fail',`policy=${replay.policyVersion}; evidenceHashPresent=${sha(replay.evidenceHash)}`);
  check('R3B-UAT-015','No commitment and no website suggestions',replay.advisoryOnly===true&&replay.createsPropertyMatch===false&&replay.reservesInventory===false&&replay.websiteSuggestionsIncluded===false?'pass':'fail','Expected advisoryOnly=true, createsPropertyMatch=false, reservesInventory=false, websiteSuggestionsIncluded=false.');
  const unexpected=candidates.filter(x=>!inventoryIds.includes(x.listingId));
  check('R3B-GAP-001','Run-level Inventory allowlist','blocked',`API evaluated ${candidates.length} Inventory records; ${unexpected.length} were outside the supplied UAT allowlist. Release 3B API has no run-level Inventory filter.`,'known_gap');

  const selected=eligible.find(x=>inventoryIds.includes(x.listingId));
  if(!selected){check('R3B-UAT-016','Supplied Inventory decision fixture','blocked','No explicitly supplied UAT Inventory is eligible in this run.');return;}
  const note=decision=>`[${runTag}] immutable automated ${decision} evidence for supplied UAT Inventory`;
  const first=(await request(base,`/crm/leads/${leadId}/inventory-matching-runs/${run.id}/candidates/${selected.id}/decisions`,{method:'POST',body:{decision:'shortlisted',reasonCode:'strong_fit',reasonNotes:note('shortlist')},expected:201})).data;
  check('R3B-UAT-016','Current eligibility revalidation on shortlist',first.liveEligibility?.eligible===true&&first.createsPropertyMatch===false&&first.reservesInventory===false?'pass':'fail',`candidate=${selected.id}; liveEligible=${first.liveEligibility?.eligible}`);
  const stale=await request(base,`/crm/leads/${leadId}/inventory-matching-runs/${run.id}/candidates/${selected.id}/decisions`,{method:'POST',body:{decision:'rejected',reasonCode:'other',reasonNotes:note('stale rejection')},expected:409});
  check('R3B-UAT-017','Stale decision rejection',/changed after it was opened/i.test(stale.data.error)?'pass':'fail',safeError(stale.data));
  const second=(await request(base,`/crm/leads/${leadId}/inventory-matching-runs/${run.id}/candidates/${selected.id}/decisions`,{method:'POST',body:{decision:'deferred',reasonCode:'timing',reasonNotes:note('defer'),expectedPreviousDecisionId:first.decision.id},expected:201})).data;
  const third=(await request(base,`/crm/leads/${leadId}/inventory-matching-runs/${run.id}/candidates/${selected.id}/decisions`,{method:'POST',body:{decision:'rejected',reasonCode:'customer_preference',reasonNotes:note('reject'),expectedPreviousDecisionId:second.decision.id},expected:201})).data;
  const feedback=(await request(base,`/crm/leads/${leadId}/inventory-matching-runs/${run.id}/candidates/${selected.id}/feedback`,{method:'POST',body:{decisionId:third.decision.id,sourceKind:'broker_observed',outcome:'more_options',reasonCode:'customer_preference',notes:`[${runTag}] immutable automated feedback retention evidence`},expected:201})).data;
  const history=(await request(base,`/crm/leads/${leadId}/inventory-matching-runs/${run.id}`,{expected:200})).data.candidates.find(x=>x.id===selected.id);
  check('R3B-UAT-018','Shortlist/defer/reject immutable history',arr(history?.decisions).length>=3&&history.decisions.slice(-3).map(x=>x.decision).join(',')==='shortlisted,deferred,rejected'?'pass':'fail',`retainedDecisions=${arr(history?.decisions).length}; latest=${history?.latestDecision?.decision}`);
  check('R3B-UAT-019','Immutable feedback retention',feedback.immutableEvidence===true&&feedback.changesPriorRun===false&&arr(history?.feedback).some(x=>x.id===feedback.feedback.id)?'pass':'fail',`feedbackRetained=${arr(history?.feedback).some(x=>x.id===feedback.feedback.id)}`);
}

function portalPayload(){
  const description=env('NYSA_R3B_UAT_PORTAL_DESCRIPTION')||('Accurate UAT property description covering the approved layout, location, amenities, transaction facts and viewing context. ').repeat(8);
  return{portalCode:'property_finder',offeringType:env('NYSA_R3B_UAT_OFFERING_TYPE')||'sale',uaeEmirate:'dubai',furnishingType:'furnished',
    downPayment:env('NYSA_R3B_UAT_DOWN_PAYMENT')||'500000',complianceType:'trakheesi',propertyType:env('NYSA_R3B_UAT_PROPERTY_TYPE')||'apartment',
    publicationTitle:env('NYSA_R3B_UAT_PORTAL_TITLE')||'Governed UAT residential property',publicationDescription:description.slice(0,2000),propertyCategory:'residential',
    bathrooms:env('NYSA_R3B_UAT_BATHROOMS')||'2',publicationPrice:env('NYSA_R3B_UAT_PRICE',{required:true}),currency:'AED',
    portalLocationReference:env('NYSA_R3B_UAT_LOCATION_REFERENCE',{required:true}),portalPropertyReference:env('NYSA_R3B_UAT_PROPERTY_REFERENCE',{required:true}),
    portalAgentReference:env('NYSA_R3B_UAT_AGENT_REFERENCE',{required:true})};
}
async function runPortalPreparation(base,inventoryId){
  const state=(await request(base,'/external-publications',{expected:200})).data;
  const inventory=arr(state.inventories).find(x=>x.id===inventoryId);
  if(!inventory){check('R3B-UAT-030','Explicit portal Inventory selection','blocked','Supplied UAT Inventory is absent from the authenticated portal-preparation scope.');return;}
  check('R3B-UAT-030','Exactly one supplied portal Inventory','pass',`inventory=${inventoryId}; no other Inventory selected for mutation.`);
  const types=arr(state.propertyFinderPropertyTypes),limits=state.propertyFinderContentLimits||{};
  check('R3B-UAT-031','Residential mappings and content limits',types.includes('apartment')&&types.includes('villa')&&types.includes('townhouse')&&limits.title?.min===30&&limits.title?.max===50&&limits.description?.min===750&&limits.description?.max===2000?'pass':'fail','Expected Apartment/Villa/Townhouse mappings, title 30-50, description 750-2000.');
  const shortTitle=await request(base,`/listings/${inventoryId}/external-publications`,{method:'POST',body:{...portalPayload(),publicationTitle:'Too short'},expected:400});
  check('R3B-UAT-032','Portal title validation',/30 to 50/i.test(shortTitle.data.error)?'pass':'fail',safeError(shortTitle.data));
  const shortDescription=await request(base,`/listings/${inventoryId}/external-publications`,{method:'POST',body:{...portalPayload(),publicationDescription:'Too short'},expected:400});
  check('R3B-UAT-033','Portal description validation',/750 to 2000/i.test(shortDescription.data.error)?'pass':'fail',safeError(shortDescription.data));
  const created=await request(base,`/listings/${inventoryId}/external-publications`,{method:'POST',body:portalPayload(),expected:201});
  const prep=created.data.preparation||{},readiness=prep.readinessSnapshot||{},fields=prep.portalFields||{};
  const prohibited=['owner','ownerName','ownerContact','counterparty','agreement','authorityEvidence','storageKey'];
  check('R3B-UAT-034','Internal-only privacy boundary',prohibited.every(key=>!(key in fields))?'pass':'fail','Portal fields exclude owner/contact/agreement/authority/private-storage fields.');
  check('R3B-UAT-035','Permit reconciliation and mismatch blocking',readiness.permitReconciliation?.matched===true||readiness.ready===false?'pass':'fail',`ready=${Boolean(readiness.ready)}; permitMatched=${Boolean(readiness.permitReconciliation?.matched)}; blockers=${arr(readiness.blockers).map(x=>x.code||x).join(',')}`);
  check('R3B-UAT-036','No outbound publication',readiness.noConnectorTransmission===true&&state.noAutomaticPublication===true&&state.connectorStatus==='not_configured'?'pass':'fail',`noConnectorTransmission=${readiness.noConnectorTransmission}; connectorStatus=${state.connectorStatus}; status=${created.data.status}`);
}

function addManualChecks(){
  check('R3B-MANUAL-001','Visual workflow clarity','manual','Human UAT Lead must confirm labels, ranking explanation, blockers, decision history and portal-preparation layout in the CRM Test UI.','manual');
  check('R3B-MANUAL-002','Operational evidence correctness','manual','Human UAT Lead must verify that supplied requirement, Inventory, permit and advertising facts are genuine approved test evidence.','manual');
  check('R3B-MANUAL-003','External portals remain untouched','manual','Operational owner must confirm no Property Finder/Bayut connector, vendor log, credit or listing was activated. The harness makes no external calls.','manual');
  check('R3B-GAP-002','Ineligible-at-decision revalidation without changing Inventory','blocked','Automated static regression covers rejection. Live proof requires an explicitly managed UAT Inventory state transition and separate authorization.','known_gap');
}
function markdown(report){
  const totals=report.summary;
  const rows=report.checks.map(x=>`| ${x.id} | ${x.kind} | ${x.status.toUpperCase()} | ${x.title.replace(/\|/g,'\\|')} | ${x.evidence.replace(/\|/g,'\\|')} |`).join('\n');
  return `# NYSA CORE Release 3B — CRM Test automated UAT\n\n- Run tag: \`${report.runTag}\`\n- Mode: **${report.mode}**\n- Approved host: \`${report.baseUrl}\`\n- Result: **${report.result.toUpperCase()}**\n- Counts: ${totals.pass} pass, ${totals.fail} fail, ${totals.blocked} blocked, ${totals.manual} manual\n\nNo credentials, cookies, private owner/contact data, authority evidence or external portal payloads are stored in this report. Immutable CRM evidence created in mutation mode is tagged with the run tag and is not deleted.\n\n| Check | Class | Result | Scope | Evidence |\n|---|---|---|---|---|\n${rows}\n`;
}
async function writeReports(base,mode){
  const summary={pass:0,fail:0,blocked:0,manual:0};for(const item of checks)summary[item.status]=(summary[item.status]||0)+1;
  const report={schemaVersion:1,runTag,generatedAt:new Date().toISOString(),baseUrl:base,mode,result:summary.fail?'fail':summary.blocked?'blocked':'pass',summary,checks};
  const baseRoot=resolve(env('NYSA_R3B_UAT_OUTPUT_DIR')||'outputs/release3b-crm-test-uat'),root=resolve(baseRoot,runTag);
  await mkdir(baseRoot,{recursive:true});
  await mkdir(root,{recursive:false});
  await Promise.all([writeFile(resolve(root,'report.json'),`${JSON.stringify(report,null,2)}\n`,{flag:'wx'}),writeFile(resolve(root,'report.md'),markdown(report),{flag:'wx'})]);
  process.stdout.write(`${JSON.stringify({result:report.result,summary,mode,runTag,reportDirectory:root})}\n`);
  return report;
}

async function main(){
  const base=approvedBaseUrl(env('NYSA_R3B_UAT_BASE_URL')||APPROVED_ORIGIN),mutation=env('NYSA_R3B_UAT_CONFIRM')===MUTATION_CONFIRMATION;
  const requestedMutation=process.argv.includes('--mutate');
  if(requestedMutation&&!mutation)throw new Error(`Mutation refused. Set NYSA_R3B_UAT_CONFIRM exactly to ${MUTATION_CONFIRMATION}.`);
  const mode=requestedMutation?'crm-test-mutation':'read-only-preflight';
  await preflight(base,requestedMutation);
  if(requestedMutation){
    const leadId=env('NYSA_R3B_UAT_LEAD_ID',{required:true}),inventoryIds=csv('NYSA_R3B_UAT_INVENTORY_IDS'),portalInventoryId=env('NYSA_R3B_UAT_PORTAL_INVENTORY_ID',{required:true}),tag=env('NYSA_R3B_UAT_RECORD_TAG',{required:true});
    for(const [name,id] of [['NYSA_R3B_UAT_LEAD_ID',leadId],['NYSA_R3B_UAT_PORTAL_INVENTORY_ID',portalInventoryId],...inventoryIds.map(id=>['NYSA_R3B_UAT_INVENTORY_IDS',id])])if(!UUID.test(id))throw new Error(`${name} must contain explicit UUIDs`);
    if(!inventoryIds.length||!inventoryIds.includes(portalInventoryId))throw new Error('NYSA_R3B_UAT_INVENTORY_IDS must include NYSA_R3B_UAT_PORTAL_INVENTORY_ID');
    await validateTaggedFixtures(base,leadId,inventoryIds,tag);
    await runGovernedMatching(base,leadId,inventoryIds);
    await runPortalPreparation(base,portalInventoryId);
  }
  addManualChecks();
  const report=await writeReports(base,mode);process.exitCode=report.summary.fail?1:report.summary.blocked?2:0;
}

main().catch(async error=>{
  check('R3B-UAT-FATAL','Harness execution','fail',safeError(error));addManualChecks();
  try{await writeReports(APPROVED_ORIGIN,process.argv.includes('--mutate')?'crm-test-mutation':'read-only-preflight');}catch{}
  process.stderr.write(`Release 3B UAT harness failed: ${safeError(error)}\n`);process.exitCode=1;
});
