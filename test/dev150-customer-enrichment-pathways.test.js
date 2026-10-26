import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const app=read('public/app.js');
const crm=read('src/routes/crm.js');
const activityRoute=crm.match(/r\.post\('\/crm\/leads\/:id\/activities',[\s\S]*?\n\}\);/)?.[0]||'';

test('three pathways use their authoritative endpoints',()=>{
  assert.match(app,/data-activity-path="interaction"/);
  assert.match(app,/data-activity-path="note"/);
  assert.match(app,/data-activity-path="task"/);
  assert.match(app,/activityType:'Note'/);
  assert.match(app,/api\(`\/crm\/leads\/\$\{id\}\/tasks`/);
  assert.doesNotMatch(app,/activityType:'Task'.*\/activities/);
});

test('duration is entered as minutes and converted to canonical seconds by the API',()=>{
  assert.match(app,/name="durationMinutes"/);
  assert.doesNotMatch(app,/Call duration \(seconds\)/);
  assert.match(activityRoute,/Number\(b\.durationMinutes\)\*60/);
  assert.match(activityRoute,/duration_seconds/);
  assert.match(app,/fmtMinutesFromSeconds\(c\.durationSeconds\)/);
  assert.match(app,/fmtMinutesFromSeconds\(a\.durationSeconds\)/);
  assert.match(read('src/routes/dashboards.js'),/opportunity_stage_snapshot/);
});

test('document evidence is controlled by outcome code and never subject text',()=>{
  assert.match(activityRoute,/b\.contactOutcomeCode==='offer_letter_sent'/);
  assert.doesNotMatch(activityRoute,/offer letter sent\$\/i\.test\(clean\(b\.subject\)\)/i);
  assert.match(app,/name="documentVersionId"><option value="">Loading governed sent documents/);
  assert.match(app,/version\.status==='sent'&&version\.immutable/);
});

test('opportunity snapshot and form workflow are separate migrations',()=>{
  const snapshot=read('src/migrations/096_activity_opportunity_stage_snapshot.sql');
  const workflow=read('src/migrations/097_activity_enrichment_pathways.sql');
  assert.match(snapshot,/opportunity_id_snapshot/);
  assert.match(snapshot,/Historical rows remain NULL/);
  assert.doesNotMatch(snapshot,/next_action_code/);
  assert.match(workflow,/next_action_code/);
  assert.match(workflow,/next_action_due_at/);
  assert.match(activityRoute,/opportunitySnapshot\?\.stage/);
});

test('meeting appointment time and mandatory next action are preserved separately',()=>{
  assert.match(app,/name="meetingStart"/);
  assert.match(app,/name="dueAt" type="datetime-local" required/);
  assert.match(activityRoute,/nextActionDueAt=b\.nextActionDueAt\|\|b\.dueAt/);
  assert.match(activityRoute,/b\.activityType==='Meeting'\?meetingStart:nextActionDueAt/);
});

test('post-save enrichment opens existing governed editors without automatic mutation',()=>{
  assert.match(app,/activity-postsave-grid/);
  assert.match(app,/Customer Master/);
  assert.match(app,/openCustomer\(lead\.contactId\)/);
  assert.match(app,/openLeadRequirements\(lead\)/);
  assert.match(app,/openQualificationQuestionnaire\(lead,routing\)/);
  assert.match(app,/no Customer data was changed automatically/i);
});

test('revised v2 layout uses a card launcher, channel pills and Opportunity viewing route',()=>{
  assert.match(app,/activity-path-cards/);
  assert.match(app,/data-activity-channel="\$\{x\}"/);
  assert.match(app,/data-activity-back/);
  assert.match(app,/data-open-activity-viewing/);
  assert.match(app,/A Viewing belongs to the active Opportunity/i);
});
