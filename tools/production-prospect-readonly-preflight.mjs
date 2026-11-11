import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compareSchemaContracts,readDatabaseSchemaContract} from './database-schema-contract.mjs';
import {inspectWorkers} from './hosted-worker-lifecycle.mjs';

const ROOT = '/home/nysareal/nysa-crm';
const DOMAIN = 'crm.nysarealty.com';
const DATABASE = 'nysareal_nysacrm';
const ROLE = 'nysareal_nysacrmapp';
const RC1 = 'b6e013c51f46be482858e733160fa7e675ff3106';
const flags = [
  'LEAD_WHATSAPP_ENABLED','LEAD_WHATSAPP_INBOX_ENABLED','WHATSAPP_SANDBOX_ENABLED',
  'WHATSAPP_SANDBOX_CALLBACK_APPROVED','WHATSAPP_SIMULATED_PROVIDER_ENABLED'
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function validateProductionConfig(config) {
  assert.equal(config.root,ROOT);
  assert.equal(config.domain,DOMAIN);
  assert.equal(config.baselineCommit,RC1);
  for (const name of ['candidateCommit','baselineSchemaSha256','scriptSha256','schemaHelperSha256','workerHelperSha256']) {
    const length = name === 'candidateCommit' ? 40 : 64;
    assert.match(config[name],new RegExp('^[a-f0-9]{'+length+'}$'),name);
  }
}

export function validateProductionRegistration(environment) {
  if (environment.PGDATABASE !== DATABASE || environment.PGUSER !== ROLE || !environment.PGPASSWORD) {
    throw new Error('Production PostgreSQL identity mismatch');
  }
  for (const key of flags) {
    if (environment[key] && environment[key] !== 'false') throw new Error('Production setting must be off: '+key);
  }
  if (environment.PROSPECT_OUTSIDE_CALLING_HOURS_MODE && environment.PROSPECT_OUTSIDE_CALLING_HOURS_MODE !== 'warning') {
    throw new Error('Production calling-hours mode differs from the approved setting');
  }
}

export async function verifyProductionCatalog(client, expected) {
  const identity = (await client.query(`SELECT current_database() AS database,current_user AS role,
    current_setting('server_version') AS version,current_setting('transaction_read_only') AS read_only`)).rows[0];
  assert.equal(identity.database,DATABASE);
  assert.equal(identity.role,ROLE);
  assert.equal(identity.read_only,'on');
  assert.match(identity.version,/^13\.23(?:\b|$)/);
  assert.equal(expected.sourceCommit,RC1);
  assert.equal(expected.ledger.length,140);
  assert.equal(expected.tables.length,258);
  assert.equal(expected.contract.triggers.length,108);
  const ledger = (await client.query('SELECT version FROM schema_migrations ORDER BY 1')).rows.map(row=>row.version);
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")).rows.map(row=>row.tablename);
  assert.deepEqual(ledger,expected.ledger,'Production migration ledger differs from RC1');
  assert.deepEqual(tables,expected.tables,'Production public table names differ from RC1');
  const comparison = compareSchemaContracts(expected.contract,await readDatabaseSchemaContract(client));
  if (!comparison.matches) {
    const error=new Error('Production schema differs from RC1');
    error.comparison=comparison;
    throw error;
  }
  return {identity,migrations:ledger.length,tables:tables.length,comparison};
}

export async function readProductionPrivilegeEvidence(client){
  const legacyRole = (await client.query(`SELECT oid FROM pg_roles WHERE rolname='nysareal_nysar2app'`)).rows[0];
  const publicTables = (await client.query(`SELECT c.relname AS table_name, pg_get_userbyid(c.relowner) AS owner,
    CASE WHEN $1::oid IS NOT NULL THEN ARRAY(
      SELECT privilege FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS privileges(privilege)
      WHERE has_table_privilege($1::oid,c.oid,privilege)
    ) ELSE ARRAY[]::text[] END AS legacy_role_privileges
    FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p')
    ORDER BY c.relname`,[legacyRole?.oid ?? null])).rows;
  const legacyRoleEvidence={name:'nysareal_nysar2app',exists:Boolean(legacyRole),connect:legacyRole
    ? (await client.query("SELECT has_database_privilege($1::oid,current_database(),'CONNECT') AS allowed",[legacyRole.oid])).rows[0].allowed
    : false};
  return {publicTables,legacyRole:legacyRoleEvidence};
}

function registration() {
  const raw = execFileSync('cloudlinux-selector',['get','--json','--interpreter','nodejs','--domain',DOMAIN],
    {encoding:'utf8',timeout:15000,windowsHide:true});
  const matches=[];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    for (const [key,value] of Object.entries(node)) {
      if (key===ROOT || key===path.basename(ROOT)) matches.push(value);
      else if (key!=='env_vars') walk(value);
    }
  }
  walk(JSON.parse(raw));
  if (matches.length!==1 || matches[0].domain!==DOMAIN) throw new Error('Production selector registration mismatch');
  return matches[0];
}

async function main(args) {
  if (process.platform !== 'linux') throw new Error('Production preflight requires the registered Linux host');
  if (args.length!==8 || args[0]!=='--config' || args[2]!=='--schema' || args[4]!=='--evidence' || args[6]!=='--approved') {
    throw new Error('Expected --config, --schema, --evidence and --approved');
  }
  const [,configFile,,schemaFile,,evidenceFile,,approval] = args;
  const configBytes=fs.readFileSync(configFile), config=JSON.parse(configBytes);
  validateProductionConfig(config);
  if (approval !== config.candidateCommit+':production-readonly-preflight:'+hash(configBytes)) {
    throw new Error('Exact candidate, config and preflight approval argument required');
  }
  const script=fileURLToPath(import.meta.url);
  if (path.resolve(script).startsWith(ROOT+'/') || path.resolve(evidenceFile).startsWith(ROOT+'/')) {
    throw new Error('The preflight and evidence must be outside the Production application');
  }
  const output=fs.openSync(evidenceFile,'wx',0o600);
  const report={candidateCommit:config.candidateCommit,configSha256:hash(configBytes),root:ROOT,domain:DOMAIN,
    startedAt:new Date().toISOString(),result:'FAILED'};
  let client;
  try {
    const schema=fs.readFileSync(schemaFile);
    assert.equal(hash(schema),config.baselineSchemaSha256,'RC1 expectation hash mismatch');
    for (const [file,key] of [[script,'scriptSha256'],
      [new URL('./database-schema-contract.mjs',import.meta.url),'schemaHelperSha256'],
      [new URL('./hosted-worker-lifecycle.mjs',import.meta.url),'workerHelperSha256']]) {
      assert.equal(hash(fs.readFileSync(file)),config[key],key+' mismatch');
    }
    assert.equal(fs.realpathSync(ROOT),ROOT);
    const installed = JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
    assert.equal(installed.version,'2.1.0-rc.1');
    report.installedVersion=installed.version;
    const provenance=path.join(ROOT,'RELEASE_PROVENANCE.json');
    report.baselineProvenance=fs.existsSync(provenance)
      ? {commit:JSON.parse(fs.readFileSync(provenance,'utf8')).commit,sha256:hash(fs.readFileSync(provenance))}
      : {available:false};
    if (report.baselineProvenance.commit && report.baselineProvenance.commit!==RC1) {
      throw new Error('Production provenance commit differs from RC1');
    }
    const {env_vars:environment={}}=registration();
    validateProductionRegistration(environment);
    report.registeredSettingNames=['PGDATABASE','PGUSER','LEAD_RESPONSE_ENVIRONMENT','NYSA_ENVIRONMENT',
      'PROSPECT_OUTSIDE_CALLING_HOURS_MODE',...flags].filter(key=>Object.hasOwn(environment,key));
    report.workers=inspectWorkers(ROOT);
    if (report.workers.length>1) throw new Error('Multiple exact-root Production workers');
    const {blocks,bfree,bavail,bsize}=fs.statfsSync(ROOT);
    const occupied=blocks-bfree;
    report.disk={usedPercent:Math.ceil(100*occupied/(occupied+bavail)),availableBytes:bavail*bsize};
    const {Client}=createRequire(path.join(ROOT,'package.json'))('pg');
    client=new Client({host:environment.PGHOST||'localhost',port:Number(environment.PGPORT||5432),
      database:DATABASE,user:ROLE,password:environment.PGPASSWORD,connectionTimeoutMillis:10000,statement_timeout:12000});
    await client.connect();
    await client.query('BEGIN READ ONLY');
    report.catalog=await verifyProductionCatalog(client,JSON.parse(schema));
    report.usersByRoleAndTeam=(await client.query(`SELECT job_role,team_id,COUNT(*)::int AS total
      FROM brokers GROUP BY job_role,team_id ORDER BY job_role,team_id`)).rows;
    Object.assign(report,await readProductionPrivilegeEvidence(client));
    const databaseBytes=Number((await client.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes);
    await client.query('ROLLBACK');
    const appBytes=Number(execFileSync('du',['-sb','--',ROOT],{encoding:'utf8',timeout:30000}).split(/\s/)[0]);
    assert.ok(Number.isSafeInteger(appBytes)&&Number.isSafeInteger(databaseBytes));
    report.backupSizeEstimate={appBytes,databaseBytes,uncompressedInputBytes:appBytes+databaseBytes};
    if (report.disk.usedPercent>=90) throw new Error('Production disk usage is at or above 90 percent');
    report.result='READ_ONLY_PREFLIGHT_PASSED';
  } catch (error) {
    // Driver errors can carry database details. Retain only the safe classification.
    report.errorCode=error.code||error.name;
    if (error instanceof assert.AssertionError) report.assertionMessage=error.message;
    if (error.comparison) report.schemaMismatch=error.comparison;
    process.exitCode=1;
  } finally {
    await client?.end();
    report.completedAt=new Date().toISOString();
    fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    fs.closeSync(output);
    console.log(JSON.stringify({result:report.result,evidenceFile}));
  }
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
