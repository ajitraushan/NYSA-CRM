import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyEmailEvidence } from '../src/email-credibility-domain.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('website Leads display newest first even when qualification differs',()=>{
  const crm=read('src/routes/crm.js');
  assert.match(crm,/WHERE \$\{where\.join\(' AND '\)\}\s+ORDER BY l\.created_at DESC,l\.id DESC LIMIT/);
  assert.doesNotMatch(crm,/CASE l\.temperature WHEN 'Hot' THEN 1 WHEN 'Warm' THEN 2 ELSE 3 END,l\.updated_at DESC/);
});

test('manager assignment queues display the most recent queue entry first',()=>{
  const operations=read('src/routes/lead-operations.js'),crm=read('src/routes/crm.js');
  assert.match(operations,/ORDER BY COALESCE\(l\.last_queue_entered_at,l\.received_at\) DESC,l\.id DESC/);
  assert.match(crm,/crm\/reassignment-queue[\s\S]*ORDER BY l\.created_at DESC,l\.id DESC/);
});

test('consent and website assessment wording states the separate governed controls',()=>{
  const app=read('public/app.js');
  for(const marker of ['Marketing consent','No marketing outreach. Direct responses needed to service this enquiry remain permitted.','Website assessment and CRM qualification are different controls','CRM Qualification remains a governed staff assessment and is not completed automatically.'])assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('UTM and format-valid email evidence do not claim customer input or mailbox verification',()=>{
  const app=read('public/app.js'),bridge=read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/assets/intake-bridge.js');
  assert.match(app,/UTM values are campaign tags captured automatically from the landing-page URL; they are not customer form questions/);
  assert.match(app,/Format only; mailbox ownership and recent use are not verified/);
  for(const field of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])assert.match(bridge,new RegExp(`params\\.get\\('${field}'\\)`));
  const result=classifyEmailEvidence('random.person@yahoo.com',{mxRecords:[{exchange:'mx.example'}]});
  assert.equal(result.status,'credible_domain');
  assert.match(result.reason,/does not verify the person/);
});

test('prior scoped UAT correction remains traceable after the combined follow-up candidate',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.174');
  assert.ok(fs.existsSync(new URL('../src/migrations/074_release3ai_governed_website_routing.sql',import.meta.url)));
  assert.match(read('release-artifacts/release-3/r3a/wordpress-staging/nysa-crm-test-intake-connector/nysa-crm-test-intake-connector.php'),/VERSION = '1.9.4'/);
  const deployment=read('release-artifacts/release-3/r3a/deploy-crm-test-r3ai-dev111-uat-corrections.sh');
  for(const marker of ['EXPECTED_VERSION=2.1.0-dev.111','PREVIOUS_VERSION=2.1.0-dev.110','EXPECTED_PACKAGE=nysa-core-r3ai-uat-corrections-dev111.zip','LATEST_MIGRATION=074_release3ai_governed_website_routing.sql','74|$LATEST_MIGRATION','Production and R2 clone snapshots: unchanged'])assert.match(deployment,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
