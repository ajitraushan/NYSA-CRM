import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/dashboard-ui.js',import.meta.url),'utf8');
const context={window:{},console,setTimeout,clearTimeout,URLSearchParams,FormData};
vm.runInNewContext(source,context,{filename:'public/dashboard-ui.js'});
const hooks=context.window.__nysaDashboardTestHooks;

test('UAT-043 queue action executes the real dashboard navigation helper with the exact Inventory ID',()=>{
  const opened=[],inventoryId='96478c1d-4795-42e2-914d-94a034f787a5';
  const button={dataset:{openVerificationInventory:inventoryId}};
  const nestedTarget={closest:selector=>selector==='[data-open-verification-inventory]'?button:null};
  assert.equal(hooks.openVerificationInventoryFromTarget(nestedTarget,id=>opened.push(id)),true);
  assert.deepEqual(opened,[inventoryId]);
  assert.equal(hooks.openVerificationInventoryFromTarget({closest:()=>null},id=>opened.push(id)),false);
  assert.deepEqual(opened,[inventoryId]);
});

test('UAT-044 every dashboard role receives My Team while operational views remain separate',()=>{
  const cases=[['agent','sales_agent'],['agent','listing_agent'],['manager','manager'],['executive','director'],['executive','admin']];
  for(const [type,jobRole] of cases){
    const views=Array.from(hooks.dashboardViewsFor(type,jobRole));
    assert.ok(views.includes('My Team'),`${type}/${jobRole} is missing My Team`);
    assert.notEqual(views[0],'My Team',`${type}/${jobRole} hierarchy replaced its operating view`);
  }
});

test('UAT-045 elapsed-time behavior crosses minute, hour, day and week boundaries',()=>{
  const cases=[[1,'1 minute'],[59,'59 minutes'],[60,'1 hour'],[61,'2 hours'],[1380,'23 hours'],[1439,'1 day'],[1440,'1 day'],[2881,'3 days'],[8640,'6 days'],[10079,'1 week'],[10080,'1 week'],[18782,'2 weeks']];
  for(const [minutes,label] of cases)assert.equal(hooks.readableElapsedMinutes(minutes),label,`${minutes} minutes`);
});
