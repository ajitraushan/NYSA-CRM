import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALIFICATION_GUIDANCE, JOB_ROLES, validateBudget, validateLeadStage, validateLeadTransition, addBusinessMinutes,
  validateContactIdentity, calculateMortgage, calculateRoi, isReassignmentDue } from '../src/crm-domain.js';

test('qualification guidance gives Hot leads the fastest response target', () => {
  assert.ok(QUALIFICATION_GUIDANCE.Hot.responseMinutes < QUALIFICATION_GUIDANCE.Warm.responseMinutes);
  assert.ok(QUALIFICATION_GUIDANCE.Warm.responseMinutes < QUALIFICATION_GUIDANCE.Cold.responseMinutes);
  assert.match(QUALIFICATION_GUIDANCE.Hot.strategy, /Call first/);
});

test('budget validation accepts open-ended and ordered ranges', () => {
  assert.deepEqual(validateBudget('', '2500000'), { min: null, max: 2500000 });
  assert.deepEqual(validateBudget('1000000', '2500000'), { min: 1000000, max: 2500000 });
});

test('budget validation rejects negative, non-numeric, and reversed ranges', () => {
  assert.ok(validateBudget(-1, 100).error);
  assert.ok(validateBudget('unknown', 100).error);
  assert.ok(validateBudget(200, 100).error);
});

test('Lost leads require a reason while Won leads do not', () => {
  assert.equal(validateLeadStage('Lost', ''), 'lostReason is required when a lead is Lost');
  assert.equal(validateLeadStage('Lost', 'Budget postponed'), null);
  assert.equal(validateLeadStage('Won'), null);
  assert.equal(validateLeadStage('Invalid'), 'Invalid stage');
});

test('internal job roles cover the approved NYSA staff groups', () => {
  assert.deepEqual(JOB_ROLES, ['admin','sales_agent','listing_agent','manager','director','accountant']);
});

test('contact identity validates email and international phone formats', () => {
  assert.deepEqual(validateContactIdentity(' Buyer@Example.com ', '+971 50 123 4567'), {
    email:'buyer@example.com', phone:'+971501234567', emailStatus:'format_valid', phoneStatus:'format_valid'
  });
  assert.match(validateContactIdentity('bad-email', '').error, /Email format/);
  assert.match(validateContactIdentity('', '0501234567').error, /international format/);
});

test('mortgage calculator handles interest-bearing and zero-interest loans', () => {
  const result = calculateMortgage({ propertyPrice:1_000_000, downPaymentPercent:20, annualRatePercent:4.5, years:25, additionalCosts:40_000 });
  assert.equal(result.principal, 800_000);
  assert.equal(result.upfrontCash, 240_000);
  assert.ok(result.monthlyPayment > 4400 && result.monthlyPayment < 4500);
  const zero = calculateMortgage({ propertyPrice:1_200_000, downPaymentPercent:20, annualRatePercent:0, years:20 });
  assert.equal(zero.monthlyPayment, 4000);
});

test('ROI and assignment deadline calculations are deterministic', () => {
  assert.equal(calculateRoi(2_000_000, 140_000, 20_000), 6);
  assert.equal(isReassignmentDue({ assignedTo:'u1', assignmentDueAt:'2026-01-01T00:00:00Z', stage:'New' }, new Date('2026-01-02T00:00:00Z')), true);
  assert.equal(isReassignmentDue({ assignedTo:'u1', assignmentDueAt:'2026-01-01T00:00:00Z', stage:'Won' }, new Date('2026-01-02T00:00:00Z')), false);
});

test('lead lifecycle rejects skipped and terminal transitions',()=>{
  assert.equal(validateLeadTransition('New','Contacted'),null);
  assert.match(validateLeadTransition('New','Won'),/cannot move/);
  assert.match(validateLeadTransition('Won','New'),/cannot move/);
  assert.equal(validateLeadTransition('Lost','New'),null);
});

test('business-minute deadlines cross evenings and weekends consistently',()=>{
  const calendar={workDays:[1,2,3,4,5],startMinute:540,endMinute:1080,utcOffsetMinutes:240};
  assert.equal(addBusinessMinutes(new Date('2026-07-17T13:30:00Z'),120,calendar).toISOString(),'2026-07-20T06:30:00.000Z');
  assert.equal(addBusinessMinutes(new Date('2026-07-13T04:00:00Z'),30,calendar).toISOString(),'2026-07-13T05:30:00.000Z');
  assert.equal(addBusinessMinutes(new Date('invalid'),30,calendar),null);
});
