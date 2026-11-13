import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import {compareSchemaContracts,loadSchemaContract,readDatabaseSchemaContract} from './database-schema-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {verifyReadinessWorker} from './hosted-worker-lifecycle.mjs';

export const root='/home/nysareal/nysa-core-dashboard-dd6262a-stage';
export const testUrl='https://crm-test.nysarealty.com';
export const productionUrl='https://crm.nysarealty.com';
export const workspace='/home/nysareal/crm-release-preparation/20261111-wn15';
export const backupDir=workspace+'/recovery/run-a-pre-dev272';
export const toolsDir=path.dirname(fileURLToPath(import.meta.url));
const domain=new URL(testUrl).hostname;
const database='nysareal_nysa_dev247_smoke', role='nysareal_nysar2app';
const version='2.1.0-dev.272', commit='54421912fc1496a1066814cd8b665c19c7e8fd45';
const userId=n=>'d1000000-0000-4000-8000-00000000000'+n;
export const teams=[
  {teamId:'d2000000-0000-4000-8000-000000000001',name:'CORE Test Sales Team',managerId:userId(2),agentIds:[userId(3),userId(4)]},
  {teamId:'d2000000-0000-4000-8000-000000000002',name:'CORE Test Leasing Team',managerId:userId(5),agentIds:[]},
];
export function command(file,args,env=process.env,timeout=15000){
  try{return execFileSync(file,args,{env,timeout,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});}
  catch{throw Error(file+' failed');}
}
export function requireCondition(ok,message){if(!ok)throw Error(message);}
export function quota(timeout=15000){
  const result=JSON.parse(command('uapi',['--output=json','Quota','get_quota_info'],process.env,timeout)).result;
  const used=Number(result?.data?.megabytes_used),limit=Number(result?.data?.megabyte_limit);
  requireCondition(Number(result?.status)===1&&result.data.megabytes_used!==null&&used>=0&&limit>0&&used/limit<0.9,'Account quota unavailable or at least 90% used');
  return 100*used/limit;
}
export async function context(){
  requireCondition(process.getuid?.()===fs.statSync('/home/nysareal').uid&&command('id',['-un']).trim()==='nysareal','Expected hosting account');
  requireCondition(fs.realpathSync(root)===root&&!process.cwd().startsWith(root),'Run outside the exact CRM Test app root');
  const provenance=JSON.parse(fs.readFileSync(root+'/RELEASE_PROVENANCE.json'));
  requireCondition(provenance.commit===commit&&provenance.version===version,'DEV272 provenance mismatch');
  const selector=JSON.parse(command('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',domain]));
  const found=[];
  function scan(value){
    if(!value||typeof value!=='object')return;
    for(const [key,entry] of Object.entries(value)){
      if(key===root||key===path.basename(root))found.push(entry);
      else if(key!=='env_vars')scan(entry);
    }
  }
  scan(selector);
  requireCondition(found.length===1&&found[0].domain===domain,'CRM Test registration mismatch');
  const env=found[0].env_vars;
  requireCondition(env.PGDATABASE===database&&env.PGUSER===role&&typeof env.PGPASSWORD==='string'&&env.PGPASSWORD.length>0,'CRM Test database registration mismatch');
  const host=env.PGHOST||'localhost',port=String(env.PGPORT||5432);
  requireCondition(['localhost','127.0.0.1','::1'].includes(host)&&port==='5432','Unexpected database endpoint');
  requireCondition(env.PROSPECT_DIGEST_EMAIL_ENABLED!=='true'&&env.PROSPECT_DIGEST_SCHEDULE_ENABLED!=='true','Digest sending or schedule enabled');
  const provider=await import(pathToFileURL(root+'/src/whatsapp-simulated-provider.js').href);
  const simulator=provider.assertSimulatedProviderEnvironment(env);
  requireCondition(simulator.enabled&&simulator.environment==='crm-test'&&simulator.syntheticPrefix==='+971509'&&simulator.syntheticDigits===6,'Simulator gate mismatch');
  const db={PATH:process.env.PATH,HOME:'/home/nysareal',LC_ALL:'C',PGDATABASE:database,PGUSER:role,PGHOST:host,PGPORT:port,PGPASSWORD:env.PGPASSWORD,PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=60000'};
  const query=sql=>command('psql',['-X','-w','-At','-v','ON_ERROR_STOP=1','-c',sql],db,65000).trim();
  const baseline=query(`SELECT current_database(),current_user,current_setting('server_version_num'),
    (SELECT count(*) FROM schema_migrations),
    (SELECT count(*) FROM pg_tables WHERE schemaname='public'),
    (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D')`);
  requireCondition(baseline===database+'|'+role+'|130023|172|313|113','CRM Test database baseline mismatch');
  requireCondition(query("SELECT count(*) FROM wa_simulated_provider_control WHERE singleton AND paused AND fault_mode='none'")==='1','Simulator must be paused with no fault');
  for(const [file,hash] of [
    ['src/database-trigger-contract.json','bbf9640691bbd7c96f415e8e52e5fdbf99adcb4c3edc1045fa6eb07e44b74262'],
    ['src/database-schema-contract/manifest.json','8a67123576f03423c5d176386156bb8ab80071df2345ef5cf1ffd5eb15aa8638'],
    ['src/database-schema-contract/columns.json','a066db695f437c9755788687a7ac4b37d33dab07419fc1f85fa79a11800a865e'],
    ['src/database-schema-contract/constraints.json','6f53e94f5bae2f5e58e7425e4cfbf535a655568e85f54abe6bf18639e05e438a'],
    ['src/database-schema-contract/functions.json','f4f3dfb893239684153bd689618e7831f13e29e2c5dcac188c02fca02efe9c89'],
    ['src/database-schema-contract/indexes.json','a33a90e1679459c80bd587f369982bc1cb6b9204601b21b49a1d04b5865742d5'],
    ['src/database-schema-contract/sequences-views.json','33a173bb3e1bd8fe928e09b703fc9d713c9ef9c389fbb365ad1175e47a01100d'],
  ]){
    requireCondition(crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex')===hash,'Installed schema contract hash mismatch: '+file);
  }
  const expected=loadSchemaContract(root+'/src/database-schema-contract',root+'/src/database-trigger-contract.json');
  const client={query:async sql=>({rows:JSON.parse(query("SELECT COALESCE(json_agg(row),'[]') FROM ("+sql+") row"))})};
  const observed=await readDatabaseSchemaContract(client);
  requireCondition(compareSchemaContracts(expected,observed).matches===true,'CRM Test schema contract drift');
  const worker=()=>verifyReadinessWorker({root,expectedVersion:version});
  console.log(JSON.stringify({commit,version,baseline,worker:await worker()}));
  return {db,query,worker,simEnv:Object.fromEntries(Object.entries(env).filter(([key])=>key.startsWith('WHATSAPP_SIMULATED_')||key==='LEAD_RESPONSE_ENVIRONMENT'))};
}
export function verifyTeams(query,active){
  const actual=JSON.parse(query(`SELECT COALESCE(json_agg(t ORDER BY t.id),'[]') FROM
    (SELECT id,name,manager_id,active FROM teams WHERE id IN (${teams.map(t=>"'"+t.teamId+"'").join(',')})) t`));
  requireCondition(actual.length===2&&actual.every((row,i)=>row.id===teams[i].teamId&&row.name===teams[i].name&&row.manager_id===teams[i].managerId&&row.active===active),'Synthetic team identity or integer state mismatch');
  const expected=[
    [2,'CORE Test Sales Manager','manager',0],[3,'CORE Test Agent A1','sales_agent',0],
    [4,'CORE Test Agent A2','sales_agent',0],[5,'CORE Test Leasing Manager','manager',1],
  ];
  for(const [id,name,role,index] of expected){
    requireCondition(query(`SELECT count(*) FROM brokers WHERE id='${userId(id)}' AND name='${name}'
      AND job_role='${role}' AND status='active'
      ${role==='sales_agent'?"AND team_id='"+teams[index].teamId+"'":''}
      AND lower(email) LIKE '%@example.invalid' AND NULLIF(btrim(coalesce(phone,'')),'') IS NULL`)==='1','Synthetic user identity mismatch');
  }
  console.log(JSON.stringify({teams:actual,syntheticUsers:expected.length}));
}
export function verifyRange(db){
  const output=command('psql',['-X','-w','-At','-f',toolsDir+'/wn15-unused-range-readonly.sql'],db,65000);
  const counts=output.split(/\r?\n/).filter(line=>/^[\w.]+\|\d+\|\d+$/.test(line));
  requireCondition(counts.length===16&&counts.every(line=>line.endsWith('|0|0')),'Synthetic phone range is in use or scan incomplete');
  console.log('Unused range verified: +971509100000 through +971509119999');
}
export async function api(route,method='GET',body){
  const token=process.env.NYSA_SIMULATION_SESSION_TOKEN;
  requireCondition(typeof token==='string'&&token.length>=32,'Private Admin session is required');
  const response=await fetch(testUrl+'/api'+route,{method,redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  requireCondition(response.ok,method+' '+route+' failed with HTTP '+response.status);
  return response.json();
}
export function freshBackup(){
  const record=JSON.parse(fs.readFileSync(backupDir+'/verified.json'));
  requireCondition(record.database===database&&record.commit===commit&&Date.now()-record.time>=0&&Date.now()-record.time<4*3600000&&fs.statSync(backupDir+'/crm-test.dump').size===record.bytes,'Verified recovery backup missing, stale or changed');
  requireCondition(command('sha256sum',['--',backupDir+'/crm-test.dump'],process.env,120000).split(' ')[0]===record.sha256,'Recovery dump hash mismatch');
}
