import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveScopedBackupPath,verifyScopedBackupTableNames} from '../tools/crm-test-backup-verification.mjs';

test('DEV261 operator creates and verifies a scoped app/database rollback in the same direct-node run',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-direct-node-release-operator.mjs',import.meta.url),'utf8');
  assert.match(source,/args\['backup-path'\]/);
  assert.doesNotMatch(source,/const backup\s*=\s*['"]\/home\/nysareal\/backup-/);
  assert.match(source,/mode:'stage-and-deploy-once'/);
  assert.match(source,/totalTimeoutMinutes/);
  assert.match(source,/createAndVerifyScopedBackup\(environment\)/);
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
  assert.match(source,/ledger\(stagePool,config\.baselineMigrationCount\)/);
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
  assert.match(source,/ROLLED_BACK_SCOPED_APP_AND_DATABASE/);
  assert.doesNotMatch(source,/fullbackup_to_homedir|Approved full backup/);
  assert.match(source,/STAGE_RESULT\.json/);
  assert.match(source,/DEPLOYED_TECHNICAL_CHECKS_PASSED/);
  assert.match(source,/report\.cleanup=cleanAfterHealth/);
  assert.match(source,/inspectWorkers\(config\.root\)/);
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
