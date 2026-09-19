import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev205-r3-only-20260919');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const baselineName='nysa-core-consolidated-crm-test-dev204-r1.zip';
const baselineBytes=await fs.readFile(path.join(output,baselineName));
if(sha(baselineBytes)!=='9286d5697ea12fe7dcfed2b79bf5c464ab78c02b70df5e17fde37a7138e80840')throw Error('deployed DEV204 baseline identity mismatch');
const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const baseline=Object.fromEntries(Object.entries(unzipSync(baselineBytes)).filter(([name])=>runtime(name)&&!name.endsWith('/')));
const source={...baseline};
const approved=['public/agent-leave-ui.js','public/app.js','src/agent-leave-domain.js','src/auth.js','src/crm-policy.js','src/role-access.js','src/routes/agent-leave.js'];
for(const name of approved)source[name]=await fs.readFile(path.join(root,name));
for(const name of ['package.json','package-lock.json']){
  const pkg=JSON.parse(Buffer.from(baseline[name]).toString());
  pkg.version='2.1.0-dev.205';
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
  files.push({path:name,sha256:sha(source[name]),bytes:source[name].length,runtimeInstall:true});
  runtimeManifest.push(`${sha(source[name])}  ${name}`);
}
entries['RUNTIME_MANIFEST.sha256']=Buffer.from(runtimeManifest.join('\n')+'\n');
entries['MANIFEST.sha256']=Buffer.from([...runtimeManifest,`${sha(entries['RUNTIME_MANIFEST.sha256'])}  RUNTIME_MANIFEST.sha256`].join('\n')+'\n');
const stem='nysa-core-consolidated-crm-test-dev205-r3';
const zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
const manifest={version:'2.1.0-dev.205',revision:'R3 modular access policy and decoupled governed-workspace bootstrap; R1/R2 superseded and must not be deployed',package:stem+'.zip',packageSha256:sha(zip),bytes:zip.length,target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',liveBaselineVersion:'2.1.0-dev.204',sourceBaselineVersion:'2.1.0-dev.204',sourceBaselinePackageSha256:sha(baselineBytes),baselineMigration:'126_executing_agent_tier_and_social_uplift.sql',newMigrations:[],latestMigration:'126_executing_agent_tier_and_social_uplift.sql',migrationCount:126,migrationNeutral:true,requirements:['Resolve governed roles, capabilities, API access and workspace navigation through a central declarative policy','Boot governed workspaces without calling business classification APIs','Separate Administrator system governance from Managing Director business authority','Give Admin Assistant leave policy employment register and leave-decision responsibility','Resolve leave approver and routing from capability policy, with self-approval prohibited'],excluded:['hard-coded route-level role selection','business calculation changes','database schema changes','historical migration changes','Production','R2 clone','Property Finder'],changedRuntimeFiles:changed,entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.zip'),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${sha(zip)}  ${stem}.zip\n`,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,packageSha256:sha(zip),bytes:zip.length,changed,entryCount:manifest.entryCount},null,2));
