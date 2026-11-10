import {execFileSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';import {selectReleaseTests} from './release-test-selection.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),selection=await selectReleaseTests(root);
if(!selection.included.length)throw new Error('No release tests selected');
console.log(`Release tests: ${selection.included.length} included; ${selection.excluded.length} historical local-artifact tests excluded`);
console.log(`Release test selection SHA-256: ${selection.includedSha256}`);
const testEnvironment={
  ...process.env,
  PGDATABASE:process.env.PGDATABASE||'nysa_release_test_contract',
  PGUSER:process.env.PGUSER||'nysa_release_test_contract',
  PGPASSWORD:process.env.PGPASSWORD||'nysa-release-test-contract-only'
};
execFileSync(process.execPath,['--test','--test-isolation=none',...selection.included],{cwd:root,env:testEnvironment,stdio:'inherit',maxBuffer:64*1024*1024});
