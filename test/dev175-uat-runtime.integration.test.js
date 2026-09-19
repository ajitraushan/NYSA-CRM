import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

const enabled=process.env.NYSA_RUN_DEV175_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
const browserMode=enabled&&process.env.NYSA_DEV175_BROWSER==='1';
let db,server,request,f;
before(async()=>{
  if(!enabled)return;
  assert.ok(['localhost','127.0.0.1','::1'].includes(process.env.PGHOST));
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
  const pool=guard.createFixturePool();try{await guard.assertDedicatedFixture(pool);}finally{await pool.end();}
  process.env.PRIVATE_STORAGE_DIR=await fs.mkdtemp(path.join(os.tmpdir(),'nysa-dev175-private-'));
  db=await import('../src/db.js');
  const id=()=>crypto.randomUUID(),prefix=`dev175-${Date.now()}`;
  f={broker:id(),contact:id(),lead:id(),requirement:id(),opportunity:id(),listing:id(),deal:id(),prefix};
  await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,$2,$3,'admin','active','synthetic-only','admin')`,[f.broker,prefix,`${prefix}@example.invalid`]);
  await db.execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$4,'buyer',$3,$3)`,[f.contact,prefix,f.broker,`${prefix}-customer@example.invalid`]);
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$4)`,[f.lead,f.contact,prefix,f.broker]);
  await db.execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,funding_method,timeline_code,created_by) VALUES($1,$2,1,'Sale','own_use','cash','0_3_months',$3)`,[f.requirement,f.lead,f.broker]);
  await db.execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by) VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Deal','Complete governed Deal',NOW()+INTERVAL '1 day','send_property_details',$6)`,[f.opportunity,prefix,f.lead,f.contact,f.requirement,f.broker]);
  await db.execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash) VALUES($1,$2,$3,'Website','{}',$4)`,[id(),f.opportunity,f.lead,'0'.repeat(64)]);
  await db.execute(`INSERT INTO listings(id,project,inventory_headline,area,property_type,bedrooms,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id) VALUES($1,$2,$2,'Synthetic test area','Apartment','2',900,1000000,'AED','Available',$3,$3,$3)`,[f.listing,prefix,f.broker]);
  await db.execute(`INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,owner_id,created_by) VALUES($1,$2,$3,'sale',1000000,'AED',NOW()+INTERVAL '1 day',$4,$4)`,[f.deal,prefix,f.opportunity,f.broker]);
  if(browserMode){
    await db.execute("UPDATE brokers SET job_role='manager' WHERE id=$1",[f.broker]);
    const checklist=id(),match=id();f.viewing=id();
    await db.execute(`INSERT INTO deal_checklists(id,deal_id,template_id,template_version_no) SELECT $1,$2,id,version_no FROM checklist_templates WHERE deal_type='sale' AND status='approved'`,[checklist,f.deal]);
    await db.execute(`INSERT INTO deal_checklist_items(id,deal_checklist_id,template_item_id,item_code,label,responsible_role,required,evidence_required,display_order) SELECT gen_random_uuid(),$1,i.id,i.item_code,i.label,i.responsible_role,i.required,i.evidence_required,i.display_order FROM checklist_template_items i JOIN deal_checklists c ON c.template_id=i.template_id WHERE c.id=$1`,[checklist]);
    await db.execute(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,match_source,fit_status,rationale,created_by,updated_by) VALUES($1,$2,$3,$4,'manual','strong_fit','Synthetic UI regression',$5,$5)`,[match,f.opportunity,f.requirement,f.listing,f.broker]);
    await db.execute(`INSERT INTO viewings(id,opportunity_id,property_match_id,listing_id,organizer_id,starts_at,ends_at,timezone,location,calendar_uid,created_by,updated_by) VALUES($1,$2,$3,$4,$5,NOW()-INTERVAL '2 hours',NOW()-INTERVAL '1 hour','Asia/Dubai','Synthetic test lobby',$6,$5,$5)`,[f.viewing,f.opportunity,match,f.listing,f.broker,id()]);
  }
  const token=crypto.randomBytes(32).toString('hex');
  await db.execute(`INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')`,[crypto.createHash('sha256').update(token).digest('hex'),f.broker]);
  const {createApp,Router}=await import('../src/lib/http-kit.js'),app=createApp();
  if(browserMode){
    const start=Router();start.get('/fixture-start',(_req,res)=>{res.setHeader('Set-Cookie',`nysa_session=${token}; HttpOnly; SameSite=Strict; Path=/`);res.statusCode=302;res.setHeader('Location',`/?workspace=opportunity&record=${f.opportunity}`);res.end();});app.mount('',start);
    app.static(path.resolve('public'));
    for(const name of ['auth','governance','lead-operations','qualification-finance','release3c-governed-shares','document-compliance','commission-payout','classification-catalogue'])app.mount('/api',(await import(`../src/routes/${name}.js`)).default);
  }
  for(const module of ['crm','opportunities','listings','official-document-evidence','dashboards','commission-payout'])app.mount('/api',(await import(`../src/routes/${module}.js`)).default);
  server=await new Promise(resolve=>{const s=app.listen({port:browserMode?4175:0,host:'127.0.0.1'},()=>resolve(s));});
  request=async(path,body)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return{status:response.status,data:await response.json()};};
});
after(async()=>{if(browserMode){console.log('Synthetic browser fixture: http://127.0.0.1:4175/fixture-start');return;}server?.closeAllConnections();server?.close();if(db)await db.closeDatabase();});

test('DEF-107/114 Lead detail loads with real SQL',gate,async()=>{
  const result=await request(`/crm/leads/${f.lead}`);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.lead.id,f.lead);
});
test('DEF-109 Inventory list executes with real SQL',gate,async()=>{
  const result=await request(`/listings?q=${f.prefix}`);assert.equal(result.status,200,JSON.stringify(result.data));
});
test('DEF-116 stage draft is durably saved and audited',gate,async()=>{
  const result=await request(`/crm/opportunities/${f.opportunity}/stage-drafts/deal`,{expectedOpportunityVersion:1,payload:{forms:[]}});
  assert.equal(result.status,201,JSON.stringify(result.data));
  const saved=await db.one('SELECT payload FROM opportunity_stage_draft_versions WHERE id=$1',[result.data.id]);assert.deepEqual(saved.payload,{forms:[]});
});
test('DEF-112 official requirements query accepts empty evidence and active rules',gate,async()=>{
  const result=await request(`/crm/listings/${f.listing}/official-document-requirements?stepCode=sale_agreement`);assert.equal(result.status,200,JSON.stringify(result.data));
  const deal=await request(`/crm/deals/${f.deal}/official-document-requirements?stepCode=sale_agreement`);assert.equal(deal.status,200,JSON.stringify(deal.data));
});
test('DEF-117 lifecycle drilldown uses active Deal, not historical Qualified',gate,async()=>{
  const result=await request('/crm/dashboard/records?segment=lifecycle_deal');
  assert.equal(result.status,200,JSON.stringify(result.data));
  const row=result.data.records.find(x=>x.id===f.lead);assert.ok(row);assert.equal(row.pipelineStage,'Deal');assert.equal(row.pipelineOpportunityId,f.opportunity);
  const qualified=await request('/crm/dashboard/records?segment=lifecycle_qualified');assert.ok(!qualified.data.records.some(x=>x.id===f.lead));
});
test('DEF-117 Closed Won remains current when the same Lead has another Qualified pursuit',gate,async()=>{
  const historical=crypto.randomUUID();
  await db.execute("UPDATE deals SET status='closed_won',approved_by=$2,approved_at=NOW(),approval_reason='Synthetic approval',approval_evidence_reference='SYNTHETIC approval evidence',actual_completion_at=NOW(),closed_by=$2,closed_at=NOW(),closure_evidence_reference='SYNTHETIC closure evidence' WHERE id=$1",[f.deal,f.broker]);
  await db.execute("UPDATE opportunities SET stage='Closed Won',closed_at=NOW(),next_action_code='closed_won',next_action='Deal completed and authoritatively closed won' WHERE id=$1",[f.opportunity]);
  await db.execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Requirements','Historical qualified pursuit',NOW(),'send_property_details',$6)`,[historical,`${f.prefix}-HISTORICAL`,f.lead,f.contact,f.requirement,f.broker]);
  try{
    const won=await request('/crm/dashboard/records?segment=lifecycle_won');assert.equal(won.status,200,JSON.stringify(won.data));
    const row=won.data.records.find(x=>x.id===f.lead);assert.ok(row);assert.equal(row.pipelineOpportunityId,f.opportunity);assert.equal(row.pipelineStage,'Won');
    const qualified=await request('/crm/dashboard/records?segment=lifecycle_qualified');assert.ok(!qualified.data.records.some(x=>x.id===f.lead));
  }finally{
    await db.execute('DELETE FROM opportunities WHERE id=$1',[historical]);
    await db.execute("UPDATE opportunities SET stage='Deal',closed_at=NULL,next_action_code='send_property_details',next_action='Complete governed Deal' WHERE id=$1",[f.opportunity]);
    await db.execute("UPDATE deals SET status='draft',actual_completion_at=NULL,closed_by=NULL,closed_at=NULL,closure_evidence_reference=NULL WHERE id=$1",[f.deal]);
  }
});
test('DEF-112 PDF upload persists private immutable evidence and remains pending independent review',gate,async()=>{
  const definition=await request('/admin/official-document-definitions',{stableCode:`synthetic_${f.deal.replaceAll('-','')}`,label:'Synthetic final document',expectedIssuer:'Synthetic test issuer',acceptedStatus:'official_captured',expiryTracked:false});
  assert.equal(definition.status,201,JSON.stringify(definition.data));
  const definitionId=definition.data.definition.id,versionId=definition.data.version.id;
  assert.equal((await request(`/admin/official-document-definition-versions/${versionId}/activate`,{})).status,200);
  const rule=await request('/admin/official-document-step-rules',{stepCode:'sale_agreement',definitionId,requirementLevel:'required',businessReason:'Synthetic final document verification'});
  assert.equal(rule.status,201,JSON.stringify(rule.data));
  assert.equal((await request(`/admin/official-document-step-rule-versions/${rule.data.version.id}/activate`,{})).status,200);
  const requirements=await request(`/crm/deals/${f.deal}/official-document-requirements?stepCode=sale_agreement`);
  const {PdfDoc}=await import('../src/proposal-pdf.js'),pdf=new PdfDoc();pdf.page(['BT /F1 12 Tf 40 800 Td (SYNTHETIC TEST EVIDENCE - NOT AN OFFICIAL DOCUMENT) Tj ET']);
  const body={definitionVersionId:versionId,officialReference:'SYNTHETIC-ONLY',issuerReference:'SYNTHETIC',issuedAt:new Date(Date.now()-3600000).toISOString(),dealId:f.deal,contextHash:requirements.data.case.contextHash,idempotencyKey:crypto.randomUUID(),fileName:'synthetic-test.pdf',mediaType:'application/pdf',base64:pdf.finish().toString('base64')};
  const upload=await request('/crm/official-document-evidence',body);assert.equal(upload.status,201,JSON.stringify(upload.data));
  const stored=await db.one('SELECT * FROM document_versions WHERE id=$1',[upload.data.evidence.documentVersionId]);assert.equal(stored.classification,'restricted');assert.equal(stored.immutable,1);
  const reloaded=await request(`/crm/deals/${f.deal}/official-document-requirements?stepCode=sale_agreement`);
  assert.equal(reloaded.data.requirements.find(x=>x.definitionId===definitionId).state,'pending_verification');assert.equal(reloaded.data.stepCanComplete,false);
  assert.equal((await request(`/crm/official-document-evidence/${upload.data.evidence.id}/review`,{decision:'verified',reviewConfirmation:true})).status,403,'Uploader cannot verify their own PDF');
  const replay=await request('/crm/official-document-evidence',body);assert.equal(replay.status,200);assert.equal(replay.data.evidence.id,upload.data.evidence.id);
});
test('DEF-117 first contact advances New only, never regresses Qualified or prematurely marks Won',gate,async()=>{
  await db.execute("UPDATE opportunities SET stage='Closed Lost',lost_reason_code='other',lost_reason='Synthetic regression ended',closed_at=NOW() WHERE id=$1",[f.opportunity]);
  // Use another Lead without an active Opportunity to check contact projection.
  const id=crypto.randomUUID();await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by,first_contact_at) VALUES($1,$2,'Synthetic contacted lead','Website','Sale','New','Unassessed',$3,$3,NOW())`,[id,f.contact,f.broker]);
  const contacted=await request('/crm/dashboard/records?segment=lifecycle_contacted');assert.ok(contacted.data.records.some(x=>x.id===id));
  await db.execute("UPDATE leads SET stage='Contacted' WHERE id=$1",[id]);
  await db.execute("UPDATE leads SET stage='Qualified' WHERE id=$1",[id]);
  const qualified=await request('/crm/dashboard/records?segment=lifecycle_qualified');assert.ok(qualified.data.records.some(x=>x.id===id));
  const won=await request('/crm/dashboard/records?segment=lifecycle_won');assert.ok(!won.data.records.some(x=>x.id===id||x.id===f.lead));
  await db.execute("UPDATE opportunities SET stage='Deal',closed_at=NULL WHERE id=$1",[f.opportunity]);
});

test('DEF-116 stale drafts reject without changing governed business state',gate,async()=>{
  const before=await db.one('SELECT stage,version FROM opportunities WHERE id=$1',[f.opportunity]);
  const drafts=await db.one('SELECT COUNT(*)::int AS n FROM opportunity_stage_draft_versions WHERE opportunity_id=$1',[f.opportunity]);
  const result=await request(`/crm/opportunities/${f.opportunity}/stage-drafts/deal`,{expectedOpportunityVersion:999,payload:{forms:[]}});
  assert.equal(result.status,409,JSON.stringify(result.data));
  assert.deepEqual(await db.one('SELECT stage,version FROM opportunities WHERE id=$1',[f.opportunity]),before);
  assert.deepEqual(await db.one('SELECT COUNT(*)::int AS n FROM opportunity_stage_draft_versions WHERE opportunity_id=$1',[f.opportunity]),drafts);
});

test('DEF-117 dashboard counts and contributing records reconcile',gate,async()=>{
  const result=await request('/crm/dashboard');assert.equal(result.status,200,JSON.stringify(result.data));
  for(const stage of result.data.agentLifecycle){
    const records=await request(`/crm/dashboard/records?segment=${stage.segment}`);
    assert.equal(records.status,200,JSON.stringify(records.data));
    assert.equal(Number(records.data.count),stage.value,stage.stage);
  }
});

test('DEF-115 Agent and Manager cannot record or confirm finance receipts',gate,async()=>{
  const original=await db.one('SELECT role,job_role FROM brokers WHERE id=$1',[f.broker]);
  try{
    for(const role of ['sales_agent','manager']){
      await db.execute("UPDATE brokers SET role='internal_broker',job_role=$2 WHERE id=$1",[f.broker,role]);
      for(const action of ['commission-receipts','commission-receipt-confirmations']){
        const result=await request(`/crm/deals/${f.deal}/${action}`,{idempotencyKey:crypto.randomUUID()});
        assert.equal(result.status,403,`${role} ${action}: ${JSON.stringify(result.data)}`);
      }
    }
  }finally{await db.execute('UPDATE brokers SET role=$2,job_role=$3 WHERE id=$1',[f.broker,original.role,original.jobRole]);}
});

test('Unassigned Agent retains permitted Lead reading but cannot operate, draft or see it in own pipeline',gate,async()=>{
  const outsider=crypto.randomUUID();
  await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,'Synthetic unrelated owner',$2,'internal_broker','active','synthetic-only','sales_agent')`,[outsider,`${outsider}@example.invalid`]);
  // Transfer only this synthetic actor's identity, not record ownership, to exercise scope checks.
  const session=await db.one('SELECT token FROM sessions WHERE broker_id=$1',[f.broker]);
  try{
    await db.execute('UPDATE sessions SET broker_id=$2 WHERE token=$1',[session.token,outsider]);
    const lead=await request(`/crm/leads/${f.lead}`);assert.equal(lead.status,200);assert.equal(lead.data.canWrite,false,'Company Lead reading does not grant operational authority');
    const draft=await request(`/crm/opportunities/${f.opportunity}/stage-drafts/deal`,{expectedOpportunityVersion:1,payload:{forms:[]}});assert.ok([403,404].includes(draft.status));
    const pipeline=await request('/crm/dashboard/records?segment=lifecycle_deal');assert.equal(pipeline.status,200);assert.ok(!pipeline.data.records.some(x=>x.id===f.lead));
  }finally{await db.execute('UPDATE sessions SET broker_id=$2 WHERE token=$1',[session.token,f.broker]);}
});
