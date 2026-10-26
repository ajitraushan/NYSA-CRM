import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('UAT-080 test questionnaire reuses governed controls instead of native numeric prompts',()=>{
  const handler=source.match(/function openQualificationModelTest\(model\)\{[^\n]+\}/)?.[0];
  assert.ok(handler,'governed model-test modal is missing');
  assert.match(handler,/model\.factors\.map\(f=>/);
  assert.match(handler,/qualificationQuestionControl\(f\)/);
  assert.match(handler,/QUALIFICATION VERSION TEST · NO LEAD ASSESSMENT SAVED/);
  assert.doesNotMatch(handler,/prompt\(/);
  assert.doesNotMatch(handler,/alert\(/);
  const register=source.match(/async function loadQualificationModels\(\)\{[^\n]+\}/)?.[0];
  assert.match(register,/openQualificationModelTest\(models\.find/);
});

test('governed question renderer exposes choices yes-no and numeric bounds at runtime',()=>{
  const definition=source.match(/function qualificationQuestionControl\(f\)\{[^\n]+\}/)?.[0];
  assert.ok(definition,'shared question renderer is missing');
  const context={esc:value=>String(value)};
  vm.runInNewContext(`${definition};globalThis.render=qualificationQuestionControl`,context);
  const dropdown=context.render({code:'budget_readiness',answerType:'single_select',required:true,answerOptions:[{label:'Confirmed and aligned',value:10},{label:'Indicative only',value:4}]});
  assert.match(dropdown,/<select/);assert.match(dropdown,/Confirmed and aligned/);assert.match(dropdown,/Indicative only/);assert.match(dropdown,/value="10"/);
  const yesNo=context.render({code:'authority',answerType:'yes_no',required:false});
  assert.match(yesNo,/>Yes</);assert.match(yesNo,/>No</);
  const scale=context.render({code:'urgency',answerType:'scale',required:true,min:0,max:10});
  assert.match(scale,/type="number"/);assert.match(scale,/min="0"/);assert.match(scale,/max="10"/);
});
