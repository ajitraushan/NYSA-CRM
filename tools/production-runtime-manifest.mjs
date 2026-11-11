import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const fileHash=async file=>{
  const hash=createHash('sha256');
  for await(const chunk of fs.createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
};
export const safeName=name=>typeof name==='string'&&/^[A-Za-z0-9_@./+-]+$/.test(name)&&
  !name.startsWith('/')&&name.split('/').every(part=>part&&!['.','..','.git','node_modules'].includes(part));

export function parseRuntimeManifest(text){
  const entries=new Map();
  for(const line of text.trimEnd().split('\n')){
    const match=/^([a-f0-9]{64})  (.+)$/.exec(line);
    if(!match||!safeName(match[2])||entries.has(match[2]))throw Error('Unsafe runtime manifest entry');
    entries.set(match[2],match[1]);
  }
  for(const name of ['package.json','package-lock.json','app.cjs'])assert.ok(entries.has(name),'Missing runtime file: '+name);
  return entries;
}

export async function verifyRuntime(root,entries){
  for(const [name,sha] of entries){
    const file=path.join(root,name);
    const fail=message=>Object.assign(new Error(message),{code:'NYSA_RUNTIME_CHECK'});
    let stat;
    try{stat=fs.lstatSync(file);}catch(error){if(error.code==='ENOENT')throw fail('Runtime file missing: '+name);throw error;}
    if(!stat.isFile()||fs.realpathSync(file)!==file)throw fail('Runtime path is not a regular in-root file: '+name);
    const actual=await fileHash(file);
    if(actual!==sha)throw fail(`Runtime hash mismatch for ${name}. Expected ${sha}, observed ${actual}`);
  }
}
