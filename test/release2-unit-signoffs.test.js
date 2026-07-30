import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(readFileSync(resolve(root,'docs/RELEASE_2_UNIT_SIGNOFFS.json'),'utf8'));

test('every Release 2 unit has explicit owner acceptance and durable evidence',()=>{
  const expected=['R2.1A','R2.2','R2.3','R2.3A','R2.3B','R2.4A','R2.5','R2.6'];
  assert.deepEqual(manifest.units.map(unit=>unit.id),expected);
  for(const unit of manifest.units){
    assert.equal(unit.status,manifest.signoffPolicy.requiredStatus,`${unit.id} status`);
    assert.equal(unit.authority,manifest.signoffPolicy.requiredAuthority,`${unit.id} authority`);
    assert.match(unit.acceptedVersion,/^\d+\.\d+\.\d+-dev\.\d+(?:\.\d+)?$/);
    assert.ok(unit.evidence.length>0,`${unit.id} evidence`);
    for(const evidence of unit.evidence)
      assert.ok(existsSync(resolve(root,evidence)),`${unit.id} missing evidence ${evidence}`);
  }
  assert.equal(manifest.signoffPolicy.cryptographicSigning,'not_configured');
  assert.match(manifest.signoffPolicy.cryptographicSigningReason,/No GPG program/);
});

test('unit migration ownership is exact, ordered and covers 038 through 059 once',()=>{
  const migrations=manifest.units.flatMap(unit=>unit.migrations);
  assert.equal(migrations.length,22);
  assert.equal(new Set(migrations).size,22);
  assert.deepEqual(
    migrations.map(name=>Number.parseInt(name.slice(0,3),10)),
    Array.from({length:22},(_,index)=>index+38)
  );
  for(const migration of migrations)
    assert.ok(existsSync(resolve(root,'src/migrations',migration)),`missing ${migration}`);
});

test('frozen R2.6 signoff binds the accepted version and exact candidate digest',()=>{
  const release=manifest.units.find(unit=>unit.id==='R2.6');
  assert.equal(release.acceptedVersion,'2.1.0-dev.79');
  assert.equal(release.sourceCommit,'5669016');
  assert.equal(release.sourceBaselineCommit,'9073206');
  assert.equal(release.candidateSha256,'689d089b357f8f9c956c329c44e592712e26becff10a9b0efbc77d8bc074836f');
  const checksum=readFileSync(
    resolve(root,'release-artifacts/release-2/r2.6/production-candidate/nysa-core-r2-6-production-candidate-dev79-9073206.sha256.txt'),
    'utf8'
  ).trim().split(/\s+/)[0];
  assert.equal(checksum,release.candidateSha256);
});
