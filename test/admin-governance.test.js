import test from 'node:test';
import assert from 'node:assert/strict';
import { stableCodeError,timeToMinutes,minutesToTime,validateInvitationExpiry,DASHBOARD_METRICS,validateFeeItems,calculateFeeItems,validateProposalConfiguration,buildIndicativePurchaseTimeline } from '../src/admin-governance.js';

test('controlled-value stable codes enforce lowercase snake_case',()=>{
  assert.equal(stableCodeError('loss_reason'),null);
  assert.match(stableCodeError('Loss_Reason'),/lowercase snake_case/);
  assert.match(stableCodeError('loss reason'),/lowercase snake_case/);
  assert.match(stableCodeError(''),/required/);
});

test('business time selectors convert exactly to stored SLA minutes',()=>{
  assert.equal(timeToMinutes('09:00'),540);assert.equal(timeToMinutes('18:30'),1110);
  assert.equal(minutesToTime(540),'09:00');assert.equal(minutesToTime(1110),'18:30');
  assert.equal(timeToMinutes('25:00'),null);
});

test('invitation expiry defaults to seven days and rejects expired Dubai dates',()=>{
  const now=new Date('2026-07-31T07:07:10.730Z');
  assert.equal(validateInvitationExpiry('',now).value,'2026-08-07T07:07:10.730Z');
  assert.match(validateInvitationExpiry('2026-07-26',now).error,/today or a future Dubai date/);
  assert.equal(validateInvitationExpiry('2026-07-31',now).value,'2026-07-31T19:59:59.999Z');
  assert.equal(validateInvitationExpiry('2026-08-07',now).value,'2026-08-07T19:59:59.999Z');
  assert.match(validateInvitationExpiry('2026-02-30',now).error,/valid date/);
  assert.match(validateInvitationExpiry('31-07-2026',now).error,/valid date/);
});

test('structured percentage fixed and tiered fees calculate deterministically',()=>{
  const items=[
    {code:'transfer_fee',label:'Transfer fee',calculationType:'percentage',ratePercent:4},
    {code:'admin_fee',label:'Administration fee',calculationType:'fixed',amount:5000},
    {code:'tiered_fee',label:'Tiered fee',calculationType:'tiered',tiers:[{from:0,to:500000,ratePercent:1},{from:500000,to:null,ratePercent:2}]}
  ];
  assert.equal(validateFeeItems(items),null);
  const result=calculateFeeItems(items,1000000);
  assert.deepEqual(result.values,{transfer_fee:40000,admin_fee:5000,tiered_fee:15000});assert.equal(result.total,60000);
  assert.match(validateFeeItems([{code:'Bad Code',label:'Bad',calculationType:'fixed',amount:1}]),/lowercase snake_case/);
});

test('business fee rules support thresholds bases VAT composite charges quantities ranges and applicability',()=>{
  const items=[
    {code:'dld_transfer_fee',label:'DLD transfer fee',calculationType:'percentage',calculationBasis:'purchase_price',ratePercent:4,payer:'contractual'},
    {code:'trustee_fee',label:'Trustee fee',calculationType:'conditional_fixed',calculationBasis:'purchase_price',vatPercent:5,bands:[{dimension:'purchase_price',operator:'below',value:500000,amount:2000},{dimension:'purchase_price',operator:'at_or_above',value:500000,amount:4000}]},
    {code:'admin_fee',label:'Administration fee',calculationType:'conditional_fixed',calculationBasis:'none',bands:[{dimension:'property_type',operator:'equals',value:'apartment,office',amount:580},{dimension:'property_type',operator:'equals',value:'land',amount:430}]},
    {code:'mortgage_registration',label:'Mortgage registration',calculationType:'percentage_plus_fixed',calculationBasis:'mortgage_amount',ratePercent:0.25,fixedAddition:290,transactionType:'mortgage',fundingMethod:'bank_finance'},
    {code:'knowledge_fee',label:'Knowledge fee',calculationType:'quantity',calculationBasis:'quantity',unitAmount:10,quantityCode:'drawings'},
    {code:'valuation_estimate',label:'Valuation estimate',calculationType:'estimate_range',calculationBasis:'none',minAmount:2500,maxAmount:3500},
    {code:'bank_processing',label:'Bank processing estimate',calculationType:'percentage',calculationBasis:'mortgage_amount',ratePercent:1,capAmount:5000,serviceChannel:'bank',includeInTotal:false}
  ];
  assert.equal(validateFeeItems(items),null);
  const result=calculateFeeItems(items,{propertyPrice:1000000,mortgageAmount:800000,fundingMethod:'bank_finance',propertyType:'apartment',serviceChannel:'trustee_centre',transactionTypes:['purchase','mortgage'],quantities:{drawings:2}});
  assert.equal(result.values.dld_transfer_fee,40000);assert.equal(result.values.trustee_fee,4200);assert.equal(result.values.admin_fee,580);assert.equal(result.values.mortgage_registration,2290);assert.equal(result.values.knowledge_fee,20);assert.equal(result.values.valuation_estimate,null);assert.equal(result.values.bank_processing,0);
  assert.equal(result.total,47090);assert.equal(result.totalMinimum,49590);assert.equal(result.totalMaximum,50590);assert.equal(result.details.trustee_fee.vatAmount,200);assert.equal(result.details.bank_processing.applied,false);
  const boundary=calculateFeeItems(items,{propertyPrice:499999,mortgageAmount:0,propertyType:'land',serviceChannel:'bank',transactionTypes:['purchase'],quantities:{drawings:1}});assert.equal(boundary.values.trustee_fee,2100);assert.equal(boundary.values.admin_fee,430);assert.equal(boundary.values.bank_processing,0);
  const threshold=calculateFeeItems(items,{propertyPrice:500000,mortgageAmount:0,propertyType:'office',serviceChannel:'trustee_centre',transactionTypes:['purchase'],quantities:{drawings:0}});assert.equal(threshold.values.trustee_fee,4200);assert.equal(threshold.details.trustee_fee.matchedBand.operator,'at_or_above');
  const cashPurchase=calculateFeeItems(items,{propertyPrice:1000000,mortgageAmount:800000,fundingMethod:'cash',propertyType:'apartment',serviceChannel:'trustee_centre',transactionTypes:['purchase','mortgage'],quantities:{drawings:1}});assert.equal(cashPurchase.values.mortgage_registration,0);assert.equal(cashPurchase.details.mortgage_registration.applied,false);
  assert.match(validateFeeItems([{code:'mortgage_fee',label:'Mortgage fee',calculationType:'fixed',calculationBasis:'none',amount:100,fundingMethod:'credit_card'}]),/Invalid funding method/);
  assert.match(validateFeeItems([{code:'valuation',label:'Valuation',calculationType:'estimate_range',calculationBasis:'none',minAmount:4000,maxAmount:3000}]),/minimum and maximum/);
});

test('proposal designer validates buyer booklet limits fields conditions and timeline',()=>{
  const sections=[{code:'customer_name',label:'Customer name',source:'system',field:'contact.full_name',mandatory:true},{code:'highlights',label:'Highlights',source:'agent_input',mandatory:true}];
  const propertyFields=['inventory_id','price','location','developer','property_status','value_proposition','match_rationale'].map(code=>({code,mandatory:true,condition:'always'}));
  const buyerBooklet={maxProperties:3,maxMediaPerProperty:2,maxAmenities:5,requireAvailabilityCheck:true,propertyFields,timelineStages:[{code:'confirm_requirements',label:'Confirm requirements',condition:'always',guidance:'Subject to complete information.'}]};
  assert.equal(validateProposalConfiguration({sections,buyerBooklet}),null);
  assert.match(validateProposalConfiguration({sections,buyerBooklet:{...buyerBooklet,propertyFields:propertyFields.filter(field=>field.code!=='inventory_id')}}),/Property field inventory_id is required/);
  assert.match(validateProposalConfiguration({sections,buyerBooklet:{...buyerBooklet,maxProperties:4}}),/between 1 and 3/);
  assert.match(validateProposalConfiguration({sections,buyerBooklet:{...buyerBooklet,maxMediaPerProperty:3}}),/between 0 and 2/);
  assert.match(validateProposalConfiguration({sections:[{code:'customer_name',label:'Customer',source:'system'}],buyerBooklet}),/mapping/);
});

test('proposal timeline consumes saved customer timing and applicable approved stages',()=>{
  const stages=[{code:'confirm',label:'Confirm shortlist',condition:'always',guidance:'1–2 business days'},{code:'view',label:'Viewing',condition:'ready_property',guidance:'Subject to access'},{code:'finance',label:'Finance and valuation',condition:'bank_finance',guidance:'Lender timeline'},{code:'developer',label:'Developer handover',condition:'off_plan',guidance:'Developer programme'}];
  const result=buildIndicativePurchaseTimeline({businessLine:'Sale',fundingMethod:'mortgage',timelineCode:'6-12 months'},[{handoverDate:'Ready'}],stages);
  assert.equal(result.customerTimeline,'6-12 months');assert.deepEqual(result.stages.map(x=>x.code),['confirm','view','finance']);assert.match(result.text,/Customer timing: 6-12 months/);assert.doesNotMatch(result.text,/Developer handover/);
});

test('dashboard KPI catalogue owns units definitions and threshold direction',()=>{
  assert.equal(DASHBOARD_METRICS.sla_breaches.unit,'leads');assert.equal(DASHBOARD_METRICS.sla_breaches.direction,'high_bad');
  assert.match(DASHBOARD_METRICS.won_leads.definition,/Won/);
});
