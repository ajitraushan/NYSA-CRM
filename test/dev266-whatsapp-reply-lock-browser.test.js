import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('DEV266 actual release UI enforces reply-lock controls for Agent, Manager and Director',()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-dev266-browser-'));
  try{
    execFileSync(process.execPath,['tools/dev266-whatsapp-reply-lock-browser-check.mjs',output,process.cwd()],{cwd:process.cwd(),encoding:'utf8',stdio:'pipe',timeout:120000});
    const evidence=JSON.parse(fs.readFileSync(path.join(output,'DEV266_BROWSER_RESULT.json'),'utf8'));
    assert.equal(evidence.loadedFromActualReleaseFile,true);
    assert.equal(evidence.releaseFile,'public/whatsapp-workspace-ui.js');
    assert.deepEqual(evidence.roles.map(item=>[item.role,item.status]),[['sales_agent','passed'],['manager','passed'],['director','passed']]);
    assert.ok(evidence.roles.every(item=>item.pageErrors.length===0&&item.consoleErrors.length===0));
  }finally{
    fs.rmSync(output,{recursive:true,force:true});
  }
});
