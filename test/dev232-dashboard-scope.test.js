import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {dashboardLeadScopeSql,dashboardTeamScopeSql} from '../src/dashboard-scope.js';
for(const expression of ['l.assigned_team_id','owner.team_id'])test(`Manager dashboard scope binds managed teams for ${expression}`,()=>{
 const scope=dashboardTeamScopeSql(expression,{jobRole:'manager',id:'synthetic-manager'},['existing-filter']);
 assert.deepEqual(scope.params,['existing-filter','synthetic-manager']);assert.match(scope.clause,/manager_id=\$2/);assert.match(scope.clause,/membership_role='manager'/);assert.match(scope.clause,/job_role='manager'/);assert.match(scope.clause,/ends_at IS NULL/);assert.ok(scope.clause.includes(`dashboard_team.id=${expression}`));
});
test('Manager dashboard excludes personally owned records outside managed teams',()=>{
 const scope=dashboardLeadScopeSql('l',{jobRole:'manager',id:'synthetic-manager'},[]);assert.doesNotMatch(scope.clause,/assigned_to/);assert.match(scope.clause,/l.assigned_team_id/);
});
test('Director dashboard is company-wide while Agent scope remains personal',()=>{
 assert.equal(dashboardLeadScopeSql('l',{role:'internal_broker',jobRole:'director',id:'director'},[]).clause,'1=1');
 assert.equal(dashboardLeadScopeSql('l',{role:'internal_broker',jobRole:'sales_agent',id:'agent'},[]).clause,'l.assigned_to=$1');
});
test('Dashboard current/prior/filter/drill-down routes use the dedicated scope; Manager inventory cannot overwrite company snapshots',()=>{
 const s=fs.readFileSync(new URL('../src/routes/dashboards.js',import.meta.url),'utf8');assert.equal((s.match(/scope=dashboardLeadScopeSql\(alias/g)||[]).length,2);assert.match(s,/deleted_at IS NULL AND \$\{inventoryScope.clause\}/);assert.match(s,/if\(!req.targetComparison&&!f.selected.businessLineId&&isCompanyReader\(req.broker\)\)for\(const \[metricCode,value\]/);assert.match(s,/canSeeIntegration=isCompanyReader/);
});
