import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createLocalConsoleServer} from '../tools/whatsapp-local-console/server.js';

const html=fs.readFileSync(new URL('../tools/whatsapp-local-console/index.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../tools/whatsapp-local-console/app.js',import.meta.url),'utf8');

test('local console presents every controlled simulator scenario',()=>{
  for(const scenario of ['happy','retry','permanent','unknown','duplicate','replay','policy']){
    assert.match(html,new RegExp(`value="${scenario}"`));
  }
  assert.match(html,/Local only/);
  assert.match(html,/Network disabled/);
  assert.match(html,/Synthetic data/);
});

test('local console has no sensitive-data input or external request primitive',()=>{
  assert.doesNotMatch(html,/type="(?:tel|email|password)"|textarea/i);
  assert.doesNotMatch(app,/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|https?:\/\//i);
  assert.match(app,/restricted-ref-console/);
  assert.match(app,/providerEventIdempotencyKey/);
});

test('local console server binds safely and sends restrictive browser headers',async()=>{
  const server=createLocalConsoleServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try{
    const address=server.address();
    const response=await fetch(`http://127.0.0.1:${address.port}/`);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.match(await response.text(),/WhatsApp Integration Lab/);
    const missing=await fetch(`http://127.0.0.1:${address.port}/not-found`);
    assert.equal(missing.status,404);
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
