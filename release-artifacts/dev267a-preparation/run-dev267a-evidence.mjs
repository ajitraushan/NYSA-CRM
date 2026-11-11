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

if(mode==='governed'){
  const selection=await selectReleaseTests(root);
  const run=spawnSync(process.execPath,['--test','--test-isolation=none',...selection.included],{
    cwd:root,
    env:{...process.env,PGDATABASE:process.env.PGDATABASE||'nysa_release_test_contract',PGUSER:process.env.PGUSER||'nysa_release_test_contract',PGPASSWORD:process.env.PGPASSWORD||'nysa-release-test-contract-only'},
    encoding:'utf8',maxBuffer:64*1024*1024
  });
  const output=`Release tests: ${selection.included.length} included; ${selection.excluded.length} historical local-artifact tests excluded\nRelease test selection SHA-256: ${selection.includedSha256}\n${run.stdout||''}${run.stderr||''}`;
  const skipped=output.split(/\r?\n/).filter(line=>line.includes('# SKIP')||line.includes('# Dedicated local')||line.includes('# Requires restricted')||line.includes('# Set NYSA_'));
  write('DEV267A_GOVERNED_TEST_OUTPUT.txt',output);
  write('DEV267A_SKIPPED_TESTS.txt',`${skipped.join('\n')}\n`);
  const summary={schema:'nysa.dev267a.governed-test-evidence.v1',exitCode:run.status,includedFiles:selection.included.length,excludedFiles:selection.excluded.length,includedFilesSha256:selection.includedSha256,outputSha256:sha256(output),skippedCount:skipped.length,skippedSha256:sha256(`${skipped.join('\n')}\n`)};
  write('DEV267A_GOVERNED_TEST_RECEIPT.json',`${JSON.stringify(summary,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(summary,null,2)}\n`);
  process.exit(run.status??1);
}

if(mode==='pg13'){
  const run=spawnSync(process.execPath,['tools/dev267-prospect-diary-pg13-check.mjs'],{cwd:root,env:process.env,encoding:'utf8',maxBuffer:32*1024*1024});
  const output=`${run.stdout||''}${run.stderr||''}`;
  write('DEV267A_PG13_INTEGRATION_RECEIPT.txt',output);
  const summary={schema:'nysa.dev267a.pg13-test-evidence.v1',exitCode:run.status,outputSha256:sha256(output),postgresql13_23:/PostgreSQL 13\.23/.test(output),testPasses:(output.match(/ℹ pass 1/g)||[]).length,testFailures:(output.match(/ℹ fail [1-9]/g)||[]).length};
  write('DEV267A_PG13_INTEGRATION_RECEIPT.json',`${JSON.stringify(summary,null,2)}\n`);
  process.stdout.write(`${JSON.stringify(summary,null,2)}\n`);
  process.exit(run.status??1);
}

if(mode==='summarize'){
  const governed=fs.readFileSync(path.join(artifactDir,'DEV267A_GOVERNED_TEST_OUTPUT.txt'),'utf8');
  const total=name=>Number(governed.match(new RegExp(`ℹ ${name} (\\d+)`))?.[1]||NaN);
  const fullSkipInventory=fs.readFileSync(path.join(artifactDir,'../dev267-preparation/DEV267_SKIPPED_TESTS.txt'),'utf8');
  const fullSkipLines=fullSkipInventory.trim().split(/\r?\n/);
  const visibleSkipLines=governed.split(/\r?\n/).filter(line=>line.startsWith('﹣'));
  const title=line=>line.replace(/ \([^()]*ms\)(?= #)/,'').replace(/\s+$/,'');
  const expectedTitles=new Set(fullSkipLines.map(title));
  const missingVisible=visibleSkipLines.map(title).filter(line=>!expectedTitles.has(line));
  if(total('fail')!==0||total('skipped')!==fullSkipLines.length||missingVisible.length)throw new Error(`Governed evidence mismatch: failed=${total('fail')} skipped=${total('skipped')} inventory=${fullSkipLines.length} missingVisible=${missingVisible.length}`);
  fs.writeFileSync(path.join(artifactDir,'DEV267A_SKIPPED_TESTS.txt'),fullSkipInventory);
  const governedSummary={schema:'nysa.dev267a.governed-test-evidence.v1',exitCode:0,tests:total('tests'),passed:total('pass'),failed:total('fail'),skipped:total('skipped'),includedFiles:Number(governed.match(/Release tests: (\d+) included/)?.[1]),excludedFiles:Number(governed.match(/; (\d+) historical/)?.[1]),includedFilesSha256:governed.match(/Release test selection SHA-256: ([a-f0-9]{64})/)?.[1],outputSha256:sha256(governed),displayedSkipLines:visibleSkipLines.length,fullSkipInventoryLines:fullSkipLines.length,skippedSha256:sha256(fullSkipInventory)};
  fs.writeFileSync(path.join(artifactDir,'DEV267A_GOVERNED_TEST_RECEIPT.json'),`${JSON.stringify(governedSummary,null,2)}\n`);
  const pg13=fs.readFileSync(path.join(artifactDir,'DEV267A_PG13_INTEGRATION_RECEIPT.txt'),'utf8');
  const pg13Summary={schema:'nysa.dev267a.pg13-test-evidence.v1',exitCode:0,outputSha256:sha256(pg13),postgresql13_23:/PostgreSQL 13\.23/.test(pg13),testPasses:(pg13.match(/ℹ pass 1/g)||[]).length,testFailures:(pg13.match(/ℹ fail [1-9]/g)||[]).length,migrations:Number(pg13.match(/"migrations":(\d+)/)?.[1]),tables:Number(pg13.match(/"tables":(\d+)/)?.[1]),triggers:Number(pg13.match(/"triggers":(\d+)/)?.[1])};
  if(!pg13Summary.postgresql13_23||pg13Summary.testPasses!==5||pg13Summary.testFailures!==0)throw new Error('PostgreSQL receipt summary mismatch');
  fs.writeFileSync(path.join(artifactDir,'DEV267A_PG13_INTEGRATION_RECEIPT.json'),`${JSON.stringify(pg13Summary,null,2)}\n`);
  process.stdout.write(`${JSON.stringify({governed:governedSummary,pg13:pg13Summary},null,2)}\n`);
  process.exit(0);
}

if(mode==='hashes'){
  const files=[
    '../../release-artifacts/origin/nysa-core-2.1.0-dev.268-origin.zip',
    '../../release-artifacts/origin/nysa-core-2.1.0-dev.268-origin.manifest.json',
    '../../release-artifacts/origin/nysa-core-2.1.0-dev.268-origin.manifest.sha256.txt',
    'DEV267A_D1_PROSPECT_DIARY_BOOTSTRAP_AND_API_DESIGN.md',
    'DEV267A_D2_APPROVAL_PACKET.md',
    'DEV267A_CONFIG_SPEC.json',
    'DEV267A_DEPLOY_CONFIG.json',
    'DEV267A_CONFIG_HASH_VERIFICATION.json',
    'DEV267A_GOVERNED_TEST_OUTPUT.txt',
    'DEV267A_GOVERNED_TEST_RECEIPT.json',
    'DEV267A_SKIPPED_TESTS.txt',
    'DEV267A_PG13_INTEGRATION_RECEIPT.txt',
    'DEV267A_PG13_INTEGRATION_RECEIPT.json',
    'exact-package-browser-final/DEV267A_HOSTED_BOOTSTRAP_BROWSER_RESULT.json',
    'exact-package-browser-final/sales_agent-prospect-diary.png',
    'exact-package-browser-final/manager-prospect-diary.png'
  ];
  const lines=files.map(relative=>{const file=path.resolve(artifactDir,relative);if(!fs.existsSync(file))throw new Error(`Missing D-2 evidence: ${relative}`);return`${sha256(fs.readFileSync(file))} *${path.relative(root,file).replaceAll('\\','/')}`;});
  const output=`${lines.join('\n')}\n`;
  write('DEV267A_D2_SHA256SUMS.txt',output);
  process.stdout.write(output);
  process.exit(0);
}

throw new Error('Usage: node release-artifacts/dev267a-preparation/run-dev267a-evidence.mjs <governed|pg13|summarize|hashes>');
