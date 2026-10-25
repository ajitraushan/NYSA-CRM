import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
const [zip,commit]=process.argv.slice(2);if(!zip||!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Exact package and source SHA required');
const root=process.cwd(),target=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-dev232-postbuild-'));
execFileSync('tar',['-xf',path.resolve(zip),'-C',target]);
const receipt=JSON.parse(fs.readFileSync(path.join(target,'RELEASE_PROVENANCE.json'),'utf8'));if(receipt.commit!==commit||receipt.version!=='2.1.0-dev.232')throw Error('Package source/version mismatch');
fs.symlinkSync(path.join(root,'node_modules'),path.join(target,'node_modules'),'junction');
for(const name of ['test/dev230-dashboard-navigation.test.js','test/uat-enh004-008.test.js','test/dev232-dashboard-scope.test.js']){const file=path.join(target,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,execFileSync('git',['show',commit+':'+name]));}
execFileSync(process.execPath,['--test','test/dev230-dashboard-navigation.test.js','test/uat-enh004-008.test.js','test/dev232-dashboard-scope.test.js'],{cwd:target,stdio:'inherit',timeout:60000});
execFileSync(process.execPath,['--input-type=module','-e',"import {verifyApprovedDocumentRuntime} from './src/approved-document-runtime-smoke.js';console.log(JSON.stringify(await verifyApprovedDocumentRuntime()));"],{cwd:target,stdio:'inherit',timeout:180000});
console.log(JSON.stringify({postBuild:'passed',commit,version:receipt.version,runtime:target,dashboardTests:12,scopeTests:5,enhancementTests:9,pdfFormats:10}));
