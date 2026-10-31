import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import{execFileSync}from'node:child_process';import{pathToFileURL}from'node:url';
process.umask(0o077);
if(process.argv[2]&&!['--production-stage'].includes(process.argv[2]))throw Error('Unknown staging target');
const zip='/home/nysareal/nysa-core-2.1.0-dev.251-origin.zip',root='/home/nysareal/crm-release-preparation/20261031-ui001/'+(process.argv[2]==='--production-stage'?'production-candidate-dev251':'candidate-dev251'),expected='749f077d323d846c9e468aafe5ef31f1d215eed9afdde98baca9c8bc5e12178a',commit='8f722679c92eabcd2efb6cef824d5225b28dbcf4';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(process.platform!=='linux'||hash(zip)!==expected)throw Error('Hosting archive integrity gate failed');
fs.mkdirSync(root,{mode:0o700});
const entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');if(entries.some(x=>x.startsWith('/')||x.split('/').includes('..')))throw Error('Unsafe archive path');
execFileSync('unzip',['-q',zip,'-d',root]);
const p=JSON.parse(fs.readFileSync(root+'/RELEASE_PROVENANCE.json'));if(p.commit!==commit||p.version!=='2.1.0-dev.251'||p.testReceipt.failed!==0||p.migrationCount!==159)throw Error('Provenance mismatch');
let files=0;for(const line of fs.readFileSync(root+'/RUNTIME_MANIFEST.sha256','utf8').trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})  (.+)$/);if(!m||m[2].split('/').includes('..')||hash(root+'/'+m[2])!==m[1])throw Error('Runtime hash mismatch');files++;}
const env={...process.env,PATH:'/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin:'+process.env.PATH};
try{fs.writeFileSync(root+'/PRIVATE_NPM_INSTALL.log',execFileSync('/home/nysareal/nodevenv/nysa-core-dashboard-dd6262a-stage/24/bin/npm',['ci','--omit=dev','--ignore-scripts'],{cwd:root,env,maxBuffer:16*1024*1024}));}
catch(error){fs.writeFileSync(root+'/PRIVATE_NPM_INSTALL.log',Buffer.concat([error.stdout||Buffer.alloc(0),error.stderr||Buffer.alloc(0)]));throw Error('Private candidate dependency installation failed');}
process.chdir(root);const {verifyApprovedDocumentRuntime}=await import(pathToFileURL(root+'/src/approved-document-runtime-smoke.js'));const pdfFormats=await verifyApprovedDocumentRuntime();
const receipt={result:'PRIVATE_CANDIDATE_VERIFIED',root,commit,version:p.version,archiveSha256:expected,runtimeFiles:files,pdfFormats,applicationMutation:false,databaseMutation:false};fs.writeFileSync(path.dirname(root)+'/CANDIDATE_STAGING.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
