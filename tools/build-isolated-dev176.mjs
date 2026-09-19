import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {zipSync,unzipSync} from 'fflate';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'release-artifacts/release-3/consolidated');
const isolated=path.join(root,'tmp/dev176-only-20260902');
const snapshot=path.join(root,'remediation-baselines/dev176-before-receivables-20260902/source-and-evidence.zip');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const snapshotBytes=await fs.readFile(snapshot),baselineBytes=await fs.readFile(path.join(output,'nysa-core-consolidated-crm-test-dev175.zip'));
if(hash(snapshotBytes)!=='03f34219c56f78fa1d7951cdec8e95c33d9ebdc257c355b9748f1cc74d2a45e9')throw Error('Snapshot identity changed');
if(hash(baselineBytes)!=='80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b')throw Error('Baseline identity changed');
const unpack=bytes=>Object.fromEntries(Object.entries(unzipSync(bytes)).filter(([name])=>!name.endsWith('/')).map(([name,content])=>{
  name=name.replaceAll('\\','/');
  if(name.startsWith('/')||name.includes(':')||name.split('/').includes('..'))throw Error('Unsafe archive entry');return[name,content];
}));
const baseline=unpack(baselineBytes),saved=unpack(snapshotBytes);
const runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/');
const source={...Object.fromEntries(Object.entries(baseline).filter(([name])=>runtime(name))),...saved};
if(JSON.parse(Buffer.from(source['package.json'])).version!=='2.1.0-dev.176')throw Error('Not a dev.176 source snapshot');
const changed=[];
for(const [name,bytes] of Object.entries(source))if(runtime(name)&&(!baseline[name]||hash(bytes)!==hash(baseline[name])))changed.push(name);
const allowed=['package.json','package-lock.json','public/app.js','public/commission-payout-ui.js','public/index.html','src/commission-payout-domain.js','src/routes/commission-payout.js','src/commission-proof.js','src/migrations/112_dev176_commission_proof.sql'];
if(changed.some(name=>!allowed.includes(name))||allowed.some(name=>!changed.includes(name)))throw Error('Unexpected runtime change set: '+JSON.stringify(changed));
for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/')&&hash(source[name])!==hash(bytes))throw Error('Applied migration changed: '+name);
if(Object.keys(source).some(name=>/receivables|dev177|113_dev/.test(name)))throw Error('Future finance source found');
await fs.mkdir(isolated,{recursive:false});
for(const [name,bytes] of Object.entries(source)){
  const destination=path.join(isolated,name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);
}
const evidence=['docs/CRM_TEST_DEV176_COMMISSION_PROOF_REMEDIATION.md','docs/ACCOUNTANT_RECEIPT_WORKFLOW.md','test/dev176-commission-proof.integration.test.js','test/dev176-commission-date.test.js','test/dev159-uat067-068-real-db.integration.test.js','docs/CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md','docs/CRM_TEST_DEV174_POST_DEV173_DEFECT_CONSOLIDATION.md'];
const entries={},files=[],all=[],installed=[];
for(const name of Object.keys(source).filter(name=>runtime(name)||evidence.includes(name)).sort()){
  if(name==='.env'||name.startsWith('storage/')||name.startsWith('node_modules/'))throw Error('Private file in package');
  const bytes=source[name],sha256=hash(bytes);entries[name]=bytes;files.push({path:name,sha256,bytes:bytes.length,runtimeInstall:runtime(name)});all.push(`${sha256}  ${name}`);if(runtime(name))installed.push(`${sha256}  ${name}`);
}
const migrations=files.filter(file=>file.path.startsWith('src/migrations/')).map(file=>file.path).sort();
if(migrations.length!==112||!migrations.at(-1).endsWith('112_dev176_commission_proof.sql'))throw Error('Unexpected migration inventory');
entries['RUNTIME_MANIFEST.sha256']=Buffer.from(installed.join('\n')+'\n');all.push(`${hash(entries['RUNTIME_MANIFEST.sha256'])}  RUNTIME_MANIFEST.sha256`);
files.push({path:'RUNTIME_MANIFEST.sha256',sha256:hash(entries['RUNTIME_MANIFEST.sha256']),bytes:entries['RUNTIME_MANIFEST.sha256'].length,runtimeInstall:false});
entries['MANIFEST.sha256']=Buffer.from(all.join('\n')+'\n');
const packageName='nysa-core-consolidated-crm-test-dev176.zip',stem=packageName.slice(0,-4),zip=zipSync(entries,{level:9,mtime:new Date('1980-01-01T00:00:00Z')});
await fs.writeFile(path.join(output,packageName),zip,{flag:'wx'});
await fs.writeFile(path.join(output,stem+'.sha256.txt'),`${hash(zip)}  ${packageName}\n`,{flag:'wx'});
const manifest={release:'NYSA CORE dev.176 only — commission proof remediation',version:'2.1.0-dev.176',package:packageName,packageSha256:hash(zip),bytes:zip.length,target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',baselineVersion:'2.1.0-dev.175',baselineMigration:'111_dev175_stage_draft_audit.sql',latestMigration:'112_dev176_commission_proof.sql',migrationCount:112,sourceSnapshotSha256:hash(snapshotBytes),baselinePackageSha256:hash(baselineBytes),sourceState:'Immutable dev176 pre-receivables snapshot; unchanged root runtime from exact dev175 package',excluded:['dev177 receivables','new Accountant permission changes','new payout approval request flow','commission-independent closure','Production','R2 clone','Property Finder'],verification:{historicalOrdinary:{total:1315,passed:1268,skippedProtected:47,failed:0},historicalSeparateDatabase:{proof:5,priorUat:11,governedClosure:2},humanUat:'Pending; not inferred'},changedRuntimeFiles:changed.sort(),entryCount:Object.keys(entries).length,files};
await fs.writeFile(path.join(output,stem+'.manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({isolated,package:path.join(output,packageName),sha256:hash(zip),bytes:zip.length,entryCount:manifest.entryCount,changedRuntimeFiles:manifest.changedRuntimeFiles},null,2));
