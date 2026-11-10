import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('DEV267 actual release UI loads and restores filtered mobile workspaces for Agent, Manager and Director',()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-dev267-browser-'));
  try{
    execFileSync(process.execPath,['tools/dev267-prospect-diary-browser-check.mjs',output,process.cwd()],{cwd:process.cwd(),encoding:'utf8',stdio:'pipe',timeout:120000});
    const evidence=JSON.parse(fs.readFileSync(path.join(output,'DEV267_BROWSER_RESULT.json'),'utf8'));
    assert.equal(evidence.loadedFromActualReleaseFile,true);
    assert.equal(evidence.releaseFile,'public/prospect-diary-ui.js');
    assert.deepEqual(evidence.roles.map(item=>[item.role,item.status]),[['sales_agent','passed'],['manager','passed'],['director','passed']]);
    assert.ok(evidence.roles.every(item=>item.pageErrors.length===0&&item.consoleErrors.length===0&&item.mobile.bodyWidth<=item.mobile.viewport+1));
  }finally{
    fs.rmSync(output,{recursive:true,force:true});
  }
});
