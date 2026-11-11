import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectReleaseTests} from '../../tools/release-test-selection.mjs';

const artifactDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(artifactDir,'../..');
const mode=process.argv[2];
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const write=(name,bytes)=>fs.writeFileSync(path.join(artifactDir,name),bytes,{flag:'wx'});
const summaryNumber=(output,name)=>Number(output.match(new RegExp(`ℹ ${name} (\\d+)`))?.[1]||NaN);

if(mode==='governed'){
  const selection=await selectReleaseTests(root);
  const testEnvironment={...process.env,PGDATABASE:process.env.PGDATABASE||'nysa_release_test_contract',PGUSER:process.env.PGUSER||'nysa_release_test_contract',PGPASSWORD:process.env.PGPASSWORD||'nysa-release-test-contract-only'};
  const tapRun=spawnSync(process.execPath,['--test','--test-isolation=none','--test-reporter=tap',...selection.included],{cwd:root,env:testEnvironment,encoding:'utf8',maxBuffer:64*1024*1024});
  const tapOutput=`Release tests: ${selection.included.length} included; ${selection.excluded.length} historical local-artifact tests excluded\nRelease test selection SHA-256: ${selection.includedSha256}\n${tapRun.stdout||''}${tapRun.stderr||''}`;
  const skipped=tapOutput.split(/\r?\n/).map(line=>line.trim()).filter(line=>/^ok \d+ - .+ # SKIP(?:\s|$)/.test(line));
  const tapNumber=name=>Number(tapOutput.match(new RegExp(`^# ${name} (\\d+)$`,'m'))?.[1]||NaN);
  const receipt={schema:'nysa.dev269.governed-test-evidence.v1',reporter:'tap',exitCode:tapRun.status,tests:tapNumber('tests'),passed:tapNumber('pass'),failed:tapNumber('fail'),skipped:tapNumber('skipped'),includedFiles:selection.included.length,excludedFiles:selection.excluded.length,includedFilesSha256:selection.includedSha256,outputSha256:sha256(tapOutput),skipInventoryCount:skipped.length,skipInventorySha256:sha256(`${skipped.join('\n')}\n`)};
  if(tapRun.status!==0||receipt.skipped!==skipped.length)throw new Error(`Governed evidence mismatch: ${JSON.stringify(receipt)}`);
  write('DEV269_GOVERNED_TEST_TAP_OUTPUT.txt',tapOutput);write('DEV269_SKIPPED_TESTS.txt',`${skipped.join('\n')}\n`);write('DEV269_GOVERNED_TEST_RECEIPT.json',`${JSON.stringify(receipt,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt,null,2)}\n`);process.exit(0);
}

if(mode==='pg13'){
  const run=spawnSync(process.execPath,['tools/dev267-prospect-diary-pg13-check.mjs'],{cwd:root,env:process.env,encoding:'utf8',maxBuffer:32*1024*1024});
  const output=`${run.stdout||''}${run.stderr||''}`,receipt={schema:'nysa.dev269.pg13-test-evidence.v1',exitCode:run.status,outputSha256:sha256(output),postgresql13_23:/PostgreSQL 13\.23/.test(output),testPasses:(output.match(/ℹ pass 1/g)||[]).length,testFailures:(output.match(/ℹ fail [1-9]/g)||[]).length,migrations:Number(output.match(/"migrations":(\d+)/)?.[1]),tables:Number(output.match(/"tables":(\d+)/)?.[1]),triggers:Number(output.match(/"triggers":(\d+)/)?.[1])};
  if(run.status!==0||!receipt.postgresql13_23||receipt.testPasses!==5||receipt.testFailures!==0||receipt.migrations!==170||receipt.tables!==306||receipt.triggers!==111)throw new Error(`PostgreSQL evidence mismatch: ${JSON.stringify(receipt)}`);
  write('DEV269_PG13_INTEGRATION_RECEIPT.txt',output);write('DEV269_PG13_INTEGRATION_RECEIPT.json',`${JSON.stringify(receipt,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt,null,2)}\n`);process.exit(0);
}

if(mode==='hashes'){
  const files=[
    '../../BASELINE.md',
    '../origin/nysa-core-2.1.0-dev.269-origin.zip','../origin/nysa-core-2.1.0-dev.269-origin.manifest.json','../origin/nysa-core-2.1.0-dev.269-origin.manifest.sha256.txt',
    'DEV269_D1_PROSPECT_EDIT_RETIRE_AND_FIXES_DESIGN.md','DEV269_D2_APPROVAL_PACKET.md','DEV269_CONFIG_SPEC.json','DEV269_DEPLOY_CONFIG.json','DEV269_CONFIG_HASH_VERIFICATION.json',
    'run-dev269-evidence.mjs','DEV269_GOVERNED_TEST_OUTPUT.txt','DEV269_GOVERNED_TEST_TAP_OUTPUT.txt','DEV269_GOVERNED_TEST_RECEIPT.json','DEV269_SKIPPED_TESTS.txt','DEV269_PG13_INTEGRATION_RECEIPT.txt','DEV269_PG13_INTEGRATION_RECEIPT.json',
    'exact-package-route/DEV269_EXACT_PACKAGE_ROUTE_RESULT.json','exact-package-browser/DEV267A_HOSTED_BOOTSTRAP_BROWSER_RESULT.json','exact-package-browser/sales_agent-prospect-diary-desktop.png','exact-package-browser/sales_agent-prospect-diary-mobile.png','exact-package-browser/manager-prospect-diary-desktop.png','exact-package-browser/manager-prospect-diary-mobile.png'
  ];
  const lines=files.map(relative=>{const file=path.resolve(artifactDir,relative);if(!fs.existsSync(file))throw new Error(`Missing D-2 evidence: ${relative}`);return`${sha256(fs.readFileSync(file))} *${path.relative(root,file).replaceAll('\\','/')}`;});
  const output=`${lines.join('\n')}\n`;fs.writeFileSync(path.join(artifactDir,'DEV269_D2_SHA256SUMS.txt'),output);process.stdout.write(output);process.exit(0);
}

throw new Error('Usage: node release-artifacts/dev269-preparation/run-dev269-evidence.mjs <governed|pg13|hashes>');
