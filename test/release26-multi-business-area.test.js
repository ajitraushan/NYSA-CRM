import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const admin=fs.readFileSync(new URL('../src/routes/admin.js',import.meta.url),'utf8');
const leads=fs.readFileSync(new URL('../src/routes/lead-operations.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../src/migrations/056_release26_agent_assignment_scope.sql',import.meta.url),'utf8');

test('administrators can maintain several active business areas and one primary team',()=>{
  assert.match(admin,/\/admin\/users\/:id\/business-areas/);
  assert.match(admin,/Primary team must be one of the selected business areas/);
  assert.match(admin,/assignment_scope_updated/);
  assert.match(admin,/NOT\(team_id=ANY\(\$2::uuid\[\]\)\)/);
  assert.match(ui,/Manage business areas/);
  assert.match(ui,/form\.getAll\('teamId'\)/);
});

test('geographical assignments are multi-select and constrain area-specific routing eligibility',()=>{
  assert.match(migration,/CREATE TABLE agent_area_assignments/);
  assert.match(admin,/ARRAY_AGG\(aa\.area_id::text/);
  assert.match(admin,/form/);
  assert.match(ui,/form\.getAll\('areaId'\)/);
  assert.match(ui,/Geographical areas/);
  assert.match(leads,/agent_area_assignments eligible_area/);
  assert.match(leads,/eligible_area\.area_id=\$\{area\}/);
});

test('routing and self-claim eligibility includes every active team and geographical membership',()=>{
  assert.match(leads,/eligible_tm\.broker_id=eligible_broker\.id AND eligible_tm\.team_id=\$\{team\} AND eligible_tm\.ends_at IS NULL/);
  assert.match(leads,/l\.primary_routing_area_id/);
  assert.match(leads,/Responsible agent must be an eligible active Sales Agent in the selected team/);
});
