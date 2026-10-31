import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const enabled=process.env.NYSA_UI001_DB_TEST==='local-synthetic';
test('UI-001 task source projection retains exact assignee scope and exposes only a masked provisional hint',{skip:!enabled,timeout:30000},async()=>{
 assert.equal(process.env.PGHOST,'localhost');assert.equal(process.env.PGDATABASE,'nysa_test_fixture');assert.equal(process.env.PGUSER,'nysa_test_user');
 assert.match(process.env.NYSA_UI001_TEST_SCHEMA||'',/^ui001_release_[a-f0-9]{12}$/);
 const [{createApp},{default:routes},database,workflow]=await Promise.all([import('../src/lib/http-kit.js'),import('../src/routes/lead-operations.js'),import('../src/db.js'),import('../src/web-intake-workflow.js')]);
 const {db,execute,one,transaction}=database;let server;
 try{
  assert.equal((await one('SELECT current_schema() AS name')).name,process.env.NYSA_UI001_TEST_SCHEMA);
  const id=()=>crypto.randomUUID(),ids={actor:id(),owner:id(),other:id(),viewer:id(),team:id(),contact:id(),lead:id(),task:id(),otherTask:id(),event:id()};
  await execute("INSERT INTO teams(id,name) VALUES($1,'Synthetic UI-001 Team')",[ids.team]);
  for(const[key,role,job]of[['actor','admin','admin'],['owner','internal_broker','sales_agent'],['other','internal_broker','sales_agent'],['viewer','viewer',null]])await execute("INSERT INTO brokers(id,name,email,role,job_role,password_hash,status,team_id,user_classification) VALUES($1,$2,$3,$4,$5,'!synthetic-login-disabled','active',$6,$7)",[ids[key],'Synthetic '+key,`ui001-${key}@example.invalid`,role,job,role==='internal_broker'?ids.team:null,role==='viewer'?'viewer':'internal_user']);
  await execute("INSERT INTO contacts(id,full_name,email,created_by) VALUES($1,'Synthetic Canonical Customer','ui001-canonical@example.invalid',$2)",[ids.contact,ids.owner]);
  await execute("INSERT INTO leads(id,contact_id,title,source,business_type,assigned_team_id,assigned_to,created_by) VALUES($1,$2,'Synthetic referral enquiry','Referral','Sale',$3,$4,$4)",[ids.lead,ids.contact,ids.team,ids.owner]);
  await execute("INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,created_by,status,due_at) VALUES($1,$2,$3,'Synthetic canonical task',$4,$4,'open',NOW()+INTERVAL '1 day'),($5,$2,$3,'Synthetic other-owner task',$6,$6,'open',NOW()+INTERVAL '1 day')",[ids.task,ids.lead,ids.contact,ids.owner,ids.otherTask,ids.other]);
  const secrets={WEB_INTAKE_IDENTITY_KEY:'1'.repeat(64),WEB_INTAKE_MATCH_KEY:'synthetic-ui001-matching-key-long-enough',WEB_INTAKE_MATCH_KEY_VERSION:'synthetic-v1'};
  const payload={eventId:'synthetic-ui001-'+id(),sourceWebsite:'synthetic.example.invalid',source:'Website',form:'ai_property_selection_v1',intakeMode:'single_step',intakeCompleteness:'complete',journeyKey:'synthetic-ui001-'+id(),title:'Synthetic property enquiry',businessType:'Sale',customerObjective:'buy',marketStageRequirement:'ready_secondary',propertySegmentRequirement:'residential',contact:{fullName:'Synthetic Intake Customer',email:'ui001-intake@example.invalid',phone:'+971500000099',preferredChannel:'Phone'},requirement:{purpose:'own_use',propertyTypes:['Apartment'],areas:['Synthetic Community'],budgetMin:1000000,budgetMax:1400000,fundingMethod:'mortgage',timelineCode:'3_6_months',bedroomsMin:2,bedroomsMax:3},consent:{marketing:false,aiWhatsapp:false,aiEmail:false,statementVersion:'synthetic-v1'},location:{country:'AE',timeZone:'Asia/Dubai',confirmed:true}};
  const picked=await transaction(async client=>{
   await client.query("INSERT INTO website_intake_events(id,event_id,payload_hash,status,received_payload) VALUES($1,$2,$3,'processing',$4::jsonb)",[ids.event,payload.eventId,'a'.repeat(64),JSON.stringify(payload)]);
   const saved=await workflow.recordWebIntakeJourney({event:{id:ids.event,eventId:payload.eventId,receivedAt:new Date(),payloadHash:'a'.repeat(64)},payload,identity:{email:payload.contact.email,phone:payload.contact.phone,emailStatus:'format_valid',phoneStatus:'unverified'},actorId:ids.actor},client,secrets);
   const result=await workflow.pickupWebIntake(saved.caseId,{id:ids.owner,role:'internal_broker',jobRole:'sales_agent'},client,secrets);
   // A provisional task may have no canonical Customer pointer; the schema explicitly permits this.
   await client.query('UPDATE tasks SET contact_id=NULL WHERE id=$1',[result.taskId]);return result;
  });
  const tokens={};for(const key of['owner','other','viewer']){tokens[key]=crypto.randomBytes(32).toString('hex');await execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[key]).digest('hex'),ids[key]]);}
  const app=createApp();app.mount('/api',routes);server=await new Promise(resolve=>{const listening=app.listen({port:0,host:'127.0.0.1'},()=>resolve(listening));});
  const get=async key=>{const result=await fetch(`http://127.0.0.1:${server.address().port}/api/crm/tasks?mine=1&bucket=open`,{headers:{authorization:'Bearer '+tokens[key]}});return{status:result.status,body:await result.json()};};
  const owner=await get('owner');assert.equal(owner.status,200);const canonical=owner.body.tasks.find(task=>task.id===ids.task),provisional=owner.body.tasks.find(task=>task.id===picked.taskId);
  assert.equal(canonical.leadSource,'Referral');assert.equal(canonical.contactName,'Synthetic Canonical Customer');assert.equal(provisional.intakeSourceFormId,'ai_property_selection_v1');assert.equal(provisional.intakeSourceSystem,'website');assert.equal(provisional.contactName,'S… C');
  assert.equal(owner.body.tasks.some(task=>task.id===ids.otherTask),false);assert.equal(JSON.stringify(provisional).includes(payload.contact.email),false);assert.equal(JSON.stringify(provisional).includes(payload.contact.phone),false);
  for(const field of['encryptedIdentity','phoneMatchHash','emailMatchHash'])assert.equal(Object.hasOwn(provisional,field),false);
  const other=await get('other');assert.equal(other.status,200);assert.equal(other.body.tasks.some(task=>task.id===picked.taskId||task.id===ids.task),false);assert.equal((await get('viewer')).status,403);
 }finally{if(server){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}await db.end();}
});
