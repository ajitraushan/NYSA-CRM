import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDldMarketImportLocalServer, dldMarketImportHeaders } from '../tools/dld-market-data-import-local/server.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('local DLD import review explains acquisition preservation analytics and processing', () => {
  const source = ['tools/dld-market-data-import-local/index.html','tools/dld-market-data-import-local/app.js'].map(read).join('\n');
  for (const text of ['Manual official CSV now','Immutable file reference and SHA-256','Validate all rows and calculate descriptive KPIs','Prepare an optional governed review file','No CRM import is executed']) assert.match(source, new RegExp(text, 'i'));
});

test('local DLD import review exposes mapping, rejected and duplicate scenarios', () => {
  const source = ['tools/dld-market-data-import-local/index.html','tools/dld-market-data-import-local/app.js'].map(read).join('\n');
  for (const text of ['OFFICIAL SOURCE → CORE MAPPING','Valid and rejected rows','Duplicate transaction ID','Download processed file','staged_admin_review']) assert.match(source, new RegExp(text, 'i'));
});

test('working POC accepts a bounded local CSV and produces an optional processed download', () => {
  const source = ['tools/dld-market-data-import-local/index.html','tools/dld-market-data-import-local/app.js'].map(read).join('\n');
  for (const text of ['Select official DLD source file','Monthly-file limit: 50 MB / 100,000 data rows','Download safe sample source CSV','Download processed file','Processed locally']) assert.match(source, new RegExp(text, 'i'));
});

test('monthly-file processing hashes in batches and bounds DOM row rendering', () => {
  const source = read('tools/dld-market-data-import-local/app.js');
  for (const pattern of [/digestRows/, /start\+=250/, /DLD_LOCAL_MAX_ROWS/, /DLD_LOCAL_MAX_FILE_BYTES/, /slice\(0,DLD_LOCAL_REVIEW_ROW_LIMIT\)/]) assert.match(source, pattern);
});

test('working POC presents accepted-sales KPIs and governed file-level breakdowns', () => {
  const source = ['tools/dld-market-data-import-local/index.html','tools/dld-market-data-import-local/app.js'].map(read).join('\n');
  for (const text of ['TRANSACTION FILE ANALYTICS','Accepted-row rate','Price distribution','Off-plan versus ready','Period activity','partial','Top communities by transaction count','Top communities by transaction value','Property mix','Bedroom mix','Top projects by transaction count','not a valuation']) assert.match(source, new RegExp(text, 'i'));
});

test('working POC supports both Dubai Pulse API and DLD website CSV adapters', () => {
  const source = read('tools/dld-market-data-import-local/app.js');
  assert.match(source, /normalizeDldTransactionsSource/);
  assert.match(source, /sourceFormat/);
});

test('local DLD import prototype cannot call DLD, an API or CRM', () => {
  const source = ['tools/dld-market-data-import-local/index.html','tools/dld-market-data-import-local/app.js','tools/dld-market-data-import-local/server.js'].map(read).join('\n');
  for (const pattern of ['fetch(','XMLHttpRequest','WebSocket','sendBeacon','api.dubaipulse','dubailand.gov']) assert.doesNotMatch(source, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  assert.match(dldMarketImportHeaders['Content-Security-Policy'], /connect-src 'none'/);
});

test('local DLD import server is loopback-only and GET-only', async () => {
  const server = createDldMarketImportLocalServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  try {
    const response = await new Promise((resolve, reject) => import('node:http').then(({get}) => get(`http://127.0.0.1:${server.address().port}/`, resolve).on('error', reject)));
    assert.equal(response.statusCode, 200);
    response.resume();
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
