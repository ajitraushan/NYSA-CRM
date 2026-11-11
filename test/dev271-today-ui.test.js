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
    querySelector: () => navigation,
    querySelectorAll: selector => selector === '[data-today-call]' ? [callButton] : [],
  };
  vm.runInNewContext(fs.readFileSync(new URL('../public/prospect-diary-ui.js', import.meta.url), 'utf8'), { window });
  const requested = [];
  await window.renderProspectDiary({
    root, actorJobRole: 'sales_agent',
    escape: value => String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'),
    async api(path) {
      requested.push(path);
      return { queueTotal: 1, items: [{
        id: 'fixture-prospect', displayName: '<script>', source: 'diary',
        phone: '+971501234567', priority: 5, createdAt: '2026-11-11T09:00:00Z',
      }] };
    },
  });
  assert.deepEqual(requested, ['/crm/prospect-diary/today']);
  assert.match(root.innerHTML, /<h2>Today<\/h2>/);
  assert.match(root.innerHTML, /1 remaining/);
  assert.match(root.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(root.innerHTML, /<script>/);
  assert.equal(typeof callButton.onclick, 'function');
  assert.equal(typeof navigation.onclick, 'function');
});
