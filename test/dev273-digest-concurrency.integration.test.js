import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import test from 'node:test';

const enabled=process.env.NYSA_DEV273_DIGEST_FIXTURE==='local-synthetic';

test('two digest processes schedule and claim distinct sends', {skip:!enabled}, async()=>{
  assert.equal(process.env.PGHOST,'127.0.0.1');
  assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
  assert.equal(process.env.PGUSER,'nysa_test_user');
  const {db}=await import('../src/db.js');
  const email='dev273-digest@example.invalid';
  const id=randomUUID();
  try {
    await db.query("INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES($1,'Digest fixture',$2,'internal_broker','sales_agent','active','fixture')",[id,email]);
    await db.query('UPDATE brokers SET prospect_digest_opt_out=true WHERE id<>$1',[id]);
    await db.query("UPDATE prospect_digest_runs SET next_attempt_at=NULL WHERE status IN ('pending','retry')");
    const childSource=`
      import {runProspectDigestTick} from './src/prospect-digest-worker.js';
      import {db} from './src/db.js';
      process.stdin.once('data', async ()=>{
        try {
          await runProspectDigestTick(new Date('2026-11-16T05:00:00Z'),{
            send: async message=>{
              if(message.to!=='dev273-digest@example.invalid') throw Error('Unexpected recipient');
              console.log('synthetic send');
              return {state:'accepted',code:'SMTP_ACCEPTED'};
            }
          });
        } catch(error) { console.error(error); process.exitCode=1; }
        finally { await db.end(); }
      });
      console.log('ready');
    `;
    const children=Array.from({length:2},()=>{
      const child=spawn(process.execPath,['--input-type=module','-e',childSource],{
        env:{...process.env,PROSPECT_DIGEST_EMAIL_ENABLED:'true',PROSPECT_DIGEST_ENVIRONMENT:'crm-test',
          PROSPECT_DIGEST_SCHEDULE_ENABLED:'true',PROSPECT_DIGEST_HOURLY_LIMIT:'20'},
      });
      let output='',errors='';
      const ready=new Promise((resolve,reject)=>{
        child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('ready'))resolve();});
        child.once('error',reject);
        child.once('exit',()=>reject(Error('Digest subprocess exited before barrier')));
      });
      child.stderr.on('data',chunk=>{errors+=chunk;});
      const done=new Promise(resolve=>child.once('close',code=>resolve({code,output,errors})));
      return {child,ready,done};
    });
    await Promise.all(children.map(worker=>worker.ready));
    for(const {child} of children) child.stdin.end('go');
    const results=await Promise.all(children.map(worker=>worker.done));
    for(const result of results) assert.equal(result.code,0,result.errors);
    assert.equal(results.flatMap(result=>result.output.match(/synthetic send/g)??[]).length,1);
    const {rows}=await db.query('SELECT status,attempts FROM prospect_digest_runs WHERE recipient_id=$1',[id]);
    assert.deepEqual(rows,[{status:'accepted',attempts:1}]);
  } finally {await db.end();}
});
