import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = '/home/nysareal/nysa-crm';
const DOMAIN = 'crm.nysarealty.com';
const DATABASE = 'nysareal_nysacrm';
const ROLE = 'nysareal_nysacrmapp';
const LAUNCHER = fileURLToPath(import.meta.url);
const TOOL_ENV = { PATH: '/usr/local/bin:/usr/bin:/bin', LC_ALL: 'C' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function registeredDatabase(run) {
  try {
    const response = JSON.parse(run('cloudlinux-selector', [
      'get', '--json', '--interpreter', 'nodejs', '--domain', DOMAIN,
    ], { env: { ...TOOL_ENV, HOME: homedir() }, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] }));
    const matches = [];
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      for (const [key, entry] of Object.entries(value)) {
        if (key === ROOT || key === path.posix.basename(ROOT)) matches.push(entry);
        else if (key !== 'env_vars') visit(entry);
      }
    }
    visit(response);
    const registration = matches[0];
    const env = registration?.env_vars;
    const host = env?.PGHOST || 'localhost';
    const port = String(env?.PGPORT || '5432');
    if (matches.length !== 1 || registration.domain !== DOMAIN ||
        env?.PGDATABASE !== DATABASE || env?.PGUSER !== ROLE ||
        typeof env?.PGPASSWORD !== 'string' || !env.PGPASSWORD ||
        !['localhost', '127.0.0.1', '::1'].includes(host) || port !== '5432') {
      throw new Error();
    }
    return { host, port, password: env.PGPASSWORD };
  } catch {
    throw new Error('Production selector registration or database credential validation failed');
  }
}

export function launchInventory(args, { run = execFileSync, spawn = spawnSync } = {}) {
  const [sqlPath, expectedSha, evidencePath] = args;
  if (args.length !== 3 || !sqlPath || !/^[a-f0-9]{64}$/.test(expectedSha ?? '') || !evidencePath) {
    throw new Error('Usage: launcher.mjs <sql-file> <expected-sha256> <new-evidence-file>');
  }

  const sql = realpathSync(sqlPath);
  const evidenceDir = realpathSync(path.dirname(evidencePath));
  const evidence = path.join(evidenceDir, path.basename(evidencePath));
  for (const candidate of [realpathSync(process.cwd()), realpathSync(LAUNCHER), sql, evidence]) {
    if (candidate === ROOT || candidate.startsWith(ROOT + path.sep)) {
      throw new Error('Run the launcher and keep its files outside the Production app folder');
    }
  }
  const sqlSha256 = sha256(readFileSync(sql));
  if (sqlSha256 !== expectedSha) throw new Error('SQL SHA-256 mismatch');
  const launcherSha256 = sha256(readFileSync(LAUNCHER));
  for (const binary of ['psql', 'pg_restore']) {
    let version;
    try {
      version = run(binary, ['--version'], { env: TOOL_ENV, encoding: 'utf8', timeout: 5000 }).trim();
    } catch {
      throw new Error('Unable to verify ' + binary + ' version');
    }
    if (!new RegExp('^' + binary + ' \\(PostgreSQL\\) 13\\.23(?:\\s|$)').test(version)) {
      throw new Error('Expected PostgreSQL ' + binary + ' 13.23');
    }
  }

  const fd = openSync(evidence, 'wx', 0o600);
  const report = {
    database: DATABASE, role: ROLE, domain: DOMAIN, sqlSha256, launcherSha256,
    startedAt: new Date().toISOString(), exitCode: null,
  };
  try {
    const { host, port, password } = registeredDatabase(run);
    let child;
    try {
      child = spawn('psql', [
        '-X', '-v', 'ON_ERROR_STOP=1', '-w', '-qAt',
        '-h', host, '-p', port, '-U', ROLE, '-d', DATABASE, '-f', sql,
      ], {
        env: { ...TOOL_ENV, PGCONNECT_TIMEOUT: '10', PGOPTIONS: '-c default_transaction_read_only=on', PGPASSWORD: password },
        stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      throw new Error('Unable to launch psql');
    }
    report.exitCode = child.status;
    for (const stream of ['stdout', 'stderr']) {
      const output = child[stream] ?? '';
      report[stream] = output.includes(password) ? '[output withheld: credential detected]' : output;
    }
    if (child.error || child.signal) report.error = 'psql process did not complete normally';
  } catch (error) {
    report.error = error.message;
  } finally {
    try {
      report.endedAt = new Date().toISOString();
      writeFileSync(fd, JSON.stringify(report, null, 2) + '\n');
    } finally {
      closeSync(fd);
    }
  }
  return report.error ? 1 : report.exitCode ?? 1;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(LAUNCHER)) {
  try {
    process.exitCode = launchInventory(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
