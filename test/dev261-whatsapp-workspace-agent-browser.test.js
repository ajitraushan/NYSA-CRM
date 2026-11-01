import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

test('actual WhatsApp workspace release file opens all six Agent sections in Chrome',()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-dev261-browser-'));
  try{
    execFileSync(process.execPath,['tools/dev261-whatsapp-workspace-agent-browser-check.mjs',output],{cwd:process.cwd(),encoding:'utf8',stdio:'pipe',timeout:120000});
    const evidence=JSON.parse(fs.readFileSync(path.join(output,'agent-six-section-browser-check.json'),'utf8'));
    assert.equal(evidence.loadedFromTrackedReleaseFile,true);
    assert.equal(evidence.releaseFile,'public/whatsapp-workspace-ui.js');
    assert.equal(evidence.role,'Sales Agent');
    assert.deepEqual(evidence.sections.map(item=>item.section),['templates','recipients','segments','campaigns','inbox','materials']);
    assert.ok(evidence.sections.every(item=>item.status==='passed'));
    assert.deepEqual(evidence.pageErrors,[]);
    assert.deepEqual(evidence.consoleErrors,[]);
  }finally{
    fs.rmSync(output,{recursive:true,force:true});
  }
});
