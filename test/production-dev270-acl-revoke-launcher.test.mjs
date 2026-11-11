import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { launchRevoke } from '../tools/production-dev270-acl-revoke-launcher.mjs';

const sha = '0c4626ba44220196261b62123fd491cbd567139b0de108e1ab9edb2b62ef090a';
const approval = 'dev270:production:revoke-table-grants:' + sha;
const approvedSql = readFileSync(new URL('../docs/production-dev270-acl/revoke-table-grants.sql', import.meta.url), 'utf8')
  .replaceAll('\r\n', '\n');
const inverseSql = readFileSync(new URL('../docs/production-dev270-acl/restore-table-grants.sql', import.meta.url));
const password = 'synthetic child password';

test('only the exact approved forward SQL can reach psql', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'nysa-acl-launcher-'));
  try {
    const sql = path.join(dir, 'revoke.sql');
    const evidence = path.join(dir, 'receipt.json');
    const args = [sql, sha, evidence, approval];
    let launches = 0;
    const deps = {
      run(command, commandArgs, options) {
        assert.equal(options.env.PGPASSWORD, undefined);
        if (commandArgs[0] === '--version') return command + ' (PostgreSQL) 13.23';
        assert.equal(command, '/usr/sbin/cloudlinux-selector');
        return JSON.stringify({ 'nysa-crm': { domain: 'crm.nysarealty.com',
          env_vars: { PGUSER: 'nysareal_nysacrmapp', PGDATABASE: 'nysareal_nysacrm', PGPASSWORD: password },
        } });
      },
      spawn(command, commandArgs, options) {
        launches++;
        assert.equal(command, 'psql');
        assert.deepEqual(commandArgs.slice(0, 3), ['-X', '-v', 'ON_ERROR_STOP=1']);
        assert.deepEqual(commandArgs.slice(-2), ['-f', sql]);
        assert.ok(!commandArgs.includes(password));
        assert.equal(options.env.PGPASSWORD, password);
        assert.equal(options.env.PGOPTIONS, '-c default_transaction_read_only=on');
        return { status: 0, stdout: 'COMMIT\n', stderr: password };
      },
    };
    const inverseSha = createHash('sha256').update(inverseSql).digest('hex');
    writeFileSync(sql, inverseSql);
    assert.throws(() => launchRevoke([sql, inverseSha, evidence, approval], deps), /pinned-sha256/);
    assert.throws(() => launchRevoke(args, deps), /SQL SHA-256 mismatch/);
    writeFileSync(sql, approvedSql);
    assert.throws(() => launchRevoke(args.slice(0, 3), deps), /exact-approval-token/);
    assert.throws(() => launchRevoke([...args.slice(0, 3), 'wrong'], deps), /exact-approval-token/);
    assert.equal(launches, 0);
    assert.equal(launchRevoke(args, deps), 0);
    assert.throws(() => launchRevoke(args, deps), /EEXIST/);
    assert.equal(launches, 1);
    const raw = readFileSync(evidence, 'utf8');
    assert.ok(!raw.includes(password));
    const result = JSON.parse(raw);
    assert.equal(result.sqlSha256, sha);
    assert.equal(result.operation, 'dev270-production-revoke-table-grants');
    assert.equal(result.stdout, 'COMMIT\n');
    assert.equal(result.exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
