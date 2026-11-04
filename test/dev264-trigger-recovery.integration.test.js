import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';

const enabled=process.env.NYSA_TRIGGER_RECOVERY_TEST==='local-synthetic';
const {Pool}=pg;
const uuid=()=>crypto.randomUUID();

test('DEV264 restores the triggerless CRM Test shape idempotently and enforces Lead rules',{skip:!enabled,timeout:180000},async()=>{
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  const pool=new Pool();
  const schema='nysa_test_user';
  const actor=uuid(),agent=uuid(),team=uuid();
  let leadId,contactId;
  try{
    const {ingestSimulatedInbound}=await import('../src/whatsapp-simulated-provider-store.js');
    const identity=(await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    assert.deepEqual(identity,{database:'nysa_test_fixture',role:'nysa_test_user'});
    await pool.query(`SET search_path TO ${schema},public`);
    const initial=(await pool.query(`SELECT COUNT(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname=$1`,[schema])).rows[0];
    assert.equal(initial.count,108);

    const drops=(await pool.query(`SELECT format('DROP TRIGGER %I ON %I.%I;',t.tgname,n.nspname,c.relname) AS sql FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname=$1 ORDER BY c.relname,t.tgname`,[schema])).rows;
    for(const row of drops)await pool.query(row.sql);
    assert.equal((await pool.query(`SELECT COUNT(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname=$1`,[schema])).rows[0].count,0);

    const original=await fs.readFile(new URL('../src/migrations/168_restore_governed_trigger_contract.sql',import.meta.url),'utf8');
    const recovery=original;
    await pool.query(recovery);
    await pool.query(recovery);
    const restored=(await pool.query(`SELECT COUNT(*)::int AS count,COUNT(DISTINCT c.relname)::int AS table_count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname=$1`,[schema])).rows[0];
    assert.deepEqual(restored,{count:108,table_count:93});

    await pool.query(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,'Synthetic DEV264 Actor',$2,'admin','admin','active','synthetic-only'),($3,'Synthetic DEV264 Agent',$4,'internal_broker','sales_agent','active','synthetic-only')`,[actor,`dev264-actor-${actor}@example.invalid`,agent,`dev264-agent-${agent}@example.invalid`]);
    await pool.query('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,`Synthetic DEV264 ${team}`,actor]);
    await pool.query('UPDATE brokers SET team_id=$1 WHERE id=$2',[team,agent]);
    const result=await ingestSimulatedInbound({id:`dev264-${uuid()}`,from:`+971509${String(crypto.randomInt(100000,999999))}`,name:'Synthetic DEV264 Prospect',team_id:team,agent_id:agent,actor_id:actor,text:'Plain inbound with agent',source_type:'other'});
    leadId=result.leadId;contactId=result.contactId;
    const lead=(await pool.query('SELECT lead_reference,stage FROM leads WHERE id=$1',[leadId])).rows[0];
    assert.match(lead.lead_reference,/^NYSA-LD-[0-9]{6}-[0-9]{6}$/);
    assert.equal(lead.stage,'New');

    await assert.rejects(pool.query("UPDATE leads SET stage='Qualified' WHERE id=$1",[leadId]),/Invalid lead stage transition/);
    const task=uuid();
    await pool.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,status,due_at,created_by,task_type) VALUES($1,$2,$3,'Synthetic follow-up',$4,'open',NOW()+INTERVAL '1 day',$5,'qualification_follow_up')`,[task,leadId,contactId,agent,actor]);
    await pool.query("UPDATE leads SET current_status='closed_lost' WHERE id=$1",[leadId]);
    const closed=(await pool.query('SELECT status,outcome FROM tasks WHERE id=$1',[task])).rows[0];
    assert.equal(closed.status,'cancelled');
    assert.match(closed.outcome,/Automatically cancelled/);
  }finally{
    await pool.query('DELETE FROM wa_inbox_notifications WHERE broker_id=$1',[agent]).catch(()=>{});
    if(leadId)await pool.query('DELETE FROM wa_conversation_messages WHERE conversation_id IN(SELECT id FROM wa_conversations WHERE lead_id=$1)',[leadId]).catch(()=>{});
    if(leadId)await pool.query('DELETE FROM wa_simulated_provider_events WHERE related_entity_id IN(SELECT id FROM wa_conversations WHERE lead_id=$1)',[leadId]).catch(()=>{});
    if(leadId)await pool.query('DELETE FROM wa_conversations WHERE lead_id=$1',[leadId]).catch(()=>{});
    if(leadId)await pool.query('DELETE FROM tasks WHERE lead_id=$1',[leadId]).catch(()=>{});
    if(leadId)await pool.query('DELETE FROM audit_log WHERE entity_id IN($1,$2)',[leadId,contactId]).catch(()=>{});
    if(leadId)await pool.query('DELETE FROM leads WHERE id=$1',[leadId]).catch(()=>{});
    if(contactId)await pool.query('DELETE FROM contacts WHERE id=$1',[contactId]).catch(()=>{});
    await pool.query('DELETE FROM team_memberships WHERE team_id=$1',[team]).catch(()=>{});
    await pool.query('UPDATE brokers SET team_id=NULL WHERE id=$1',[agent]).catch(()=>{});
    await pool.query('DELETE FROM teams WHERE id=$1',[team]).catch(()=>{});
    await pool.query('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[actor,agent]]).catch(()=>{});
    await pool.end();
    // ingestSimulatedInbound uses the shared src/db.js singleton. The governed
    // release runner executes integration files in one process, so leave that
    // pool open for the remaining files; the process closes its idle clients.
  }
});
