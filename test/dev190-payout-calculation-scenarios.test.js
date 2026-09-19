import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applySocialMediaPayoutBonus,calculateRealtimePayout,receiptQuarterKey} from '../src/commission-payout-domain.js';

const base=[
  {lowerAmount:0,upperAmount:100000,agentPercent:55},
  {lowerAmount:100000,upperAmount:200000,agentPercent:60},
  {lowerAmount:200000,upperAmount:300000,agentPercent:65},
  {lowerAmount:300000,upperAmount:400000,agentPercent:70},
  {lowerAmount:400000,upperAmount:null,agentPercent:75}
];
const calculate=({prior,current,method='attained_trigger',social=false,date='2026-09-05'})=>calculateRealtimePayout({
  agentId:'scenario-agent',dealReference:`SCENARIO-${prior}-${current}`,currency:'AED',receiptDate:date,
  priorCumulativeAmount:prior,currentCreditedAmount:current,triggerMethod:method,slabs:applySocialMediaPayoutBonus(base,social),
  policyVersionId:'scenario-policy',socialMediaStatusVersionId:social?'scenario-social-active':null,socialMediaBonusPercent:social?5:0
});
const runDatedDeals=(deals,method)=>{
  const cumulativeByQuarter=new Map();
  return deals.map(deal=>{
    const quarter=receiptQuarterKey(deal.date),prior=cumulativeByQuarter.get(quarter)||0;
    const result=calculate({prior,current:deal.amount,date:deal.date,method,social:deal.social});
    cumulativeByQuarter.set(quarter,prior+deal.amount);
    return result;
  });
};

test('Option 2 keeps exact up-to boundaries in the lower slab and never reprices previous Deals',()=>{
  const scenarios=[
    [0,50000,27500,55],[50000,50000,27500,55],[100000,100000,60000,60],
    [200000,100000,65000,65],[300000,100000,70000,70],[400000,50000,37500,75]
  ];
  for(const [prior,current,expected,rate] of scenarios){const result=calculate({prior,current});assert.equal(result.agentPayoutAmount,expected);assert.equal(result.bands[0].agentPercent,rate);assert.equal(result.quarterTrueUpAmount,0);}
});

test('Social-media Active adds five points only in slabs one to three',()=>{
  const scenarios=[[0,50000,30000,60],[50000,50000,30000,60],[100000,100000,65000,65],[200000,100000,70000,70],[300000,100000,70000,70],[400000,50000,37500,75]];
  for(const [prior,current,expected,rate] of scenarios){const result=calculate({prior,current,social:true});assert.equal(result.agentPayoutAmount,expected);assert.equal(result.bands[0].agentPercent,rate);}
});

test('Option 1 settles the quarterly achieved-rate difference on each crossing Deal',()=>{
  const credits=[50000,50000,100000,100000,100000,50000],expected=[27500,27500,65000,75000,85000,57500],trueUps=[0,0,5000,10000,15000,20000];
  let prior=0,total=0;
  credits.forEach((current,index)=>{const result=calculate({prior,current,method:'quarter_achieved_rate'});assert.equal(result.agentPayoutAmount,expected[index]);assert.equal(result.quarterTrueUpAmount,trueUps[index]);total+=result.agentPayoutAmount;prior+=current;});
  assert.equal(prior,450000);assert.equal(total,337500);
});

test('Option 1 applies social-media increment only to receipts dated while Active',()=>{
  const inactiveFirst=calculate({prior:0,current:50000,method:'quarter_achieved_rate',social:false});
  const activeSecond=calculate({prior:50000,current:50000,method:'quarter_achieved_rate',social:true});
  assert.equal(inactiveFirst.agentPayoutAmount,27500);assert.equal(activeSecond.agentPayoutAmount,30000);
  assert.equal(inactiveFirst.agentPayoutAmount+activeSecond.agentPayoutAmount,57500);
  const activeFirst=calculate({prior:0,current:50000,method:'quarter_achieved_rate',social:true});
  const inactiveSecond=calculate({prior:50000,current:50000,method:'quarter_achieved_rate',social:false});
  assert.equal(activeFirst.agentPayoutAmount,30000);assert.equal(inactiveSecond.agentPayoutAmount,27500);
  assert.equal(activeFirst.agentPayoutAmount+inactiveSecond.agentPayoutAmount,57500);
});

test('a one-fils boundary crossing records the full Option 1 true-up without rewriting the prior Deal',()=>{
  const boundary=calculate({prior:99999.99,current:0.01,method:'quarter_achieved_rate'});assert.equal(boundary.agentPayoutAmount,0.01);assert.equal(boundary.bands[0].agentPercent,55);
  const result=calculate({prior:100000,current:0.01,method:'quarter_achieved_rate'});
  assert.equal(result.agentPayoutAmount,5000.01);assert.equal(result.quarterTrueUpAmount,5000);
  assert.equal(result.companyRetainedAmount,-5000);
});

test('dated multi-Deal commission accumulates inside Q3 and resets on the first Q4 receipt for both options',()=>{
  const deals=[
    {date:'2026-07-05',amount:100000},{date:'2026-08-10',amount:100000},
    {date:'2026-09-15',amount:100000},{date:'2026-09-30',amount:100000},
    {date:'2026-10-01',amount:50000}
  ];
  for(const method of ['attained_trigger','quarter_achieved_rate']){
    const [q3First,q3Second,q3Third,q3Fourth,q4First]=runDatedDeals(deals,method);
    assert.deepEqual([q3First.priorCumulativeAmount,q3Second.priorCumulativeAmount,q3Third.priorCumulativeAmount,q3Fourth.priorCumulativeAmount],[0,100000,200000,300000]);
    assert.equal(q3Fourth.resultingCumulativeAmount,400000);
    assert.equal(q4First.quarterKey,'2026-Q4');assert.equal(q4First.priorCumulativeAmount,0);assert.equal(q4First.resultingCumulativeAmount,50000);assert.equal(q4First.agentPayoutAmount,27500);assert.equal(q4First.bands[0].agentPercent,55);
  }
});

test('application route derives its cumulative query key with the date-safe quarter helper',()=>{
  const route=fs.readFileSync(new URL('../src/routes/commission-payout.js',import.meta.url),'utf8');
  assert.match(route,/const quarter=receiptQuarterKey\(line\.receiptDate\),prior=await one/);
  assert.doesNotMatch(route,/String\(line\.receiptDate\)\.slice\(0,4\)/);
});
