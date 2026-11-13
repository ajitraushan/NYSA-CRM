import assert from 'node:assert/strict';
import {createHash, randomInt, randomUUID} from 'node:crypto';
import test from 'node:test';

test('DEV273 Customer and Lead HTTP scope across linked surfaces', {
  skip:process.env.NYSA_DEV273_SCOPE_FIXTURE!=='local-synthetic',
},async t=>{
  assert.equal(process.env.PGHOST,'127.0.0.1');
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  const {db}=await import('../src/db.js');
  const {createApp}=await import('../src/lib/http-kit.js');
  const app=createApp();
  for(const name of ['crm','ai','files-proposals','opportunities','lead-operations','dashboards']){
    app.mount('/api',(await import('../src/routes/'+name+'.js')).default);
  }
  const users={};
  let server;
  try {
    for(const [name,role] of [['owner','sales_agent'],['outsider','sales_agent'],['director','director']]){
      const id=randomUUID(), token=createHash('sha256').update(randomUUID()).digest('hex');
      await db.query("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,$2,$3,'internal_broker',$4,'active','fixture')",[id,name,id+'@example.invalid',role]);
      await db.query("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),id]);
      users[name]={id,token};
    }
    const contact=randomUUID(),lead=randomUUID(),title='DEV273 '+contact;
    const email='scope-'+contact+'@example.invalid',phone='+971501234567';
    await db.query("INSERT INTO contacts(id,full_name,email,phone,contact_type,owner_id,created_by) VALUES($1,$2,$3,$4,'buyer',$5,$5)",[contact,title,email,phone,users.owner.id]);
    await db.query("INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$4)",[lead,contact,title,users.owner.id]);
    const document=randomUUID(), task=randomUUID();
    await db.query("INSERT INTO documents(id,document_reference,document_type,title,owner_id,created_by,contact_id,lead_id) VALUES($1,$2,'correspondence',$2,$3,$3,$4,$5)",[document,title,users.owner.id,contact,lead]);
    await db.query("INSERT INTO proposals(id,lead_id,contact_id,template_type,title,created_by,proposal_number) VALUES($1,$2,$3,'customer_requirement',$4,$5,$6)",[randomUUID(),lead,contact,title,users.owner.id,'NYSA-PR-209912-'+String(randomInt(100000,1000000))]);
    await db.query("INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,due_at,created_by) VALUES($1,$2,$3,$4,$5,now(),$6)",[task,lead,contact,title,users.outsider.id,users.owner.id]);
    server=await new Promise(resolve=>{const listener=app.listen({host:'127.0.0.1',port:0},()=>resolve(listener));});
    const request=(user,path,method='GET')=>fetch('http://127.0.0.1:'+server.address().port+'/api/crm'+path,{method,
      headers:{authorization:'Bearer '+users[user].token}});
    await t.test('Opportunity list and detail mask Director contact details and enforce Agent scope',async()=>{
      const opportunity=randomUUID();
      await db.query(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by)
        VALUES($1,$2,$3,$4,$5,$2,'Sale','Deal','Send details',now(),'send_property_details',$5)`,[opportunity,title,lead,contact,users.owner.id]);
      await db.query(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,provenance_snapshot,provenance_hash)
        VALUES($1,$2,$3,'Website','{}',$4)`,[randomUUID(),opportunity,lead,'0'.repeat(64)]);
      for(const user of ['owner','director']){
        const list=await request(user,'/opportunities?leadId='+lead);
        assert.equal(list.status,200);
        const {opportunities}=await list.json();
        assert.equal(opportunities.length,1);
        const detail=await request(user,'/opportunities/'+opportunity);
        assert.equal(detail.status,200);
        for(const row of [opportunities[0],(await detail.json()).opportunity]){
          assert.equal(row.id,opportunity);
          assert.equal(row.contactEmail,user==='owner'?email:'s***@example.invalid');
          assert.equal(row.contactPhone,user==='owner'?phone:'••••4567');
        }
      }
      const blocked=await request('outsider','/opportunities/'+opportunity);
      assert.equal(blocked.status,404);
      await blocked.arrayBuffer();
    });
    for(const path of ['/customers/'+contact,'/leads/'+lead,'/customers/'+contact+'/documents',
      '/leads/'+lead+'/documents','/documents/'+document,'/leads/'+lead+'/proposals','/leads/'+lead+'/action-suggestions']){
      const response=await request('outsider',path);
      assert.equal(response.status,404,path);
      await response.arrayBuffer();
    }
    for(const path of ['/contacts','/leads','/opportunities']){
      const response=await request('outsider',path+'?q='+encodeURIComponent(title));
      assert.equal(response.status,200,path);
      assert.equal((await response.json()).count,0,path);
    }
    const tasks=await request('outsider','/tasks');
    assert.equal(tasks.status,200);
    assert.ok(!(await tasks.text()).includes(task));
    const ownerDocuments=await request('owner','/leads/'+lead+'/documents');
    assert.equal(ownerDocuments.status,200);
    assert.deepEqual((await ownerDocuments.json()).documents.map(row=>row.id),[document]);
    const ownerProposals=await request('owner','/leads/'+lead+'/proposals');
    assert.equal(ownerProposals.status,200);
    assert.ok((await ownerProposals.text()).includes(title));
    const dashboard=await request('outsider','/dashboard');
    assert.equal(dashboard.status,200);
    assert.ok(!(await dashboard.text()).includes(title));
    for(const user of ['outsider','director']){
      const response=await request(user,'/dashboard/export');
      assert.equal(response.status,200);
      const csv=await response.text();
      assert.equal(csv.includes(title),user==='director');
      assert.ok(!csv.includes(email)&&!csv.includes(phone));
    }
    const customer=await request('director','/customers/'+contact);
    assert.equal(customer.status,200);
    const masked=await customer.text();
    assert.ok(!masked.includes(email)&&!masked.includes(phone));
    const reveal=await request('director','/customers/'+contact+'/reveal-contact','POST');
    assert.equal(reveal.status,200);
    assert.equal(reveal.headers.get('cache-control'),'no-store');
    assert.deepEqual(await reveal.json(),{email,phone});
    const log=await request('director','/customers/'+contact+'/contact-reveal-log');
    assert.equal(log.status,200);
    assert.deepEqual((await log.json()).entries.map(row=>row.fields),[['phone','email']]);
    const audit=await db.query("SELECT details::jsonb AS details FROM audit_log WHERE entity_id=$1 AND action='contact_details_revealed'",[contact]);
    assert.deepEqual(audit.rows,[{details:{fields:['phone','email']}}]);
    const blockedReveal=await request('outsider','/customers/'+contact+'/reveal-contact','POST');
    assert.equal(blockedReveal.status,404);
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await db.end();
  }
});
