import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('UAT-079 retirement action executes through a CSP-compliant event listener',()=>{
  const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/onclick="retireQualificationModel/);
  const match=source.match(/function bindQualificationRetirementActions\(table\)\{[^\n]+\}/);
  assert.ok(match,'runtime retirement binding helper is missing');
  let listener,receivedId;
  const button={dataset:{retireModel:'model-079'},addEventListener:(event,handler)=>{assert.equal(event,'click');listener=handler;}};
  const table={querySelectorAll:selector=>{assert.equal(selector,'[data-retire-model]');return[button];}};
  const context={globalThis:{retireQualificationModel:id=>{receivedId=id;}}};
  vm.runInNewContext(`${match[0]};bindQualificationRetirementActions(table)`,{...context,table});
  assert.equal(typeof listener,'function','click listener was not registered');
  listener();
  assert.equal(receivedId,'model-079','click did not reach the governed retirement action');
});
