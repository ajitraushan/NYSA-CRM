import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBrokerNextActionLocalServer,brokerQueueHeaders} from '../tools/broker-next-action-local/server.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('broker action prototype exposes queue context and preview decisions',()=>{
  const html=read('tools/broker-next-action-local/index.html'),app=read('tools/broker-next-action-local/app.js');
  for(const marker of ['Actions requiring attention','Working context will appear here','No Inventory reservation','No automatic assignment'])assert.match(html,new RegExp(marker,'i'));
  for(const marker of ['prepareBrokerNextActions','previewBrokerActionDecision','Simulated provider event','Manual fallback','PREVIEW · NOT APPLIED'])assert.match(app,new RegExp(marker,'i'));
});

test('broker action prototype has no communication or external request primitive',()=>{
  const sources=['tools/broker-next-action-local/index.html','tools/broker-next-action-local/app.js','tools/broker-next-action-local/server.js'].map(read).join('\n');
  for(const prohibited of ['fetch(','XMLHttpRequest','WebSocket','EventSource','sendBeacon','wa.me','propertyfinder.com','atlas.propertyfinder.com'])assert.doesNotMatch(sources,new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.match(brokerQueueHeaders['Content-Security-Policy'],/connect-src 'none'/);
});

test('broker action local server is loopback-only with restrictive headers',async()=>{
  const server=createBrokerNextActionLocalServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  try{
    const address=server.address();assert.equal(address.address,'127.0.0.1');
    const response=await new Promise((resolve,reject)=>import('node:http').then(({get})=>get(`http://127.0.0.1:${address.port}/`,resolve).on('error',reject)));
    assert.equal(response.statusCode,200);assert.match(response.headers['content-security-policy'],/connect-src 'none'/);assert.equal(response.headers['x-frame-options'],'DENY');response.resume();
  }finally{await new Promise(resolve=>server.close(resolve));}
});
