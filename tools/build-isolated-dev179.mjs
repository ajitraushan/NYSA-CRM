import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev179-only-20260903');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseBytes=await fs.readFile(path.join(output,'nysa-core-consolidated-crm-test-dev178.zip'));
if(sha(baseBytes)!=='1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218')throw Error('dev178 baseline identity mismatch');
const runtime=n=>['app.cjs','.env.example','package.json','package-lock.json'].includes(n)||n.startsWith('src/')||n.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baseBytes)).filter(([n])=>runtime(n)&&!n.endsWith('/')));
const source={...baseline};
const approved=[
  'public/accountant-workspace-ui.js','public/receivables-ui.js','public/opportunity-finance-ui.js',
  'public/commission-payout-ui.js','public/bootstrap.js','public/app.js',
  'src/accountant-access.js','src/accountant-workspace.js','src/commission-proof.js',
  'src/commission-receivables.js','src/receivable-receipt-posting.js','src/receivables-domain.js',
  'src/opportunity-finance.js','src/routes/commission-payout.js',
  'src/migrations/113_dev177_commission_receivables.sql',
  'src/migrations/115_receivable_single_entry_receipts.sql',
  'src/migrations/116_opportunity_finance_identity.sql'
];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const p=JSON.parse(Buffer.from(baseline[name]).toString());p.version='2.1.0-dev.179';
  if(p.packages?.[''])p.packages[''].version=p.version;
  source[name]=Buffer.from(JSON.stringify(p,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
const migrations=Object.keys(source).filter(n=>n.startsWith('src/migrations/')).sort();
if(migrations.length!==116||!migrations.at(-1).endsWith('116_opportunity_finance_identity.sql'))throw Error('Unexpected migration set');
const changed=Object.keys(source).filter(n=>!baseline[n]||sha(source[n])!==sha(baseline[n])).sort();
if(changed.some(n=>!approved.includes(n)&&!['package.json','package-lock.json'].includes(n)))throw Error('Unexpected runtime delta');
await fs.mkdir(isolated,{recursive:false});
for(const [name,bytes] of Object.entries(source)){
  const destination=path.join(isolated,name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
}
// Verification support is local only, never shipped.
for(const directory of ['test','tools','scripts','schema-proposals']){
  try{await fs.cp(path.join(root,directory),path.join(isolated,directory),{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}
}
await fs.mkdir(path.join(isolated,'docs'),{recursive:true});
for(const name of await fs.readdir(path.join(root,'docs')))if(/\.(md|json)$/.test(name))await fs.copyFile(path.join(root,'docs',name),path.join(isolated,'docs',name));
for(const name of ['AGENTS.md','CRM_CHANGE_POLICY.md','BASELINE.md','GIT_ALLOWED_SIGNERS']){
  try{await fs.copyFile(path.join(root,name),path.join(isolated,name));}catch(e){if(e.code!=='ENOENT')throw e;}
}
await fs.symlink(path.join(root,'release-artifacts'),path.join(isolated,'release-artifacts'),'junction');
const entries={...source},files=[],runtimeManifest=[];
for(const name of Object.keys(source).sort()){
  files.push({path:name,sha256:sha(source[name]),bytes:source[name].length,runtimeInstall:true});
  runtimeManifest.push(`${sha(source[name])}  ${name}`);
}
entries['RUNTIME_MANIFEST.sha256']=Buffer.from(runtimeManifest.join('\n')+'\n');
entries['MANIFEST.sha256']=Buffer.from([...runtimeManifest,`${sha(entries['RUNTIME_MANIFEST.sha256'])}  RUNTIME_MANIFEST.sha256`].join('\n')+'\n');
const stem='nysa-core-consolidated-crm-test-dev179',zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.179',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,
  target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',
  baselineVersion:'2.1.0-dev.178',baselinePackageSha256:sha(baseBytes),baselineMigration:'114_commission_independent_transaction_closure.sql',
  newMigrations:migrations.filter(n=>!baseline[n]),latestMigration:'116_opportunity_finance_identity.sql',migrationCount:116,
  excluded:['new payout request workflow','statutory invoice PDF generation','Production','R2 clone','Property Finder'],
  changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
