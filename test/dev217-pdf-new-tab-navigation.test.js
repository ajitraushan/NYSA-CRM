import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('all private PDF review links use the controlled separate-tab opener',()=>{
  const app=read('public/app.js');
  assert.match(app,/a\[href\*="\/api\/crm\/document-versions\/"\]\[href\$="\/view"\]/);
  assert.match(app,/event\.preventDefault\(\);openCrmPdfTab\(link\.href\)/);
  assert.match(app,/tab\.opener=null/);
  assert.match(app,/The PDF tab was blocked/);
});

test('proposal review never embeds the PDF over the application workspace',()=>{
  const app=read('public/app.js');
  const start=app.indexOf('async function openProposalPdfReview');
  const end=app.indexOf('window.openProposalPdfReview',start);
  const block=app.slice(start,end);
  assert.match(block,/openCrmPdfTab\(pdfUrl\)/);
  assert.match(block,/Back to Proposal/);
  assert.doesNotMatch(block,/<iframe|fetch\(|URL\.createObjectURL/);
});
