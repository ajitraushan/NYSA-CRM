import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectWorkers } from './hosted-worker-lifecycle.mjs';

const root = '/home/nysareal/nysa-core-dashboard-dd6262a-stage';
const domain = 'crm-test.nysarealty.com';
const digestNames = [
  'PROSPECT_DIGEST_SMTP_SENDER',
  'PROSPECT_DIGEST_TEST_RECIPIENTS',
  'PROSPECT_DIGEST_ENVIRONMENT',
  'PROSPECT_DIGEST_HOURLY_LIMIT',
  'PROSPECT_DIGEST_EMAIL_ENABLED',
  'PROSPECT_DIGEST_SCHEDULE_ENABLED',
];

export function readDigestRegistration(registration) {
  const matches = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      if (name === root || name === basename(root)) matches.push(child);
      else if (name !== 'env_vars') visit(child);
    }
  }
  visit(registration);
  if (registration?.result !== 'success' || matches.length !== 1 || matches[0]?.domain !== domain) {
    throw new Error('CRM Test selector registration could not be verified.');
  }

  const env = matches[0].env_vars ?? {};
  if (typeof env !== 'object' || Array.isArray(env)) {
    throw new Error('CRM Test selector environment is invalid.');
  }
  const digest = Object.fromEntries(digestNames.map(name => {
    const value = Object.hasOwn(env, name) ? env[name] : null;
    if (value !== null && typeof value !== 'string') {
      throw new Error('CRM Test digest setting is invalid.');
    }
    return [name, value];
  }));
  return { environmentVariableNames: Object.keys(env).sort(), digest };
}

function main() {
  if (process.platform !== 'linux' || process.argv.length !== 2) {
    throw new Error('CRM Test diagnostic requires Linux and takes no arguments.');
  }
  const raw = execFileSync('/usr/sbin/cloudlinux-selector', [
    'get', '--json', '--interpreter', 'nodejs', '--domain', domain,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
  const registration = readDigestRegistration(JSON.parse(raw));
  const workers = inspectWorkers(root);
  console.log(JSON.stringify({ workers, ...registration }, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    main();
  } catch {
    // Selector output and subprocess errors can contain credentials.
    console.error('CRM Test digest diagnostic failed.');
    process.exitCode = 1;
  }
}
