import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createFixturePool,assertDedicatedFixture} from './local-postgres-fixture/fixture-guard.mjs';
const pool=createFixturePool();
try{
 await assertDedicatedFixture(pool);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nysa-before-enh229-fixture-'));
 const file=path.join(directory,'fixture.dump');
 execFileSync('C:/Program Files/PostgreSQL/16/bin/pg_dump.exe',['--format=custom','--no-owner','--no-acl','--file',file],{env:process.env,stdio:['ignore','pipe','pipe']});
 execFileSync('C:/Program Files/PostgreSQL/16/bin/pg_restore.exe',['--list',file],{stdio:['ignore','pipe','pipe']});
 console.log(JSON.stringify({snapshot:file,bytes:fs.statSync(file).size,verified:true}));
}finally{await pool.end();}
