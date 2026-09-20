import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {zipSync} from 'fflate';
import {assertAdvertisedCommit,assertFullCommit,collectRuntimeFiles,git,parseAdvertisedRefs,withDetachedCheckout} from './release-origin-core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
const commit=assertFullCommit(value('--commit')),remote=value('--remote')||process.env.NYSA_RELEASE_GIT_REMOTE||'origin';
const output=path.resolve(root,value('--output')||'release-artifacts/origin');
const remoteUrl=git(root,['remote','get-url',remote]);
if(!/^https:\/\/github\.com\/ajitraushan\/NYSA-CRM(?:\.git)?$/i.test(remoteUrl))throw new Error(`Configured origin is not the governed GitHub repository: ${remoteUrl}`);
git(root,['fetch','--no-tags',remote,commit]);
const advertised=assertAdvertisedCommit(commit,parseAdvertisedRefs(git(root,['ls-remote','--heads','--tags',remote]))),tree=git(root,['rev-parse',`${commit}^{tree}`]);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

await withDetachedCheckout({repo:root,commit,run:async checkout=>{
  const files=await collectRuntimeFiles(checkout),pkg=JSON.parse(files['package.json']),migrations=Object.keys(files).filter(x=>/^src\/migrations\/\d{3}_.+\.sql$/.test(x)).sort();
  const startedAt=new Date().toISOString();let testOutput='';
  try{testOutput=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['test'],{cwd:checkout,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:64*1024*1024});}
  catch(error){throw new Error(`Release tests failed for isolated commit ${commit}:\n${String(error.stdout||'').slice(-8000)}\n${String(error.stderr||'').slice(-4000)}`);}
  const summary={tests:Number(testOutput.match(/ℹ tests (\d+)/)?.[1]||0),passed:Number(testOutput.match(/ℹ pass (\d+)/)?.[1]||0),failed:Number(testOutput.match(/ℹ fail (\d+)/)?.[1]||0),skipped:Number(testOutput.match(/ℹ skipped (\d+)/)?.[1]||0)};
  if(!summary.tests||summary.failed)throw new Error('Isolated test receipt is missing or not green');
  const testReceipt={command:'npm test',startedAt,completedAt:new Date().toISOString(),...summary,outputSha256:sha(Buffer.from(testOutput))};
  const provenance={schema:'nysa.release-provenance.v1',repositoryUrl:remoteUrl,remote,commit,tree,advertisedRefs:advertised.map(x=>x.ref),sourceRef:advertised[0].ref,version:pkg.version,migrationCount:migrations.length,latestMigration:migrations.at(-1)?.split('/').at(-1)||null,testReceipt};
  files['RELEASE_PROVENANCE.json']=Buffer.from(JSON.stringify(provenance,null,2)+'\n');
  const runtimeManifest=Object.keys(files).sort().map(name=>`${sha(files[name])}  ${name}`).join('\n')+'\n';files['RUNTIME_MANIFEST.sha256']=Buffer.from(runtimeManifest);
  const stem=`nysa-core-${String(pkg.version).replace(/[^a-z0-9.-]+/gi,'-')}-origin`,archive=zipSync(files,{level:9,mtime:new Date('1980-01-01T00:00:00Z')}),packageSha256=sha(archive);
  const manifest={...provenance,package:`${stem}.zip`,packageSha256,bytes:archive.length,runtimeManifestSha256:sha(files['RUNTIME_MANIFEST.sha256']),entryCount:Object.keys(files).length};
  const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n'),manifestSha256=sha(manifestBytes);
  await fs.mkdir(output,{recursive:true});
  for(const [name,bytes] of [[`${stem}.zip`,archive],[`${stem}.manifest.json`,manifestBytes],[`${stem}.sha256.txt`,Buffer.from(`${packageSha256}  ${stem}.zip\n`)],[`${stem}.manifest.sha256.txt`,Buffer.from(`${manifestSha256}  ${stem}.manifest.json\n`)]])await fs.writeFile(path.join(output,name),bytes,{flag:'wx'});
  console.log(JSON.stringify({package:path.join(output,`${stem}.zip`),repositoryUrl:remoteUrl,commit,tree,sourceRef:provenance.sourceRef,packageSha256,manifestSha256,testReceipt,version:pkg.version,migrationCount:migrations.length,latestMigration:provenance.latestMigration},null,2));
}});
