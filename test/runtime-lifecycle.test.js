import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { configureHttpServer, createShutdownHandler } from '../src/lib/runtime-lifecycle.js';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

test('repeated shutdown requests share one graceful shutdown', async () => {
  let closeCallback;
  let closeCalls = 0;
  let idleCloseCalls = 0;
  let databaseCloseCalls = 0;
  const exits = [];
  const events = [];
  const timer = { unref() {} };
  const server = {
    listening: true,
    closeIdleConnections() { idleCloseCalls += 1; },
    close(callback) { closeCalls += 1; closeCallback = callback; }
  };
  const shutdown = createShutdownHandler({
    getServer: () => server,
    closeDatabase: async () => { databaseCloseCalls += 1; },
    exit: code => exits.push(code),
    log: (event, details) => events.push({ event, details }),
    setTimer: () => timer,
    clearTimer: value => assert.equal(value, timer)
  });

  const first = shutdown('SIGTERM');
  const second = shutdown('SIGINT');
  assert.equal(first, second);
  closeCallback();
  await first;

  assert.equal(closeCalls, 1);
  assert.equal(idleCloseCalls, 1);
  assert.equal(databaseCloseCalls, 1);
  assert.deepEqual(exits, [0]);
  assert.deepEqual(events.map(item => item.event), ['shutdown-requested', 'shutdown-complete']);
});

test('forced shutdown closes active connections and exits once', async () => {
  let closeCallback;
  let forceCallback;
  let allCloseCalls = 0;
  let databaseCloseCalls = 0;
  const exits = [];
  const server = {
    listening: true,
    closeIdleConnections() {},
    close(callback) { closeCallback = callback; },
    closeAllConnections() { allCloseCalls += 1; }
  };
  const shutdown = createShutdownHandler({
    getServer: () => server,
    closeDatabase: async () => { databaseCloseCalls += 1; },
    exit: code => exits.push(code),
    log: () => {},
    setTimer: callback => {
      forceCallback = callback;
      return { unref() {} };
    },
    clearTimer: () => {}
  });

  const result = shutdown('SIGTERM');
  forceCallback();
  closeCallback();
  await result;

  assert.equal(allCloseCalls, 1);
  assert.equal(databaseCloseCalls, 0);
  assert.deepEqual(exits, [1]);
});

test('runtime source remains single-instance and does not spawn processes', async () => {
  const sourceRoot = path.join(root, 'src');
  const files = [];
  async function collect(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await collect(absolute);
      else if (entry.name.endsWith('.js')) files.push(absolute);
    }
  }
  await collect(sourceRoot);
  const sources = await Promise.all(files.map(file => fs.readFile(file, 'utf8')));
  const combined = sources.join('\n');

  assert.doesNotMatch(combined, /(?:node:)?(?:child_process|cluster|worker_threads)/);
  assert.equal((combined.match(/\bapp\.listen\s*\(/g) || []).length, 1);
});

test('HTTP runtime bounds request headers keep-alive and socket reuse',()=>{
  const server={};
  assert.equal(configureHttpServer(server),server);
  assert.equal(server.requestTimeout,30000);
  assert.equal(server.headersTimeout,15000);
  assert.equal(server.keepAliveTimeout,5000);
  assert.equal(server.maxRequestsPerSocket,1000);
});
