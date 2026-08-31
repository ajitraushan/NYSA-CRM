import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createListingAgreementLocalServer, listingAgreementHeaders } from '../tools/listing-agreement-readiness-local/server.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('prototype displays the Inventory, agreement and external-listing boundaries', () => {
  const sources = ['tools/listing-agreement-readiness-local/index.html', 'tools/listing-agreement-readiness-local/app.js'].map(read).join('\n');
  for (const marker of ['WITHDRAWN — DO NOT INTEGRATE', 'Internal Inventory', 'Agreement is not a prerequisite', 'External listing gate', 'Signed-agreement evidence', 'publication readiness blocked', 'eligible, not published', 'NO DOCUMENT GENERATION', 'NO PUBLICATION']) assert.match(sources, new RegExp(marker, 'i'));
});

test('prototype uses opaque synthetic references and never exposes legal document content', () => {
  const app = read('tools/listing-agreement-readiness-local/app.js');
  for (const marker of ['PARTY-SYN-018', 'AUTH-SYN-018-V2', 'INV-SNAPSHOT-SYN-7', 'Not displayed in this local module']) assert.match(app, new RegExp(marker));
  assert.doesNotMatch(app, /(ownerName|ownerPhone|ownerEmail|passport|emiratesId)/i);
});

test('prototype has no request, upload, signing or portal action', () => {
  const sources = ['tools/listing-agreement-readiness-local/index.html', 'tools/listing-agreement-readiness-local/app.js', 'tools/listing-agreement-readiness-local/server.js'].map(read).join('\n');
  for (const prohibited of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'input type="file"', 'atlas.propertyfinder.com']) assert.doesNotMatch(sources, new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  assert.match(listingAgreementHeaders['Content-Security-Policy'], /connect-src 'none'/);
});

test('prototype server is loopback-only and GET-only', async () => {
  const server = createListingAgreementLocalServer();
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
