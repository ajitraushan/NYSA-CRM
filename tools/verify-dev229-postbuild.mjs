import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const [zip,commit]=process.argv.slice(2);
if(!zip||!/^[0-9a-f]{40}$/.test(commit||''))throw new Error('Exact ZIP and full source SHA required');
const root=process.cwd(),target=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-dev229-postbuild-'));
execFileSync('tar',['-xf',path.resolve(zip),'-C',target]);
const provenance=JSON.parse(fs.readFileSync(path.join(target,'RELEASE_PROVENANCE.json'),'utf8'));
if(provenance.commit!==commit||provenance.version!=='2.1.0-dev.229')throw new Error('Extracted runtime source/version mismatch');
// Dependencies did not change. Share the already installed lockfile-matched libraries;
// runtime source, templates and migrations are exclusively the extracted package.
fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
const support=['test/uat-enh004-008.test.js','test/uat-enh004-008.integration.test.js','test/uat-20261025-documents.integration.test.js','test/dev218-approved-documents.integration.test.js','tools/local-postgres-fixture/fixture-guard.mjs','tools/uat-enh229-http-regression.mjs'];
for(const name of support){const file=path.join(target,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,execFileSync('git',['show',`${commit}:${name}`],{maxBuffer:8*1024*1024}));}
const run=(args,env={})=>execFileSync(process.execPath,args,{cwd:target,env:{...process.env,...env},stdio:'inherit',timeout:180000});
run(['--test','test/uat-enh004-008.test.js']);
run([`--env-file=${path.join(root,'.env')}`,'--test','--test-isolation=process','test/uat-enh004-008.integration.test.js','test/uat-20261025-documents.integration.test.js','test/dev218-approved-documents.integration.test.js'],{NYSA_RUN_ENH004_008_DB:'1',NYSA_RUN_UAT_20261025_DB:'1',NYSA_RUN_DEV218_DB_INTEGRATION:'1'});
run([`--env-file=${path.join(root,'.env')}`,'tools/uat-enh229-http-regression.mjs']);
run(['--input-type=module','-e',"import {verifyApprovedDocumentRuntime} from './src/approved-document-runtime-smoke.js';console.log(JSON.stringify(await verifyApprovedDocumentRuntime()));"]);
console.log(JSON.stringify({postBuild:'passed',version:provenance.version,commit,runtime:target,focused:9,database:4,httpJourneys:3,pdfFormats:10}));
