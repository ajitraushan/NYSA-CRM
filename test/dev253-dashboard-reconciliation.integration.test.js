import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

test('Dashboard cards reconcile with paginated records for Agent, Manager and all Director views', {skip:process.env.NYSA_RUN_DEV253_DB!=='1',timeout:120000},async()=>{
 assert.equal(process.env.PGDATABASE,'nysa_test_fixture');assert.equal(process.env.PGUSER,'nysa_test_user');assert.equal(process.env.PGHOST,'localhost');
 const db=await import('../src/db.js'),{createApp}=await import('../src/lib/http-kit.js'),{default:routes}=await import('../src/routes/dashboards.js');
 const ids=Array.from({length:7},()=>crypto.randomUUID()),[agent,manager,director,team,otherTeam,contact,otherManager]=ids,leads=Array.from({length:505},()=>crypto.randomUUID()),campaign='SYNTHETIC-DEV253-'+crypto.randomUUID(),tokens=Array.from({length:3},()=>crypto.randomBytes(32).toString('hex'));
 let server;
 try{
  for(const [id,jobRole,token] of [[agent,'sales_agent',tokens[0]],[manager,'manager',tokens[1]],[director,'director',tokens[2]],[otherManager,'manager',null]]){
   await db.execute("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,'Synthetic reconciliation',$2,'internal_broker',$3,'active','synthetic-only')",[id,`synthetic-${id}@example.invalid`,jobRole]);
   if(token)await db.execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(token).digest('hex'),id]);
  }
  for(const [id,owner] of [[team,manager],[otherTeam,otherManager]])await db.execute("INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)",[id,'Synthetic '+id,owner]);
  await db.execute('UPDATE brokers SET team_id=$1 WHERE id=$2',[team,agent]);
  await db.execute("INSERT INTO contacts(id,full_name,email,created_by) VALUES($1,'Synthetic reconciliation customer',$2,$3)",[contact,`synthetic-${contact}@example.invalid`,agent]);
  await db.execute("INSERT INTO leads(id,contact_id,title,source,business_type,created_by,assigned_to,assigned_team_id,campaign_code,acceptance_due_at) SELECT id,$2,'Synthetic reconciliation enquiry','Website','Sale',$3,$3,CASE WHEN ordinal=505 THEN $5::uuid ELSE $4::uuid END,$6,NOW()-INTERVAL '1 day' FROM unnest($1::uuid[]) WITH ORDINALITY input(id,ordinal)",[leads,contact,agent,team,otherTeam,campaign]);
  await db.execute("UPDATE leads SET current_status='closed_won' WHERE id=$1",[leads[1]]);
  await db.execute("UPDATE leads SET current_status='closed_lost',temperature='Hot' WHERE id=$1",[leads[2]]);
  await db.execute("UPDATE leads SET temperature='Hot' WHERE id=$1",[leads[3]]);
  await db.execute('UPDATE leads SET assigned_to=NULL WHERE id=$1',[leads[503]]);
  await db.execute('UPDATE leads SET assigned_to=NULL,assigned_team_id=NULL WHERE id=$1',[leads[502]]);
  for(let i=0;i<3;i++)await db.execute("INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,created_by,due_at) VALUES($1,$2,$4,'Synthetic overdue task',$3,$3,NOW()-INTERVAL '1 hour')",[crypto.randomUUID(),leads[0],agent,contact]);
  const app=createApp();app.mount('/api',routes);server=await new Promise(resolve=>{const s=app.listen(0,()=>resolve(s));});
  const request=async(path,token)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{headers:{authorization:`Bearer ${token}`}}),data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};
  const date=new Date().toISOString().slice(0,10),filter=new URLSearchParams({dateFrom:date,dateTo:date,campaignCode:campaign});let checked=0;
  for(const [role,token,views] of [['agent',tokens[0],[null]],['manager',tokens[1],[null]],['director',tokens[2],['Executive','Sales','Inventory','Operations and Risk']]])for(const view of views){
   const q=new URLSearchParams(filter);if(view)q.set('view',view);const cards=await request('/crm/dashboard?'+q,token);
   for(const card of cards.kpis){const recordQ=new URLSearchParams(q);recordQ.set('segment',card.code);recordQ.set('pageSize','100');const first=await request('/crm/dashboard/records?'+recordQ,token);assert.equal(first.count,card.current,`${role}/${view}/${card.code}`);let seen=first.records.length;const contributors=new Set(first.records.map(x=>x.taskId||x.pipelineOpportunityId||x.id));
    for(let page=2;page<=first.pages;page++){recordQ.set('page',page);const next=await request('/crm/dashboard/records?'+recordQ,token);assert.equal(next.count,first.count);seen+=next.records.length;for(const row of next.records)contributors.add(row.taskId||row.pipelineOpportunityId||row.id);}
    assert.equal(seen,first.count,'Every contributing row reachable');if(card.code==='new_leads')assert.equal(contributors.size,first.count,'No duplicated or omitted contributors across pages');if(card.code==='won_leads'||card.code==='hot_leads')assert.equal(first.count,1,'Nonzero terminal/qualification fixture');checked++;
   }
  }
  const countQ=new URLSearchParams(filter);countQ.set('segment','new_leads');assert.equal((await request('/crm/dashboard/records?'+countQ,tokens[2])).count,505,'No silent 500-row cap');
  countQ.set('segment','lifecycle_new');countQ.set('page','999');const lifecycle=await request('/crm/dashboard/records?'+countQ,tokens[2]);assert.equal(lifecycle.count,503);assert.equal(lifecycle.page,6);assert.equal(lifecycle.records.length,3,'Lifecycle query clamps pages without truncating the total');countQ.delete('page');
  countQ.set('segment','overdue_tasks');const tasks=await request('/crm/dashboard/records?'+countQ,tokens[0]);assert.equal(tasks.count,3);assert.equal(new Set(tasks.records.map(x=>x.taskId)).size,3,'Multiple tasks on one Lead remain distinct');
  const unassigned=new URLSearchParams(filter);unassigned.set('agentId','unassigned');unassigned.set('teamId',team);unassigned.set('segment','new_leads');assert.equal((await request('/crm/dashboard/records?'+unassigned,tokens[1])).count,1,'Unassigned agent is not All');unassigned.set('teamId','unassigned');assert.equal((await request('/crm/dashboard/records?'+unassigned,tokens[2])).count,1,'Unassigned team is not All');assert.equal((await request('/crm/dashboard?'+unassigned,tokens[1])).kpis.find(k=>k.code==='unassigned_leads').current,0,'Manager unassigned-team filter remains scoped and valid');
  const denied=new URLSearchParams(filter);denied.set('teamId',otherTeam);denied.set('segment','new_leads');assert.equal((await request('/crm/dashboard/records?'+denied,tokens[1])).count,0,'Manager cannot cross team scope');
  console.log(JSON.stringify({dashboardReconciliation:'passed',cardChecks:checked,roles:3,synthetic:true,paginationBeyond500:true}));
 }finally{
  if(server){server.close();server.closeAllConnections?.();}
  await db.execute('DELETE FROM tasks WHERE lead_id=ANY($1::uuid[])',[leads]);await db.execute('DELETE FROM leads WHERE id=ANY($1::uuid[])',[leads]);await db.execute('DELETE FROM contacts WHERE id=$1',[contact]);
  await db.execute('UPDATE brokers SET team_id=NULL WHERE id=$1',[agent]);await db.execute('DELETE FROM teams WHERE id=ANY($1::uuid[])',[[team,otherTeam]]);await db.execute('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[[agent,manager,director,otherManager]]);await db.execute('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[agent,manager,director,otherManager]]);await db.closeDatabase();
 }
});
