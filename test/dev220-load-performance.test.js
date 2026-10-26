import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../src/lib/http-kit.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('feature modules load in parallel and app restoration remains the final bootstrap gate',()=>{
  const source=read('public/bootstrap.js');
  assert.match(source,/Promise\.all\(\[import\(`/);
  assert.match(source,/\.\.\.featureFiles\.map\(loadScript\)/);
  assert.ok(source.indexOf("await loadScript('app.js')")>source.indexOf('Promise.all('));
});

test('versioned scripts and font assets are immutable while bootstrap remains no-store',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-static-cache-'));
  fs.writeFileSync(path.join(root,'bootstrap.js'),'bootstrap');
  fs.writeFileSync(path.join(root,'app.js'),'app');
  fs.writeFileSync(path.join(root,'brand.otf'),'font');
  const app=createApp();app.static(root);
  const server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});
  server.unref();
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const [bootstrap,appResponse,font]=await Promise.all([fetch(`${base}/bootstrap.js`),fetch(`${base}/app.js?v=2.1.0-dev.220`),fetch(`${base}/brand.otf`)]);
    assert.match(bootstrap.headers.get('cache-control'),/no-store/);
    assert.equal(appResponse.headers.get('cache-control'),'public, max-age=31536000, immutable');
    assert.equal(font.headers.get('cache-control'),'public, max-age=31536000, immutable');
    assert.equal(font.headers.get('content-type'),'font/otf');
  }finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
});
