import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardTypeFor,buildDashboardMetric,dashboardViewFor,buildRoleDashboardPresentation } from '../src/dashboard-domain.js';

test('authenticated staff receive the role-appropriate dashboard',()=>{
  assert.equal(dashboardTypeFor({role:'admin',jobRole:'admin'}),'executive');
  assert.equal(dashboardTypeFor({role:'internal_broker',jobRole:'director'}),'executive');
  assert.equal(dashboardTypeFor({role:'internal_broker',jobRole:'manager'}),'manager');
  assert.equal(dashboardTypeFor({role:'internal_broker',jobRole:'sales_agent'}),'agent');
  assert.equal(dashboardTypeFor({role:'internal_broker',jobRole:'accountant'}),'accounting');
});

test('KPI current prior target variance and trend reconcile arithmetically',()=>{
  assert.deepEqual(buildDashboardMetric('new_leads','New leads',12,9,15,'leads','definition'),{code:'new_leads',label:'New leads',current:12,prior:9,target:15,unit:'leads',varianceToPrior:3,varianceToTarget:-3,trend:'up',definition:'definition'});
  assert.equal(buildDashboardMetric('x','X',5,5,null,'records','d').trend,'flat');
  assert.equal(buildDashboardMetric('x','X',2,5,null,'records','d').trend,'down');
});

const fixture=type=>buildRoleDashboardPresentation({type,view:'Executive',current:{leads:12,won:3,hot:4,warm:5,acceptanceBreaches:1,contactBreaches:1,noNextAction:2,staleRisk:3,unassigned:1,awaitingAcceptance:2,slaRisk:1},previous:{leads:9,won:2,hot:3,warm:4},targets:[{metricCode:'sla_breaches',targetValue:0,exceptionThreshold:0,thresholdDirection:'high_bad',definition:'No breach is acceptable',benchmarkSource:'Approved SLA policy'}],trend:[{period:'2026-07-01',value:5}],tasks:{overdue:2,today:3},exceptions:{missingContact:1,missingConsent:2},proposals:{prepare:1,review:1,send:1},inventory:{available:8,stale:2,mediaNotReady:1},agents:[{open:11}],dataAsOf:new Date('2026-07-15T00:00:00Z')});

test('agent manager and managing director presentations are separate contracts',()=>{
  const agent=fixture('agent'),manager=fixture('manager'),director=fixture('executive');
  assert.equal(agent.view,'My work');
  assert.equal(manager.view,'Team performance');
  assert.equal(director.view,'Executive');
  assert.ok(agent.panels.includes('agent_actions'));
  assert.ok(agent.panels.includes('agent_exceptions'));
  assert.ok(!agent.panels.includes('agent_workload'));
  assert.ok(manager.panels.includes('agent_workload'));
  assert.ok(manager.panels.includes('manager_hierarchy'));
  assert.ok(director.panels.includes('executive_questions'));
  assert.ok(director.panels.includes('executive_hierarchy'));
});

test('managing director executive tabs have distinct content contracts',()=>{
  assert.equal(dashboardViewFor('executive','Unknown'),'Executive');
  const sales=buildRoleDashboardPresentation({...fixtureInput(),view:'Sales'});
  const inventory=buildRoleDashboardPresentation({...fixtureInput(),view:'Inventory'});
  const risk=buildRoleDashboardPresentation({...fixtureInput(),view:'Operations and Risk'});
  assert.ok(sales.panels.includes('source_quality'));
  assert.ok(inventory.panels.includes('inventory_aging'));
  assert.ok(risk.panels.includes('integration_health'));
  assert.notDeepEqual(sales.panels,inventory.panels);
  assert.notDeepEqual(inventory.panels,risk.panels);
});

function fixtureInput(){return {type:'executive',current:{leads:1},previous:{},targets:[],trend:[],tasks:{},exceptions:{},proposals:{},inventory:{},agents:[],dataAsOf:new Date('2026-07-15T00:00:00Z')};}

test('threshold exceptions and unavailable financial forecasts are explicit',()=>{
  const presentation=fixture('executive'),sla=presentation.kpis.find(k=>k.code==='sla_breaches');
  assert.equal(sla.exceptionStatus,'exception');
  assert.equal(sla.benchmarkSource,'Approved SLA policy');
  assert.match(presentation.unavailableMetrics.map(x=>x.label).join(' '),/Revenue/);
  assert.ok(!presentation.leadingIndicators.some(x=>/revenue|commission|bookings/i.test(x.label)));
});
