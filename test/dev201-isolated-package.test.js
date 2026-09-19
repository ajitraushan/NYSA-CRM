import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/,'$1')),'..'),artifact=name=>path.join(root,'release-artifacts/release-3/consolidated',name),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dev201 is a checksum-bound migration-neutral CRM-Test delta from deployed dev200',()=>{const name='nysa-core-consolidated-crm-test-dev201-r1.zip',bytes=fs.readFileSync(artifact(name)),manifest=JSON.parse(fs.readFileSync(artifact(name.replace('.zip','.manifest.json')),'utf8')),checksum=fs.readFileSync(artifact(name.replace('.zip','.sha256.txt')),'utf8').trim();assert.equal(checksum,`${sha(bytes)}  ${name}`);assert.equal(manifest.packageSha256,sha(bytes));assert.equal(manifest.version,'2.1.0-dev.201');assert.equal(manifest.sourceBaselinePackageSha256,'3497a0eecce7fac8af900557986ceab9546810a9a4a0fbb6cbd76e04009902fd');assert.equal(manifest.migrationNeutral,true);assert.deepEqual(manifest.newMigrations,[]);assert.equal(manifest.latestMigration,'126_executing_agent_tier_and_social_uplift.sql');});

test('dev201 package changes only the approved Dubai-date batch-payment runtime files',()=>{const current=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev201-r1.zip'))),baseline=unzipSync(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev200-r1.zip'))),expected=['package-lock.json','package.json','src/routes/commission-payout.js'],runtime=name=>['app.cjs','.env.example','package.json','package-lock.json'].includes(name)||name.startsWith('src/')||name.startsWith('public/'),changed=Object.keys(current).filter(name=>runtime(name)&&!name.endsWith('/')&&(!baseline[name]||sha(current[name])!==sha(baseline[name]))).sort();assert.deepEqual(changed,expected);for(const [name,bytes] of Object.entries(baseline))if(name.startsWith('src/migrations/'))assert.equal(sha(current[name]),sha(bytes),name);assert.equal(JSON.parse(Buffer.from(current['package.json'])).version,'2.1.0-dev.201');});

test('dev201 deployer is dev200 baseline-bound and backup-first',()=>{const deployer=fs.readFileSync(artifact('deploy-crm-test-consolidated-dev201-r1.sh'),'utf8'),manifest=JSON.parse(fs.readFileSync(artifact('nysa-core-consolidated-crm-test-dev201-r1.manifest.json'),'utf8'));assert.match(deployer,/EXPECTED_VERSION=2\.1\.0-dev\.201/);assert.match(deployer,/PREVIOUS_VERSION=2\.1\.0-dev\.200/);assert.ok(deployer.includes(`APPROVED_SHA256=${manifest.packageSha256}`));assert.match(deployer,/pg_dump[\s\S]*pre-dev201\.dump[\s\S]*tar -czf/);assert.match(deployer,/Production and R2 clone snapshots: unchanged/);assert.doesNotMatch(deployer,/\r/);});

