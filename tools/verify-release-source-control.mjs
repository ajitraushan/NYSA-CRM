import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',...options}).trim();
const governed=[
  '.gitignore','AGENTS.md','BASELINE.md','CRM_CHANGE_POLICY.md','package.json','package-lock.json',
  'app.cjs','public','src','test','tools','scripts','docs'
];

const dirty=git(['status','--porcelain=v1','--untracked-files=all','--',...governed]);
if(dirty)throw new Error(`Release source control gate: governed files are dirty:\n${dirty}`);

const branch=git(['branch','--show-current']);
if(!branch)throw new Error('Release source control gate: detached HEAD is not permitted');
if(!branch.startsWith('codex/'))throw new Error(`Release source control gate: unexpected branch ${branch}`);

const head=git(['rev-parse','HEAD']);
const remote=process.env.NYSA_RELEASE_GIT_REMOTE||'origin';
const remoteUrl=git(['remote','get-url',remote]);
if(!/^https:\/\/github\.com\/ajitraushan\/NYSA-CRM(?:\.git)?$/i.test(remoteUrl)){
  throw new Error(`Release source control gate: unexpected remote ${remoteUrl}`);
}

const ref=`refs/heads/${branch}`;
const remoteLine=git(['ls-remote','--heads',remote,ref]);
const remoteHead=remoteLine.split(/\s+/)[0]||'';
if(remoteHead!==head){
  throw new Error(`Release source control gate: ${head} is not the pushed ${remote}/${branch} head`);
}

console.log(JSON.stringify({branch,sourceCommit:head,remote,remoteUrl},null,2));

