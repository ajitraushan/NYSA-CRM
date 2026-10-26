import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {assertAdvertisedCommit,collectRuntimeFiles,parseAdvertisedRefs,tempTestRoot,withDetachedCheckout} from '../tools/release-origin-core.mjs';
import {selectReleaseTests} from '../tools/release-test-selection.mjs';
const git=(cwd,args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();

test('unpushed commit is rejected because it is absent from advertised refs',()=>{
  const pushed='a'.repeat(40),unpushed='b'.repeat(40),refs=parseAdvertisedRefs(`${pushed}\trefs/heads/main\n`);
  assert.equal(assertAdvertisedCommit(pushed,refs)[0].ref,'refs/heads/main');
  assert.throws(()=>assertAdvertisedCommit(unpushed,refs),/not advertised/);
});

test('detached commit packaging excludes modified and untracked caller files',{skip:process.env.NYSA_RUN_RELEASE_GIT_INTEGRATION==='1'?false:'Requires disposable Git worktree process access'},async()=>{
  const repo=await tempTestRoot();try{
    git(repo,['init']);git(repo,['config','user.email','release-test@example.invalid']);git(repo,['config','user.name','Release Test']);
    await fs.mkdir(path.join(repo,'public'));await fs.writeFile(path.join(repo,'package.json'),'{}\n');await fs.writeFile(path.join(repo,'public/app.js'),'committed\n');
    git(repo,['add','.']);git(repo,['commit','-m','baseline']);const commit=git(repo,['rev-parse','HEAD']);
    await fs.writeFile(path.join(repo,'public/app.js'),'modified-working-copy\n');await fs.writeFile(path.join(repo,'public/untracked.js'),'must-not-leak\n');
    const files=await withDetachedCheckout({repo,commit,run:collectRuntimeFiles});
    assert.equal(Buffer.from(files['public/app.js']).toString(),'committed\n');assert.equal(files['public/untracked.js'],undefined);
  }finally{await fs.rm(repo,{recursive:true,force:true});}
});

test('policy exposes one canonical origin-only package command',async()=>{
  const pkg=JSON.parse(await fs.readFile('package.json','utf8')),agents=await fs.readFile('AGENTS.md','utf8'),policy=await fs.readFile('CRM_CHANGE_POLICY.md','utf8'),legacy=await fs.readFile('tools/verify-release-source-control.mjs','utf8'),deployer=await fs.readFile('tools/prepare-dev209-deployer.mjs','utf8');
  assert.equal(pkg.scripts['release:package'],'node tools/build-release-from-origin.mjs');assert.match(agents,/Packaging from the current working directory is prohibited/);assert.match(policy,/nysa\.release-provenance\.v1/);assert.match(legacy,/Deprecated release gate/);assert.match(deployer,/deployer generation refused/);assert.match(deployer,/manifest\.schema!=='nysa\.release-provenance\.v1'/);
});

test('release tests exclude only tests coupled to ignored historical artifacts',async()=>{
  const selected=await selectReleaseTests(process.cwd());assert.ok(selected.included.length>100);assert.ok(selected.excluded.length>0);
  for(const file of selected.excluded)assert.match(await fs.readFile(file,'utf8'),/release-artifacts/);
  assert.match(selected.includedSha256,/^[0-9a-f]{64}$/);assert.match(selected.excludedSha256,/^[0-9a-f]{64}$/);
});
