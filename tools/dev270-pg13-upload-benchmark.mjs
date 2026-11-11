import assert from 'node:assert/strict';
import pg from 'pg';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';

assert.equal(process.env.PGHOST,'127.0.0.1');
assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
assert.equal(process.env.PGUSER,'nysa_test_user');
const admin=new pg.Client({database:'postgres',user:'postgres'});
await admin.connect();
try {
  const {directory}=(await admin.query("SELECT current_setting('data_directory') AS directory")).rows[0];
  assert.match(directory,/nysa-dev270-rehearsal-/);
  assert.equal(path.resolve(directory),path.resolve(process.env.NYSA_PG13_FIXTURE_DATA));
}finally{await admin.end();}
const {execute,many,one,closeDatabase}=await import('../src/db.js');
const {createApp}=await import('../src/lib/http-kit.js');
const {createSession}=await import('../src/auth.js');
const {default:prospects}=await import('../src/routes/prospects.js');
let server;
try{
  const identity=await one(`SELECT current_database() AS database,current_user AS role,
    current_setting('server_version') AS postgres`);
  assert.match(identity.postgres,/^13\.23\b/);
  const agent=randomUUID();
  await execute(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash)
    VALUES($1,'Synthetic benchmark Agent',$2,'internal_broker','sales_agent','active','fixture-only')`,[agent,agent+'@example.invalid']);
  const token=await createSession(agent);
  const app=createApp();
  app.mount('/api',prospects);
  server=await new Promise(resolve=>{
    const instance=app.listen({host:'127.0.0.1',port:0},()=>resolve(instance));
  });
  async function request(action,body,expected){
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/crm/prospect-diary/upload/${action}`,{
      method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)
    });
    assert.equal(response.status,expected);
    return response.json();
  }
  const rows=Array.from({length:2000},(_,i)=>`Fixture ${i},+97150${String(8800000+i)},bench-${agent}-${i}@example.invalid,Fixture note,diary`);
  const payload={fileName:'synthetic-benchmark.csv',base64:Buffer.from(['Name,Phone,Email,Notes,Source',...rows].join('\n')).toString('base64')};
  const tooMany={...payload,base64:Buffer.from(Buffer.from(payload.base64,'base64').toString()+'\nExtra,,extra@example.invalid,,diary').toString('base64')};
  assert.match((await request('preview',tooMany,400)).error,/2,000/);
  const previewStart=performance.now();
  const review=await request('preview',payload,200);
  const previewMs=performance.now()-previewStart;
  assert.equal(review.counts.ready,2000);
  const acquired=[];
  let completed=false;
  const started=performance.now();
  const pending=request('commit',{...payload,batchId:review.batchId,reviewToken:review.reviewToken},201)
    .finally(()=>{completed=true;});
  const monitor=(async()=>{
    while(!completed){
      const locks=await many(`SELECT DISTINCT c.relname AS relation FROM pg_locks l JOIN pg_class c ON c.oid=l.relation
        WHERE l.granted AND l.mode='ShareRowExclusiveLock' AND c.relname IN('contacts','contact_channels','leads','prospects')
          AND l.database=(SELECT oid FROM pg_database WHERE datname=current_database()) ORDER BY 1`);
      if(locks.length===4)acquired.push(performance.now()-started);
      await sleep(10);
    }
  })();
  const [result]=await Promise.all([pending,monitor]);
  const commitMs=performance.now()-started;
  assert.equal(result.counts.ready,2000);
  assert.ok(acquired.length>1,'Four table locks must be observed during commit');
  const prospectsSaved=await one('SELECT count(*)::int AS total FROM prospects WHERE upload_batch_id=$1',[review.batchId]);
  const notesSaved=await one(`SELECT count(*)::int AS total FROM prospect_activities a JOIN prospects p ON p.id=a.prospect_id
    WHERE p.upload_batch_id=$1`,[review.batchId]);
  assert.equal(prospectsSaved.total,2000);
  assert.equal(notesSaved.total,2000);
  console.log(JSON.stringify({...identity,rowsSaved:prospectsSaved.total,notesSaved:notesSaved.total,previewMs:Math.round(previewMs),
    commitMs:Math.round(commitMs),lockSamplingIntervalMs:10,lockSamples:acquired.length,
    firstFourLocksMs:Math.round(acquired[0]),lastFourLocksMs:Math.round(acquired.at(-1)),
    observedLockSpanMs:Math.round(acquired.at(-1)-acquired[0]),
    tables:['contact_channels','contacts','leads','prospects'],concurrentBusinessTraffic:false}));
}finally{
  if(server){server.close();server.closeAllConnections();}
  await closeDatabase();
}
