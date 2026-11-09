import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import pg from 'pg';

const releaseRoot=path.resolve(process.argv[2]||'');
const evidenceDir=path.resolve(process.argv[3]||'');
if(!releaseRoot||!evidenceDir)throw new Error('Usage: node tools/dev266-exact-package-route-check.mjs <extracted-release-root> <evidence-dir>');
const packageJson=JSON.parse(await fs.readFile(path.join(releaseRoot,'package.json'),'utf8'));
assert.equal(packageJson.version,'2.1.0-dev.266');
await fs.access(path.join(releaseRoot,'app.cjs'));
await fs.access(path.join(releaseRoot,'src','server.js'));
await fs.access(path.join(releaseRoot,'public','whatsapp-workspace-ui.js'));

const required=['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD'];
for(const name of required)if(!process.env[name])throw new Error(`${name} is required for the local synthetic exact-package test`);
assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
assert.equal(process.env.PGUSER,'nysa_test_user');

const uuid=()=>crypto.randomUUID();
const people={admin:uuid(),agent:uuid(),manager:uuid()},team=uuid();
const tokens=Object.fromEntries(Object.keys(people).map(role=>[role,crypto.randomBytes(32).toString('hex')]));
const pool=new pg.Pool({host:process.env.PGHOST,port:Number(process.env.PGPORT),database:process.env.PGDATABASE,user:process.env.PGUSER,password:process.env.PGPASSWORD,ssl:false,max:4});
const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(error=>error?reject(error):resolve(value));});});
const logs={stdout:[],stderr:[]};
const child=spawn(process.execPath,['app.cjs'],{cwd:releaseRoot,windowsHide:true,env:{...process.env,NODE_ENV:'production',PORT:String(port),LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SIMULATED_PROVIDER_ENABLED:'true',WHATSAPP_SIMULATED_PROVIDER_TOKEN:'local-synthetic-dev266-exact-package-token',WHATSAPP_SIMULATED_PROVIDER_URL:'http://127.0.0.1:9/api/providers/whatsapp-simulated',WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES:'30'}});
child.stdout.on('data',chunk=>logs.stdout.push(String(chunk)));
child.stderr.on('data',chunk=>logs.stderr.push(String(chunk)));
const base=`http://127.0.0.1:${port}`;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const probe=async pathName=>{const response=await fetch(`${base}${pathName}`);return{status:response.status,body:await response.text(),server:response.headers.get('server')}};
const ready=async()=>{for(let attempt=1;attempt<=40;attempt++){try{const result=await probe('/api/readiness');if(result.status===200)return{...result,attempt};}catch{}await wait(250);}throw new Error(`Exact package did not become ready: ${logs.stderr.join('').slice(-1000)}`);};
const request=async(pathName,{method='GET',body,as='admin'}={})=>{const response=await fetch(`${base}/api${pathName}`,{method,headers:{authorization:`Bearer ${tokens[as]}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json();}catch{data={raw:await response.text()};}return{status:response.status,data};};
let conversationId;
try{
  const readiness=await ready(),health=await probe('/api/health'),root=await probe('/');
  assert.equal(readiness.status,200);assert.equal(health.status,200);assert.equal(root.status,200);assert.match(root.body,/NYSA CORE/);
  const identity=(await pool.query("SELECT current_setting('server_version') AS version,current_database() AS database,current_user AS username,(SELECT COUNT(*)::int FROM schema_migrations) AS migrations")).rows[0];
  assert.match(identity.version,/^13\.23(?:\b|$)/);assert.equal(identity.database,'nysa_test_fixture');assert.equal(identity.username,'nysa_test_user');assert.equal(identity.migrations,169);
  await pool.query(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash)
    VALUES($1,'DEV266 Exact Admin',$2,'admin','admin','active','synthetic-only'),
    ($3,'DEV266 Exact Agent',$4,'internal_broker','sales_agent','active','synthetic-only'),
    ($5,'DEV266 Exact Manager',$6,'internal_broker','manager','active','synthetic-only')`,[
      people.admin,`dev266-exact-admin-${people.admin}@example.invalid`,people.agent,`dev266-exact-agent-${people.agent}@example.invalid`,people.manager,`dev266-exact-manager-${people.manager}@example.invalid`
    ]);
  await pool.query('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,`DEV266 Exact ${team}`,people.manager]);
  await pool.query('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[people.agent,people.manager]]);
  await pool.query("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4),($5,$2,$4,'manager',$4)",[uuid(),team,people.agent,people.manager,uuid()]);
  for(const [role,id] of Object.entries(people))await pool.query("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[role]).digest('hex'),id]);
  assert.equal((await request('/admin/whatsapp-simulation/control',{method:'POST',body:{paused:false,faultMode:'none'}})).status,200);
  const phone=`+971509${String(100000+(Number.parseInt(crypto.randomBytes(3).toString('hex'),16)%800000)).padStart(6,'0')}`;
  const inbound=await request('/admin/whatsapp-simulation/inbound',{method:'POST',body:{from:phone,name:'DEV266 Exact Prospect',teamId:team,agentId:people.agent,text:'Exact package full-router test',eventId:`dev266-exact-${uuid()}`}});
  assert.equal(inbound.status,202,JSON.stringify(inbound));conversationId=inbound.data.conversationId;
  const acquire=await request(`/crm/whatsapp-workspace/conversations/${conversationId}/reply-lock`,{method:'POST',as:'agent',body:{action:'acquire'}});
  assert.equal(acquire.status,200,JSON.stringify(acquire));assert.equal(acquire.data.replyLock.heldByCurrentUser,true);
  const blocked=await request(`/crm/whatsapp-workspace/conversations/${conversationId}/simulated-send`,{method:'POST',as:'manager',body:{text:'Must be blocked',idempotencyKey:`blocked-${uuid()}`}});
  assert.equal(blocked.status,409,JSON.stringify(blocked));assert.equal(blocked.data.code,'WHATSAPP_REPLY_LOCK_HELD');
  const released=await request(`/crm/whatsapp-workspace/conversations/${conversationId}/reply-lock`,{method:'POST',as:'manager',body:{action:'release'}});
  assert.equal(released.status,200,JSON.stringify(released));
  const sent=await request(`/crm/whatsapp-workspace/conversations/${conversationId}/simulated-send`,{method:'POST',as:'manager',body:{text:'Exact package allowed after release',idempotencyKey:`allowed-${uuid()}`}});
  assert.equal(sent.status,202,JSON.stringify(sent));
  const counts=(await pool.query("SELECT COUNT(*) FILTER(WHERE direction='outbound')::int AS outbound,COUNT(*) FILTER(WHERE direction='outbound' AND body='Must be blocked')::int AS blocked FROM wa_conversation_messages WHERE conversation_id=$1",[conversationId])).rows[0];
  assert.deepEqual(counts,{outbound:1,blocked:0});
  await fs.rm(evidenceDir,{recursive:true,force:true});await fs.mkdir(evidenceDir,{recursive:true});
  const evidence={schema:'nysa.dev266.exact-package-route.v1',synthetic:true,releaseRoot,version:packageJson.version,identity:{serverVersion:identity.version,database:identity.database,username:identity.username,migrations:identity.migrations},fullRouter:true,health:{status:health.status},readiness:{status:readiness.status,attempt:readiness.attempt},root:{status:root.status,containsNysaCore:true},checks:{acquire:acquire.status,nonHolderSend:blocked.status,managerRelease:released.status,postReleaseSend:sent.status,outboundMessages:counts.outbound,blockedMessages:counts.blocked},result:'passed',checkedAt:new Date().toISOString()};
  await fs.writeFile(path.join(evidenceDir,'DEV266_EXACT_PACKAGE_ROUTE_RESULT.json'),`${JSON.stringify(evidence,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}finally{
  try{await pool.query("UPDATE wa_simulated_provider_control SET paused=TRUE,fault_mode='none',updated_by=NULL,updated_at=NOW() WHERE singleton=TRUE");}catch{}
  if(conversationId){try{await pool.query('DELETE FROM audit_log WHERE entity_id=$1',[conversationId]);}catch{}try{await pool.query('DELETE FROM wa_inbox_notifications WHERE conversation_id=$1',[conversationId]);}catch{}try{await pool.query('DELETE FROM wa_conversation_messages WHERE conversation_id=$1',[conversationId]);}catch{}try{await pool.query('DELETE FROM wa_conversations WHERE id=$1',[conversationId]);}catch{}}
  try{await pool.query('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[Object.values(people)]);}catch{}
  try{await pool.query('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[Object.values(people)]);}catch{}
  try{await pool.query('DELETE FROM team_memberships WHERE team_id=$1',[team]);}catch{}
  try{await pool.query('UPDATE brokers SET team_id=NULL WHERE id=ANY($1::uuid[])',[Object.values(people)]);}catch{}
  try{await pool.query('DELETE FROM teams WHERE id=$1',[team]);}catch{}
  try{await pool.query('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[Object.values(people)]);}catch{}
  await pool.end().catch(()=>{});
  if(!child.killed){child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),wait(3000)]);if(!child.killed)child.kill('SIGKILL');}
}
