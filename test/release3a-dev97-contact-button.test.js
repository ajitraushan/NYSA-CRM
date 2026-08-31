import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('dev.97 exposes contact credibility refresh to the serving Lead broker at both boundaries',()=>{
  const crm=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(crm,/canRefreshContactCredibility=.*leads\.some\(lead=>canWriteLead\(req\.broker,lead\)\)/);
  assert.match(crm,/serviceLeads\.some\(lead=>canWriteLead\(req\.broker,lead\)\)/);
  assert.match(crm,/serving Lead broker/);
  assert.match(ui,/KYC and contact verification[\s\S]*Pre-KYC email evidence:[\s\S]*Run pre-KYC email check[\s\S]*Run paid Apollo professional check/);
  assert.doesNotMatch(ui,/<span>Contact credibility<\/span>/);
});

test('dev.97 CRM Test deployment accepts dev.96, preserves migration 068 and retries stable PID evidence',()=>{
  const script=fs.readFileSync(new URL('../release-artifacts/release-3/r3a/deploy-crm-test-r3a-dev97-complete.sh',import.meta.url),'utf8');
  assert.match(script,/EXPECTED_VERSION=2\.1\.0-dev\.97/);
  assert.match(script,/EXPECTED_PACKAGE=nysa-core-r3a-contact-credibility-dev97\.zip/);
  assert.match(script,/2\.1\.0-dev\.96\|2\.1\.0-dev\.97/);
  assert.match(script,/worker_has_apollo_key/);
  assert.match(script,/APOLLO_API_KEY could not be verified on one stable new CRM Test worker/);
  assert.match(script,/protected_migrations\+=\("\$LATEST_MIGRATION"\)/);
  assert.doesNotMatch(script,/\/dev\/fd|<\(/);
});
