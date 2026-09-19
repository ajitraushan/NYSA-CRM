import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('release builder is guarded by a clean pushed source commit',()=>{
  const gate=fs.readFileSync('tools/verify-release-source-control.mjs','utf8');
  const builder=fs.readFileSync('tools/build-isolated-dev208.mjs','utf8');
  assert.match(gate,/status','--porcelain=v1'/);
  assert.match(gate,/ls-remote','--heads'/);
  assert.match(gate,/ajitraushan\\\/NYSA-CRM/);
  assert.match(builder,/verify-release-source-control\.mjs/);
  assert.match(builder,/sourceCommit/);
});
