import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fail=message=>{throw new Error(message);};
const resolveRepo=value=>path.resolve(root,String(value));
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sha256Lf=file=>crypto.createHash('sha256').update(Buffer.from(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),'utf8')).digest('hex');
const repoPath=file=>path.relative(root,file).replaceAll('\\','/');
const hash64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

function parseArgs(argv){
  if(argv.length!==2||argv[0]!=='--spec')fail('Usage: node tools/generate-crm-test-deploy-config.mjs --spec <repo-relative-json>');
  return resolveRepo(argv[1]);
}

function atomicWrite(file,bytes){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary=`${file}.tmp`;
  if(fs.existsSync(temporary))fs.rmSync(temporary);
  fs.writeFileSync(temporary,bytes,{flag:'wx'});
  fs.renameSync(temporary,file);
}

const specFile=parseArgs(process.argv.slice(2));
const spec=JSON.parse(fs.readFileSync(specFile,'utf8'));
for(const field of ['sourceConfig','output','proofOutput','packageFile','manifestFile','version','baselineVersion','baselineCommit','operatorCommit','hostPreparationDir','expectedMigrationCount']){
  if(spec[field]===undefined||spec[field]===null||spec[field]==='')fail(`Missing spec field: ${field}`);
}
if(!/^2\.1\.0-dev\.\d+$/.test(spec.version))fail('version must be a DEV release');
if(!/^[a-f0-9]{40}$/.test(spec.baselineCommit)||!/^[a-f0-9]{40}$/.test(spec.operatorCommit))fail('baselineCommit and operatorCommit must be full SHA-1 values');
if(!Number.isInteger(spec.expectedMigrationCount)||spec.expectedMigrationCount<1)fail('expectedMigrationCount must be a positive integer');

const files={
  sourceConfig:resolveRepo(spec.sourceConfig),output:resolveRepo(spec.output),proofOutput:resolveRepo(spec.proofOutput),
  package:resolveRepo(spec.packageFile),manifest:resolveRepo(spec.manifestFile),
  baselineManifest:resolveRepo(spec.baselineSchemaContractManifest||'src/database-schema-baseline/manifest.json'),
  baselineTrigger:resolveRepo(spec.baselineTriggerContract||'src/database-schema-baseline/database-trigger-contract.json'),
  expectedManifest:resolveRepo(spec.expectedSchemaContractManifest||'src/database-schema-contract/manifest.json'),
  expectedColumns:resolveRepo(spec.expectedSchemaContractColumns||'src/database-schema-contract/columns.json'),
  triggerContract:resolveRepo(spec.expectedTriggerContract||'src/database-trigger-contract.json'),
  schemaHelper:resolveRepo(spec.schemaContractHelper||'tools/database-schema-contract.mjs')
};
for(const name of ['sourceConfig','package','manifest','baselineManifest','baselineTrigger','expectedManifest','expectedColumns','triggerContract','schemaHelper']){
  const file=files[name];
  if(!fs.existsSync(file))fail(`${name} file is unavailable: ${repoPath(file)}`);
}
for(const name of ['output','proofOutput'])if(fs.existsSync(files[name]))fail(`${name} path already exists: ${repoPath(files[name])}`);

const source=JSON.parse(fs.readFileSync(files.sourceConfig,'utf8'));
const manifest=JSON.parse(fs.readFileSync(files.manifest,'utf8'));
const baselineManifest=JSON.parse(fs.readFileSync(files.baselineManifest,'utf8'));
const expectedManifest=JSON.parse(fs.readFileSync(files.expectedManifest,'utf8'));
const expectedColumns=JSON.parse(fs.readFileSync(files.expectedColumns,'utf8'));
const triggers=JSON.parse(fs.readFileSync(files.triggerContract,'utf8'));
const expectedTableNames=[...new Set(expectedColumns.entries.map(item=>item.table))].sort();
if(manifest.commit!==spec.commit&&spec.commit)fail(`Manifest commit differs from spec: ${manifest.commit}`);
if(manifest.version!==spec.version)fail(`Manifest version differs from spec: ${manifest.version}`);
if(manifest.packageSha256!==sha256(files.package))fail('Origin manifest does not bind the package bytes');
if(!Number.isInteger(manifest.testReceipt?.passed)||manifest.testReceipt.passed<1||manifest.testReceipt.failed!==0)fail('Origin manifest lacks a successful governed test receipt');
if(source.version!==spec.baselineVersion||source.commit!==spec.baselineCommit)fail('Source config is not the approved installed baseline');
if(source.expectedMigrationCount!==spec.expectedMigrationCount-1)fail('Expected migration count is not exactly one after the accepted baseline');
if(source.expectedPostTableNames?.length!==source.expectedPostTableCount)fail('Source config baseline table names are inconsistent');
if(expectedTableNames.length!==expectedManifest.contracts?.columns?.count&&expectedColumns.count!==expectedManifest.contracts?.columns?.count)fail('Expected columns contract is inconsistent');
if(triggers.triggers?.length!==triggers.triggerCount)fail('Expected trigger contract is inconsistent');
if(baselineManifest.triggers?.file!==path.basename(files.baselineTrigger)||baselineManifest.triggers?.fileSha256!==sha256(files.baselineTrigger))fail('Baseline trigger contract does not match its approved manifest');

const hosted=spec.hostPreparationDir.replace(/\/$/,'');
const config={...source,
  base:`${hosted}/evidence`,candidate:`${hosted}/candidate`,
  zip:`${hosted}/${path.basename(files.package)}`,manifest:`${hosted}/${path.basename(files.manifest)}`,
  version:spec.version,baselineVersion:spec.baselineVersion,baselineCommit:spec.baselineCommit,commit:manifest.commit,
  archiveHash:sha256(files.package),manifestHash:sha256(files.manifest),operatorCommit:spec.operatorCommit,
  baselineMigrationCount:source.expectedMigrationCount,expectedMigrationCount:spec.expectedMigrationCount,
  expectedTableCount:source.expectedPostTableCount,expectedTableNames:source.expectedPostTableNames,
  expectedPostTableCount:expectedTableNames.length,expectedPostTableNames:expectedTableNames,
  baselineTriggers:source.baselineTriggers,
  expectedTriggerCount:triggers.triggerCount,expectedTriggerContractSha256:triggers.canonicalSha256,
  schemaContractHelperPath:'/home/nysareal/crm-deployment-tools/tools/database-schema-contract.mjs',
  schemaContractHelperSha256:sha256Lf(files.schemaHelper),
  baselineSchemaContractManifestSha256:sha256(files.baselineManifest),
  expectedSchemaContractManifestSha256:sha256(files.expectedManifest),
  expectedTestPassed:manifest.testReceipt.passed
};
for(const [field,value] of Object.entries(config).filter(([name])=>/hash|sha256/i.test(name))){
  if(!hash64(value))fail(`${field} must be exactly 64 lowercase hexadecimal characters`);
}
const triggerCanonical=crypto.createHash('sha256').update(JSON.stringify(triggers.triggers)).digest('hex');
if(triggerCanonical!==triggers.canonicalSha256)fail('Trigger contract canonical SHA-256 does not match its entries');

const configBytes=`${JSON.stringify(config,null,2)}\n`;
const checks={
  archiveHash:{file:repoPath(files.package),configured:config.archiveHash,actual:sha256(files.package)},
  manifestHash:{file:repoPath(files.manifest),configured:config.manifestHash,actual:sha256(files.manifest)},
  baselineSchemaContractManifestSha256:{file:repoPath(files.baselineManifest),configured:config.baselineSchemaContractManifestSha256,actual:sha256(files.baselineManifest)},
  baselineTriggerContractFileSha256:{file:repoPath(files.baselineTrigger),configured:baselineManifest.triggers.fileSha256,actual:sha256(files.baselineTrigger),comparison:'raw file SHA-256 pinned by baseline manifest'},
  expectedSchemaContractManifestSha256:{file:repoPath(files.expectedManifest),configured:config.expectedSchemaContractManifestSha256,actual:sha256(files.expectedManifest)},
  schemaContractHelperSha256:{file:repoPath(files.schemaHelper),configured:config.schemaContractHelperSha256,actual:sha256Lf(files.schemaHelper),normalization:'Git/hosting LF'},
  expectedTriggerContractSha256:{file:repoPath(files.triggerContract),configured:config.expectedTriggerContractSha256,actual:triggerCanonical,comparison:'SHA-256(JSON.stringify(triggers))'}
};
for(const [name,check] of Object.entries(checks)){
  check.is64Hex=hash64(check.configured);check.matches=check.is64Hex&&check.configured===check.actual;
  if(!check.matches)fail(`${name} does not match ${check.file}`);
}
const proof={
  schema:'nysa.crm-test.deploy-config-verification.v1',generatedAt:new Date().toISOString(),
  spec:repoPath(specFile),config:repoPath(files.output),configSha256:crypto.createHash('sha256').update(configBytes).digest('hex'),
  allHashFields64Hex:true,allNamedFilesMatch:true,fileChecks:checks,
  database:{baselineMigrationCount:config.baselineMigrationCount,expectedMigrationCount:config.expectedMigrationCount,expectedTableCount:config.expectedTableCount,expectedPostTableCount:config.expectedPostTableCount,baselineTriggerCount:config.baselineTriggers.length,expectedTriggerCount:config.expectedTriggerCount},
  tests:{...manifest.testReceipt},candidate:{version:config.version,commit:config.commit,packageSha256:config.archiveHash,manifestSha256:config.manifestHash}
};
atomicWrite(files.output,configBytes);
atomicWrite(files.proofOutput,`${JSON.stringify(proof,null,2)}\n`);
process.stdout.write(`${JSON.stringify(proof,null,2)}\n`);
