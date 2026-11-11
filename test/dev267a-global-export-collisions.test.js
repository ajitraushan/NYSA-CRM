import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=file=>fs.readFileSync(file,'utf8');

test('app top-level function declarations do not collide with feature window exports',()=>{
  const app=read('public/app.js');
  const modules=['prospect-diary-ui.js','dashboard-ui.js','review-task-ui.js','director-commission-summary-ui.js','customer-lookup-ui.js','finance-workspace-ui.js','shared-review-panel.js','accountant-workspace-ui.js','purchased-data-import-ui.js','whatsapp-workspace-ui.js','offer-ui.js','deal-ui.js','inventory-workspace-ui.js','official-document-ui.js','market-intelligence-ui.js','commission-payout-ui.js','receivables-ui.js','opportunity-finance-ui.js','agent-leave-ui.js','document-compliance-ui.js','marketing-material-compliance-ui.js','matching-completion-ui.js','email-calendly-ui.js','lead-integration-ui.js','lead-response-dev244-ui.js','incoming-leads-ui.js','web-intake-phase1-ui.js'];
  const declarations=new Set([...app.matchAll(/(?:^|\n)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match=>match[1]));
  const exports=new Set(modules.flatMap(file=>[...read(`public/${file}`).matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(match=>match[1])));
  const collisions=[...declarations].filter(name=>exports.has(name)).sort();
  assert.deepEqual(collisions,[]);
  assert.match(app,/function renderProspectDiaryWorkspace\(\)/);
  assert.doesNotMatch(app,/function renderProspectDiary\(\)/);
});

test('dashboard feature-module exports are isolated and app dashboard remains the effective shell implementation',()=>{
  const app=read('public/app.js'),dashboard=read('public/dashboard-ui.js');
  assert.match(app,/async function renderCrmDashboard\(/);
  assert.match(app,/async function openDashboardRecords\(/);
  assert.match(dashboard,/window\.renderDashboardFeatureModule=async function/);
  assert.match(dashboard,/window\.openDashboardRecordsFeatureModule=async function/);
  assert.doesNotMatch(dashboard,/window\.renderCrmDashboard\s*=/);
  assert.doesNotMatch(dashboard,/window\.openDashboardRecords\s*=/);
  for(const name of ['renderDashboardFeatureModule','openDashboardRecordsFeatureModule']){
    const outside=[...fs.readdirSync('public').filter(file=>file.endsWith('.js')&&file!=='dashboard-ui.js').flatMap(file=>[...read(`public/${file}`).matchAll(new RegExp(`\\b${name}\\b`,'g'))].map(()=>file))];
    assert.deepEqual(outside,[],`${name} gained a caller outside dashboard-ui.js: ${outside.join(', ')}`);
  }
});
