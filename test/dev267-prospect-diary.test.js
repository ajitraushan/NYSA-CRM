import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV267 Prospect Diary release surface is wired without relaxing existing workflows',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'2.1.0-dev.273');
  const server=read('src/server.js'),app=read('public/app.js'),bootstrap=read('public/bootstrap.js'),route=read('src/routes/prospects.js'),migration=read('src/migrations/170_prospect_diary.sql');
  assert.match(server,/import prospectRoutes from '.\/routes\/prospects\.js'/);
  assert.match(server,/app\.mount\('\/api', prospectRoutes\)/);
  assert.match(bootstrap,/prospect-diary-ui\.js/);
  assert.match(bootstrap,/prospect-diary\.css/);
  assert.match(app,/Prospect Diary/);
  assert.match(app,/recordWorkspace/);
  assert.match(route,/Only the owning Agent may convert this Prospect/);
  assert.match(route,/Matching Customers exist/);
  assert.doesNotMatch(route,/INSERT INTO leads/i);
  assert.match(migration,/task_type='prospect_follow_up'/);
  assert.match(migration,/company_calling_numbers/);
  assert.match(migration,/policy_warning_acknowledged/);
  assert.match(migration,/Prospect outreach is blocked/);
  assert.match(migration,/ALTER TABLE tasks/);
  assert.match(route,/Repeat-call policy warning requires acknowledgement/);
  assert.match(route,/it does not block the call/);
  assert.match(route,/FOR UPDATE OF p/);
  assert.match(route,/Outside calling hours — customer request:/);
  assert.match(route,/prospectLocalTime/);
  assert.match(route,/outsideCallingHoursMode/);
  assert.match(route,/sourceChanged/);
  assert.match(route,/phoneChanged/);
});

test('DEV267 browser release module exports only through its explicit window contract',()=>{
  const ui=read('public/prospect-diary-ui.js');
  assert.match(ui,/window\.renderProspectDiary/);
  assert.match(ui,/window\.openProspectDiaryRecord/);
  assert.match(ui,/context\.api/);
  assert.match(ui,/context\.openRecord/);
  assert.match(ui,/context\.actor/);
  assert.match(ui,/context\.toast/);
});

test('DEV267 keeps repeat limits advisory and preserves governed outreach controls',()=>{
  const migration=read('src/migrations/170_prospect_diary.sql'),route=read('src/routes/prospects.js'),app=read('public/app.js'),policy=read('src/prospect-calling-policy.js'),ui=read('public/prospect-diary-ui.js');
  assert.match(migration,/prospect_call_start_minute BETWEEN 540 AND 1079/);
  assert.match(migration,/prospect_channel IN\('call','whatsapp','email'\)/);
  assert.match(migration,/correction_reason TEXT/);
  assert.match(route,/it does not block the call/);
  assert.match(route,/applyOutsideCallingHours/);
  assert.match(policy,/PROSPECT_OUTSIDE_CALLING_HOURS_MODE/);
  assert.match(route,/next\.step === 'close_dnc' \? 'do_not_contact' : 'wrong_number'/);
  assert.match(route,/Admin or Director access is required/);
  assert.match(route,/timezone_corrected/);
  assert.match(ui,/Team warning overrides/);
  assert.match(route,/prospect-diary\/overrides/);
  assert.match(app,/data-task-prospect/);
  assert.match(app,/data-diary-prospect/);
  assert.match(app,/esc\(t\.details\|\|'No additional instructions'\)/);
  assert.match(app,/if\(item\.details\)detailRows\.push/);
  assert.match(ui,/context\.escape\(a\.notes\)/);
  assert.match(ui,/context\.escape\(f\.details\|\|'No additional details'\)/);
  assert.match(app,/Company-registered calling numbers/);
});
