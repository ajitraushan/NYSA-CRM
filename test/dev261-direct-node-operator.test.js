import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolveScopedBackupPath,verifyScopedBackupTableNames} from '../tools/crm-test-backup-verification.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

test('canonical operator requires four separately approved phases and chained receipts',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  assert.match(source,/new Set\(\['stage','backup','install','smoke'\]\)/);
  assert.match(source,/args\.approved!==`\$\{config\.commit\}:\$\{args\.phase\}`/);
  assert.match(source,/if\(args\.phase==='stage'\)await stagePhase\(\)/);
  assert.match(source,/else if\(args\.phase==='backup'\)await backupPhase\(\)/);
  assert.match(source,/else if\(args\.phase==='install'\)await installPhase\(\)/);
  assert.match(source,/else await smokePhase\(\)/);
  assert.match(source,/assertReceipt\('STAGE_RESULT\.json','STAGED_AND_VERIFIED'\)/);
  assert.match(source,/assertReceipt\('BACKUP_RESULT\.json','SCOPED_BACKUP_VERIFIED'\)/);
  assert.match(source,/assertReceipt\('INSTALL_RESULT\.json','INSTALLED_STARTED_AND_READY'\)/);
  assert.doesNotMatch(source,/mode:'stage-and-deploy-once'/);
});

test('backup phase verifies an exact scoped app and PostgreSQL rollback set before install',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  assert.match(source,/args\['backup-path'\]/);
  assert.doesNotMatch(source,/const backup\s*=\s*['"]\/home\/nysareal\/backup-/);
  assert.match(source,/totalTimeoutMinutes/);
  assert.match(source,/createAndVerifyScopedBackup\(environment,report\)/);
  assert.match(source,/pg_dump/);
  assert.match(source,/pg_dump',\['--version'\]/);
  assert.match(source,/server_version_num/);
  assert.match(source,/clientMajor<serverMajor/);
  assert.match(source,/--format=custom/);
  assert.match(source,/pg_restore',\['--list'/);
  assert.match(source,/tableSetVerification=verifyScopedBackupTableNames\(liveTableNames,dumpTableNames\)/);
  assert.match(source,/databaseIncluded=.*tableSetVerification\.matches/);
  assert.match(source,/dumpTableNamesSha256/);
  assert.match(source,/expectedTableCount/);
  assert.match(source,/expectedTableNames/);
  assert.match(source,/baselineMigrationCount/);
  assert.match(source,/expectedPostTableCount/);
  assert.match(source,/expectedPostTableNames/);
  assert.match(source,/ledger\(pool,config\.baselineMigrationCount\)/);
  assert.match(source,/ledger\(verificationPool,config\.expectedMigrationCount\)/);
  assert.match(source,/postDeploymentTableComparison/);
  assert.match(source,/compareTableNames\(livePool,\{expectedNames:config\.expectedTableNames,expectedCount:config\.expectedTableCount/);
  assert.match(source,/expectedNamesSha256/);
  assert.match(source,/observedNamesSha256/);
  assert.match(source,/extra,missing,matches/);
  assert.doesNotMatch(source,/dumpCanonical===observedCanonical/);
  assert.match(source,/PGPASSWORD:environment\.PGPASSWORD/);
  assert.doesNotMatch(source,/mysqldump|--password/);
  assert.match(source,/crm-test-app\.tar\.gz/);
  assert.match(source,/SCOPED_BACKUP_VERIFIED\.json/);
  assert.match(source,/ROLLED_BACK_APPLICATION_AND_DOMAIN_VERIFIED/);
  assert.doesNotMatch(source,/fullbackup_to_homedir|Approved full backup/);
  assert.match(source,/STAGE_RESULT\.json/);
  assert.match(source,/BACKUP_RESULT\.json/);
  assert.match(source,/SCOPED_BACKUP_VERIFIED/);
  assert.match(source,/inspectWorkers\(config\.root\)/);
});

test('automatic rollback is application-only and never changes the database',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  const restore=source.slice(source.indexOf('function restoreApplicationBackup'),source.indexOf('function privateRegistrationFile'));
  assert.match(restore,/tar',\['-xzf',receipt\.app\.path/);
  assert.match(restore,/databaseRestorePerformed:false/);
  assert.doesNotMatch(restore,/pg_restore|receipt\.database|--dbname|--clean/);
  assert.doesNotMatch(source,/pg_restore',\['--clean'/);
  assert.match(source,/databaseRestorePerformed=false/);
  assert.match(source,/databaseStatePreserved=true/);
});

test('install rollback restores selector environment and proves the domain serves CORE',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  assert.match(source,/ORIGINAL_REGISTRATION_PRIVATE\.json/);
  assert.match(source,/selector\('set',\['--env-vars',JSON\.stringify\(saved\.env_vars\)\]\)/);
  assert.match(source,/\['\/api\/health',200/);
  assert.match(source,/\['\/api\/readiness',200,\{expectedVersion:version\}\]/);
  assert.match(source,/\['\/',200,\{requireCore:true\}\]/);
  assert.match(source,/NYSA\\s\+CORE/);
  assert.match(source,/ROLLBACK_REQUIRES_ATTENTION/);
  assert.doesNotMatch(source,/catch\{report\.result='ROLLBACK_REQUIRES_ATTENTION'/);
});

test('readiness acceptance prevents every later automatic rollback',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  const install=source.slice(source.indexOf('async function installPhase()'),source.indexOf('async function smokePhase()'));
  const accepted=install.indexOf('readinessAccepted=true');
  const postChecks=install.indexOf('postDeploymentTableComparison');
  const catchBoundary=install.indexOf("if(readinessAccepted)report.result='POST_READINESS_CHECK_FAILED_APP_PRESERVED'");
  const rollbackBranch=install.indexOf('else{',catchBoundary);
  const rollbackCall=install.indexOf('rollbackAfterInstallFailure',rollbackBranch);
  assert.ok(accepted>0,'readiness acceptance latch is present');
  assert.ok(postChecks>accepted,'table checks occur after readiness acceptance');
  assert.ok(catchBoundary>postChecks,'failure boundary is evaluated after post-readiness checks');
  assert.ok(rollbackCall>rollbackBranch,'rollback call exists only in the pre-readiness else branch');
  assert.match(install,/report\.readinessAccepted=readinessAccepted/);
  assert.match(install,/POST_READINESS_CHECK_FAILED_APP_PRESERVED/);
});

test('settled smoke is bounded, records each attempt and never auto-rolls back',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  assert.match(source,/Number\(config\.smokeWindowSeconds\)<30/);
  assert.match(source,/Number\(config\.smokeWindowSeconds\)>60/);
  assert.match(source,/report\.attempts\.push\(attempt\)/);
  assert.match(source,/actualStatus:response\.status/);
  assert.match(source,/bodySnippet:sanitizeSnippet\(text\)/);
  assert.match(source,/server:response\.headers\.get\('server'\)/);
  assert.match(source,/SMOKE_FAILED_HEALTHY_APP_PRESERVED/);
  const smoke=source.slice(source.indexOf('async function smokePhase()'));
  assert.doesNotMatch(smoke,/restoreApplicationBackup|rollbackAfterInstallFailure|selector\('stop'/);
});

test('migration 166 production role mapping is an explicit release gate',()=>{
  const migration=fs.readFileSync(new URL('../src/migrations/166_whatsapp_simulated_provider_stub.sql',import.meta.url),'utf8');
  const baseline=fs.readFileSync(new URL('../BASELINE.md',import.meta.url),'utf8');
  assert.match(migration,/TO nysareal_nysar2app;/);
  assert.match(baseline,/Production uses `nysareal_nysacrmapp`/);
  assert.match(baseline,/record original\/rendered migration hashes/);
  assert.match(baseline,/mandatory production-release approval item/);
});

test('DEV262 accepts migration 166 as the installed baseline without applying a new migration',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('../release-artifacts/dev262-preparation/DEV262_DEPLOY_CONFIG.json',import.meta.url),'utf8'));
  const operator=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  const server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
  const database=fs.readFileSync(new URL('../src/db.js',import.meta.url),'utf8');
  const install=operator.slice(operator.indexOf('async function installPhase()'),operator.indexOf('async function smokePhase()'));

  assert.equal(config.baselineMigrationCount,166);
  assert.equal(config.expectedMigrationCount,166);
  assert.equal(config.expectedTableCount,303);
  assert.equal(config.expectedPostTableCount,303);
  assert.deepEqual(config.expectedTableNames,config.expectedPostTableNames);
  assert.equal(sha256(`${config.expectedTableNames.join('\n')}\n`),'69e336181d98d9965ac6916b032a6bdb1496951917ecf912831f769738dbfeec');
  assert.deepEqual(config.expectedTableNames.filter(name=>name.startsWith('wa_simulat')),['wa_simulated_provider_control','wa_simulated_provider_events','wa_simulation_runs']);

  assert.match(install,/await ledger\(pool,config\.baselineMigrationCount\)/);
  assert.match(install,/await ledger\(verificationPool,config\.expectedMigrationCount\)/);
  assert.doesNotMatch(install,/src\/migrations|INSERT INTO schema_migrations|\bpg_restore\b/);
  assert.match(server,/await migrate\(\)/);
  assert.match(database,/if \(applied\.has\(file\)\) continue/);
});

test('DEV263 advances the migration ledger to 167 without changing the verified table set',()=>{
  const config=JSON.parse(fs.readFileSync(new URL('../release-artifacts/dev263-preparation/DEV263_DEPLOY_CONFIG.json',import.meta.url),'utf8'));
  const migration=fs.readFileSync(new URL('../src/migrations/167_whatsapp_simulator_fault_contract.sql',import.meta.url),'utf8');

  assert.equal(config.commit,'4eb1758c98ed1822ea451de7c90b4266a96a64d0');
  assert.equal(config.baselineMigrationCount,166);
  assert.equal(config.expectedMigrationCount,167);
  assert.equal(config.expectedTableCount,303);
  assert.equal(config.expectedPostTableCount,303);
  assert.deepEqual(config.expectedTableNames,config.expectedPostTableNames);
  assert.match(migration,/ALTER TABLE wa_simulated_provider_control/);
  assert.match(migration,/invalid_number/);
  assert.doesNotMatch(migration,/CREATE TABLE/);
});

test('canonical operator completes full scoped-backup table verification with exact live and dump names',()=>{
  const live=['customers','schema_migrations','wa_messages'];
  const exact=verifyScopedBackupTableNames(live,['wa_messages','customers','schema_migrations']);
  assert.deepEqual(exact.extra,[]);
  assert.deepEqual(exact.missing,[]);
  assert.equal(exact.liveCount,3);
  assert.equal(exact.dumpCount,3);
  assert.equal(exact.liveNamesSha256,exact.dumpNamesSha256);
  assert.equal(exact.matches,true);

  const missing=verifyScopedBackupTableNames(live,['customers','schema_migrations']);
  assert.deepEqual(missing.extra,[]);
  assert.deepEqual(missing.missing,['wa_messages']);
  assert.equal(missing.matches,false);

  const extra=verifyScopedBackupTableNames(live,[...live,'unexpected_table']);
  assert.deepEqual(extra.extra,['unexpected_table']);
  assert.deepEqual(extra.missing,[]);
  assert.equal(extra.matches,false);
});

test('canonical operator accepts the complete scoped-backup path as a parameter without creating it',()=>{
  const fullPath='/home/nysareal/crm-release-preparation/20261103-dev262/scoped-backup-20261103T210000Z';
  assert.equal(resolveScopedBackupPath(fullPath,{appRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage'}),fullPath);
  assert.throws(()=>resolveScopedBackupPath('scoped-backup-relative',{appRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage'}),/absolute/);
  assert.throws(()=>resolveScopedBackupPath('/home/nysareal/nysa-core-dashboard-dd6262a-stage/backup',{appRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage'}),/outside/);
});
