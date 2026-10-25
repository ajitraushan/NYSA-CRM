import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';

const migration=await fs.readFile(new URL('../src/migrations/138_terminal_lead_follow_up_cleanup.sql',import.meta.url),'utf8');
const dashboard=await fs.readFile(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');
test('DEV236 cancels obsolete follow-ups without completing independent approval work',()=>{
  assert.match(migration,/NEW\.task_type NOT IN \('general','qualification_follow_up','customer_response_follow_up'\)/);
  assert.match(migration,/status IN \('open','in_progress'\)/);
  assert.match(migration,/AFTER INSERT OR UPDATE OF stage,current_status ON leads/);
  assert.match(migration,/original_task_creator/);
  assert.doesNotMatch(migration,/DELETE FROM|SET status='completed'/i);
});
test('DEV236 cancelled dashboard tasks cannot fall through into overdue',()=>{
  assert.match(dashboard,/WHEN t.status='cancelled' THEN 'cancelled' WHEN t.due_at<NOW\(\) THEN 'overdue'/);
});

test('DEV236 actual PostgreSQL migration and lifecycle regression',{
  skip:process.env.NYSA_RUN_DEV236_DB!=='1'?'Dedicated local PostgreSQL fixture required':false
},async t=>{
  assert.equal(process.env.PGHOST,'localhost');
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  const pool=new pg.Pool(),client=await pool.connect(),schema=`dev236_${crypto.randomBytes(6).toString('hex')}`;
  const id=()=>crypto.randomUUID(),actor=id();
  let active,won,completedTask,legacyTask;
  const lead=async(stage='Qualified',current='active')=>{const key=id();await client.query('INSERT INTO leads(id,stage,current_status,next_follow_up_at) VALUES($1,$2,$3,NOW())',[key,stage,current]);return key;};
  const task=async(leadId,{type='qualification_follow_up',status='open',outcome='Original note'}={})=>{
    const key=id();await client.query(`INSERT INTO tasks(id,lead_id,task_type,status,outcome,due_at,created_by,completed_at)
      VALUES($1,$2,$3,$4,$5,NOW()-INTERVAL '2 days',$6,CASE WHEN $4='completed' THEN NOW()-INTERVAL '1 day' END)`,[key,leadId,type,status,outcome,actor]);return key;
  };
  const row=async key=>(await client.query('SELECT * FROM tasks WHERE id=$1',[key])).rows[0];
  try{
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema},public`);
    await client.query(`CREATE TABLE leads(id UUID PRIMARY KEY,stage TEXT,current_status TEXT,next_follow_up_at TIMESTAMPTZ);
      CREATE TABLE tasks(id UUID PRIMARY KEY,lead_id UUID,task_type TEXT,status TEXT,outcome TEXT,due_at TIMESTAMPTZ,completed_at TIMESTAMPTZ,created_by UUID,updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE audit_log(id UUID PRIMARY KEY,entity_type TEXT,entity_id UUID,action TEXT,performed_by UUID,details TEXT);`);
    active=await lead();won=await lead('Won','closed_won');legacyTask=await task(won);
    completedTask=await task(won,{status:'completed'});const completedBefore=await row(completedTask);
    const independent=await task(won,{type:'document_compliance_follow_up'});
    await client.query(migration);
    await t.test('existing closed Lead follow-up is reconciled with reason and audit',async()=>{
      const result=await row(legacyTask);assert.equal(result.status,'cancelled');assert.match(result.outcome,/Original note\nAutomatically cancelled/);assert.equal(result.completed_at,null);
      const audit=(await client.query('SELECT * FROM audit_log WHERE entity_id=$1',[legacyTask])).rows;
      assert.equal(audit.length,1);assert.equal(JSON.parse(audit[0].details).executionMode,'automatic_lifecycle_rule');
    });
    await t.test('completed history and independent compliance work remain unchanged',async()=>{
      assert.deepEqual(await row(completedTask),completedBefore);assert.equal((await row(independent)).status,'open');
    });
    await t.test('active Leads retain their pending follow-ups',async()=>{
      const key=await task(active);assert.equal((await row(key)).status,'open');
    });
    for(const [stage,status] of [['Won','active'],['Lost','active'],['Qualified','closed_won'],['Qualified','closed_lost']]){
      await t.test(`closure via ${stage}/${status} cancels open and in-progress follow-ups`,async()=>{
        const key=await lead(),a=await task(key),b=await task(key,{type:'general',status:'in_progress'}),c=await task(key,{type:'customer_response_follow_up'});
        await client.query('UPDATE leads SET stage=$1,current_status=$2 WHERE id=$3',[stage,status,key]);
        for(const taskId of [a,b,c])assert.equal((await row(taskId)).status,'cancelled');
        assert.equal((await client.query('SELECT next_follow_up_at FROM leads WHERE id=$1',[key])).rows[0].next_follow_up_at,null);
      });
    }
    await t.test('late task creation/reopening on a closed Lead cannot leave pending work',async()=>{
      const key=await task(won);assert.equal((await row(key)).status,'cancelled');
      await client.query("UPDATE tasks SET status='open' WHERE id=$1",[key]);assert.equal((await row(key)).status,'cancelled');
    });
    await t.test('repeated Lead closure does not duplicate cancellation audit or outcome',async()=>{
      const before=await row(legacyTask),count=(await client.query('SELECT COUNT(*)::int AS n FROM audit_log WHERE entity_id=$1',[legacyTask])).rows[0].n;
      await client.query("UPDATE leads SET stage='Won' WHERE id=$1",[won]);assert.deepEqual(await row(legacyTask),before);
      assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM audit_log WHERE entity_id=$1',[legacyTask])).rows[0].n,count);
    });
    await t.test('Lead reopen does not resurrect obsolete cancelled tasks',async()=>{
      await client.query("UPDATE leads SET stage='Qualified',current_status='active' WHERE id=$1",[won]);
      assert.equal((await row(legacyTask)).status,'cancelled');const key=await task(won);assert.equal((await row(key)).status,'open');
    });
    await t.test('cancelled tasks are excluded by actual dashboard CASE classification',async()=>{
      const expression=dashboard.match(/SELECT (CASE WHEN t.status='completed'[\s\S]*?END) AS label,COUNT\(\*\)::int AS value/)[1];
      const result=await client.query(`SELECT ${expression} AS label FROM tasks t WHERE id=$1`,[legacyTask]);assert.equal(result.rows[0].label,'cancelled');
    });
    await t.test('failed closure transaction restores both Lead and task statuses',async()=>{
      const key=await lead(),taskId=await task(key);await client.query('SAVEPOINT closure_failure');
      await client.query("UPDATE leads SET stage='Won' WHERE id=$1",[key]);assert.equal((await row(taskId)).status,'cancelled');
      await client.query('ROLLBACK TO SAVEPOINT closure_failure');assert.equal((await row(taskId)).status,'open');
    });
  }finally{await client.query('ROLLBACK');client.release();await pool.end();}
});
