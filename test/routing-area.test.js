import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(join(root,path),'utf8');

test('governed areas retain stable identity lifecycle and audit support',()=>{
  const migration=read('src/migrations/028_governed_areas_and_routing.sql');
  const routes=read('src/routes/lead-operations.js');
  assert.match(migration,/stable_code TEXT NOT NULL UNIQUE CHECK/);
  assert.match(migration,/business_label TEXT NOT NULL/);
  assert.match(migration,/retirement_reason TEXT/);
  assert.match(migration,/'RoutingRule','Area','WebsiteIntake'/);
  assert.match(routes,/Retire or change active routing rules that use this area first/);
  assert.match(routes,/Reason is required to retire or reactivate an area/);
});

test('routing is deterministic by priority and area specificity without broker assignment',()=>{
  const migration=read('src/migrations/028_governed_areas_and_routing.sql');
  const service=read('src/routing-service.js');
  const routes=read('src/routes/lead-operations.js');
  assert.match(migration,/routing_rules_active_match_area_uq/);
  assert.match(service,/r\.area_id IS NULL OR r\.area_id=\$3::uuid/);
  assert.match(service,/ORDER BY r\.priority,CASE WHEN r\.area_id IS NULL THEN 1 ELSE 0 END/);
  assert.match(routes,/VALUES\(\$1,\$2,\$3,\$4,\$5,\$6,\$7,NULL,'team_queue',\$8\)/);
  assert.match(routes,/source, business and area combination/);
});

test('lead capture exposes one confirmed primary routing area and otherwise uses All areas',()=>{
  const app=read('public/app.js');
  const crm=read('src/routes/crm.js');
  const intake=read('src/routes/website-intake.js');
  assert.match(app,/Primary routing area/);
  assert.match(app,/No confirmed primary area — use All areas rule/);
  assert.match(crm,/primary_routing_area_id/);
  assert.match(crm,/resolvePrimaryRoutingArea/);
  assert.match(intake,/primary_routing_area_id/);
});

test('administration separates area governance from routing rule maintenance',()=>{
  const app=read('public/app.js');
  assert.match(app,/\['areas','Area maintenance'\]/);
  assert.match(app,/id="area-form"/);
  assert.match(app,/id="routing-area"/);
  assert.match(app,/All areas/);
  assert.match(app,/loadAreas\(\)/);
});
