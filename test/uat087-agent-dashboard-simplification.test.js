import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('UAT-087 puts Agent navigation and actions directly below the dashboard heading',()=>{
  const ui=read('public/dashboard-ui.js'),html=read('public/index.html');
  assert.match(ui,/const agentCommandBar=likelyType==='agent'/);
  assert.match(ui,/agent-dashboard-command-bar/);
  assert.ok(ui.indexOf('${agentCommandBar}')<ui.indexOf('<div class="dashboard-workspace">'));
  assert.match(ui,/\$\{tabsMarkup\}\$\{actionsMarkup\}/);
  assert.match(ui,/agent-dashboard-filter-drawer/);
  assert.match(html,/\.agent-dashboard-command-bar\{position:sticky/);
});

test('UAT-087 reduces Agent density through progressive disclosure without removing information',()=>{
  const ui=read('public/dashboard-ui.js');
  for(const marker of ['customer-priority-card-compact','customer-priority-context','x.source','x.campaignCode','x.whyNow','x.consequence','priorityCountdown(x)','data-guided-lead'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['agent-performance-disclosure','performanceMarkup','agent-dashboard-reference','Qualification priorities','Task counts','Operational exceptions','Recent customer activity'])assert.match(ui,new RegExp(marker));
  assert.match(ui,/Open only the information needed for the current decision/);
});

test('UAT-088 preserves formatted values so conversion rate cannot render as NaN',()=>{
  const ui=read('public/dashboard-ui.js');
  assert.match(ui,/const dashboardValue=value=>typeof value==='string'/);
  assert.match(ui,/Number\.isFinite\(Number\(value\)\)/);
  assert.match(ui,/\$\{dashboardValue\(row\.value\)\}/);
  assert.match(ui,/Warm conversion rate',value:`\$\{n\(data\.qualification\.warmConversionRate\)\}%`/);
  assert.doesNotMatch(ui,/<td>\$\{n\(row\.value\)\}<\/td>/);
});
