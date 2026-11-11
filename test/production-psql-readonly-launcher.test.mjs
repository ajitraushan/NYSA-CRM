import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { launchInventory } from '../tools/production-psql-readonly-launcher.mjs';

test('Production launcher sends the password only to psql and protects the evidence', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nysa-psql-launcher-'));
  try {
    const password = 'synthetic secret:!$ for launcher test';
    const sql = path.join(directory, 'inventory.sql');
    const evidence = path.join(directory, 'evidence.json');
    writeFileSync(sql, 'SELECT 1;\n');
    const hash = createHash('sha256').update(readFileSync(sql)).digest('hex');
    const args = [sql, hash, evidence];
    let calls = 0;
    const dependencies = {
      run(command, commandArgs, options) {
        assert.ok(!JSON.stringify(commandArgs).includes(password));
        assert.equal(options.env.PGPASSWORD, undefined);
        if (command !== '/usr/sbin/cloudlinux-selector') return command + ' (PostgreSQL) 13.23';
        return JSON.stringify({
          'nysa-crm': {
            domain: 'crm.nysarealty.com',
            env_vars: { PGDATABASE: 'nysareal_nysacrm', PGUSER: 'nysareal_nysacrmapp', PGPASSWORD: password },
          },
        });
      },
      spawn(command, commandArgs, options) {
        calls++;
        assert.equal(command, 'psql');
        assert.deepEqual(commandArgs.slice(0, 4), ['-X', '-v', 'ON_ERROR_STOP=1', '-w']);
        assert.equal(commandArgs.at(-2), '-f');
        assert.ok(!JSON.stringify(commandArgs).includes(password));
        assert.equal(options.env.PGPASSWORD, password);
        return { status: 0, stdout: 'inventory output\n', stderr: 'accidental echo: ' + password };
      },
    };
    assert.throws(() => launchInventory([sql, '0'.repeat(64), evidence], dependencies), /SHA-256 mismatch/);
    assert.equal(launchInventory(args, dependencies), 0);
    assert.throws(() => launchInventory(args, dependencies), /EEXIST/);
    assert.equal(calls, 1);
    const raw = readFileSync(evidence, 'utf8');
    assert.ok(!raw.includes(password));
    const receipt = JSON.parse(raw);
    assert.equal(receipt.stdout, 'inventory output\n');
    assert.match(receipt.stderr, /withheld/);
    assert.equal(receipt.sqlSha256, hash);
    assert.equal(receipt.selectorPath, '/usr/sbin/cloudlinux-selector');
    assert.match(receipt.launcherSha256, /^[a-f0-9]{64}$/);
    assert.equal(receipt.exitCode, 0);
    assert.ok(Date.parse(receipt.endedAt) >= Date.parse(receipt.startedAt));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

const password = 'synthetic-secret-do-not-print';
const registration = {
  domain: 'crm.nysarealty.com',
  env_vars: { PGDATABASE: 'nysareal_nysacrm', PGUSER: 'nysareal_nysacrmapp', PGPASSWORD: password },
};

for (const [code, response, details = {}] of [
  ['SELECTOR_EXEC_FAILED', () => { throw new Error(password); }],
  ['SELECTOR_INVALID_JSON', () => password],
  ['SELECTOR_REGISTRATION_COUNT', () => '{}', { count: 0 }],
  ['SELECTOR_REGISTRATION_COUNT', () => JSON.stringify({
    first: { 'nysa-crm': registration }, second: { '/home/nysareal/nysa-crm': registration },
  }), { count: 2 }],
  ['SELECTOR_DOMAIN_MISMATCH', () => JSON.stringify({ 'nysa-crm': { ...registration, domain: password } })],
  ...[
    ['SELECTOR_DATABASE_MISMATCH', { PGDATABASE: password }],
    ['SELECTOR_USER_MISMATCH', { PGUSER: password }],
    ['SELECTOR_PASSWORD_MISSING', { PGPASSWORD: '' }],
    ['SELECTOR_HOST_NOT_LOCAL', { PGHOST: 'other-db.example.com' }, { host: 'other-db.example.com' }],
    ['SELECTOR_HOST_NOT_LOCAL', { PGHOST: password }, { host: '[withheld]' }],
    ['SELECTOR_PORT_MISMATCH', { PGPORT: password }],
  ].map(([failure, env, fields]) => [failure, () => JSON.stringify({
    'nysa-crm': { ...registration, env_vars: { ...registration.env_vars, ...env } },
  }), fields]),
]) {
  test(code + ' produces safe evidence without starting psql', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'nysa-psql-selector-'));
    try {
      const sql = path.join(directory, 'inventory.sql');
      const evidence = path.join(directory, 'evidence.json');
      writeFileSync(sql, 'SELECT 1;\n');
      const hash = createHash('sha256').update(readFileSync(sql)).digest('hex');
      let launches = 0;
      const status = launchInventory([sql, hash, evidence], {
        run(command, args) {
          if (args[0] === '--version') return command + ' (PostgreSQL) 13.23';
          assert.equal(command, '/usr/sbin/cloudlinux-selector');
          return response();
        },
        spawn() { launches++; },
      });
      assert.equal(status, 1);
      assert.equal(launches, 0);
      const raw = readFileSync(evidence, 'utf8');
      assert.ok(!raw.includes(password));
      const receipt = JSON.parse(raw);
      assert.equal(receipt.selectorPath, '/usr/sbin/cloudlinux-selector');
      assert.equal(receipt.error, code);
      assert.deepEqual(receipt.errorDetails, details);
      assert.equal(receipt.exitCode, null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
