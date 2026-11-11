import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('DEV267a actual hosted bootstrap opens Prospect Diary for Agent and Manager without console errors',()=>{
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-dev267a-bootstrap-'));
  try{
    execFileSync(process.execPath,['tools/dev267a-hosted-bootstrap-browser-check.mjs',output,process.cwd()],{cwd:process.cwd(),encoding:'utf8',stdio:'pipe',timeout:120000});
    const evidence=JSON.parse(fs.readFileSync(path.join(output,'DEV267A_HOSTED_BOOTSTRAP_BROWSER_RESULT.json'),'utf8'));
    assert.equal(evidence.loadedThroughActualIndexAndBootstrap,true);
    assert.equal(evidence.version,'2.1.0-dev.268');
    assert.deepEqual(evidence.roles.map(item=>[item.role,item.status]),[['sales_agent','passed'],['manager','passed']]);
    assert.ok(evidence.roles.every(item=>item.pageErrors.length===0&&item.consoleErrors.length===0&&item.state.heading==='Prospect Diary'));
    assert.deepEqual(evidence.requiredOrder,['/bootstrap.js','/prospect-diary-ui.js','/dashboard-ui.js','/app.js']);
  }finally{
    fs.rmSync(output,{recursive:true,force:true});
  }
});
