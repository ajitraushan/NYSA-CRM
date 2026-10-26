const ALLOWED_REASONS = new Set([
  'SIGINT',
  'SIGTERM',
  'server-error',
  'startup-failure'
]);

function safeReason(reason) {
  return ALLOWED_REASONS.has(reason) ? reason : 'unspecified';
}

export function configureHttpServer(server,{
  requestTimeoutMs=30000,
  headersTimeoutMs=15000,
  keepAliveTimeoutMs=5000,
  maxRequestsPerSocket=1000
}={}){
  if(!server)return server;
  server.requestTimeout=requestTimeoutMs;
  server.headersTimeout=Math.min(headersTimeoutMs,requestTimeoutMs);
  server.keepAliveTimeout=keepAliveTimeoutMs;
  server.maxRequestsPerSocket=maxRequestsPerSocket;
  return server;
}

export function writeRuntimeEvent(event, details = {}, writer = console.log) {
  writer(JSON.stringify({
    component: 'nysa-core-runtime',
    event,
    pid: process.pid,
    ...details
  }));
}

export function createShutdownHandler({
  getServer,
  closeDatabase,
  exit = code => process.exit(code),
  log = (event, details) => writeRuntimeEvent(event, details),
  timeoutMs = 10000,
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) {
  let shutdownPromise;
  let forced = false;

  return function shutdown(reason = 'unspecified', exitCode = 0) {
    if (shutdownPromise) return shutdownPromise;

    const normalizedReason = safeReason(reason);
    log('shutdown-requested', { reason: normalizedReason });

    shutdownPromise = (async () => {
      const server = getServer();
      const forceTimer = setTimer(() => {
        forced = true;
        log('shutdown-forced', { reason: normalizedReason, timeoutMs });
        server?.closeAllConnections?.();
        exit(1);
      }, timeoutMs);
      forceTimer?.unref?.();

      try {
        if (server?.listening) {
          server.closeIdleConnections?.();
          await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
          });
        }

        if (forced) return;
        await closeDatabase();
        if (forced) return;

        clearTimer(forceTimer);
        log('shutdown-complete', { reason: normalizedReason, exitCode });
        exit(exitCode);
      } catch (error) {
        clearTimer(forceTimer);
        log('shutdown-failed', {
          reason: normalizedReason,
          errorName: error?.name || 'Error'
        });
        exit(1);
      }
    })();

    return shutdownPromise;
  };
}
