import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('UAT-089 derives Agent attention colours only from governed deadline and priority states',()=>{
  const ui=read('public/dashboard-ui.js');
  assert.match(ui,/x\.dueMinutes!==null&&x\.dueMinutes!==undefined&&x\.dueMinutes<0\?\{className:'attention-overdue',label:'Overdue'\}/);
  assert.match(ui,/x\.priorityBand==='immediate'\?\{className:'attention-urgent',label:'Urgent'\}/);
  assert.match(ui,/x\.priorityBand==='due_today'\?\{className:'attention-due-today',label:'Due today'\}/);
  assert.ok(ui.indexOf("className:'attention-overdue'")<ui.indexOf("priorityBand==='immediate'"),'elapsed deadlines must take precedence over the broader Immediate band');
});

test('UAT-089 provides text and colour signals without hiding the exact countdown',()=>{
  const ui=read('public/dashboard-ui.js'),html=read('public/index.html');
  assert.match(ui,/class="attention-status">\$\{attention\.label\}/);
  assert.match(ui,/priorityCountdown\(x\)/);
  for(const marker of ['.customer-priority-card-compact.attention-overdue','.customer-priority-card-compact.attention-urgent','.customer-priority-card-compact.attention-due-today','.attention-status'])assert.ok(html.includes(marker),`missing ${marker}`);
  assert.match(html,/var\(--red-soft\)/);
  assert.match(html,/var\(--amber-soft\)/);
  assert.match(html,/text-transform:uppercase/);
});
