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
  const {savePrivate,removePrivate}=await import('../src/private-files.js');
  const {createApp}=await import('../src/lib/http-kit.js');
  const app=createApp();
  for(const name of ['crm','ai','files-proposals','opportunities','lead-operations','dashboards']){
    app.mount('/api',(await import('../src/routes/'+name+'.js')).default);
  }
  const users={};
  let server;
  try {
    for(const [name,role] of [['owner','sales_agent'],['outsider','sales_agent'],['offered','sales_agent'],['manager','manager'],['director','director']]){
      const id=randomUUID(), token=createHash('sha256').update(randomUUID()).digest('hex');
      await db.query("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,$2,$3,'internal_broker',$4,'active','fixture')",[id,name,id+'@example.invalid',role]);
      await db.query("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),id]);
      users[name]={id,token};
    }
    const team=randomUUID();
    await db.query('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,'DEV273 '+team,users.manager.id]);
    await db.query("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'manager',$3),($4,$2,$5,'member',$3),($6,$2,$7,'member',$3)",
      [randomUUID(),team,users.manager.id,randomUUID(),users.owner.id,randomUUID(),users.offered.id]);
    await db.query('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[users.owner.id,users.offered.id]]);
    const scopeMarker='DEV273-SCOPE-'+randomUUID();
    const contact=randomUUID(),lead=randomUUID(),title=scopeMarker+' owner';
    const email='scope-'+contact+'@example.invalid',phone='+9715'+String(randomInt(10000000,100000000));
    await db.query("INSERT INTO contacts(id,full_name,email,phone,contact_type,owner_id,created_by) VALUES($1,$2,$3,$4,'buyer',$5,$5)",[contact,title,email,phone,users.owner.id]);
    await db.query("INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,assigned_team_id,created_by) VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$5,$4)",[lead,contact,title,users.owner.id,team]);
    await db.query("INSERT INTO contact_channels(id,contact_id,channel_kind,usage_label,raw_value,normalized_value,is_primary,verification_status,created_by) VALUES($1,$2,'Email','Primary',$3,$3,1,'format_valid',$4),($5,$2,'Phone','Primary',$6,$6,1,'format_valid',$4)",
      [randomUUID(),contact,email,users.owner.id,randomUUID(),phone]);
    const document=randomUUID(), task=randomUUID();
    await db.query("INSERT INTO documents(id,document_reference,document_type,title,owner_id,created_by,contact_id,lead_id) VALUES($1,$2,'correspondence',$2,$3,$3,$4,$5)",[document,title,users.owner.id,contact,lead]);
    await db.query("INSERT INTO proposals(id,lead_id,contact_id,template_type,title,created_by,proposal_number) VALUES($1,$2,$3,'customer_requirement',$4,$5,$6)",[randomUUID(),lead,contact,title,users.owner.id,'NYSA-PR-209912-'+String(randomInt(100000,1000000))]);
    await db.query("INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,due_at,created_by) VALUES($1,$2,$3,$4,$5,now(),$6)",[task,lead,contact,title,users.outsider.id,users.owner.id]);
    server=await new Promise(resolve=>{const listener=app.listen({host:'127.0.0.1',port:0},()=>resolve(listener));});
    const request=(user,path,method='GET',body)=>fetch('http://127.0.0.1:'+server.address().port+'/api/crm'+path,{method,
      headers:{authorization:'Bearer '+users[user].token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    await t.test('Scoped generated PDF preview and download preserve original bytes and audit access',async()=>{
      const version=randomUUID();
      const pdf=Buffer.from('%PDF-1.4\n% Synthetic original contact '+phone+'\n%%EOF\n');
      const key=await savePrivate(pdf,'.pdf');
      try {
        await db.query(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by)
          VALUES($1,$2,1,'fixture.pdf','application/pdf',$3,$4,$5,1,'generated','private','generated',$6,$6)`,
        [version,document,pdf.length,key,createHash('sha256').update(pdf).digest('hex'),users.owner.id]);
        for(const [suffix,action] of [['view','previewed'],['download?download=1','downloaded']]){
          for(const user of ['owner','manager','director','outsider']){
            const response=await request(user,'/document-versions/'+version+'/'+suffix);
            assert.equal(response.status,user==='outsider'?404:200,user+' '+suffix);
            const body=Buffer.from(await response.arrayBuffer());
            if(user!=='outsider'){
              assert.equal(response.headers.get('content-type'),'application/pdf');
              assert.deepEqual(body,pdf);
            }
          }
          const {rows}=await db.query(`SELECT performed_by,timestamp,details::jsonb AS details FROM audit_log
            WHERE entity_type='DocumentVersion' AND entity_id=$1 AND action=$2`,[version,action]);
          assert.deepEqual(rows.map(row=>row.performed_by).sort(),[users.owner.id,users.manager.id,users.director.id].sort());
          for(const row of rows){
            assert.ok(row.timestamp instanceof Date);
            assert.deepEqual(row.details,{documentId:document});
          }
        }
      } finally {await removePrivate(key);}
    });
    await t.test('Role defaults, Owning Agent filters, approved-only WEB and Meta queues and open offers enforce scope',async()=>{
      const outsiderContact=randomUUID(),outsiderLead=randomUUID(),webContact=randomUUID(),webLead=randomUUID(),metaContact=randomUUID(),metaLead=randomUUID(),offerContact=randomUUID(),offerLead=randomUUID();
      const isolated=scopeMarker;
      await db.query(`INSERT INTO contacts(id,full_name,email,phone,contact_type,owner_id,created_by) VALUES
        ($1,$2,'outside@example.invalid','+971501230001','buyer',$3,$3),
        ($4,$5,'web@example.invalid','+971501230002','buyer',$3,$3),
        ($6,$7,'meta@example.invalid','+971501230003','buyer',$3,$3),
        ($8,$9,'offer@example.invalid','+971501230004','buyer',$10,$10)`,
      [outsiderContact,'Outsider '+isolated,users.outsider.id,webContact,'Web '+isolated,metaContact,'Meta '+isolated,offerContact,'Offer '+isolated,users.offered.id]);
      await db.query(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,assigned_team_id,assignment_status,created_by) VALUES
        ($1,$2,$3,'Other','Sale','New','Unassessed',$4,NULL,'assigned',$4),
        ($5,$6,$7,'Website','Sale','New','Unassessed',NULL,NULL,'unassigned',$4),
        ($8,$9,$10,'Social media','Sale','New','Unassessed',NULL,NULL,'unassigned',$4),
        ($11,$12,$13,'Website','Sale','New','Unassessed',$14,$15,'assigned',$4)`,
      [outsiderLead,outsiderContact,'Outside '+isolated,users.outsider.id,webLead,webContact,'WEB '+isolated,metaLead,metaContact,'META '+isolated,offerLead,offerContact,'OFFER '+isolated,users.offered.id,team]);
      await db.query(`INSERT INTO website_intake_events(id,event_id,payload_hash,status,received_payload,contact_id,lead_id,processed_at,resolution,resolution_reason,resolved_by,resolved_at)
        VALUES($1,$2,$3,'accepted','{}'::jsonb,$4,$5,now(),'approve_email_only','Synthetic approved email-only intake',$6,now())`,
      [randomUUID(),'dev273-accepted-'+randomUUID(),'a'.repeat(64),webContact,webLead,users.manager.id]);
      await db.query("INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,agent_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,1,$3,$4,'offered',now()+interval '1 hour',$5)",
        [randomUUID(),offerLead,team,users.offered.id,users.manager.id]);
      const ids=async(user,path,key)=>new Set((await (await request(user,path)).json())[key].map(row=>row.id));
      const q=encodeURIComponent(scopeMarker);
      assert.deepEqual(await ids('owner','/contacts?q='+q,'contacts'),new Set([contact]));
      assert.deepEqual(await ids('manager','/contacts?q='+q,'contacts'),new Set([contact,offerContact]));
      assert.deepEqual(await ids('director','/contacts?q='+q,'contacts'),new Set([contact,outsiderContact,webContact,metaContact,offerContact]));
      assert.deepEqual(await ids('manager','/contacts?q='+q+'&ownerId='+users.owner.id,'contacts'),new Set([contact]));
      assert.deepEqual(await ids('owner','/leads?q='+q,'leads'),new Set([lead]));
      assert.deepEqual(await ids('manager','/leads?q='+q+'&assignedTo=unassigned','leads'),new Set([webLead,metaLead]));
      assert.deepEqual(await ids('director','/leads?q='+q+'&assignedTo=unassigned','leads'),new Set([webLead,metaLead]));
      const queue=await (await request('manager','/assignment-queue')).json();
      assert.deepEqual(new Set(queue.leads.filter(row=>row.title.includes(scopeMarker)).map(row=>row.id)),new Set([webLead,metaLead]));
      const pendingContact=randomUUID(),pendingLead=randomUUID(),rejectedContact=randomUUID(),rejectedLead=randomUUID(),intakeBoundary='DEV273-INTAKE-'+randomUUID();
      await db.query(`INSERT INTO contacts(id,full_name,email,phone,contact_type,owner_id,created_by) VALUES
        ($1,$2,'pending-intake@example.invalid','+971501230005','buyer',$3,$3),
        ($4,$5,'rejected-intake@example.invalid','+971501230006','buyer',$3,$3)`,
      [pendingContact,'Pending '+intakeBoundary,users.outsider.id,rejectedContact,'Rejected '+intakeBoundary]);
      await db.query(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,assigned_team_id,assignment_status,created_by) VALUES
        ($1,$2,$3,'Website','Sale','New','Unassessed',NULL,NULL,'unassigned',$4),
        ($5,$6,$7,'Website','Sale','New','Unassessed',NULL,NULL,'unassigned',$4)`,
      [pendingLead,pendingContact,'Pending '+intakeBoundary,users.outsider.id,rejectedLead,rejectedContact,'Rejected '+intakeBoundary]);
      await db.query(`INSERT INTO website_intake_events(id,event_id,payload_hash,status,received_payload,contact_id,lead_id,resolution,resolution_reason,resolved_by,resolved_at)
        VALUES($1,$2,$3,'processing','{}'::jsonb,$4,$5,NULL,NULL,NULL,NULL),
          ($6,$7,$8,'rejected','{}'::jsonb,$9,$10,'reject_invalid','Synthetic rejected intake',$11,now())`,
      [randomUUID(),'dev273-processing-'+randomUUID(),'b'.repeat(64),pendingContact,pendingLead,
        randomUUID(),'dev273-rejected-'+randomUUID(),'c'.repeat(64),rejectedContact,rejectedLead,users.manager.id]);
      const guardedQueue=await (await request('manager','/assignment-queue')).json();
      assert.ok(guardedQueue.leads.some(row=>row.id===webLead));
      assert.ok(guardedQueue.leads.some(row=>row.id===metaLead));
      assert.ok(!guardedQueue.leads.some(row=>row.id===pendingLead));
      assert.ok(!guardedQueue.leads.some(row=>row.id===rejectedLead));
      const offered=await (await request('offered','/leads/'+offerLead)).json();
      assert.equal(offered.lead.openAssignmentOffer,true);
      assert.equal(offered.lead.contactEmail,'o***@example.invalid');
      assert.equal(offered.lead.contactPhone,'••••0004');
      assert.equal(offered.canWrite,false);
      assert.deepEqual(offered.activities,[]);
    });
    await t.test('AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary',async()=>{
      const ownerSuggestion=await request('owner','/leads/'+lead+'/ai/next-action','POST',{});
      assert.equal(ownerSuggestion.status,200);
      assert.equal((await ownerSuggestion.json()).advisoryOnly,true);
      const blockedSuggestion=await request('outsider','/leads/'+lead+'/ai/next-action','POST',{});
      assert.equal(blockedSuggestion.status,404);
      const blockedHistory=await request('outsider','/leads/'+lead+'/action-suggestions');
      assert.equal(blockedHistory.status,404);
      const duplicate=await request('outsider','/contacts','POST',{fullName:'Restricted duplicate',email,phone});
      assert.equal(duplicate.status,409);
      const duplicateBody=await duplicate.json();
      assert.deepEqual(duplicateBody.duplicates,[{restricted:true},{restricted:true}]);
      assert.ok(!JSON.stringify(duplicateBody).includes(contact));
      assert.ok(!JSON.stringify(duplicateBody).includes(title));
      assert.ok(!JSON.stringify(duplicateBody).includes(email));
      assert.ok(!JSON.stringify(duplicateBody).includes(phone));
      for(const user of ['manager','director']){
        const reveal=await request(user,'/leads/'+lead+'/reveal-contact','POST',{});
        assert.equal(reveal.status,200,user);
        assert.deepEqual(await reveal.json(),{email,phone});
        const log=await request(user,'/leads/'+lead+'/contact-reveal-log');
        assert.equal(log.status,200,user);
        assert.ok((await log.json()).entries.every(entry=>entry.fields.join(',')==='phone,email'));
      }
      assert.equal((await request('outsider','/leads/'+lead+'/reveal-contact','POST',{})).status,404);
    });
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
          assert.equal(row.contactPhone,user==='owner'?phone:'••••'+phone.slice(-4));
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
