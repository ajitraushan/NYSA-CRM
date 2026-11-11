import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT='/home/nysareal/nysa-crm';
const DOMAIN='crm.nysarealty.com';
const DATABASE='nysareal_nysacrm';
const APP_ROLE='nysareal_nysacrmapp';
const OWNER_ROLE='nysareal_nysacrm';
const CANDIDATE='5c1c350151d6ace33377b33526e2bfedf4ae8f6b';
const PREFLIGHT_SHA='112bd0b1914306bb650b5dc4befa3f9f1735dca882c90b39e6c6bdf4b1c5a107';
const PREPARATION='/home/nysareal/crm-release-preparation/';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function productionRegistration(){
  const response=execFileSync('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',DOMAIN],
    {encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']});
  const matches=[];
  function find(node){
    if(!node||typeof node!=='object')return;
    for(const [key,value] of Object.entries(node)){
      if(key===ROOT||key===path.basename(ROOT))matches.push(value);
      else if(key!=='env_vars')find(value);
    }
  }
  find(JSON.parse(response));
  assert.equal(matches.length,1,'Production selector registration is ambiguous');
  assert.equal(matches[0].domain,DOMAIN,'Unexpected selector domain');
  const environment=matches[0].env_vars||{};
  assert.equal(environment.PGDATABASE,DATABASE,'Unexpected registered database');
  assert.equal(environment.PGUSER,APP_ROLE,'Unexpected registered role');
  assert.ok(environment.PGPASSWORD,'Registered database credential unavailable');
  return environment;
}

export async function inspectOwnerAccess(client,expectedTables){
  assert.equal(expectedTables.length,58,'Expected 58 preflight owner tables');
  assert.equal(new Set(expectedTables).size,58,'Duplicate expected owner table');
  await client.query('BEGIN READ ONLY');
  try{
    const {rows:[identity]}=await client.query(`SELECT current_database() AS database,
      current_user AS role, current_setting('server_version') AS postgres,
      current_setting('transaction_read_only') AS transaction_read_only`);
    assert.equal(identity.database,DATABASE);
    assert.equal(identity.role,APP_ROLE);
    assert.equal(identity.transaction_read_only,'on');
    assert.match(identity.postgres,/^13\.23\b/);
    const {rows:[role]}=await client.query(`SELECT rolname AS role, rolinherit,
      pg_has_role($1::name,$2::name,'MEMBER') AS member,
      pg_has_role($1::name,$2::name,'USAGE') AS usage
      FROM pg_roles WHERE rolname=$1::name`,[APP_ROLE,OWNER_ROLE]);
    assert.equal(role.role,APP_ROLE);
    const {rows:tables}=await client.query(`SELECT c.relname AS table_name, r.rolname::text AS owner,
      has_table_privilege($1::name,c.oid,'SELECT') AS app_role_select
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_roles r ON r.oid=c.relowner
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND r.rolname=$2::name
      ORDER BY c.relname`,[APP_ROLE,OWNER_ROLE]);
    assert.deepEqual(tables.map(row=>row.table_name).sort(),[...expectedTables].sort(),
      'The owner table set has changed since the approved preflight');
    return {identity,ownerRole:OWNER_ROLE,role,tables,
      tablesWithSelect:tables.filter(row=>row.app_role_select).length};
  }finally{
    await client.query('ROLLBACK');
  }
}

async function main(args){
  assert.equal(process.platform,'linux');
  assert.equal(args.length,6);
  assert.deepEqual(args.filter((_,index)=>index%2===0),['--preflight','--evidence','--approved']);
  const [,preflightFile,,evidenceFile,,approval]=args;
  const script=fileURLToPath(import.meta.url),scriptSha256=sha(fs.readFileSync(script));
  assert.equal(approval,`${CANDIDATE}:production-ownership-readonly:${scriptSha256}`);
  for(const file of [script,preflightFile,evidenceFile]){
    assert.ok(path.normalize(file)===file&&file.startsWith(PREPARATION),'Use the governed preparation paths');
  }
  assert.equal(fs.realpathSync(path.dirname(evidenceFile)),path.dirname(evidenceFile));
  const bytes=fs.readFileSync(preflightFile);
  assert.equal(sha(bytes),PREFLIGHT_SHA,'Unexpected preflight receipt hash');
  const preflight=JSON.parse(bytes);
  assert.equal(preflight.result,'READ_ONLY_PREFLIGHT_PASSED');
  assert.equal(preflight.candidateCommit,CANDIDATE);
  const expectedTables=preflight.publicTables.filter(table=>table.owner===OWNER_ROLE).map(table=>table.table_name);
  assert.equal(expectedTables.length,58);
  const out=fs.openSync(evidenceFile,'wx',0o600);
  const report={candidateCommit:CANDIDATE,scriptSha256,preflightSha256:PREFLIGHT_SHA,
    startedAt:new Date().toISOString(),result:'FAILED'};
  let client;
  try{
    const env=productionRegistration();
    const {Client}=createRequire(path.join(ROOT,'package.json'))('pg');
    client=new Client({host:env.PGHOST||'localhost',port:Number(env.PGPORT||5432),
      database:DATABASE,user:APP_ROLE,password:env.PGPASSWORD,connectionTimeoutMillis:10000,statement_timeout:15000});
    await client.connect();
    Object.assign(report,await inspectOwnerAccess(client,expectedTables));
    report.result='READ_ONLY_OWNERSHIP_CHECK_COMPLETE';
  }catch(error){
    report.errorCode=error.code||error.name;
    if(error instanceof assert.AssertionError)report.assertionMessage=error.message;
    process.exitCode=1;
  }finally{
    await client?.end();
    report.completedAt=new Date().toISOString();
    fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
    fs.closeSync(out);
  }
  console.log(JSON.stringify({result:report.result,evidenceFile}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
