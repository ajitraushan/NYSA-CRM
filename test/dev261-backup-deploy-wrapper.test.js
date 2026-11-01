import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('DEV261 backup wrapper creates one cPanel backup and passes its exact path to the direct-node operator',()=>{
  const source=fs.readFileSync(new URL('../tools/crm-test-full-backup-and-release.mjs',import.meta.url),'utf8');
  assert.match(source,/Backup','fullbackup_to_homedir'/);
  assert.match(source,/Backup','list_backups'/);
  assert.match(source,/!before\.has\(item\.file\)/);
  assert.match(source,/\^complete\$/);
  assert.match(source,/--backup-path',backupPath/);
  assert.match(source,/backup-timeout-minutes/);
  assert.match(source,/operator-timeout-minutes/);
  assert.doesNotMatch(source,/rename|move_file|Move-Item/i);
});
