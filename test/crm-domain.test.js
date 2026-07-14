import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALIFICATION_GUIDANCE, JOB_ROLES, validateBudget, validateLeadStage, validateLeadTransition, addBusinessMinutes,
  validateContactIdentity, calculateMortgage, calculateRoi, calculateInvestmentReturns, validateQualificationFactors, calculateQualification, applyQualificationOverride, isReassignmentDue } from '../src/crm-domain.js';

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

test('qualification thresholds and factor contributions are explainable at boundaries',()=>{
  const model={factors:[{code:'budget_readiness',label:'Budget readiness',min:0,max:10,weight:2,required:true,missingTreatment:'reject'},
    {code:'decision_timeline',label:'Decision timeline',min:0,max:10,weight:1,required:false,missingTreatment:'zero'}],thresholds:{warmMin:45,hotMin:75},guidance:{Hot:{responseMinutes:15}}};
  assert.equal(validateQualificationFactors(model.factors),null);
  const hot=calculateQualification(model,{budget_readiness:10,decision_timeline:2.5});assert.equal(hot.score,75);assert.equal(hot.temperature,'Hot');assert.equal(hot.contributions.length,2);
  const warm=calculateQualification(model,{budget_readiness:6.75,decision_timeline:0});assert.equal(warm.score,45);assert.equal(warm.temperature,'Warm');
  assert.match(calculateQualification(model,{}).error,/Missing required factor/);
});

test('qualification excludes prohibited sensitive and social-media factors',()=>{
  assert.match(validateQualificationFactors([{code:'nationality',label:'Nationality',min:0,max:1,weight:1}]),/prohibited/);
  assert.match(validateQualificationFactors([{code:'social_media_score',label:'Profile',min:0,max:1,weight:1}]),/prohibited/);
});

test('qualification override requires authority and reason and model changes preserve prior results',()=>{
  const factors=[{code:'readiness',label:'Readiness',min:0,max:10,weight:1,required:true,missingTreatment:'reject'}];
  const prior=calculateQualification({factors,thresholds:{warmMin:40,hotMin:80}},{readiness:7});
  const later=calculateQualification({factors,thresholds:{warmMin:60,hotMin:70}},{readiness:7});
  assert.equal(prior.temperature,'Warm');assert.equal(later.temperature,'Hot');assert.equal(prior.temperature,'Warm');
  assert.match(applyQualificationOverride(prior,'Hot','',true).error,/requires/);
  assert.match(applyQualificationOverride(prior,'Hot','Manager decision',false).error,/not authorized/);
  assert.deepEqual(applyQualificationOverride(prior,'Hot',' Urgent verified need ',true),{finalTemperature:'Hot',overrideReason:'Urgent verified need'});
});

test('financial outputs expose LTV DBR gross net and cash-on-cash values',()=>{
  const mortgage=calculateMortgage({propertyPrice:1_000_000,loanAmount:750_000,annualRatePercent:4,years:25,additionalCosts:30_000,monthlyIncome:40_000,monthlyDebt:2_000});
  assert.equal(mortgage.loanToValue,75);assert.ok(mortgage.debtBurdenRatio>0);assert.equal(mortgage.upfrontCash,280_000);
  const roi=calculateInvestmentReturns({price:1_000_000,annualRent:80_000,annualCosts:10_000,vacancyPercent:5,cashInvested:300_000});
  assert.deepEqual({gross:roi.grossYield,net:roi.netYield,cash:roi.cashOnCashReturn},{gross:8,net:6.6,cash:22});
});
