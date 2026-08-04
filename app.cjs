'use strict';

import('./src/server.js').catch((error) => {
  console.error('Application module load failed:', error);
  process.exitCode = 1;
});
