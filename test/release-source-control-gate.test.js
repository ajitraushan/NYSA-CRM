import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('release builder uses an advertised origin commit and never the caller working tree',()=>{
  const gate=fs.readFileSync('tools/verify-release-source-control.mjs','utf8');
  const builder=fs.readFileSync('tools/build-release-from-origin.mjs','utf8');
  assert.match(gate,/Deprecated release gate/);
  assert.match(builder,/ls-remote/);
  assert.match(builder,/withDetachedCheckout/);
  assert.match(builder,/assertAdvertisedCommit/);
  assert.match(builder,/repositoryUrl/);
  assert.doesNotMatch(builder,/status','--porcelain=v1/);
});
