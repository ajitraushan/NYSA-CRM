import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const enabled=process.env.NYSA_RUN_DEV176_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Restricted local synthetic database required'};
const browserMode=enabled&&process.env.NYSA_DEV176_BROWSER==='1';
const id=()=>crypto.randomUUID();
let db,server,request,f,proofBody,proof;
before(async()=>{
  if(!enabled)return;
  assert.ok(['localhost','127.0.0.1','::1'].includes(process.env.PGHOST));
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs');
  const pool=guard.createFixturePool();try{await guard.assertDedicatedFixture(pool);}finally{await pool.end();}
  process.env.PRIVATE_STORAGE_DIR=await fs.mkdtemp(path.join(os.tmpdir(),'nysa-dev176-private-'));
  db=await import('../src/db.js');
  f={prefix:`dev176-${Date.now()}`,agent:id(),accountant:id(),outsider:id(),director:id(),contact:id(),lead:id(),requirement:id(),opportunity:id(),deal:id(),otherDeal:id(),tokens:{}};
  for(const [role,jobRole] of [['agent','sales_agent'],['accountant','accountant'],['outsider','sales_agent'],['director','director']]){
    await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role)
      VALUES($1,$2,$3,'internal_broker','active','synthetic-only',$4)`,[f[role],`${f.prefix} ${role}`,`${f.prefix}-${role}@example.invalid`,jobRole]);
    const token=crypto.randomBytes(32).toString('hex');f.tokens[role]=token;
    await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(token).digest('hex'),f[role]]);
  }
  await db.execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$4,'buyer',$3,$3)`,[f.contact,f.prefix,f.agent,`${f.prefix}@example.invalid`]);
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$4)`,[f.lead,f.contact,f.prefix,f.agent]);
  await db.execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,funding_method,timeline_code,created_by) VALUES($1,$2,1,'Sale','own_use','cash','0_3_months',$3)`,[f.requirement,f.lead,f.agent]);
  await db.execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by,buyer_commission_percent,seller_commission_percent)
    VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Deal','Complete governed Deal',NOW()+INTERVAL '1 day','send_property_details',$6,2,0)`,[f.opportunity,f.prefix,f.lead,f.contact,f.requirement,f.agent]);
  await db.execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash) VALUES($1,$2,$3,'Website','{}',$4)`,[id(),f.opportunity,f.lead,'0'.repeat(64)]);
  await db.execute(`INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,owner_id,created_by)
    VALUES($1,$2,$3,'sale',1000000,'AED',NOW()+INTERVAL '1 day',$4,$4)`,[f.deal,f.prefix,f.opportunity,f.agent]);
  const otherLead=id(),otherRequirement=id(),otherOpportunity=id();
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$4)`,[otherLead,f.contact,f.prefix+'-other',f.agent]);
  await db.execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,funding_method,timeline_code,created_by) VALUES($1,$2,1,'Sale','own_use','cash','0_3_months',$3)`,[otherRequirement,otherLead,f.agent]);
  await db.execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Deal','Synthetic cross-Deal scope check',NOW()+INTERVAL '1 day','send_property_details',$6)`,[otherOpportunity,f.prefix+'-other',otherLead,f.contact,otherRequirement,f.agent]);
  await db.execute(`INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,owner_id,created_by)
    VALUES($1,$2,$3,'sale',1000000,'AED',NOW()+INTERVAL '1 day',$4,$4)`,[f.otherDeal,f.prefix+'-other',otherOpportunity,f.agent]);
  const {PdfDoc}=await import('../src/proposal-pdf.js'),pdf=new PdfDoc();
  pdf.page(['BT /F1 12 Tf 40 800 Td (SYNTHETIC COMMISSION PROOF - NO REAL PAYMENT) Tj ET']);
  f.pdf=pdf.finish();f.pdfPath=path.join(process.env.PRIVATE_STORAGE_DIR,'synthetic-commission-proof.pdf');
  await fs.writeFile(f.pdfPath,f.pdf);
  proofBody={idempotencyKey:id(),fileName:'synthetic-commission-proof.pdf',mediaType:'application/pdf',base64:f.pdf.toString('base64')};
  const {createApp,Router}=await import('../src/lib/http-kit.js'),app=createApp();
  if(browserMode){
    const start=Router();
    for(const role of ['agent','accountant','director'])start.get(`/fixture-${role}`,(_req,res)=>{
      res.setHeader('Set-Cookie',`nysa_session=${f.tokens[role]}; HttpOnly; SameSite=Strict; Path=/`);
      res.statusCode=302;res.setHeader('Location',role==='agent'?`/?workspace=opportunity&record=${f.opportunity}`:'/');res.end();
    });
    app.mount('',start);app.static(path.resolve('public'));
    for(const name of ['auth','governance','lead-operations','qualification-finance','release3c-governed-shares','document-compliance','classification-catalogue','official-document-evidence','dashboards','listings'])app.mount('/api',(await import(`../src/routes/${name}.js`)).default);
  }
  for(const name of ['commission-payout','opportunities','crm','agent-leave','listings','marketing-material-compliance'])app.mount('/api',(await import(`../src/routes/${name}.js`)).default);
  server=await new Promise(resolve=>{const s=app.listen({port:browserMode?4176:0,host:'127.0.0.1'},()=>resolve(s));});
  request=async(role,url,body,raw=false)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${url}`,{method:body?'POST':'GET',
      headers:{authorization:`Bearer ${f.tokens[role]}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
    return{status:response.status,headers:response.headers,data:raw?Buffer.from(await response.arrayBuffer()):await response.json()};
  };
});
after(async()=>{if(browserMode){console.log(JSON.stringify({browserFixture:'http://127.0.0.1:4176/fixture-agent',financeFixture:'http://127.0.0.1:4176/fixture-accountant',proofFile:f.pdfPath,dealReference:f.prefix}));return;}server?.closeAllConnections();server?.close();if(db)await db.closeDatabase();});

test('Scoped agent uploads private proof and bytes survive download/reload; upload does not record receipt',gate,async()=>{
  const result=await request('agent',`/crm/deals/${f.deal}/commission-proofs`,proofBody);
  assert.equal(result.status,201,JSON.stringify(result.data));proof=result.data.proof;
  assert.equal(proof.storageKey,undefined);
  assert.equal(proof.fileHash,crypto.createHash('sha256').update(f.pdf).digest('hex'));
  const list=await request('agent',`/crm/deals/${f.deal}/commission-proofs`);
  assert.equal(list.data.proofs[0].id,proof.id);assert.equal(list.data.canUpload,true);
  const download=await request('agent',`/crm/deals/${f.deal}/commission-proofs/${proof.id}/download`,undefined,true);
  assert.equal(download.status,200);assert.deepEqual(download.data,f.pdf);
  assert.equal(download.headers.get('cache-control'),'private, no-store');
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deal_commission_receipts WHERE deal_id=$1',[f.deal])).n,0);
  assert.equal((await db.one('SELECT status FROM deals WHERE id=$1',[f.deal])).status,'draft');
});
test('Proof retries are idempotent, conflicting keys rejected, concurrent retries produce one immutable attachment',gate,async()=>{
  const retry=await request('agent',`/crm/deals/${f.deal}/commission-proofs`,proofBody);
  assert.equal(retry.status,200);assert.equal(retry.data.proof.id,proof.id);
  assert.equal((await request('agent',`/crm/deals/${f.deal}/commission-proofs`,{...proofBody,fileName:'different.pdf'})).status,409);
  const body={...proofBody,idempotencyKey:id()};
  const results=await Promise.all([request('agent',`/crm/deals/${f.deal}/commission-proofs`,body),request('agent',`/crm/deals/${f.deal}/commission-proofs`,body)]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,201]);assert.equal(results[0].data.proof.id,results[1].data.proof.id);
  await assert.rejects(db.execute('UPDATE deal_commission_proofs SET file_name=$1 WHERE id=$2',['tamper.pdf',proof.id]),/immutable/);
  await assert.rejects(db.execute('DELETE FROM deal_commission_proofs WHERE id=$1',[proof.id]),/immutable/);
});
test('Reject unauthorized reads/writes, cross-Deal downloads and unsupported/spoofed/oversize proof',gate,async()=>{
  for(const url of [`/crm/deals/${f.deal}/commission-proofs`,`/crm/deals/${f.deal}/commission-proofs/${proof.id}/download`]){
    assert.equal((await request('outsider',url)).status,403);
  }
  assert.equal((await request('outsider',`/crm/deals/${f.deal}/commission-proofs`,proofBody)).status,403);
  assert.equal((await request('agent','/finance/commission-deals')).status,403);
  const cross=await request('accountant',`/crm/deals/${f.deal}/commission-proofs/${id()}/download`);
  assert.equal(cross.status,400);
  assert.equal((await request('accountant',`/crm/deals/${f.otherDeal}/commission-proofs/${proof.id}/download`)).status,400);
  assert.equal((await request('agent',`/crm/deals/${f.otherDeal}/commission-proofs`,proofBody)).status,409);
  for(const body of [
    {...proofBody,mediaType:'text/html',fileName:'receipt.html'},
    {...proofBody,base64:Buffer.from('not a PDF').toString('base64')},
    {...proofBody,fileName:'receipt.exe'},
    {...proofBody,base64:Buffer.concat([Buffer.from('%PDF-'),Buffer.alloc(5*1024*1024)]).toString('base64')},
  ])assert.equal((await request('agent',`/crm/deals/${f.deal}/commission-proofs`,{...body,idempotencyKey:id()})).status,400);
});
test('Accountant has a finance-only Deal list and can retrieve proof; agent cannot confirm actual receipt',gate,async()=>{
  const list=await request('accountant','/finance/commission-deals?q='+f.prefix);
  assert.equal(list.status,200,JSON.stringify(list.data));assert.ok(list.data.deals.some(d=>d.id===f.deal));
  assert.equal((await request('accountant',`/crm/deals/${f.deal}/commission-proofs`)).status,200);
  assert.equal((await request('accountant',`/crm/opportunities/${f.opportunity}`)).status,403);
  for(const action of ['commission-receipts','commission-receipt-confirmations'])
    assert.equal((await request('agent',`/crm/deals/${f.deal}/${action}`,{idempotencyKey:id()})).status,403);
});
test('Finance links the exact proof to an immutable receipt, confirms actual receipt, leaves closure separate',{...gate,skip:gate.skip||(browserMode&&process.env.NYSA_DEV176_BROWSER_CONFIRMED!=='1')},async()=>{
  const expectation=await request('agent',`/crm/deals/${f.deal}/commission-expectations`,{idempotencyKey:id(),referralAmount:0,referralSettlementBasis:'none'});
  assert.equal(expectation.status,201,JSON.stringify(expectation.data));
  assert.equal((await request('agent',`/crm/deal-commission-expectations/${expectation.data.expectation.id}/freeze`,{})).status,200);
  const body={idempotencyKey:id(),amount:'20K',receivedDate:'2026-09-02',receiptMethod:'bank_transfer',financeReference:`SYNTHETIC-${id()}`,proofId:proof.id};
  for(const amount of ['bad','1.001','-1K'])assert.equal((await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,{...body,amount})).status,400);
  assert.equal((await request('accountant',`/crm/deals/${f.otherDeal}/commission-receipts`,body)).status,400);
  assert.equal((await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,{...body,receivedDate:'2026-02-30'})).status,400);
  assert.equal((await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,{...body,proofId:id()})).status,400);
  const receipt=await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,body);
  assert.equal(receipt.status,201,JSON.stringify(receipt.data));assert.equal(receipt.data.receipt.proofId,proof.id);
  assert.equal(Number(receipt.data.receipt.amount),20000);
  assert.equal(receipt.data.receipt.evidenceReference,proof.proofReference);
  assert.equal((await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,body)).status,200);
  assert.equal((await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,{...body,amount:20000})).status,200);
  assert.equal((await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,{...body,amount:1})).status,409);
  const confirm=await request('accountant',`/crm/deals/${f.deal}/commission-receipt-confirmations`,{idempotencyKey:id(),reason:'Synthetic company-account receipt reconciled',evidenceReference:proof.proofReference});
  assert.equal(confirm.status,201,JSON.stringify(confirm.data));assert.equal(confirm.data.closureReady,true);
  const reloaded=await request('accountant',`/crm/deals/${f.deal}/commission`);
  assert.equal(Number(reloaded.data.confirmations[0].confirmedActualReceived),20000);
  assert.equal(reloaded.data.confirmations[0].receiptDate,'2026-09-02');
  assert.equal(reloaded.data.receipts[0].receivedDate,'2026-09-02');
  assert.notEqual((await db.one('SELECT status FROM deals WHERE id=$1',[f.deal])).status,'closed_won');
  assert.equal((await request('accountant','/finance/agent-payouts')).status,403);
});

test('Accountant four-workspace scope: searchable finance Opportunity projection, own leave and denied unrelated access',gate,async()=>{
  const list=await request('accountant','/finance/accountant-opportunities?q='+f.prefix);
  assert.equal(list.status,200,JSON.stringify(list.data));assert.equal(list.data.readOnly,true);
  const item=list.data.opportunities.find(x=>x.id===f.opportunity);
  assert.ok(item);assert.equal(item.dealId,f.deal);assert.equal(item.agreedGrossCommission,20000);
  const receivableContext=await request('accountant',`/finance/receivables/opportunities/${f.opportunity}/context`);
  assert.equal(receivableContext.status,200,JSON.stringify(receivableContext.data));
  assert.equal(receivableContext.data.context.agreedGrossCommission,20000);
  assert.equal(receivableContext.data.context.dealId,f.deal);
  for(const privateField of ['contactEmail','contactPhone','contactId','leadId','privateNotes','listingId'])assert.equal(item[privateField],undefined);
  const detail=await request('accountant',`/finance/accountant-opportunities/${f.opportunity}`);
  assert.equal(detail.status,200);assert.equal(detail.data.opportunity.opportunityReference,f.prefix);
  assert.equal((await request('accountant',`/finance/accountant-opportunities/${id()}`)).status,404);
  assert.equal((await request('agent','/finance/accountant-opportunities')).status,403);
  assert.equal((await request('accountant','/finance/accountant-opportunities?q=NO-MATCH-'+id())).data.count,0);
  for(const url of ['/listings','/crm/leads','/crm/contacts','/crm/opportunities','/finance/agent-payouts']){
    assert.equal((await request('accountant',url)).status,403,url);
  }
  for(const url of ['/crm/my-employment','/crm/my-leave-balances','/crm/my-leave-applications'])assert.equal((await request('accountant',url)).status,200,url);
  for(const action of ['close-won','commission-expectations','agent-credit'])assert.equal((await request('accountant',`/crm/deals/${f.deal}/${action}`,{idempotencyKey:id()})).status,403,action);
  assert.equal((await request('agent','/listings')).status,200);
  // Distinct Opportunity/Deal references prove this is not merely relabelled Deal search.
  const oppReference=f.prefix+'-OPP';
  await db.execute('UPDATE opportunities SET opportunity_reference=$1 WHERE id=$2',[oppReference,f.opportunity]);
  const receiptRegister=await request('accountant','/finance/commission-deals?q='+oppReference);
  assert.equal(receiptRegister.status,200);assert.equal(receiptRegister.data.deals.length,1);
  assert.equal(receiptRegister.data.deals[0].opportunityReference,oppReference);
  assert.equal(receiptRegister.data.deals[0].dealReference,f.prefix);
  assert.equal(receiptRegister.data.deals[0].opportunityId,f.opportunity);
  assert.equal((await request('accountant','/finance/commission-deals?q='+f.prefix)).status,200);
});
