import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCustomerShortlistLocalServer,securityHeaders} from '../tools/customer-shortlist-local/server.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('local shortlist prototype exposes the complete controlled workflow',()=>{
  const html=read('tools/customer-shortlist-local/index.html'),app=read('tools/customer-shortlist-local/app.js');
  for(const marker of ['Broker-shortlisted properties','Prepare properties for customer review','Record selected responses and show next action','NO SEND CAPABILITY'])assert.match(html,new RegExp(marker,'i'));
  for(const outcome of ['interested','viewing_requested','information_required','more_options','not_suitable'])assert.match(html,new RegExp(outcome));
  assert.match(app,/prepareCustomerShortlist/);
  assert.match(app,/recordCustomerShortlistResponses/);
  for(const marker of ['rejectionReason','preferenceImpact','Proposed · not sent or applied'])assert.match(app,new RegExp(marker,'i'));
  assert.match(html,/Current responsible agent CRM work queue/i);
  for(const marker of ['Approved customer media','Comparable market evidence','Floor plan unavailable','Market comparison unavailable'])assert.match(app,new RegExp(marker,'i'));
});

test('local shortlist prototype has no external request or communication primitive',()=>{
  const sources=['tools/customer-shortlist-local/index.html','tools/customer-shortlist-local/app.js','tools/customer-shortlist-local/server.js'].map(read).join('\n');
  for(const prohibited of ['fetch(','XMLHttpRequest','WebSocket','EventSource','sendBeacon','whatsapp','wa.me','propertyfinder.com','atlas.propertyfinder.com'])assert.doesNotMatch(sources,new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  for(const prohibited of ['phone','email','credential','api key','secret'])assert.doesNotMatch(read('tools/customer-shortlist-local/index.html'),new RegExp(`name=["']?[^>]*${prohibited}`,'i'));
  assert.equal(securityHeaders['Content-Security-Policy'].includes("connect-src 'none'"),true);
});

test('local shortlist server binds safely and serves restrictive headers',async()=>{
  const server=createCustomerShortlistLocalServer();
  await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
  try{
    const address=server.address();
    assert.equal(address.address,'127.0.0.1');
    const response=await new Promise((resolve,reject)=>{
      import('node:http').then(({get})=>get(`http://127.0.0.1:${address.port}/`,resolve).on('error',reject));
    });
    assert.equal(response.statusCode,200);
    assert.match(response.headers['content-security-policy'],/connect-src 'none'/);
    assert.equal(response.headers['x-frame-options'],'DENY');
    response.resume();
    for(const stylesheet of ['details.css','feedback.css']){
      const cssResponse=await new Promise((resolve,reject)=>{
        import('node:http').then(({get})=>get(`http://127.0.0.1:${address.port}/${stylesheet}`,resolve).on('error',reject));
      });
      assert.equal(cssResponse.statusCode,200);
      assert.match(cssResponse.headers['content-type'],/^text\/css/);
      cssResponse.resume();
    }
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
