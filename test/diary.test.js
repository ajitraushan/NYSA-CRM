import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDiaryRange,diaryStatus,markDiaryConflicts,calendarDeliveryStatus } from '../src/diary-domain.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('diary accepts Today and Week boundaries but rejects wider or invalid ranges',()=>{
  assert.equal(validateDiaryRange('2026-07-24T00:00:00+04:00','2026-07-25T00:00:00+04:00').error,undefined);
  assert.equal(validateDiaryRange('2026-07-20T00:00:00+04:00','2026-07-27T00:00:00+04:00').error,undefined);
  assert.match(validateDiaryRange('2026-07-20T00:00:00+04:00','2026-07-29T00:00:00+04:00').error,/eight days/);
  assert.match(validateDiaryRange('bad','2026-07-29T00:00:00+04:00').error,/Valid from and to/);
});

test('diary status and delivery labels remain derived from authoritative records',()=>{
  const now=new Date('2026-07-24T08:00:00Z');
  assert.equal(diaryStatus({startsAt:'2026-07-24T09:00:00Z'},now),'due_later');
  assert.equal(diaryStatus({startsAt:'2026-07-24T08:20:00Z'},now),'due_now');
  assert.equal(diaryStatus({startsAt:'2026-07-24T07:40:00Z'},now),'due_now');
  assert.equal(diaryStatus({startsAt:'2026-07-24T07:29:00Z'},now),'overdue');
  assert.equal(diaryStatus({startsAt:'2026-07-24T07:30:00Z',endsAt:'2026-07-24T08:15:00Z'},now),'due_now');
  assert.equal(diaryStatus({startsAt:'2026-07-24T07:00:00Z',completedAt:'2026-07-24T07:30:00Z'},now),'completed');
  assert.equal(diaryStatus({startsAt:'2026-07-24T09:00:00Z',recordStatus:'cancelled'},now),'cancelled');
  assert.equal(calendarDeliveryStatus({category:'meeting',googleEventUrl:null}),'not_sent');
  assert.equal(calendarDeliveryStatus({category:'viewing',googleEventUrl:'https://calendar.google.com/x',calendarSyncStatus:'active'}),'synced');
  assert.equal(calendarDeliveryStatus({category:'meeting',calendarSyncStatus:'error'}),'error');
  assert.equal(calendarDeliveryStatus({category:'call'}),'crm_only');
});

test('diary flags only active overlapping appointments for the same agent',()=>{
  const items=markDiaryConflicts([
    {id:'a',agentId:'agent-1',startsAt:'2026-07-24T08:00:00Z',endsAt:'2026-07-24T09:00:00Z',status:'due_now'},
    {id:'b',agentId:'agent-1',startsAt:'2026-07-24T08:30:00Z',endsAt:'2026-07-24T09:30:00Z',status:'due_later'},
    {id:'c',agentId:'agent-2',startsAt:'2026-07-24T08:30:00Z',endsAt:'2026-07-24T09:30:00Z',status:'due_later'},
    {id:'d',agentId:'agent-1',startsAt:'2026-07-24T08:15:00Z',endsAt:'2026-07-24T08:45:00Z',status:'cancelled'}
  ]);
  assert.deepEqual(Object.fromEntries(items.map(x=>[x.id,x.conflict])),{a:true,b:true,c:false,d:false});
});

test('My Diary combines CRM schedules with role scope and direct operating actions',()=>{
  const route=read('src/routes/diary.js'),server=read('src/server.js'),ui=read('public/app.js'),page=read('public/index.html');
  for(const contract of ['activities','tasks','viewings','activity_calendar_events','viewing_calendar_events','selectedAgentId','allowedAgents','Asia/Dubai','Company diary access is restricted'])assert.match(route,new RegExp(contract));
  assert.match(server,/diaryRoutes/);
  for(const contract of ['My Diary','Today','Week','All company appointments','Calls','Meetings','Viewings','Tasks & follow-ups','Scheduling conflict','Due now','Due later','Overdue','Every item below is scheduled or due on this date','Email has been sent','The Google Calendar invitation has not been sent','View Customer over Diary','View Lead over Diary','View Opportunity over Diary','Open Google Meet video room','Open Google Calendar event details','Copy phone number','Open phone app to call','Record call outcome','Record viewing outcome'])assert.match(ui,new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/data-tab="dashboard"[\s\S]*data-tab="diary"[\s\S]*data-tab="crm"[\s\S]*data-tab="opportunities"/);
  assert.doesNotMatch(ui,/statusLabel=\{upcoming/);
  assert.match(ui,/openCustomer\(b\.dataset\.diaryCustomer\)/);
  assert.doesNotMatch(ui,/data-diary-customer[\s\S]{0,500}switchTab\('customers'\)/);
  assert.match(page,/\.diary-item/);
  assert.match(page,/\.diary-conflict/);
  assert.match(page,/app\.js\?v=r2\.6-dev58/);
  assert.match(page,/\.diary-item\{grid-template-columns:130px minmax\(0,1fr\)\}/);
  assert.match(page,/\.diary-actions\{grid-column:1\/-1;justify-content:flex-start/);
});
