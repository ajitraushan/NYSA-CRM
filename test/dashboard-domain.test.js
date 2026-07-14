import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardTypeFor,buildDashboardMetric } from '../src/dashboard-domain.js';

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
