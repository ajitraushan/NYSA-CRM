import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev189-r4-only-20260905');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baselineName='nysa-core-consolidated-crm-test-dev188-r3.zip';
const baselineBytes=await fs.readFile(path.join(output,baselineName));
if(sha(baselineBytes)!=='c94a52e4aa00f7c51e8f9cab187aef700c11d9f413870bf33a75674f7a12c9b4')throw Error('dev188 baseline identity mismatch');

const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baselineBytes)).filter(([name])=>runtime(name)&&!name.endsWith('/')));
const source={...baseline};
const approved=[
  'public/app.js','public/index.html','public/receivables-ui.js','public/opportunity-finance-ui.js',
  'public/accountant-workspace-ui.js','public/commission-payout-ui.js','src/commission-receivables.js',
  'src/receivables-domain.js','src/receivable-receipt-posting.js','src/routes/commission-payout.js',
  'src/accountant-access.js','src/auth.js','src/migrations/119_invoice_payment_auto_confirmation.sql',
  'src/migrations/120_commission_payment_batches.sql'
];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const pkg=JSON.parse(Buffer.from(baseline[name]).toString());pkg.version='2.1.0-dev.189';
  if(pkg.packages?.[''])pkg.packages[''].version=pkg.version;
  source[name]=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
const migrations=Object.keys(source).filter(name=>name.startsWith('src/migrations/')).sort();
if(migrations.length!==120||!migrations.at(-1).endsWith('120_commission_payment_batches.sql'))throw Error('Unexpected migration set');
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
const stem='nysa-core-consolidated-crm-test-dev189-r4',zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.189',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,
  target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',
  liveBaselineVersion:'2.1.0-dev.188',sourceBaselineVersion:'2.1.0-dev.188',sourceBaselinePackageSha256:sha(baselineBytes),baselineMigration:'118_dev186_187_receivable_workflow.sql',
  newMigrations:['119_invoice_payment_auto_confirmation.sql','120_commission_payment_batches.sql'],latestMigration:'120_commission_payment_batches.sql',migrationCount:120,migrationNeutral:false,
  requirements:['Post-dev188 Receivables clarity and payment evidence corrections','Decimal K/M shorthand for monetary inputs','Automatic invoice-payment confirmation and instalment agent-credit basis','Commission Payments shared Accountant/MD table','Consolidated MD approval with row selection and deferral','Accountant payment recording after MD approval','Softer NYSA navy-to-teal visual treatment','Closed Won commission-receivable selector with customer or payer and outstanding amount','Automatic NYSA-INV invoice numbering'],
  excluded:['performance management','campaign management','Production','R2 clone','Property Finder'],
  changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
