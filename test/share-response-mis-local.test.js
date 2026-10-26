import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createShareResponseMisLocalServer, shareResponseMisHeaders } from '../tools/share-response-mis-local/server.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('local MIS clearly separates evidenced stages and integration status', () => {
  const sources = ['tools/share-response-mis-local/index.html', 'tools/share-response-mis-local/app.js'].map(read).join('\n');
  for (const marker of ['NOT INTEGRATED', 'Prepared', 'Shared', 'Delivered', 'Opened', 'Responded', 'Viewing requested', 'Converted', 'prepared, not sent', 'existing CRM Task', 'Unfilled stages have no evidence']) {
    assert.match(sources, new RegExp(marker, 'i'));
  }
});

test('local MIS preserves approved Module 3 package identity and separate properties', () => {
  const app = read('tools/share-response-mis-local/app.js');
  for (const marker of ['prepared_not_sent', 'NYSA-SYN-001', 'NYSA-SYN-002', 'SHARE-SYN-001', 'missing_authoritative_task']) {
    assert.match(app, new RegExp(marker, 'i'));
  }
});

test('local MIS has no external request, contact input or mutation route', () => {
  const sources = ['tools/share-response-mis-local/index.html', 'tools/share-response-mis-local/app.js', 'tools/share-response-mis-local/server.js'].map(read).join('\n');
  for (const prohibited of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'wa.me', 'atlas.propertyfinder.com']) {
    assert.doesNotMatch(sources, new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  assert.match(shareResponseMisHeaders['Content-Security-Policy'], /connect-src 'none'/);
});

test('local MIS server is loopback-only and GET-only', async () => {
  const server = createShareResponseMisLocalServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.equal(address.address, '127.0.0.1');
    const response = await new Promise((resolve, reject) => import('node:http').then(({ get }) => get(`http://127.0.0.1:${address.port}/`, resolve).on('error', reject)));
    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-security-policy'], /connect-src 'none'/);
    response.resume();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
