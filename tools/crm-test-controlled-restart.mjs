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

export async function restartCrmTest(expectedPids, {
  inspect = () => inspectWorkers(root),
  getRegistration = registration,
  control = action => selector(action, ['--app-root', basename(root)]),
  stopWorkers = stopVerifiedWorkers,
  readiness = verifyReadinessWorker,
} = {}) {
  const expected = new Set(expectedPids);
  if (expected.size !== expectedPids.length || expected.size === 0 ||
      expectedPids.some(pid => !Number.isSafeInteger(pid) || pid <= 1)) {
    throw new Error('Expected distinct reviewed CRM Test PIDs.');
  }
  const checkReviewedSet = () => {
    const workers = inspect();
    const live = new Set(workers.map(worker => worker.pid));
    if (workers.length !== expected.size || live.size !== expected.size ||
        [...expected].some(pid => !live.has(pid))) {
      throw new Error(`CRM Test worker set changed. Expected ${[...expected].join(', ')}. Found ${[...live].join(', ') || 'none'}.`);
    }
    return workers;
  };
  const before = checkReviewedSet();
  const app = getRegistration();
  if (app.app_status !== 'started' ||
      app.env_vars?.PROSPECT_DIGEST_EMAIL_ENABLED !== 'false' ||
      app.env_vars?.PROSPECT_DIGEST_SCHEDULE_ENABLED !== 'false') {
    throw new Error('CRM Test must be started with digest sending and scheduling off.');
  }

  checkReviewedSet();
  control('stop');
  await stopWorkers(root, {
    assertStopped: () => getRegistration().app_status === 'stopped',
    inspect: () => {
      const workers = inspect();
      if (workers.some(worker => !expected.has(worker.pid))) {
        throw new Error('An unexpected CRM Test worker appeared during stop.');
      }
      return workers;
    },
  });
  control('start');
  let ready;
  try {
    ready = await readiness({ root, expectedVersion });
  } catch {
    const workers = inspect();
    throw new Error(`DEV272 readiness or worker verification failed after start. Found ${workers.length} verified workers (PIDs: ${workers.map(worker => worker.pid).join(', ') || 'none'}).`);
  }
  if (ready.version !== expectedVersion || ready.database !== 'ready' ||
      ready.workerCount !== 1 || ready.workers.length !== 1 || expected.has(ready.workers[0].pid)) {
    throw new Error('Expected green DEV272 readiness and exactly one new worker after start.');
  }
  return { before, ...ready };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [flag, pids, ...extra] = process.argv.slice(2);
    if (process.platform !== 'linux' || flag !== '--expected-pids' || extra.length ||
        !/^[1-9][0-9]*(,[1-9][0-9]*)*$/.test(pids ?? '')) {
      throw new Error('Usage: --expected-pids PID[,PID]');
    }
    console.log(JSON.stringify(await restartCrmTest(pids.split(',').map(Number)), null, 2));
  } catch (error) {
    // Selector subprocess errors can contain credentials.
    const message = error instanceof Error && !('cmd' in error) && !(error instanceof SyntaxError)
      ? error.message : 'Selector operation or response failed.';
    console.error('CRM Test controlled restart stopped: '+message);
    process.exitCode = 1;
  }
}
