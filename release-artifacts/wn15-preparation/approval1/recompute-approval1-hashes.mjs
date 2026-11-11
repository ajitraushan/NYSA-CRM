import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const audit=path.join(root,'audit');
const hosted=path.join(root,'hosted');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const parse=text=>text.replaceAll('\r','').trim().split('\n').filter(Boolean).map(line=>{
  const match=line.match(/^([0-9a-f]{64})\s+(.+)$/);
  if(!match)throw new Error(`invalid sha256sum line: ${line}`);
  return {hash:match[1],file:match[2].replace(/^\*/, '')};
});

const hostedExpected=parse(fs.readFileSync(path.join(audit,'HOSTED_SHA256SUMS.txt'),'utf8'));
const local=[];
for(const item of hostedExpected){
  const marker='/20261111-wn15/';
  const at=item.file.indexOf(marker);
  if(at<0)throw new Error(`hosted path is outside approved root: ${item.file}`);
  const relative=item.file.slice(at+marker.length);
  const localFile=path.join(hosted,...relative.split('/'));
  if(!fs.existsSync(localFile))throw new Error(`missing local copy: ${relative}`);
  const observed=sha(localFile);
  if(observed!==item.hash)throw new Error(`hosted/local hash mismatch for ${relative}: expected ${item.hash}, observed ${observed}`);
  local.push(`${observed}  hosted/${relative}`);
}

const exportExpected=parse(fs.readFileSync(path.join(audit,'EXPORT_SHA256SUMS.txt'),'utf8'));
for(const item of exportExpected){
  const localFile=path.join(audit,path.basename(item.file));
  if(!fs.existsSync(localFile))throw new Error(`missing downloaded audit file: ${path.basename(item.file)}`);
  const observed=sha(localFile);
  if(observed!==item.hash)throw new Error(`audit-download hash mismatch for ${path.basename(item.file)}: expected ${item.hash}, observed ${observed}`);
}

fs.writeFileSync(path.join(root,'LOCAL_SHA256SUMS.txt'),`${local.join('\n')}\n`);
fs.writeFileSync(path.join(root,'HASH_COMPARISON_RESULT.json'),`${JSON.stringify({
  schema:'nysa.wn15.approval1-hash-comparison.v1',
  result:'passed',
  hostedFileCount:hostedExpected.length,
  exportFileCount:exportExpected.length,
  hostedAndLocalMatch:true,
  exportDownloadsMatch:true
},null,2)}\n`);
process.stdout.write(`APPROVAL1_HASH_COMPARISON=passed hosted=${hostedExpected.length} exports=${exportExpected.length}\n`);
