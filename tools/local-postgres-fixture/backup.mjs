import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {assertDedicatedFixture,createFixturePool} from './fixture-guard.mjs';

if(!['localhost','127.0.0.1','::1'].includes(process.env.PGHOST))throw new Error('Loopback fixture required');
const pool=createFixturePool();
try{await assertDedicatedFixture(pool);}finally{await pool.end();}
const directory=path.resolve('uat-evidence',`fixture-backup-${new Date().toISOString().replace(/[:.]/g,'-')}`);
await fs.mkdir(directory,{recursive:true});
const file=path.join(directory,'before-commission-proof.dump');
const result=spawnSync('pg_dump',['--format=custom','--no-owner','--no-acl','--file',file],{env:process.env,encoding:'utf8',windowsHide:true});
if(result.error||result.status!==0)throw new Error(`Restricted fixture backup failed (${result.error?.code||result.status})`);
const listing=spawnSync('pg_restore',['--list',file],{encoding:'utf8',windowsHide:true});
if(listing.error||listing.status!==0)throw new Error('Fixture backup verification failed');
const bytes=await fs.readFile(file);
console.log(JSON.stringify({file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),verified:true}));
