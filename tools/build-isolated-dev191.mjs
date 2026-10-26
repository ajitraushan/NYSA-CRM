import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev191-r10-only-20260905');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baselineName='nysa-core-consolidated-crm-test-dev190-r6.zip';
const baselineBytes=await fs.readFile(path.join(output,baselineName));
if(sha(baselineBytes)!=='220c14b96cb8650d30c716acf75e4e857f06893def782421fe58eb62a94d171f')throw Error('dev190 baseline identity mismatch');

const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baselineBytes)).filter(([name])=>runtime(name)&&!name.endsWith('/')));
const source={...baseline};
const approved=[
  'public/app.js','public/receivables-ui.js','src/commission-invoice-pdf.js','src/commission-receivables.js',
  'src/organization-domain.js','src/proposal-pdf.js','src/routes/crm.js','src/routes/governance.js','src/migrations/122_commission_invoice_legal_and_bank_details.sql'
];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const pkg=JSON.parse(Buffer.from(baseline[name]).toString());pkg.version='2.1.0-dev.191';
  if(pkg.packages?.[''])pkg.packages[''].version=pkg.version;
  source[name]=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
const migrations=Object.keys(source).filter(name=>name.startsWith('src/migrations/')).sort();
if(migrations.length!==122||!migrations.at(-1).endsWith('122_commission_invoice_legal_and_bank_details.sql'))throw Error('Unexpected migration set');
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
const stem='nysa-core-consolidated-crm-test-dev191-r10',zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.191',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,
  target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',
  liveBaselineVersion:'2.1.0-dev.190',sourceBaselineVersion:'2.1.0-dev.190',sourceBaselinePackageSha256:sha(baselineBytes),baselineMigration:'121_agent_social_media_payout_eligibility.sql',
  newMigrations:['122_commission_invoice_legal_and_bank_details.sql'],latestMigration:'122_commission_invoice_legal_and_bank_details.sql',migrationCount:122,migrationNeutral:false,
  requirements:['NYSA tax invoice follows the supplied reference layout without proposal wording','Invoice shows NYSA trade licence and VAT registration number','VAT registration and bank remittance details are maintained in versioned Administration Organisation Settings','Developer VAT registration and registered address are maintained in Company invoice details','Off-plan invoices must use the Developer linked to the Deal or Inventory','Invoice PDF uses the maintained NYSA logo and generated NYSA-INV reference','NYSA office address appears inside the legal-details table opposite the recipient address','Developer or customer appears only as Invoice To and not in the footnote or signature area','Only the NYSA authorised-signatory line appears at the bottom','Thin NYSA-gold separator appears below the logo and above the invoice-number row','Invoice table borders render at 0.25-point width','Invoice body text is #333333 and table borders are warm off-white','Only the short brokerage-commission description appears below the bank table','All invoice tables use compact single-spaced rows and multiline leading'],
  excluded:['automatic correction of previously issued invoices','performance management','campaign management','Production','R2 clone','Property Finder'],
  changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
