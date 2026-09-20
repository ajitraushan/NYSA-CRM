import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev209-r1-only-20260920');
execFileSync(process.execPath,[path.join(root,'tools/verify-release-source-control.mjs')],{cwd:root,stdio:'inherit'});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baselineName='nysa-core-consolidated-crm-test-dev208-r1.zip';
const baselineBytes=await fs.readFile(path.join(output,baselineName));
if(sha(baselineBytes)!=='989d6b628ee3a06b744012a5cb6a59eddd2db1a37e84642cbb63bb938cad8aa2')throw Error('deployed DEV208 baseline identity mismatch');
const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baselineBytes)).filter(([name])=>runtime(name)&&!name.endsWith('/')));
const source={...baseline};
const approved=[
  'public/app.js','public/index.html','public/purchased-data-import-ui.js',
  'src/auth.js','src/role-access.js','src/routes/agent-leave.js','src/routes/lead-operations.js',
  'src/routes/listings.js','src/routes/purchased-data-import.js'
];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const pkg=JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
  if(pkg.version!=='2.1.0-dev.209'||(pkg.packages?.['']&&pkg.packages[''].version!==pkg.version))throw Error('local version is not DEV209');
  source[name]=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
}
for(const [name,bytes] of Object.entries(baseline)){
  if(name.startsWith('src/migrations/')&&source[name]&&sha(source[name])!==sha(bytes))throw Error('Historical migration changed: '+name);
}
const migrations=Object.keys(source).filter(name=>name.startsWith('src/migrations/')).sort();
if(migrations.length!==127||!migrations.at(-1).endsWith('127_governed_purchased_data_intake.sql'))throw Error('Unexpected migration set');
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
const stem='nysa-core-consolidated-crm-test-dev209-r1';
const zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={
  version:'2.1.0-dev.209',revision:'DEV208 UAT rebuild: runtime defects, access, Inventory, tasks and detached-stage theme',
  sourceCommit,
  package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,target:'CRM Test only',
  expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',
  liveBaselineVersion:'2.1.0-dev.208',sourceBaselineVersion:'2.1.0-dev.208',sourceBaselinePackage:baselineName,
  sourceBaselinePackageSha256:sha(baselineBytes),baselineMigration:'126_executing_agent_tier_and_social_uplift.sql',
  newMigrations:[],latestMigration:'127_governed_purchased_data_intake.sql',
  migrationCount:127,migrationNeutral:true,
  requirements:['Populated Sales Agent leave runtime','Sales Agent Inventory creation','Sales Agent and Admin purchased-data import','Manager closure approvals in My Tasks','Dark detached Opportunity stages','Remove Completed Open page wording'],
  excluded:['historical migration changes','Production','R2 clone','live CRM Test deployment without explicit confirmation'],
  changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files
};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
