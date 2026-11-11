import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = '/home/nysareal/nysa-crm';
const DOMAIN = 'crm.nysarealty.com';
const DATABASE = 'nysareal_nysacrm';
const ROLE = 'nysareal_nysacrmapp';
const REVOKE_SQL_SHA256 = '0c4626ba44220196261b62123fd491cbd567139b0de108e1ab9edb2b62ef090a';
const APPROVAL = 'dev270:production:revoke-table-grants:' + REVOKE_SQL_SHA256;
// Confirmed on hosting with: command -v cloudlinux-selector
const SELECTOR = '/usr/sbin/cloudlinux-selector';
const LAUNCHER = fileURLToPath(import.meta.url);
const TOOL_ENV = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', LC_ALL: 'C' };
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

class SelectorFailure extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

function registeredDatabase(run) {
  let raw;
  try {
    raw = run(SELECTOR, [
      'get', '--json', '--interpreter', 'nodejs', '--domain', DOMAIN,
    ], { env: { ...TOOL_ENV, HOME: homedir() }, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new SelectorFailure('SELECTOR_EXEC_FAILED');
  }
  let response;
  try {
    response = JSON.parse(raw);
  } catch {
    throw new SelectorFailure('SELECTOR_INVALID_JSON');
  }

  const matches = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, entry] of Object.entries(value)) {
      if (key === ROOT || key === path.posix.basename(ROOT)) matches.push(entry);
      else if (key !== 'env_vars') visit(entry);
    }
  }
  visit(response);
  if (matches.length !== 1) {
    throw new SelectorFailure('SELECTOR_REGISTRATION_COUNT', { count: matches.length });
  }
  const [registration] = matches;
  if (registration?.domain !== DOMAIN) throw new SelectorFailure('SELECTOR_DOMAIN_MISMATCH');

  const env = registration.env_vars;
  if (env?.PGDATABASE !== DATABASE) throw new SelectorFailure('SELECTOR_DATABASE_MISMATCH');
  if (env?.PGUSER !== ROLE) throw new SelectorFailure('SELECTOR_USER_MISMATCH');
  const password = env?.PGPASSWORD;
  if (typeof password !== 'string' || !password) throw new SelectorFailure('SELECTOR_PASSWORD_MISSING');

  const host = env.PGHOST || 'localhost';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    // Keep hostnames and IP literals, and suppress strings that could contain credentials.
    const safeHost = typeof host === 'string' && !host.includes(password) &&
      (/^[a-zA-Z0-9._-]{1,253}$/.test(host) || isIP(host));
    throw new SelectorFailure('SELECTOR_HOST_NOT_LOCAL', { host: safeHost ? host : '[withheld]' });
  }
  const port = String(env.PGPORT || '5432');
  if (port !== '5432') throw new SelectorFailure('SELECTOR_PORT_MISMATCH');
  return { host, port, password };
}

export function launchRevoke(args, { run = execFileSync, spawn = spawnSync } = {}) {
  const [sqlPath, expectedSha, evidencePath, approved] = args;
  if (args.length !== 4 || !sqlPath || !evidencePath || expectedSha !== REVOKE_SQL_SHA256 || approved !== APPROVAL) {
    throw new Error('Expected <revoke-sql-file> <pinned-sha256> <new-evidence-file> <exact-approval-token>');
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
    operation: 'dev270-production-revoke-table-grants', database: DATABASE, role: ROLE, domain: DOMAIN, selectorPath: SELECTOR, sqlSha256, launcherSha256,
    startedAt: new Date().toISOString(), exitCode: null,
  };
  try {
    const { host, port, password } = registeredDatabase(run);
    let child;
    try {
      child = spawn('psql', [
        '-X', '-v', 'ON_ERROR_STOP=1', '-w', '-At',
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
    report.error = error instanceof SelectorFailure ? error.code : 'PSQL_LAUNCH_FAILED';
    if (error instanceof SelectorFailure) report.errorDetails = error.details;
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
    process.exitCode = launchRevoke(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
