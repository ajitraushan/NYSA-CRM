import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev207-r2-only-20260919');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baselineName='nysa-core-consolidated-crm-test-dev206-r1.zip';
const baselineBytes=await fs.readFile(path.join(output,baselineName));
if(sha(baselineBytes)!=='c1eecba608f05cf9cf2d17041a1234967c490d2e5a5bfdfc7ccff1c4b358457e')throw Error('deployed DEV206 baseline identity mismatch');
const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baselineBytes)).filter(([name])=>runtime(name)&&!name.endsWith('/')));
const source={...baseline};
const approved=[
  'public/app.js','public/commission-payout-ui.js','public/dashboard-ui.js','public/document-compliance-ui.js',
  'public/market-intelligence-ui.js','public/marketing-material-compliance-ui.js','public/opportunity-finance-ui.js','public/receivables-ui.js',
  'src/commission-payout-domain.js','src/commission-proof.js','src/commission-receivables.js','src/crm-policy.js',
  'src/dashboard-domain.js','src/inventory-agent-governance.js','src/listing-workflow-domain.js',
  'src/marketing-material-compliance-domain.js','src/official-document-config-domain.js','src/role-access.js',
  'src/routes/admin.js','src/routes/auth.js','src/routes/campaigns.js','src/routes/classification-catalogue.js',
  'src/routes/comments.js','src/routes/commission-payout.js','src/routes/crm.js','src/routes/dashboards.js',
  'src/routes/diary.js','src/routes/dld-market-intelligence.js','src/routes/document-compliance.js',
  'src/routes/email-calendly.js','src/routes/files-proposals.js','src/routes/governance.js','src/routes/integrations.js',
  'src/routes/inventory-import.js','src/routes/lead-operations.js','src/routes/listing-intake.js','src/routes/listing-mappings.js',
  'src/routes/listings.js','src/routes/marketing-material-compliance.js','src/routes/official-document-evidence.js',
  'src/routes/opportunities.js','src/routes/partner-organizations.js','src/routes/property-finder-sandbox.js',
  'src/routes/qualification-finance.js','src/routes/release3c-governed-shares.js','src/routes/transaction-representation.js',
  'src/routes/website-intake.js'
];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const pkg=JSON.parse(Buffer.from(baseline[name]).toString());
  pkg.version='2.1.0-dev.207';
  if(pkg.packages?.[''])pkg.packages[''].version=pkg.version;
  source[name]=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
const migrations=Object.keys(source).filter(name=>name.startsWith('src/migrations/')).sort();
if(migrations.length!==126||!migrations.at(-1).endsWith('126_executing_agent_tier_and_social_uplift.sql'))throw Error('Unexpected migration set');
const changed=Object.keys(source).filter(name=>!baseline[name]||sha(source[name])!==sha(baseline[name])).sort();
const expected=[...approved,'package.json','package-lock.json'].sort();
if(JSON.stringify(changed)!==JSON.stringify(expected))throw Error(`Unexpected runtime delta: ${JSON.stringify(changed)}`);
await fs.mkdir(isolated,{recursive:false});
for(const [name,bytes] of Object.entries(source)){
  const destination=path.join(isolated,name);
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.writeFile(destination,bytes);
}
for(const directory of ['test','tools','scripts','schema-proposals']){
  try{await fs.cp(path.join(root,directory),path.join(isolated,directory),{recursive:true});}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
for(const name of ['AGENTS.md','CRM_CHANGE_POLICY.md','BASELINE.md','GIT_ALLOWED_SIGNERS']){
  try{await fs.copyFile(path.join(root,name),path.join(isolated,name));}
  catch(error){if(error.code!=='ENOENT')throw error;}
}
await fs.symlink(path.join(root,'release-artifacts'),path.join(isolated,'release-artifacts'),'junction');
const entries={...source},files=[],runtimeManifest=[];
for(const name of Object.keys(source).sort()){
  files.push({path:name,baselineSha256:baseline[name]?sha(baseline[name]):null,sha256:sha(source[name]),bytes:source[name].length,runtimeInstall:true,changed:changed.includes(name)});
  runtimeManifest.push(`${sha(source[name])}  ${name}`);
}
entries['RUNTIME_MANIFEST.sha256']=Buffer.from(runtimeManifest.join('\n')+'\n');
entries['MANIFEST.sha256']=Buffer.from([...runtimeManifest,`${sha(entries['RUNTIME_MANIFEST.sha256'])}  RUNTIME_MANIFEST.sha256`].join('\n')+'\n');
const stem='nysa-core-consolidated-crm-test-dev207-r2';
const zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.207',revision:'R1 source-level Admin business-access removal and role terminology consistency',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',liveBaselineVersion:'2.1.0-dev.206',sourceBaselineVersion:'2.1.0-dev.206',sourceBaselinePackage:baselineName,sourceBaselinePackageSha256:sha(baselineBytes),baselineMigration:'126_executing_agent_tier_and_social_uplift.sql',newMigrations:[],latestMigration:'126_executing_agent_tier_and_social_uplift.sql',migrationCount:126,migrationNeutral:true,requirements:['Remove dormant Admin and retired Assistant permissions from operational business modules','Keep Admin limited to configuration and governed leave administration','Assign business review and company-wide workflows to the existing Manager or Managing Director roles','Use Admin consistently in active user-facing configuration text','Move Property Finder sandbox operations from Admin to Managing Director','Preserve the central fail-closed access policy and add source-level regression checks'],excluded:['business calculation changes','database schema changes','historical migration changes','automatic user-role reassignment','Production','R2 clone','live CRM Test deployment without explicit confirmation'],changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
