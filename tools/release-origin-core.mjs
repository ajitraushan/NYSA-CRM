import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export const FULL_SHA=/^[0-9a-f]{40}$/;
export const runtimePath=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('public/')||name.startsWith('src/');
export const git=(repo,args,options={})=>execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe'],...options}).trim();
export function assertFullCommit(value){if(!FULL_SHA.test(String(value||'')))throw new Error('Release commit must be an explicit full 40-character lowercase SHA');return value;}
export function parseAdvertisedRefs(text){return String(text||'').trim().split(/\r?\n/).filter(Boolean).map(line=>{const [sha,ref]=line.trim().split(/\s+/);return{sha,ref};});}
export function assertAdvertisedCommit(commit,refs){assertFullCommit(commit);const matches=refs.filter(item=>item.sha===commit&&/^refs\/(heads|tags)\//.test(item.ref));if(!matches.length)throw new Error(`Commit ${commit} is not advertised by an origin branch or tag`);return matches;}
export async function collectRuntimeFiles(checkout){
  const names=git(checkout,['ls-files','-z']).split('\0').filter(Boolean).filter(runtimePath).sort();
  const files={};for(const name of names)files[name]=await fs.readFile(path.join(checkout,name));return files;
}
export async function withDetachedCheckout({repo,commit,run}){
  assertFullCommit(commit);const parent=path.join(repo,'tmp');await fs.mkdir(parent,{recursive:true});const checkout=await fs.mkdtemp(path.join(parent,'origin-release-'));
  try{
    await fs.rm(checkout,{recursive:true,force:true});git(repo,['-c','core.autocrlf=false','worktree','add','--detach',checkout,commit]);
    if(git(checkout,['rev-parse','HEAD'])!==commit)throw new Error('Detached checkout commit mismatch');
    if(git(checkout,['status','--porcelain=v1','--untracked-files=all']))throw new Error('Detached checkout is not clean');
    return await run(checkout);
  }finally{
    try{git(repo,['worktree','remove','--force',checkout]);}catch{}
    await fs.rm(checkout,{recursive:true,force:true});
  }
}
export const tempTestRoot=()=>fs.mkdtemp(path.join(os.tmpdir(),'nysa-origin-release-test-'));
