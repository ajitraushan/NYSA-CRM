import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import pg from 'pg';

const releaseRoot=path.resolve(process.argv[2]||'');
const evidenceDir=path.resolve(process.argv[3]||'');
if(!releaseRoot||!evidenceDir)throw new Error('Usage: node tools/dev269-exact-package-route-check.mjs <extracted-release-root> <absent-evidence-dir>');
const packageJson=JSON.parse(await fs.readFile(path.join(releaseRoot,'package.json'),'utf8'));
assert.equal(packageJson.version,'2.1.0-dev.269');
for(const file of ['app.cjs','src/server.js','src/routes/prospects.js','public/prospect-diary-ui.js'])await fs.access(path.join(releaseRoot,file));
await assert.rejects(fs.access(evidenceDir));

for(const name of ['PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD'])if(!process.env[name])throw new Error(`${name} is required for the local synthetic exact-package test`);
assert.equal(process.env.PGDATABASE,'nysa_test_fixture');
assert.equal(process.env.PGUSER,'nysa_test_user');

const uuid=()=>crypto.randomUUID(),agent=uuid(),manager=uuid(),team=uuid();
const tokens={agent:crypto.randomBytes(32).toString('hex'),manager:crypto.randomBytes(32).toString('hex')};
const suffix=String(crypto.randomBytes(4).readUInt32BE()%9000000+1000000),phone=`+97152${suffix}`,email=`ahmed-${suffix}@example.invalid`;
const pool=new pg.Pool({host:process.env.PGHOST,port:Number(process.env.PGPORT),database:process.env.PGDATABASE,user:process.env.PGUSER,password:process.env.PGPASSWORD,ssl:false,max:4});
const port=await new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(error=>error?reject(error):resolve(value));});});
const logs={stdout:[],stderr:[]},child=spawn(process.execPath,['app.cjs'],{cwd:releaseRoot,windowsHide:true,env:{...process.env,NODE_ENV:'production',PORT:String(port),LEAD_RESPONSE_ENVIRONMENT:'crm-test',WHATSAPP_SIMULATED_PROVIDER_ENABLED:'true',WHATSAPP_SIMULATED_PROVIDER_TOKEN:'local-synthetic-dev269-package-token',WHATSAPP_SIMULATED_PROVIDER_URL:'http://127.0.0.1:9/api/providers/whatsapp-simulated',WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES:'30'}});
child.stdout.on('data',chunk=>logs.stdout.push(String(chunk)));child.stderr.on('data',chunk=>logs.stderr.push(String(chunk)));
const base=`http://127.0.0.1:${port}`,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const probe=async pathname=>{const response=await fetch(`${base}${pathname}`);return{status:response.status,body:await response.text()};};
const ready=async()=>{for(let attempt=1;attempt<=40;attempt++){try{const result=await probe('/api/readiness');if(result.status===200)return{...result,attempt};}catch{}await wait(250);}throw new Error(`Exact package did not become ready: ${logs.stderr.join('').slice(-1200)}`);};
const request=async(pathname,{method='GET',body,as='agent'}={})=>{const response=await fetch(`${base}/api${pathname}`,{method,headers:{authorization:`Bearer ${tokens[as]}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json();}catch{data={raw:await response.text()};}return{status:response.status,data};};
let prospectId,contactId;
try{
  const readiness=await ready(),health=await probe('/api/health'),root=await probe('/');
  assert.equal(readiness.status,200);assert.equal(health.status,200);assert.equal(root.status,200);assert.match(root.body,/NYSA CORE/);
  const identity=(await pool.query("SELECT current_setting('server_version') AS version,current_database() AS database,current_user AS username,(SELECT COUNT(*)::int FROM schema_migrations) AS migrations")).rows[0];
  assert.match(identity.version,/^13\.23(?:\b|$)/);assert.deepEqual({database:identity.database,username:identity.username,migrations:identity.migrations},{database:'nysa_test_fixture',username:'nysa_test_user',migrations:170});
  await pool.query(`INSERT INTO brokers(id,name,email,role,job_role,status,password_hash) VALUES
    ($1,'DEV269 Exact Agent',$2,'internal_broker','sales_agent','active','synthetic-only'),
    ($3,'DEV269 Exact Manager',$4,'internal_broker','manager','active','synthetic-only')`,[agent,`dev269-agent-${suffix}@example.invalid`,manager,`dev269-manager-${suffix}@example.invalid`]);
  await pool.query('INSERT INTO teams(id,name,manager_id) VALUES($1,$2,$3)',[team,`DEV269 Exact ${suffix}`,manager]);
  await pool.query('UPDATE brokers SET team_id=$1 WHERE id=ANY($2::uuid[])',[team,[agent,manager]]);
  await pool.query("INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by) VALUES($1,$2,$3,'member',$4),($5,$2,$4,'manager',$4)",[uuid(),team,agent,manager,uuid()]);
  for(const [role,id] of Object.entries({agent,manager}))await pool.query("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[crypto.createHash('sha256').update(tokens[role]).digest('hex'),id]);
  const created=await request('/crm/prospects',{method:'POST',body:{displayName:'Ahmed',phone,briefNotes:'Exact package original note',source:'cold_call'}});
  assert.equal(created.status,201,JSON.stringify(created));prospectId=created.data.prospect.id;assert.equal(created.data.prospect.email,null);
  const before=await request(`/crm/prospects/${prospectId}/conversion-matches`);assert.equal(before.status,200);assert.equal(before.data.customerReady,false);
  const edited=await request(`/crm/prospects/${prospectId}`,{method:'PATCH',body:{displayName:'Ahmed Khan',email,briefNotes:'Exact package audited note'}});
  assert.equal(edited.status,200,JSON.stringify(edited));assert.equal(edited.data.prospect.normalizedEmail,email);
  const converted=await request(`/crm/prospects/${prospectId}/convert`,{method:'POST',body:{contactType:'buyer'}});
  assert.equal(converted.status,201,JSON.stringify(converted));contactId=converted.data.contactId;
  const audits=(await pool.query("SELECT COUNT(*)::int AS count FROM audit_log WHERE entity_type='Prospect' AND entity_id=$1 AND action='profile_updated'",[prospectId])).rows[0].count;assert.equal(audits,1);
  const workspace=await request('/crm/whatsapp-workspace');assert.equal(workspace.status,200,JSON.stringify(workspace));assert.ok(workspace.data.materials.every(item=>!Object.hasOwn(item,'storageKey')));
  await fs.mkdir(evidenceDir,{recursive:false});
  const evidence={schema:'nysa.dev269.exact-package-route.v1',synthetic:true,releaseRoot,version:packageJson.version,identity:{serverVersion:identity.version,database:identity.database,username:identity.username,migrations:identity.migrations},fullRouter:true,health:health.status,readiness:{status:readiness.status,attempt:readiness.attempt},root:{status:root.status,containsNysaCore:true},checks:{createdWithoutEmail:created.status,preEditConversionReady:before.data.customerReady,edited:edited.status,conversion:converted.status,profileAuditRows:audits,workspace:workspace.status,materialStorageKeysAbsent:true},result:'passed',checkedAt:new Date().toISOString()};
  await fs.writeFile(path.join(evidenceDir,'DEV269_EXACT_PACKAGE_ROUTE_RESULT.json'),`${JSON.stringify(evidence,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}finally{
  if(prospectId){try{await pool.query('DELETE FROM audit_log WHERE entity_id=$1',[prospectId]);}catch{}try{await pool.query('DELETE FROM prospects WHERE id=$1',[prospectId]);}catch{}}
  if(contactId){try{await pool.query('DELETE FROM contacts WHERE id=$1',[contactId]);}catch{}}
  try{await pool.query('DELETE FROM audit_log WHERE performed_by=ANY($1::uuid[])',[[agent,manager]]);}catch{}
  try{await pool.query('DELETE FROM sessions WHERE broker_id=ANY($1::uuid[])',[[agent,manager]]);}catch{}
  try{await pool.query('DELETE FROM team_memberships WHERE team_id=$1',[team]);}catch{}
  try{await pool.query('UPDATE brokers SET team_id=NULL WHERE id=ANY($1::uuid[])',[[agent,manager]]);}catch{}
  try{await pool.query('DELETE FROM teams WHERE id=$1',[team]);}catch{}
  try{await pool.query('DELETE FROM brokers WHERE id=ANY($1::uuid[])',[[agent,manager]]);}catch{}
  await pool.end().catch(()=>{});
  if(!child.killed){child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),wait(3000)]);if(!child.killed)child.kill('SIGKILL');}
}
