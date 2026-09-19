import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev178-only-20260903');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseBytes=await fs.readFile(path.join(output,'nysa-core-consolidated-crm-test-dev176.zip'));
if(sha(baseBytes)!=='5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560')throw Error('dev176 baseline identity mismatch');
const runtime=n=>['app.cjs','.env.example','package.json','package-lock.json'].includes(n)||n.startsWith('src/')||n.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baseBytes)).filter(([n])=>runtime(n)&&!n.endsWith('/')));
const source={...baseline};
const approved=[
  'public/accountant-workspace-ui.js','public/money-input.js','public/bootstrap.js','public/app.js',
  'public/commission-payout-ui.js','public/deal-ui.js','src/accountant-access.js','src/accountant-workspace.js',
  'src/auth.js','src/commission-proof.js','src/crm-policy.js','src/routes/commission-payout.js',
  'src/routes/opportunities.js','src/migrations/114_commission_independent_transaction_closure.sql'
];
for(const name of approved){
  let text=await fs.readFile(path.join(root,name),'utf8');
  if(name==='public/bootstrap.js')text=text.split(/\r?\n/).filter(l=>!l.includes('/receivables-ui.js')).join('\n');
  if(name==='public/app.js'){
    text=text.split(/\r?\n/).filter(l=>!l.includes('<button data-tab="receivables">')).join('\n');
    text=text.replace("currentTab === 'receivables' ? window.renderCommissionReceivables?.() : ",'');
  }
  if(name==='src/routes/commission-payout.js')text=text.split(/\r?\n/).filter(l=>!l.includes('registerCommissionReceivableRoutes')).join('\n');
  if(/receivables-ui|commission-receivables|registerCommissionReceivableRoutes|renderCommissionReceivables/i.test(text))throw Error('Deferred code remains in '+name);
  source[name]=Buffer.from(text);
}
for(const name of ['package.json','package-lock.json']){
  const p=JSON.parse(Buffer.from(baseline[name]).toString());p.version='2.1.0-dev.178';
  if(p.packages?.[''])p.packages[''].version=p.version;
  source[name]=Buffer.from(JSON.stringify(p,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
if(Object.keys(source).some(n=>/receivables|113_|dev177|^\.env$|^storage\//i.test(n)))throw Error('Excluded source included');
const migrations=Object.keys(source).filter(n=>n.startsWith('src/migrations/')).sort();
if(migrations.length!==113||!migrations.at(-1).endsWith('114_commission_independent_transaction_closure.sql'))throw Error('Unexpected migration set');
const changed=Object.keys(source).filter(n=>!baseline[n]||sha(source[n])!==sha(baseline[n])).sort();
if(changed.some(n=>!approved.includes(n)&&!['package.json','package-lock.json'].includes(n)))throw Error('Unexpected runtime delta');
await fs.mkdir(isolated,{recursive:false});
for(const [name,bytes] of Object.entries(source)){
  const destination=path.join(isolated,name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
}
// Local verification files are not runtime installation contents.
for(const directory of ['test','tools','scripts'])await fs.cp(path.join(root,directory),path.join(isolated,directory),{recursive:true,filter:p=>!/[\\/]dev177-[^\\/]+\.test\.js$/.test(p)});
await fs.mkdir(path.join(isolated,'docs'),{recursive:true});
for(const name of await fs.readdir(path.join(root,'docs')))if(name.endsWith('.md'))await fs.copyFile(path.join(root,'docs',name),path.join(isolated,'docs',name));
for(const name of ['AGENTS.md','CRM_CHANGE_POLICY.md','BASELINE.md'])await fs.copyFile(path.join(root,name),path.join(isolated,name));
const entries={...source},files=[],runtimeManifest=[];
for(const name of Object.keys(source).sort()){
  files.push({path:name,sha256:sha(source[name]),bytes:source[name].length,runtimeInstall:true});
  runtimeManifest.push(`${sha(source[name])}  ${name}`);
}
entries['RUNTIME_MANIFEST.sha256']=Buffer.from(runtimeManifest.join('\n')+'\n');
entries['MANIFEST.sha256']=Buffer.from([...runtimeManifest,`${sha(entries['RUNTIME_MANIFEST.sha256'])}  RUNTIME_MANIFEST.sha256`].join('\n')+'\n');
const stem='nysa-core-consolidated-crm-test-dev178',zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.178',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,
  target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',
  baselineVersion:'2.1.0-dev.176',baselinePackageSha256:sha(baseBytes),baselineMigration:'112_dev176_commission_proof.sql',
  latestMigration:'114_commission_independent_transaction_closure.sql',migrationCount:113,
  excluded:['migration 113 / provisional dev177 receivables','invoicing','new payout request workflow','Production','R2 clone','Property Finder'],
  changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
