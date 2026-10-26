import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
async function walk(dir){const out=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())out.push(...await walk(full));else if(item.name.endsWith('.test.js'))out.push(full);}return out;}
export async function selectReleaseTests(root){
  const all=(await walk(path.join(root,'test'))).sort(),included=[],excluded=[];
  for(const full of all){const rel=path.relative(root,full).replaceAll('\\','/'),text=await fs.readFile(full,'utf8');(text.includes('release-artifacts')?excluded:included).push(rel);}
  return{included,excluded,includedSha256:sha(included.join('\n')+'\n'),excludedSha256:sha(excluded.join('\n')+'\n')};
}
