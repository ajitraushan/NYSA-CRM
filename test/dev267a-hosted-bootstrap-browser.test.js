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
    assert.equal(evidence.version,'2.1.0-dev.269');
    assert.deepEqual(evidence.roles.map(item=>[item.role,item.status]),[['sales_agent','passed'],['manager','passed']]);
    assert.ok(evidence.roles.every(item=>item.pageErrors.length===0&&item.consoleErrors.length===0&&item.state.heading==='Prospect Diary'));
    assert.ok(evidence.roles.every(item=>item.state.headTag==='SECTION'&&item.state.headBackground!=='rgb(0, 0, 0)'&&item.mobile.bodyWidth<=item.mobile.viewport+1));
    assert.ok(evidence.roles.every(item=>item.recordState.headTag==='SECTION'&&item.recordState.headBackground==='rgba(0, 0, 0, 0)'&&item.recordState.headBackgroundImage==='none'&&item.recordState.nameColor==='rgb(20, 35, 44)'&&item.recordState.headerElements===0));
    assert.ok(evidence.roles.every(item=>item.recordMobile.headTag==='SECTION'&&item.recordMobile.headBackground==='rgba(0, 0, 0, 0)'&&item.recordMobile.nameColor==='rgb(20, 35, 44)'&&item.recordMobile.headerElements===0));
    assert.equal(evidence.roles.find(item=>item.role==='manager').dncrRefresh,'passed');
    assert.ok(evidence.roles.every(item=>item.screenshots.length===4));
    assert.deepEqual(evidence.requiredOrder,['/bootstrap.js','/prospect-diary-ui.js','/dashboard-ui.js','/app.js']);
  }finally{
    fs.rmSync(output,{recursive:true,force:true});
  }
});
