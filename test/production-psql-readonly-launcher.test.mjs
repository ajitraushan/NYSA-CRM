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
        if (command !== 'cloudlinux-selector') return command + ' (PostgreSQL) 13.23';
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
    assert.match(receipt.launcherSha256, /^[a-f0-9]{64}$/);
    assert.equal(receipt.exitCode, 0);
    assert.ok(Date.parse(receipt.endedAt) >= Date.parse(receipt.startedAt));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
