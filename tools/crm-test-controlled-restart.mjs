import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectWorkers, stopVerifiedWorkers, verifyReadinessWorker } from './hosted-worker-lifecycle.mjs';

const root = '/home/nysareal/nysa-core-dashboard-dd6262a-stage';
const domain = 'crm-test.nysarealty.com';
const expectedVersion = '2.1.0-dev.272';

function selector(action, extra = []) {
  const output = execFileSync('/usr/sbin/cloudlinux-selector', [
    action, '--json', '--interpreter', 'nodejs', '--domain', domain, ...extra,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
  const result = JSON.parse(output);
  if (result?.result !== 'success') throw new Error('CloudLinux did not confirm the operation.');
  return result;
}

function registration() {
  const matches = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      if (name === root || name === basename(root)) matches.push(child);
      else if (name !== 'env_vars') visit(child);
    }
  }
  visit(selector('get'));
  if (matches.length !== 1 || matches[0]?.domain !== domain) {
    throw new Error('CRM Test registration could not be verified.');
  }
  return matches[0];
}

export async function restartCrmTest(expectedPid, {
  expectEmailEnabled = false,
  inspect = () => inspectWorkers(root),
  getRegistration = registration,
  control = action => selector(action, ['--app-root', basename(root)]),
  stopWorkers = stopVerifiedWorkers,
  readiness = verifyReadinessWorker,
} = {}) {
  const before = inspect();
  if (before.length !== 1 || before[0].pid !== expectedPid) {
    throw new Error('Expected exactly the reviewed CRM Test worker.');
  }
  const app = getRegistration();
  if (app.app_status !== 'started' ||
      app.env_vars?.PROSPECT_DIGEST_EMAIL_ENABLED !== String(expectEmailEnabled) ||
      app.env_vars?.PROSPECT_DIGEST_SCHEDULE_ENABLED !== 'false') {
    throw new Error('CRM Test must be started with the expected digest sending setting and scheduling off.');
  }

  control('stop');
  await stopWorkers(root, {
    assertStopped: () => getRegistration().app_status === 'stopped',
    inspect: () => {
      const workers = inspect();
      if (workers.some(worker => worker.pid !== expectedPid)) {
        throw new Error('An unexpected CRM Test worker appeared during stop.');
      }
      return workers;
    },
  });
  control('start');
  const ready = await readiness({ root, expectedVersion });
  if (ready.workers[0].pid === expectedPid) throw new Error('Readiness returned the old worker PID.');
  return { before, ...ready };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [flag, pid, emailFlag, emailValue, extra] = process.argv.slice(2);
    const expectEmailEnabled = emailFlag === '--expect-email-enabled' && emailValue === 'true';
    if (process.platform !== 'linux' || flag !== '--expected-pid' || extra !== undefined ||
        (emailFlag !== undefined && !expectEmailEnabled) ||
        !/^[1-9][0-9]*$/.test(pid ?? '') || !Number.isSafeInteger(Number(pid)) || Number(pid) <= 1) {
      throw new Error('A reviewed CRM Test worker PID is required.');
    }
    console.log(JSON.stringify(await restartCrmTest(Number(pid), { expectEmailEnabled }), null, 2));
  } catch {
    // Selector output and subprocess errors can contain credentials.
    console.error('CRM Test controlled restart failed. Check the app state before any further action.');
    process.exitCode = 1;
  }
}
