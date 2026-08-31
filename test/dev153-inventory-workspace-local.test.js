import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInventoryWorkspaceReviewServer,inventoryWorkspaceReviewHeaders} from '../tools/inventory-workspace-local/server.js';

test('UAT-035 visual review is loopback-only, GET-only and network-isolated',async()=>{
  assert.match(inventoryWorkspaceReviewHeaders['Content-Security-Policy'],/connect-src 'none'/);
  const server=createInventoryWorkspaceReviewServer();await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  try{const {port,address}=server.address();assert.equal(address,'127.0.0.1');for(const route of ['/','/review.js','/inventory-workspace-ui.js','/source-ui.css']){const response=await fetch(`http://127.0.0.1:${port}${route}`);assert.equal(response.status,200);await response.arrayBuffer();}const blocked=await fetch(`http://127.0.0.1:${port}/`,{method:'POST'});assert.equal(blocked.status,405);}finally{await new Promise(resolve=>server.close(resolve));}
});

test('UAT-035 visual fixture contains no live records, private party data or external request code',()=>{
  const source=['index.html','review.js','server.js'].map(file=>readFileSync(new URL(`../tools/inventory-workspace-local/${file}`,import.meta.url),'utf8')).join('\n');
  assert.match(source,/SYNTHETIC LOCAL REVIEW/);
  for(const forbidden of ['XMLHttpRequest','WebSocket','sendBeacon','ownerPhone','ownerEmail','passport','emiratesId'])assert.doesNotMatch(source,new RegExp(forbidden,'i'));
});
