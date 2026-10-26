import {readFile,writeFile,readdir,mkdir,stat} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
import crypto from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';

const root=resolve(new URL('../../..',import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/,'$1'));
const output=resolve(root,'release-artifacts','release-3','consolidated');
const packageName='nysa-core-consolidated-crm-test-dev174.zip';
const stem=packageName.slice(0,-4),version='2.1.0-dev.174';
const evidence=[
  'docs/CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md',
  'docs/CRM_TEST_DEV174_POST_DEV173_DEFECT_CONSOLIDATION.md',
  'docs/CRM_TEST_DEV174_REMEDIATION_AND_DEPLOYMENT_PLAN.md',
  'test/dev174-financial-illustration.test.js',
  'test/dev174-fullscreen-proposal-review.test.js',
  'test/dev174-inventory-parking-spaces.test.js',
  'test/dev174-listing-executive-developer-creation.test.js',
  'test/dev174-manager-agent-lead-boundary.test.js',
  'test/dev174-opportunity-cta-visibility.test.js',
  'test/dev174-opportunity-stage-top-layer.test.js',
  'test/dev174-single-area-maintenance.test.js',
  'test/dev174-value-brief-proposal.test.js',
  'test/dev174-value-brief-return.test.js',
  'test/dev174-consolidated-package.test.js'
];
const scope=['DEF-097','DEF-098','DEF-099','SPEC-GAP-001','DEF-101','DEF-102','DEF-103','DEF-104','DEF-105','DEF-106'];
const runtimeRoots=['.env.example','app.cjs','package.json','package-lock.json','public','src'];
await mkdir(output,{recursive:true});const files=[];
async function walk(target){for(const entry of (await readdir(target,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=join(target,entry.name);if(entry.isDirectory())await walk(file);else if(entry.isFile())files.push(file);}}
for(const item of runtimeRoots){const target=resolve(root,item);(await stat(target)).isDirectory()?await walk(target):files.push(target);}
const data={},archive=[],runtime=[],records=[];
async function add(file,isRuntime){const name=relative(root,file).split(sep).join('/');if(name.startsWith('/')||name.includes('\\')||name.split('/').includes('..'))throw new Error(`unsafe archive path: ${name}`);if(name==='.env'||name.startsWith('storage/')||name.startsWith('node_modules/'))throw new Error(`private/runtime path prohibited: ${name}`);const bytes=await readFile(file),sha256=crypto.createHash('sha256').update(bytes).digest('hex');data[name]=new Uint8Array(bytes);archive.push(`${sha256}  ${name}`);if(isRuntime)runtime.push(`${sha256}  ${name}`);records.push({path:name,sha256,bytes:bytes.length,runtimeInstall:isRuntime});}
for(const file of files.sort())await add(file,true);for(const item of evidence)await add(resolve(root,item),false);
const runtimeManifest=new TextEncoder().encode(`${runtime.join('\n')}\n`),runtimeSha=crypto.createHash('sha256').update(runtimeManifest).digest('hex');data['RUNTIME_MANIFEST.sha256']=runtimeManifest;archive.push(`${runtimeSha}  RUNTIME_MANIFEST.sha256`);records.push({path:'RUNTIME_MANIFEST.sha256',sha256:runtimeSha,bytes:runtimeManifest.length,runtimeInstall:false});data['MANIFEST.sha256']=new TextEncoder().encode(`${archive.join('\n')}\n`);
const zip=zipSync(data,{level:9,mtime:new Date('1980-01-01T00:00:00Z')}),entries=Object.keys(unzipSync(zip));await writeFile(join(output,packageName),zip);const packageSha256=crypto.createHash('sha256').update(zip).digest('hex');await writeFile(join(output,`${stem}.sha256.txt`),`${packageSha256}  ${packageName}\n`);
const migrationNames=entries.filter(name=>/^src\/migrations\/\d{3}_.+\.sql$/.test(name)).sort(),migrationNumbers=migrationNames.map(name=>Number(name.match(/^src\/migrations\/(\d{3})_/)[1]));if(migrationNames.length!==110||migrationNames.at(-1)!=='src/migrations/110_dev174_financial_illustration.sql')throw new Error(`unexpected migration inventory: ${migrationNames.length}/${migrationNames.at(-1)}`);if(new Set(migrationNumbers).size!==migrationNumbers.length)throw new Error('duplicate migration number in candidate');
await writeFile(join(output,`${stem}.manifest.json`),`${JSON.stringify({release:'NYSA CORE consolidated CRM Test candidate',version,package:packageName,packageSha256,sourceBaselineCommit:'a6af2ec2f6b2def3af968682511e671f03b43735',sourceState:'dirty worktree preserved; exact identity is the embedded file manifests',target:'CRM Test only',expectedRoot:'/home/nysareal/nysa-core-dashboard-dd6262a-stage',expectedDatabase:'nysareal_nysa_r2_rehearsal',baselineVersion:'2.1.0-dev.173',baselineMigration:'107_dev169_versioned_opportunity_stage_drafts.sql',latestMigration:'110_dev174_financial_illustration.sql',migrationCount:110,requirements:scope,verification:{ordinary:{total:1291,passed:1261,failed:0,skippedProtected:30},focusedLinkedFunctions:{total:47,passed:47,failed:0},humanUat:'All post-dev.173 items remain pending deployed human retest; no pass inferred'},deploymentPlan:'docs/CRM_TEST_DEV174_REMEDIATION_AND_DEPLOYMENT_PLAN.md',providerState:{propertyFinder:'disabled and excluded',nativeWhatsApp:'not included',microsoft365Email:'disabled pending integration',calendly:'disabled pending integration'},protectedEnvironments:['Production','Production/R2 clone'],zipPathSeparator:'/',entryCount:entries.length,files:records},null,2)}\n`);console.log(JSON.stringify({package:join(output,packageName),packageSha256,entryCount:entries.length,migrationCount:migrationNames.length,latestMigration:migrationNames.at(-1)},null,2));
