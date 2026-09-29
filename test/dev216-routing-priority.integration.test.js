import test,{after,before} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV216_ROUTING_INTEGRATION==='1',gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture',timeout:20000};
const id=()=>crypto.randomUUID();
let db,server,request,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside the disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci|rehearsal/i,'Refusing to mutate a database not identified as non-production');
  const [{createApp},{default:crmRoutes},{default:leadRoutes},database]=await Promise.all([import('../src/lib/http-kit.js'),import('../src/routes/crm.js'),import('../src/routes/lead-operations.js'),import('../src/db.js')]);
  db=database;const stamp=Date.now(),prefix=`dev216-routing-${stamp}`;
  fixture={prefix,director:id(),manager:id(),agentA:id(),agentB:id(),primaryTeam:id(),secondaryTeam:id(),contact:id(),leads:[],tokens:{}};
  fixture.priorActiveRuleIds=(await db.many('SELECT id FROM routing_rules WHERE active=1')).map(row=>row.id);await db.execute('UPDATE routing_rules SET active=0 WHERE active=1');
  await db.execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES
    ($1,$2,$3,'internal_broker','active','synthetic-only','director'),
    ($4,$5,$6,'internal_broker','active','synthetic-only','manager'),
    ($7,$8,$9,'internal_broker','active','synthetic-only','sales_agent'),
    ($10,$11,$12,'internal_broker','active','synthetic-only','sales_agent')`,[
    fixture.director,`${prefix} Director`,`${prefix}-director@example.invalid`,fixture.manager,`${prefix} Manager`,`${prefix}-manager@example.invalid`,
    fixture.agentA,`${prefix} Agent A`,`${prefix}-a@example.invalid`,fixture.agentB,`${prefix} Agent B`,`${prefix}-b@example.invalid`]);
  await db.execute(`INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1),($4,$5,$3,1)`,[fixture.primaryTeam,`${prefix} Priority 10`,fixture.manager,fixture.secondaryTeam,`${prefix} Priority 20`]);
  for(const [teamId,brokerId,role] of [[fixture.primaryTeam,fixture.manager,'manager'],[fixture.primaryTeam,fixture.agentA,'member'],[fixture.primaryTeam,fixture.agentB,'member']])await db.execute(`INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,$4,$5)`,[id(),teamId,brokerId,role,fixture.director]);
  await db.execute(`INSERT INTO routing_rules(id,name,priority,source,business_type,team_id,assignment_method,created_by) VALUES
    ($1,$2,20,'Current CRM',NULL,$3,'team_queue',$4),($5,$6,10,NULL,'Sale',$7,'team_queue',$4)`,[id(),`${prefix} lower priority`,fixture.secondaryTeam,fixture.director,id(),`${prefix} winning priority`,fixture.primaryTeam]);
  await db.execute(`INSERT INTO contacts(id,full_name,email,contact_type,created_by) VALUES($1,$2,$3,'buyer',$4)`,[fixture.contact,`${prefix} Customer`,`${prefix}-customer@example.invalid`,fixture.director]);
  for(const [role,brokerId] of [['director',fixture.director],['manager',fixture.manager],['agentA',fixture.agentA],['agentB',fixture.agentB]]){const raw=crypto.randomBytes(32).toString('hex');fixture.tokens[role]=raw;await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(raw).digest('hex'),brokerId]);}
  const app=createApp();app.mount('/api',crmRoutes);app.mount('/api',leadRoutes);server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  request=async(role,path,{method='GET',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{authorization:`Bearer ${fixture.tokens[role]}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,payload:await response.json()};};
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(!db||!fixture)return;
  const brokerIds=[fixture.director,fixture.manager,fixture.agentA,fixture.agentB];
  await db.execute('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[brokerIds]);
  if(fixture.leads.length){await db.execute('DELETE FROM tasks WHERE lead_id=ANY($1::uuid[])',[fixture.leads]);await db.execute('DELETE FROM lead_stage_history WHERE lead_id=ANY($1::uuid[])',[fixture.leads]);await db.execute('DELETE FROM lead_assignments WHERE lead_id=ANY($1::uuid[])',[fixture.leads]);await db.execute('DELETE FROM leads WHERE id=ANY($1::uuid[])',[fixture.leads]);}
  await db.execute('DELETE FROM contacts WHERE id=$1',[fixture.contact]);await db.execute('DELETE FROM routing_rules WHERE created_by=$1',[fixture.director]);if(fixture.priorActiveRuleIds?.length)await db.execute('UPDATE routing_rules SET active=1 WHERE id=ANY($1::uuid[])',[fixture.priorActiveRuleIds]);
  await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[brokerIds]);await db.execute('DELETE FROM team_memberships WHERE team_id=ANY($1::uuid[])',[[fixture.primaryTeam,fixture.secondaryTeam]]);await db.execute('DELETE FROM teams WHERE id=ANY($1::uuid[])',[[fixture.primaryTeam,fixture.secondaryTeam]]);await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[brokerIds]);await db.closeDatabase();
});

async function importLead(suffix){
  const response=await request('director','/api/crm/imports/leads',{method:'POST',body:{externalSystem:fixture.prefix,externalId:suffix,contactId:fixture.contact,title:`${fixture.prefix} ${suffix}`,businessType:'Sale'}});
  assert.equal(response.status,201,JSON.stringify(response.payload));fixture.leads.push(response.payload.id);return response.payload;
}

test('routing priority wins, Manager assignment works, and an expired Agent cannot reclaim the same Lead',gate,async()=>{
  const first=await importLead('priority');
  assert.equal(first.assignedTeamId,fixture.primaryTeam,'The matching rule with priority 10 must beat priority 20');
  const stored=await db.one('SELECT assigned_team_id,routing_reason FROM leads WHERE id=$1',[first.id]);assert.equal(stored.assignedTeamId,fixture.primaryTeam);assert.match(stored.routingReason,/winning priority/);

  const queue=await request('manager','/api/crm/assignment-queue');assert.equal(queue.status,200,JSON.stringify(queue.payload));assert.ok(queue.payload.leads.some(lead=>lead.id===first.id));
  const assigned=await request('manager','/api/crm/assignment-queue/bulk-assign',{method:'POST',body:{leadIds:[first.id],agentId:fixture.agentA}});assert.equal(assigned.status,200,JSON.stringify(assigned.payload));assert.equal(assigned.payload.assignedCount,1);
  const accepted=await request('agentA',`/api/crm/leads/${first.id}/assignment/accept`,{method:'POST',body:{}});assert.equal(accepted.status,200,JSON.stringify(accepted.payload));assert.equal(accepted.payload.status,'accepted');

  const expired=await importLead('expired');
  const offered=await request('manager','/api/crm/assignment-queue/bulk-assign',{method:'POST',body:{leadIds:[expired.id],agentId:fixture.agentA}});assert.equal(offered.status,200,JSON.stringify(offered.payload));
  await db.execute("UPDATE leads SET acceptance_due_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[expired.id]);await db.execute("UPDATE lead_assignments SET acceptance_due_at=NOW()-INTERVAL '1 minute' WHERE lead_id=$1 AND status='offered'",[expired.id]);
  const formerQueue=await request('agentA','/api/crm/assignment-queue');assert.equal(formerQueue.status,200,JSON.stringify(formerQueue.payload));assert.ok(!formerQueue.payload.leads.some(lead=>lead.id===expired.id),'The timed-out Agent must not receive the same Lead as a self-claim');
  const blocked=await request('agentA',`/api/crm/assignment-queue/${expired.id}/claim`,{method:'POST',body:{}});assert.equal(blocked.status,409,JSON.stringify(blocked.payload));assert.match(blocked.payload.error,/expired from your assignment/i);
  const replacementQueue=await request('agentB','/api/crm/assignment-queue');assert.ok(replacementQueue.payload.leads.some(lead=>lead.id===expired.id));
  const claimed=await request('agentB',`/api/crm/assignment-queue/${expired.id}/claim`,{method:'POST',body:{}});assert.equal(claimed.status,200,JSON.stringify(claimed.payload));assert.equal(claimed.payload.agentId,fixture.agentB);
});
