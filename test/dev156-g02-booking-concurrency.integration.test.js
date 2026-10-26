import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const enabled=process.env.NYSA_RUN_DB_INTEGRATION==='1';

test('G-02 two concurrent reservation requests against accepted Offers produce one winner without changing either Negotiation acceptance',{
  skip:enabled?false:'Set NYSA_RUN_DB_INTEGRATION=1 with dedicated PostgreSQL test credentials'
},async()=>{
  for(const name of ['PGDATABASE','PGUSER','PGPASSWORD'])assert.ok(process.env[name],`${name} is required`);
  assert.match(process.env.PGDATABASE,/test|fixture|ci/i,'Refusing to mutate a database not explicitly named as test, fixture or CI');

  const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))).replaceAll('\\','/');
  process.env.NYSA_APP_ROOT=root;
  const priorExitCode=process.exitCode;
  process.exitCode=undefined;
  try{
    await import(`../release-artifacts/release-3/consolidated/dev154-live-db-integration.mjs?permanent-test=${Date.now()}`);
    assert.notEqual(process.exitCode,1,'The live G-02 integration script reported a failure');
  }finally{
    process.exitCode=priorExitCode;
  }
});
