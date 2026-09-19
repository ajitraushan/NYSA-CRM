import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev192-r5-only-20260906');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baselineName='nysa-core-consolidated-crm-test-dev191-r10.zip';
const baselineBytes=await fs.readFile(path.join(output,baselineName));
if(sha(baselineBytes)!=='76e89622721934fc396a8ebeee26755ec8628689bc7d875eac38825de85ed233')throw Error('dev191 baseline identity mismatch');

const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baselineBytes)).filter(([name])=>runtime(name)&&!name.endsWith('/')));
const source={...baseline};
const approved=['public/commission-payout-ui.js','public/index.html','src/accountant-access.js','src/routes/commission-payout.js','src/migrations/123_agent_payout_calculation_sheet_audit.sql'];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const pkg=JSON.parse(Buffer.from(baseline[name]).toString());pkg.version='2.1.0-dev.192';
  if(pkg.packages?.[''])pkg.packages[''].version=pkg.version;
  source[name]=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
const migrations=Object.keys(source).filter(name=>name.startsWith('src/migrations/')).sort();
if(migrations.length!==123||!migrations.at(-1).endsWith('123_agent_payout_calculation_sheet_audit.sql'))throw Error('Unexpected migration set');
const changed=Object.keys(source).filter(name=>!baseline[name]||sha(source[name])!==sha(baseline[name])).sort();
if(changed.some(name=>!approved.includes(name)&&!['package.json','package-lock.json'].includes(name)))throw Error('Unexpected runtime delta: '+name);

await fs.mkdir(isolated,{recursive:false});
for(const [name,bytes] of Object.entries(source)){
  const destination=path.join(isolated,name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
}
for(const directory of ['test','tools','scripts','schema-proposals']){
  try{await fs.cp(path.join(root,directory),path.join(isolated,directory),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
}
for(const name of ['AGENTS.md','CRM_CHANGE_POLICY.md','BASELINE.md','GIT_ALLOWED_SIGNERS']){
  try{await fs.copyFile(path.join(root,name),path.join(isolated,name));}catch(error){if(error.code!=='ENOENT')throw error;}
}
await fs.symlink(path.join(root,'release-artifacts'),path.join(isolated,'release-artifacts'),'junction');

const entries={...source},files=[],runtimeManifest=[];
for(const name of Object.keys(source).sort()){
  files.push({path:name,sha256:sha(source[name]),bytes:source[name].length,runtimeInstall:true});
  runtimeManifest.push(`${sha(source[name])}  ${name}`);
}
entries['RUNTIME_MANIFEST.sha256']=Buffer.from(runtimeManifest.join('\n')+'\n');
entries['MANIFEST.sha256']=Buffer.from([...runtimeManifest,`${sha(entries['RUNTIME_MANIFEST.sha256'])}  RUNTIME_MANIFEST.sha256`].join('\n')+'\n');
const stem='nysa-core-consolidated-crm-test-dev192-r5',zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.192',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,
  target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',
  liveBaselineVersion:'2.1.0-dev.191',sourceBaselineVersion:'2.1.0-dev.191',sourceBaselinePackageSha256:sha(baselineBytes),baselineMigration:'122_commission_invoice_legal_and_bank_details.sql',
  newMigrations:['123_agent_payout_calculation_sheet_audit.sql'],latestMigration:'123_agent_payout_calculation_sheet_audit.sql',migrationCount:123,migrationNeutral:false,
  requirements:['Print and email-attachment payout calculation-sheet actions complete without audit constraint failure','Select all and clear all controls are available for Accountant preparation and MD-batch submission selection','Prepare selected is one atomic, chronologically ordered server transaction','Multiple commission credits for the same Agent and Deal receive unique payout references','Accountant sees submitted rows in a Pending with MD register until decision','Agent and social-media status render on separate aligned lines','Opportunity and Deal references render on separate aligned lines','Agent payout calculations appear in one scalable Receivables-style commission payment register with inline document actions'],
  excluded:['payout calculation policy changes','invoice or receivable business-rule changes','performance management','campaign management','Production','R2 clone','Property Finder'],
  changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
