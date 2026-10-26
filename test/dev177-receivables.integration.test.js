import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
const enabled=process.env.NYSA_RUN_DEV177_DB_INTEGRATION==='1',gate={skip:enabled?false:'Restricted local synthetic database required'};
const browserMode=enabled&&process.env.NYSA_DEV177_BROWSER==='1',id=()=>crypto.randomUUID();
let db,server,request,f,schedule,first,second,collection;
before(async()=>{
  if(!enabled)return;
  process.env.PRIVATE_STORAGE_DIR=await fs.mkdtemp(path.join(os.tmpdir(),'nysa-opportunity-finance-'));
  assert.ok(['localhost','127.0.0.1','::1'].includes(process.env.PGHOST));
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs'),pool=guard.createFixturePool();
  try{await guard.assertDedicatedFixture(pool);}finally{await pool.end();}
  db=await import('../src/db.js');
  f={prefix:`AR-UAT-${Date.now()}`,agent:id(),accountant:id(),director:id(),admin:id(),contact:id(),lead:id(),requirement:id(),opportunity:id(),deal:id(),developer:id(),agency:id(),tokens:{}};
  for(const [role,jobRole] of [['agent','sales_agent'],['accountant','accountant'],['director','director'],['admin','admin']]){
    await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,$2,$3,$4,'active','synthetic-only',$5)`,[f[role],`${f.prefix} ${role}`,`${f.prefix}-${role}@example.invalid`,role==='admin'?'admin':'internal_broker',jobRole]);
    const token=crypto.randomBytes(32).toString('hex');f.tokens[role]=token;
    await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(token).digest('hex'),f[role]]);
  }
  await db.execute(`INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$4,'buyer',$3,$3)`,[f.contact,f.prefix,f.agent,`${f.prefix}@example.invalid`]);
  for(const type of ['developer','agency'])await db.execute('INSERT INTO companies(id,name,company_type,created_by) VALUES($1,$2,$3,$4)',[f[type],`${f.prefix} ${type}`,type,f.agent]);
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Off-plan','Qualified','Warm',$4,$4)`,[f.lead,f.contact,f.prefix,f.agent]);
  await db.execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,funding_method,timeline_code,created_by) VALUES($1,$2,1,'Sale','own_use','cash','0_3_months',$3)`,[f.requirement,f.lead,f.agent]);
  await db.execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Deal','Synthetic receivables UAT',NOW()+INTERVAL '1 day','send_property_details',$6)`,[f.opportunity,f.prefix,f.lead,f.contact,f.requirement,f.agent]);
  await db.execute('UPDATE opportunities SET buyer_commission_percent=2,seller_commission_percent=0 WHERE id=$1',[f.opportunity]);
  await db.execute(`INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,owner_id,created_by)
    VALUES($1,$2,$3,'sale',1000000,'AED',NOW()+INTERVAL '1 day',$4,$4)`,[f.deal,f.prefix+'-DEAL',f.opportunity,f.agent]);
  const {createApp,Router}=await import('../src/lib/http-kit.js'),app=createApp();
  if(browserMode){
    const start=Router();
    for(const role of ['accountant','agent'])start.get(`/fixture-${role}`,(_req,res)=>{res.setHeader('Set-Cookie',`nysa_session=${f.tokens[role]}; HttpOnly; SameSite=Strict; Path=/`);res.statusCode=302;res.setHeader('Location','/');res.end();});
    app.mount('',start);app.static(path.resolve('public'));
    for(const name of ['auth','governance','lead-operations','qualification-finance','release3c-governed-shares','document-compliance','classification-catalogue','official-document-evidence','dashboards','listings','opportunities','crm'])app.mount('/api',(await import(`../src/routes/${name}.js`)).default);
  }
  app.mount('/api',(await import('../src/routes/commission-payout.js')).default);
  server=await new Promise(resolve=>{const s=app.listen({port:browserMode?4177:0,host:'127.0.0.1'},()=>resolve(s));});
  request=async(role,url,body)=>{
    if(body&&url.endsWith('/collections'))body={receiptMethod:'bank_transfer',...body};
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api${url}`,{method:body?'POST':'GET',headers:{authorization:`Bearer ${f.tokens[role]}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
    return{status:response.status,data:await response.json()};
  };
});
after(async()=>{if(browserMode){console.log(JSON.stringify({browserFixture:'http://127.0.0.1:4177/fixture-accountant',opportunityReference:f.prefix,noDealOpportunityReference:f.noDealReference}));return;}server?.closeAllConnections();server?.close();if(db)await db.closeDatabase();});
const payload=()=>({idempotencyKey:id(),opportunityId:f.opportunity,payerType:'developer',payerId:f.developer,commissionAmount:'10000',instalments:[{commissionAmount:'4000',dueDate:'2026-09-01',milestone:'Booking'},{commissionAmount:'6000',dueDate:'2026-12-01',milestone:'Construction milestone'}]});
const endpoint=invoiceId=>`/finance/receivables/${invoiceId}`;
test('Finance-only selectors expose uninvoiced Closed Won commission balances and reject other roles',gate,async()=>{
  assert.equal((await request('agent','/finance/receivables')).status,403);
  assert.equal((await request('agent','/finance/receivables/schedules',payload())).status,403);
  for(const role of ['accountant','director','admin'])assert.equal((await request(role,'/finance/receivables')).status,200);
  const opp=await request('accountant',`/finance/receivables/opportunities?q=${f.prefix}`);
  assert.equal(opp.data.opportunities.length,0,'A non-Closed-Won Opportunity must not appear in the commission receivable selector');
  for(const type of ['customer','agency','developer']){
    const lookup=await request('accountant',`/finance/receivables/payers?type=${type}&q=${f.prefix}`);
    assert.equal(lookup.status,200);assert.equal(lookup.data.payers.length,1);assert.deepEqual(Object.keys(lookup.data.payers[0]).sort(),['id','name']);
  }
});
test('Closed Won Opportunity automatically enters awaiting invoicing and leaves only after an active schedule exists',gate,async()=>{
  const closedLead=id(),closedRequirement=id(),closedOpportunity=id(),closedDeal=id(),closedPayer=id(),reference=`NYSA-OP-209999-${Date.now()}`;
  await db.execute("INSERT INTO companies(id,name,company_type,created_by) VALUES($1,$2,'developer',$3)",[closedPayer,`SYNTHETIC HANDOFF PAYER ${Date.now()}`,f.agent]);
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Off-plan','Won','Warm',$4,$4)`,[closedLead,f.contact,reference,f.agent]);
  await db.execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,funding_method,timeline_code,created_by) VALUES($1,$2,1,'Sale','own_use','cash','0_3_months',$3)`,[closedRequirement,closedLead,f.agent]);
  await db.execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,closed_at,next_action,next_action_due_at,next_action_code,created_by,buyer_commission_percent,seller_commission_percent,originating_agent_split_percent,servicing_agent_split_percent)
    VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Closed Won',NOW(),'Transaction complete',NOW(),'closed_won',$6,2,0,25,75)`,[closedOpportunity,reference,closedLead,f.contact,closedRequirement,f.agent]);
  await db.execute(`INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,actual_completion_at,status,owner_id,created_by,approved_by,approved_at,approval_reason,approval_evidence_reference,closed_by,closed_at,closure_evidence_reference)
    VALUES($1,$2,$3,'sale',1000000,'AED',NOW(),NOW(),'closed_won',$4,$4,$4,NOW(),'Synthetic manager approval','SYNTHETIC approval evidence',$4,NOW(),'SYNTHETIC closure evidence')`,[closedDeal,reference+'-DEAL',closedOpportunity,f.agent]);
  const denied=await request('agent','/finance/receivables/awaiting');assert.equal(denied.status,403);
  let waiting=await request('accountant','/finance/receivables/awaiting');assert.equal(waiting.status,200,JSON.stringify(waiting.data));
  let row=waiting.data.opportunities.find(x=>x.id===closedOpportunity);assert.ok(row,JSON.stringify(waiting.data));assert.equal(Number(row.expectedCommission),20000);assert.equal(row.commissionStatus,'ready');
  const lookup=await request('accountant',`/finance/receivables/opportunities?q=${reference} - Sale`);assert.equal(lookup.data.opportunities[0].id,closedOpportunity);
  assert.equal(lookup.data.opportunities[0].displayParty,f.prefix);assert.equal(lookup.data.opportunities[0].outstandingCommission,20000);
  const created=await request('accountant','/finance/receivables/schedules',{idempotencyKey:id(),opportunityId:closedOpportunity,payerType:'developer',payerId:closedPayer,commissionAmount:20000,instalments:[{commissionAmount:20000,dueDate:'2026-09-30',milestone:'Commission due'}]});
  assert.equal(created.status,201,JSON.stringify(created.data));
  waiting=await request('accountant','/finance/receivables/awaiting');assert.ok(!waiting.data.opportunities.some(x=>x.id===closedOpportunity));
  const cancelled=await request('accountant',endpoint(created.data.invoices[0].id)+'/cancel',{idempotencyKey:id(),reason:'Synthetic replacement schedule required'});assert.equal(cancelled.status,201,JSON.stringify(cancelled.data));
  waiting=await request('accountant','/finance/receivables/awaiting');row=waiting.data.opportunities.find(x=>x.id===closedOpportunity);assert.ok(row,JSON.stringify(waiting.data));
});
test('Create two separate planned invoices with correct VAT; atomic validation and idempotent retries',gate,async()=>{
  const body=payload();
  const created=await request('accountant','/finance/receivables/schedules',body);
  assert.equal(created.status,201,JSON.stringify(created.data));schedule=created.data;[first,second]=schedule.invoices;
  assert.equal(first.totalCents,420000);assert.equal(second.totalCents,630000);assert.equal(first.status,'scheduled');assert.equal(first.invoiceReference,null);
  const retry=await request('accountant','/finance/receivables/schedules',body);assert.equal(retry.status,200);assert.equal(retry.data.scheduleId,schedule.scheduleId);
  assert.equal((await request('accountant','/finance/receivables/schedules',{...body,commissionAmount:10001})).status,409);
  assert.equal((await request('accountant','/finance/receivables/schedules',{...payload(),commissionAmount:10001})).status,400);
  assert.equal((await request('accountant','/finance/receivables/schedules',{...payload(),payerId:f.agency})).status,400);
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM commission_receivable_schedules WHERE opportunity_id=$1',[f.opportunity])).n,1);
  assert.equal((await request('accountant',endpoint(first.id))).status,200);
});
test('Each instalment requires its own issued invoice; bad dates, duplicate references and role escalation rejected',gate,async()=>{
  const url=endpoint(first.id)+'/issue',body={idempotencyKey:id(),invoiceDate:'2026-08-31',invoiceReference:f.prefix+'-INV-1'};
  assert.equal((await request('agent',url,body)).status,403);
  assert.equal((await request('accountant',url,{...body,invoiceDate:'2026-02-30'})).status,400);
  assert.equal((await request('accountant',url,{...body,invoiceDate:'2099-01-01'})).status,400);
  assert.equal((await request('accountant',url,{...body,invoiceDate:'2026-09-02'})).status,400);
  const created=await request('accountant',url,body);assert.equal(created.status,201,JSON.stringify(created.data));assert.equal(created.data.invoice.status,'unpaid');assert.equal(created.data.invoice.overdue,true);
  assert.equal((await request('accountant',url,body)).status,200);
  assert.equal((await request('accountant',endpoint(second.id)+'/issue',{...body,idempotencyKey:id(),invoiceReference:body.invoiceReference.toLowerCase()})).status,409);
  assert.equal((await request('accountant',endpoint(second.id)+'/issue',{...body,idempotencyKey:id(),invoiceReference:f.prefix+'-INV-2'})).status,201);
});
test('Gross partial collection drives balance; repeated bank reference and overpayment are blocked',gate,async()=>{
  const url=endpoint(first.id)+'/collections',body={idempotencyKey:id(),amount:'1050',receivedDate:'2026-09-01',financeReference:f.prefix+'-BANK-1',evidenceReference:'SYNTHETIC bank proof 1'};
  const result=await request('accountant',url,body);assert.equal(result.status,201,JSON.stringify(result.data));collection=result.data.collectionId;
  assert.equal(result.data.invoice.status,'part_paid');assert.equal(result.data.invoice.balanceCents,315000);
  assert.equal(result.data.netCommissionCents,100000);assert.equal(result.data.vatCents,5000);
  const posted=await db.one('SELECT * FROM deal_commission_receipts WHERE id=$1',[result.data.commissionReceiptId]);
  assert.equal(Number(posted.amount),1000);assert.equal(posted.opportunityId,f.opportunity);assert.equal(posted.dealId,null);assert.equal(posted.entryType,'receipt');
  assert.equal((await request('accountant',url,body)).status,200);
  assert.equal((await request('accountant',url,{...body,idempotencyKey:id()})).status,409);
  assert.equal((await request('accountant',url,{...body,idempotencyKey:id(),amount:5000})).status,409);
  assert.equal((await request('accountant',url,{...body,idempotencyKey:id(),receivedDate:'2026-08-01'})).status,400);
  assert.equal((await request('accountant',endpoint(first.id)+'/cancel',{idempotencyKey:id(),reason:'Cannot cancel paid amount'})).status,409);
});
test('Concurrent remaining payments cannot overcollect; invoice is paid after reload with full audit',gate,async()=>{
  const payment={amount:'3150',receivedDate:'2026-09-02',evidenceReference:'SYNTHETIC final payment'};
  const results=await Promise.all([1,2].map(n=>request('accountant',endpoint(first.id)+'/collections',{...payment,idempotencyKey:id(),financeReference:f.prefix+'-FINAL-'+n})));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const detail=await request('accountant',endpoint(first.id));assert.equal(detail.status,200,JSON.stringify(detail.data));
  assert.equal(detail.data.invoice.status,'paid');assert.equal(detail.data.invoice.balanceCents,0);assert.equal(detail.data.collections.length,2);assert.ok(detail.data.events.length>=4);
  const register=await request('accountant',`/finance/receivables?q=${f.prefix}&status=paid`);assert.equal(register.status,200);
  assert.equal(register.data.summary.invoiceCount,1);assert.equal(Number(register.data.summary.collectedCents),420000);
});
test('Audited reversals restore balance; cancellation preserves invoice and blocks further collection',gate,async()=>{
  assert.equal((await request('accountant',endpoint(second.id)+'/reverse',{idempotencyKey:id(),collectionId:collection,reason:'Wrong invoice reference correction'})).status,400);
  const result=await request('accountant',endpoint(first.id)+'/reverse',{idempotencyKey:id(),collectionId:collection,reason:'Synthetic duplicate payment correction'});
  assert.equal(result.status,201);assert.equal(result.data.invoice.balanceCents,105000);assert.equal(result.data.invoice.status,'part_paid');
  const reversed=await db.one('SELECT * FROM deal_commission_receipts WHERE id=$1',[result.data.commissionReceiptId]);
  assert.equal(Number(reversed.amount),1000);assert.equal(reversed.entryType,'reversal');
  const original=await db.one('SELECT commission_receipt_id FROM commission_receivable_collections WHERE id=$1',[collection]);
  assert.equal(reversed.reversesReceiptId,original.commissionReceiptId);
  assert.equal((await request('accountant',endpoint(first.id)+'/reverse',{idempotencyKey:id(),collectionId:collection,reason:'Attempt duplicate reversal'})).status,409);
  assert.equal((await request('accountant',endpoint(second.id)+'/cancel',{idempotencyKey:id(),reason:'Synthetic cancelled milestone'})).status,201);
  assert.equal((await request('accountant',endpoint(second.id)+'/collections',{idempotencyKey:id(),amount:1})).status,409);
  await assert.rejects(db.execute('DELETE FROM commission_receivable_collections WHERE id=$1',[collection]),/immutable/);
  await assert.rejects(db.execute('UPDATE commission_receivable_invoices SET commission_cents=1 WHERE id=$1',[first.id]),/immutable/);
  const register=await request('accountant',`/finance/receivables?q=${f.prefix}`);assert.equal(Number(register.data.summary.outstandingCents),105000);assert.equal(Number(register.data.summary.overdueCents),105000);
});
test('Concurrent schedule retry writes once; customer/agency/developer all supported without touching closure',gate,async()=>{
  const body={...payload(),payerType:'agency',payerId:f.agency};
  const results=await Promise.all([request('accountant','/finance/receivables/schedules',body),request('accountant','/finance/receivables/schedules',body)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(results[0].data.scheduleId,results[1].data.scheduleId);
  assert.equal((await request('accountant','/finance/receivables/schedules',{...payload(),payerType:'customer',payerId:f.contact})).status,201);
  assert.equal((await db.one('SELECT stage FROM opportunities WHERE id=$1',[f.opportunity])).stage,'Deal');
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deals WHERE opportunity_id=$1',[f.opportunity])).n,1);
  assert.equal((await db.one('SELECT status FROM deals WHERE id=$1',[f.deal])).status,'draft');
});
test('Pagination keeps complete filtered totals and invalid inputs do not become server errors',{...gate,skip:gate.skip||browserMode},async()=>{
  const body={...payload(),commissionAmount:60,instalments:Array.from({length:60},(_,n)=>({commissionAmount:1,dueDate:'2027-01-01',milestone:`Synthetic page test ${n+1}`}))};
  assert.equal((await request('accountant','/finance/receivables/schedules',body)).status,201);
  const p1=await request('accountant',`/finance/receivables?q=${f.prefix}`),p2=await request('accountant',`/finance/receivables?q=${f.prefix}&page=2`);
  assert.equal(p1.data.invoices.length,50);assert.equal(p2.data.invoices.length,16);assert.equal(p1.data.summary.invoiceCount,66);
  assert.deepEqual(p1.data.summary,p2.data.summary);
  const scheduled=await request('accountant',`/finance/receivables?q=${f.prefix}&status=scheduled`);
  assert.equal(Number(scheduled.data.summary.scheduledCents),2100000+6300);
  assert.equal((await request('accountant','/finance/receivables?status=invalid')).status,400);
  // Restricted Accountant boundary rejects paths outside its exact route grammar.
  assert.equal((await request('accountant','/finance/receivables/not-an-id')).status,403);
  assert.equal((await request('accountant','/finance/receivables/schedules',{...payload(),instalments:[null]})).status,400);
});

test('Receivables reads live Opportunity split without exposing customer or sales details',gate,async()=>{
  await db.execute('UPDATE opportunities SET originating_agent_split_percent=25,servicing_agent_split_percent=75 WHERE id=$1',[f.opportunity]);
  const url=`/finance/receivables/opportunities/${f.opportunity}/context`;
  const response=await request('accountant',url);
  assert.equal(response.status,200,JSON.stringify(response.data));assert.equal(response.data.readOnly,true);
  assert.equal(Number(response.data.context.originatingAgentSplitPercent),25);
  assert.equal(Number(response.data.context.servicingAgentSplitPercent),75);
  assert.equal(response.data.context.agreedGrossCommission,20000,JSON.stringify(response.data.context));
  assert.ok(Number(response.data.context.scheduledCommissionCents)>0);
  for(const field of ['contactId','leadId','ownerId','email','phone','privateNotes'])assert.equal(response.data.context[field],undefined);
  assert.equal((await request('agent',url)).status,403);
  assert.equal((await request('accountant',`/finance/receivables/opportunities/${id()}/context`)).status,404);
});

test('Finance displays linked invoice references and rejects recording the same payment again',gate,async()=>{
  const data=await request('accountant',`/crm/deals/${f.deal}/commission`);
  assert.equal(data.status,200,JSON.stringify(data.data));
  assert.ok(data.data.receipts.some(r=>r.invoiceReference===f.prefix+'-INV-1'&&r.opportunityReference===f.prefix));
  const duplicate=await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,{
    idempotencyKey:id(),amount:1000,receivedDate:'2026-09-01',receiptMethod:'bank_transfer',
    financeReference:f.prefix+'-BANK-1',evidenceReference:'SYNTHETIC duplicate should fail'});
  assert.equal(duplicate.status,409,JSON.stringify(duplicate.data));
});

test('Direct Finance receipt cannot be duplicated as an invoice payment; failures preserve balances',gate,async()=>{
  const financeReference=f.prefix+'-DIRECT';
  const direct=await request('accountant',`/crm/deals/${f.deal}/commission-receipts`,{
    idempotencyKey:id(),amount:100,receivedDate:'2026-09-01',receiptMethod:'bank_transfer',financeReference,evidenceReference:'SYNTHETIC direct payment'});
  assert.equal(direct.status,201,JSON.stringify(direct.data));
  const before=await request('accountant',endpoint(first.id));
  const body={idempotencyKey:id(),amount:105,receivedDate:'2026-09-02',financeReference,evidenceReference:'SYNTHETIC must not duplicate'};
  assert.equal((await request('accountant',endpoint(first.id)+'/collections',body)).status,409);
  assert.equal((await request('accountant',endpoint(first.id)+'/collections',{...body,financeReference:f.prefix+'-BADMETHOD',receiptMethod:'unknown'})).status,400);
  assert.equal((await request('accountant',endpoint(first.id)+'/collections',{...body,financeReference:f.prefix+'-BADPROOF',proofId:id()})).status,400);
  const after=await request('accountant',endpoint(first.id));
  assert.equal(after.data.invoice.balanceCents,before.data.invoice.balanceCents);
  assert.equal(after.data.collections.length,before.data.collections.length);
});

test('A new partial payment supersedes confirmation, preserves evidence and permits fresh reconciliation',gate,async()=>{
  const expectation=await request('agent',`/crm/deals/${f.deal}/commission-expectations`,{idempotencyKey:id(),referralAmount:0,referralSettlementBasis:'none'});
  assert.equal(expectation.status,201,JSON.stringify(expectation.data));
  assert.equal((await request('agent',`/crm/deal-commission-expectations/${expectation.data.expectation.id}/freeze`,{})).status,200);
  const confirm=()=>request('accountant',`/crm/deals/${f.deal}/commission-receipt-confirmations`,{idempotencyKey:id(),reason:'Synthetic receipt evidence reconciled',evidenceReference:'SYNTHETIC confirmation'});
  const original=await confirm();assert.equal(original.status,201,JSON.stringify(original.data));
  const pay=await request('accountant',endpoint(first.id)+'/collections',{idempotencyKey:id(),amount:'105',receivedDate:'2026-09-02',financeReference:f.prefix+'-AFTERCONF',evidenceReference:'SYNTHETIC additional partial payment'});
  assert.equal(pay.status,201,JSON.stringify(pay.data));
  const saved=await db.one('SELECT * FROM deal_commission_receipt_confirmations WHERE id=$1',[original.data.confirmation.id]);
  assert.equal(saved.status,'superseded');assert.equal(saved.confirmedActualReceived,original.data.confirmation.confirmedActualReceived);
  await assert.rejects(()=>db.execute('UPDATE deal_commission_receipt_confirmations SET confirmed_actual_received=1 WHERE id=$1',[saved.id]),/immutable/);
  const next=await confirm();assert.equal(next.status,201,JSON.stringify(next.data));
  assert.equal(Number(next.data.confirmation.confirmedActualReceived),Number(original.data.confirmation.confirmedActualReceived)+100);
  const reversal=await request('accountant',endpoint(first.id)+'/reverse',{idempotencyKey:id(),collectionId:pay.data.collectionId,reason:'Synthetic correct wrong payment allocation'});
  assert.equal(reversal.status,201,JSON.stringify(reversal.data));
  assert.equal((await db.one('SELECT status FROM deal_commission_receipt_confirmations WHERE id=$1',[next.data.confirmation.id])).status,'superseded');
  assert.equal((await request('accountant','/finance/agent-payouts')).status,403);
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deal_agent_credit_versions WHERE deal_id=$1',[f.deal])).n,0);
});

test('Receipt posting rolls back if the linked collection write fails',gate,async()=>{
  const body={idempotencyKey:id(),amount:105,receivedDate:'2026-09-02',financeReference:f.prefix+'-ATOMIC',evidenceReference:'SYNTHETIC rollback'};
  // Fault injection is limited to this disposable invoice in the guarded local schema.
  const fn='test_ar_fault_'+first.id.replaceAll('-','');
  await db.execute(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic collection fault'; END $$`);
  await db.execute(`CREATE TRIGGER ${fn} BEFORE INSERT ON commission_receivable_collections FOR EACH ROW WHEN (NEW.invoice_id='${first.id}'::uuid) EXECUTE FUNCTION ${fn}()`);
  try{
    assert.equal((await request('accountant',endpoint(first.id)+'/collections',body)).status,500);
    assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deal_commission_receipts WHERE finance_reference=$1',[body.financeReference])).n,0);
    assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM commission_receivable_requests WHERE idempotency_key=$1',[body.idempotencyKey])).n,0);
  }finally{await db.execute(`DROP TRIGGER ${fn} ON commission_receivable_collections`);await db.execute(`DROP FUNCTION ${fn}()`);}
  const retry=await request('accountant',endpoint(first.id)+'/collections',body);
  assert.equal(retry.status,201,JSON.stringify(retry.data));
  assert.equal((await request('accountant',endpoint(first.id)+'/collections',body)).status,200);
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deal_commission_receipts WHERE finance_reference=$1',[body.financeReference])).n,1);
});

test('VAT-only rounding is linked and reversible without inventing a zero Finance receipt',gate,async()=>{
  const created=await request('accountant','/finance/receivables/schedules',{...payload(),commissionAmount:'0.10',instalments:[{commissionAmount:'0.10',dueDate:'2026-09-03',milestone:'Synthetic rounding'}]});
  assert.equal(created.status,201,JSON.stringify(created.data));
  const invoice=(await db.one('SELECT id FROM commission_receivable_invoices WHERE schedule_id=$1',[created.data.scheduleId])).id;
  assert.equal((await request('accountant',endpoint(invoice)+'/issue',{idempotencyKey:id(),invoiceReference:f.prefix+'-ROUND',invoiceDate:'2026-09-03'})).status,201);
  const pay=amount=>request('accountant',endpoint(invoice)+'/collections',{idempotencyKey:id(),amount,receivedDate:'2026-09-03',financeReference:f.prefix+'-ROUND-'+id(),evidenceReference:'SYNTHETIC rounding evidence'});
  const net=await pay('0.05');assert.equal(net.status,201,JSON.stringify(net.data));assert.equal(net.data.netCommissionCents,5);
  const vat=await pay('0.01');assert.equal(vat.status,201,JSON.stringify(vat.data));assert.equal(vat.data.netCommissionCents,0);assert.equal(vat.data.vatCents,1);assert.equal(vat.data.commissionReceiptId,null);
  const final=await pay('0.05');assert.equal(final.status,201,JSON.stringify(final.data));assert.equal(final.data.netCommissionCents,5);
  const paid=await request('accountant',endpoint(invoice));assert.equal(paid.data.invoice.status,'paid');assert.equal(Number(paid.data.invoice.balanceCents),0);
  const reversed=await request('accountant',endpoint(invoice)+'/reverse',{idempotencyKey:id(),collectionId:vat.data.collectionId,reason:'Synthetic VAT-only rounding correction'});
  assert.equal(reversed.status,201,JSON.stringify(reversed.data));assert.equal(reversed.data.commissionReceiptId,null);
  assert.equal(Number((await request('accountant',endpoint(invoice))).data.invoice.balanceCents),1);
});

test('Opportunity without any Deal: issue invoice, upload proof, collect partial payments and reconcile',gate,async()=>{
  f.noDeal=id();f.noDealReference=f.prefix+'-NO-DEAL';
  const newLead=id(),newRequirement=id();
  await db.execute(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$4)`,[newLead,f.contact,f.noDealReference,f.agent]);
  await db.execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,funding_method,timeline_code,created_by) VALUES($1,$2,1,'Sale','own_use','cash','0_3_months',$3)`,[newRequirement,newLead,f.agent]);
  await db.execute(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by,originating_agent_split_percent,servicing_agent_split_percent)
    VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Viewing','Synthetic Opportunity finance',NOW()+INTERVAL '1 day','send_property_details',$6,25,75)`,[f.noDeal,f.noDealReference,newLead,f.contact,newRequirement,f.agent]);
  const created=await request('accountant','/finance/receivables/schedules',{...payload(),opportunityId:f.noDeal,commissionAmount:1000,instalments:[{commissionAmount:1000,dueDate:'2026-09-03',milestone:'Commission instalment'}]});
  assert.equal(created.status,201,JSON.stringify(created.data));f.noDealInvoice=created.data.invoices[0].id;
  assert.equal((await request('accountant',endpoint(f.noDealInvoice)+'/issue',{idempotencyKey:id(),invoiceDate:'2026-09-03',invoiceReference:f.noDealReference+'-INV'})).status,201);
  const base=`/finance/opportunities/${f.noDeal}`;
  const {PdfDoc}=await import('../src/proposal-pdf.js'),pdf=new PdfDoc();pdf.page(['BT /F1 12 Tf 40 800 Td (SYNTHETIC OPPORTUNITY PAYMENT PROOF) Tj ET']);
  f.noDealProofBody={idempotencyKey:id(),fileName:'synthetic-opportunity-proof.pdf',mediaType:'application/pdf',base64:pdf.finish().toString('base64')};
  const uploaded=await request('accountant',base+'/commission-proofs',f.noDealProofBody);assert.equal(uploaded.status,201,JSON.stringify(uploaded.data));f.noDealProof=uploaded.data.proof;
  assert.equal(f.noDealProof.opportunityId,f.noDeal);assert.equal(f.noDealProof.dealId,null);assert.equal(f.noDealProof.storageKey,undefined);
  f.noDealPaymentBody={idempotencyKey:id(),amount:'0.525K',receivedDate:'2026-09-03',financeReference:f.noDealReference+'-BANK1',receiptMethod:'bank_transfer',proofId:f.noDealProof.id};
  const pay=await request('accountant',endpoint(f.noDealInvoice)+'/collections',f.noDealPaymentBody);assert.equal(pay.status,201,JSON.stringify(pay.data));f.noDealPayment=pay.data;
  assert.equal(pay.data.invoice.status,'part_paid');assert.equal(pay.data.netCommissionCents,50000);assert.equal(pay.data.vatCents,2500);
  const receipt=await db.one('SELECT * FROM deal_commission_receipts WHERE id=$1',[pay.data.commissionReceiptId]);assert.equal(receipt.opportunityId,f.noDeal);assert.equal(receipt.dealId,null);
  const confirmed=await request('accountant',base+'/commission-receipt-confirmations',{idempotencyKey:id(),reason:'Synthetic payment reconciled against bank',evidenceReference:'SYNTHETIC bank reconciliation'});
  assert.equal(confirmed.status,201,JSON.stringify(confirmed.data));assert.equal(confirmed.data.confirmation.opportunityId,f.noDeal);assert.equal(confirmed.data.confirmation.dealId,null);assert.equal(Number(confirmed.data.confirmation.confirmedActualReceived),500);
  assert.equal(confirmed.data.confirmation.expectationBasis,'issued_invoices');f.noDealConfirmation=confirmed.data.confirmation;
  const details=await request('accountant',base+'/commission');assert.equal(details.status,200);assert.equal(details.data.receipts.length,1);assert.equal(details.data.receipts[0].invoiceReference,f.noDealReference+'-INV');
  assert.equal(Number(details.data.opportunity.originatingAgentSplitPercent),25);
  assert.equal((await request('accountant','/finance/commission-opportunities?q='+f.noDealReference)).data.opportunities[0].id,f.noDeal);
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deals WHERE opportunity_id=$1',[f.noDeal])).n,0);
  assert.equal((await db.one('SELECT stage FROM opportunities WHERE id=$1',[f.noDeal])).stage,'Viewing');
});

test('No-Deal Opportunity receipts reject unauthorized access, wrong proof, duplicate bank references and conflicting retries',gate,async()=>{
  const base=`/finance/opportunities/${f.noDeal}`;
  assert.equal((await request('agent',base+'/commission')).status,403);
  assert.equal((await request('agent',base+'/commission-receipt-confirmations',{idempotencyKey:id(),reason:'Must not confirm',evidenceReference:'SYNTHETIC'})).status,403);
  assert.equal((await request('accountant','/finance/agent-payouts')).status,403);
  assert.equal((await request('accountant',endpoint(f.noDealInvoice)+'/collections',f.noDealPaymentBody)).status,200);
  assert.equal((await request('accountant',base+'/commission-proofs',f.noDealProofBody)).status,200);
  assert.equal((await request('accountant',`/finance/opportunities/${f.opportunity}/commission-proofs/${f.noDealProof.id}/download`)).status,400);
  assert.equal((await request('accountant',endpoint(first.id)+'/collections',{...f.noDealPaymentBody,idempotencyKey:id(),amount:105})).status,400);
  assert.equal((await request('accountant',base+'/commission-receipts',{...f.noDealPaymentBody,amount:500,idempotencyKey:id()})).status,409);
  await assert.rejects(()=>db.execute('UPDATE deal_commission_receipts SET opportunity_id=$1 WHERE id=$2',[f.opportunity,f.noDealPayment.commissionReceiptId]),/immutable/);
});

test('No-Deal payment reversal restores invoice and supersedes reconciliation; later Deal creation does not copy receipts',gate,async()=>{
  const before=await request('accountant',`/finance/opportunities/${f.noDeal}/commission`);
  const reversed=await request('accountant',endpoint(f.noDealInvoice)+'/reverse',{idempotencyKey:id(),collectionId:f.noDealPayment.collectionId,reason:'Synthetic Opportunity payment correction'});
  assert.equal(reversed.status,201,JSON.stringify(reversed.data));assert.equal(reversed.data.invoice.status,'unpaid');
  assert.equal(Number(reversed.data.invoice.balanceCents),105000);
  assert.equal((await db.one('SELECT status FROM deal_commission_receipt_confirmations WHERE id=$1',[f.noDealConfirmation.id])).status,'superseded');
  const newBody={...f.noDealPaymentBody,idempotencyKey:id(),amount:'1.05K',financeReference:f.noDealReference+'-BANK2'};
  const paid=await request('accountant',endpoint(f.noDealInvoice)+'/collections',newBody);assert.equal(paid.status,201,JSON.stringify(paid.data));assert.equal(paid.data.invoice.status,'paid');
  const priorCount=(await db.one('SELECT COUNT(*)::int AS n FROM opportunity_commission_receipts WHERE finance_opportunity_id=$1',[f.noDeal])).n;
  if(browserMode)return; // Leave this exact synthetic Opportunity without a Deal for browser checks.
  const laterDeal=id();await db.execute(`INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,owner_id,created_by)
    VALUES($1,$2,$3,'sale',1000000,'AED',NOW()+INTERVAL '1 day',$4,$4)`,[laterDeal,f.noDealReference+'-LATER',f.noDeal,f.agent]);
  const legacy=await request('accountant',`/crm/deals/${laterDeal}/commission`);
  assert.equal(legacy.status,200,JSON.stringify(legacy.data));assert.equal(legacy.data.receipts.length,priorCount);
  assert.ok(legacy.data.receipts.some(r=>r.id===before.data.receipts[0].id));
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM opportunity_commission_receipts WHERE finance_opportunity_id=$1',[f.noDeal])).n,priorCount);
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deal_commission_receipts WHERE deal_id=$1',[laterDeal])).n,0);
  assert.equal((await db.one('SELECT COUNT(*)::int AS n FROM deal_agent_credit_versions WHERE deal_id=$1',[laterDeal])).n,0);
});

test('Opportunity direct receipts and confirmations serialize retries and preserve parent identity', {...gate,skip:gate.skip||browserMode},async()=>{
  const base=`/finance/opportunities/${f.noDeal}`,body={idempotencyKey:id(),amount:'0.01K',receivedDate:'2026-09-03',receiptMethod:'bank_transfer',financeReference:f.noDealReference+'-DIRECT',proofId:f.noDealProof.id};
  const results=await Promise.all([request('accountant',base+'/commission-receipts',body),request('accountant',base+'/commission-receipts',body)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(results[0].data.receipt.id,results[1].data.receipt.id);
  assert.equal(results[0].data.receipt.opportunityId,f.noDeal);assert.equal(results[0].data.receipt.dealId,null);
  assert.equal((await request('accountant',base+'/commission-receipts',{...body,idempotencyKey:id()})).status,409);
  const confirmation={idempotencyKey:id(),reason:'Synthetic concurrent reconciliation',evidenceReference:'SYNTHETIC bank reconciliation'};
  const confirms=await Promise.all([request('accountant',base+'/commission-receipt-confirmations',confirmation),request('accountant',base+'/commission-receipt-confirmations',confirmation)]);
  assert.deepEqual(confirms.map(r=>r.status).sort(),[200,201]);assert.equal(confirms[0].data.confirmation.id,confirms[1].data.confirmation.id);
  assert.equal((await request('accountant',base+'/commission-receipt-confirmations',{...confirmation,reason:'Conflicting details must be rejected'})).status,409);
  await assert.rejects(()=>db.execute(`INSERT INTO deal_commission_receipts(id,receipt_reference,opportunity_id,entry_type,amount,currency,received_date,receipt_method,finance_reference,normalized_finance_reference,evidence_reference,evidence_fingerprint,idempotency_key,recorded_by,proof_id)
    SELECT $1,$2,$3,'receipt',amount,currency,received_date,receipt_method,$2,$2,evidence_reference,evidence_fingerprint,$2,recorded_by,proof_id FROM deal_commission_receipts WHERE id=$4`,[id(),f.prefix+'-BAD-OPP',f.opportunity,results[0].data.receipt.id]),/Proof must belong/);
});
