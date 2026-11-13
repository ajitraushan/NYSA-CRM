import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('Sales Agent opens Today by default and queue text is escaped', async () => {
  const window = {};
  const navigation = {};
  const callButton = { dataset: { todayCall: 'fixture-prospect' } };
  const root = {
    innerHTML: '',
    querySelector: selector => selector==='[data-today-add]' ? navigation : null,
    querySelectorAll: selector => selector === '[data-today-call]' ? [callButton] : [],
  };
  vm.runInNewContext(fs.readFileSync(new URL('../public/prospect-diary-ui.js', import.meta.url), 'utf8'), { window });
  const requested = [];
  await window.renderProspectDiary({
    root, actorJobRole: 'sales_agent',
    escape: value => String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),
    async api(path) {
      requested.push(path);
      if(path==='/crm/organization')return {organization:{prospectCallStartMinute:570,prospectCallEndMinute:1020}};
      return { queueTotal: 1, outsideCallingHours:true, callsMade:3, target:12, connected:2, items: [{
        id: 'fixture-prospect', displayName: '<script>', source: 'diary',
        phone: '+971501234567', priority: 5, firstCallOverdue: true, firstCallDueAt: '2026-11-11T09:00:00Z', createdAt: '2026-11-11T09:00:00Z',
      },{
        id: 'moved-retry', priority: 6, nextRetryAt: '2026-11-19T08:00:00Z',
        retryMoved: {plannedAt:'2026-11-16T08:00:00Z',movedAt:'2026-11-19T08:00:00Z',reason:'unanswered_weekly_threshold'},
      }] };
    },
  });
  assert.deepEqual(requested, ['/crm/prospect-diary/today','/crm/organization']);
  assert.match(root.innerHTML, /<h2>Today<\/h2>/);
  assert.match(root.innerHTML, /1 prospect left to call today/);
  assert.match(root.innerHTML, /09:30.*17:00 Dubai time/);
  assert.match(root.innerHTML, /Calls<\/dt><dd>3 \/ 12/);
  assert.match(root.innerHTML, /New <span>1<\/span>/);
  assert.match(root.innerHTML, /First call overdue.*11 Nov 2026.*13:00/);
  assert.match(root.innerHTML, /Retry moved from 16 Nov 2026.*to 19 Nov 2026.*weekly unanswered-call limit/);
  assert.doesNotMatch(root.innerHTML, /data-today-call="moved-retry"/);
  assert.match(root.innerHTML, /Diary<\/span>/);
  assert.match(root.innerHTML, /Add prospect/);
  for(const view of ['today','diary','upload','dashboard'])assert.match(root.innerHTML,new RegExp('data-diary-view="'+view+'"'));
  assert.match(root.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(root.innerHTML, /<script>/);
  assert.equal(typeof callButton.onclick, 'function');
  assert.equal(typeof navigation.onclick, 'function');
});
