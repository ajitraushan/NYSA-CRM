import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev196-r1-only-20260906');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baselineName='nysa-core-consolidated-crm-test-dev192-r5.zip';
const baselineBytes=await fs.readFile(path.join(output,baselineName));
if(sha(baselineBytes)!=='4f36f775d49324ab0056994386b6362b5c02d01a18ee8f28221147a7c983bfe7')throw Error('dev192 baseline identity mismatch');

const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baselineBytes)).filter(([name])=>runtime(name)&&!name.endsWith('/')));
const source={...baseline};
const approved=[
  'public/commission-payout-ui.js',
  'src/accountant-access.js',
  'src/commission-payout-domain.js',
  'src/commission-payout-sheet-pdf.js',
  'src/routes/commission-payout.js',
  'src/migrations/124_commission_payment_batch_release.sql',
  'src/migrations/125_agent_payout_gross_tier_then_split.sql',
  'src/migrations/126_executing_agent_tier_and_social_uplift.sql'
];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const pkg=JSON.parse(Buffer.from(baseline[name]).toString());pkg.version='2.1.0-dev.196';
  if(pkg.packages?.[''])pkg.packages[''].version=pkg.version;
  source[name]=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
const migrations=Object.keys(source).filter(name=>name.startsWith('src/migrations/')).sort();
if(migrations.length!==126||!migrations.at(-1).endsWith('126_executing_agent_tier_and_social_uplift.sql'))throw Error('Unexpected migration set');
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
const stem='nysa-core-consolidated-crm-test-dev196-r1',zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.196',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,
  target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',
  liveBaselineVersion:'2.1.0-dev.192',sourceBaselineVersion:'2.1.0-dev.192',sourceBaselinePackageSha256:sha(baselineBytes),baselineMigration:'123_agent_payout_calculation_sheet_audit.sql',
  newMigrations:['124_commission_payment_batch_release.sql','125_agent_payout_gross_tier_then_split.sql','126_executing_agent_tier_and_social_uplift.sql'],latestMigration:'126_executing_agent_tier_and_social_uplift.sql',migrationCount:126,migrationNeutral:false,
  requirements:[
    'MD-approved commission rows are aggregated under their approval batch and Accountant records one atomic batch payment',
    'Payout uses gross commission received by NYSA excluding VAT as the tier basis and never the sale price or unpaid Deal commission',
    'The Deal executing Agent owns the quarterly tier and each company receipt is counted once for tier attainment',
    'The achieved tier creates one eligible Agent pool before the frozen originating and servicing split is applied',
    'The five-point social-media uplift applies to tiers one through three only when the executing Agent has a one-hundred-percent Deal share',
    'A split Deal including a seventy-five/twenty-five split receives no social-media uplift for either Agent',
    'The landscape Agent calculation PDF separately discloses property, sale price, full Deal commission, received commission, executing Agent tier, split and tier increase adjustment'
  ],
  excluded:['invoice or receivable business-rule changes','performance management','campaign management','Production','R2 clone','Property Finder'],
  changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
