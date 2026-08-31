import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateProposalConfiguration } from '../src/admin-governance.js';
import { makeProposalPdf } from '../src/proposal-pdf.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const configuration={
  sections:[
    {code:'customer_name',label:'Customer name',source:'system',field:'contact.full_name',mandatory:true},
    {code:'selected_property',label:'Selected property',source:'properties',mandatory:true},
    {code:'financial_calculation',label:'Saved financial calculation',source:'financial',mandatory:true},
    {code:'assumptions',label:'Customer-facing assumptions',source:'agent_input',mandatory:true}
  ],
  buyerBooklet:{maxProperties:1,maxMediaPerProperty:0,maxAmenities:1,requireAvailabilityCheck:false,
    propertyFields:['inventory_id','price','location','property_status'].map(code=>({code,mandatory:true,condition:'always'})),timelineStages:[]}
};

test('Financial Illustration is a separate governed calculation-led template contract',()=>{
  assert.equal(validateProposalConfiguration(configuration,'Financial Illustration'),null);
  assert.match(validateProposalConfiguration({...configuration,buyerBooklet:{...configuration.buyerBooklet,maxProperties:2}},'Financial Illustration'),/exactly 1 selected property/);
  assert.notEqual(validateProposalConfiguration(configuration,'Investment'),null);
});

test('proposal API requires one property and a saved immutable scenario for Financial Illustration',()=>{
  const route=read('src/routes/files-proposals.js');
  assert.match(route,/PROPOSAL_TYPES=\['Quick','Investment','Comparison','Financial Illustration'\]/);
  assert.match(route,/financialIllustration&&listingIds\.length!==1/);
  assert.match(route,/A saved immutable financial scenario is required for a Financial Illustration/);
  assert.match(route,/financialScenario:scenario/);
  assert.match(route,/financialScenario:scenario[\s\S]{0,400}makeProposalPdf|makeProposalPdf\(\{proposal[\s\S]{0,300}financialScenario:scenario/);
});

test('migration adds and activates the approved Financial Illustration without weakening existing templates',()=>{
  const migration=read('src/migrations/110_dev174_financial_illustration.sql');
  assert.match(migration,/Quick','Investment','Comparison','Financial Illustration/);
  assert.match(migration,/Saved financial calculation','source','financial','mandatory',true/);
  assert.match(migration,/Customer-facing assumptions','source','agent_input','mandatory',true/);
  assert.match(migration,/'maxProperties',1,'maxMediaPerProperty',0/);
  assert.match(migration,/'timelineStages','\[\]'::jsonb/);
  assert.match(migration,/SELECT id FROM brokers WHERE role='admin' ORDER BY updated_at LIMIT 1/);
  assert.doesNotMatch(migration,/SELECT id FROM brokers WHERE role='admin' ORDER BY created_at/);
  assert.doesNotMatch(migration,/UPDATE proposal_templates SET configuration/i);
});

test('Financial Illustration PDF shows calculations and excludes sales recommendation sections',()=>{
  const pdf=makeProposalPdf({proposal:{title:'Customer financial illustration',proposalNumber:'NYSA-PR-FI-1',templateType:'Financial Illustration'},version:1,organization:{displayName:'NYSA Realty',defaultCurrency:'AED'},recipient:{fullName:'Customer'},requirement:{},properties:[{id:'listing-1',project:'Business Bay Home',inventoryReference:'NYSA-INV-1',area:'Business Bay',propertyType:'Apartment',bedrooms:'2',price:2500000,currency:'AED'}],financialScenario:{scenarioType:'mortgage',scenarioName:'Mortgage option',currency:'AED',inputSnapshot:{annualRatePercent:4.5,years:25},outputSnapshot:{propertyPrice:2500000,downPayment:500000,principal:2000000,monthlyPayment:11116,upfrontCash:600000,totalRegulatoryFees:100000,months:300,assumptionVersion:{name:'Dubai fees',version:1}},disclaimer:'Indicative saved calculation.'},narrative:{assumptions:'Subject to lender approval and current charges.'},disclaimer:'This is indicative only.',agent:{name:'Agent'},preparedAt:'30 Aug 2026'});
  const text=pdf.toString('latin1');
  assert.match(text,/YOUR PROPERTY FINANCIAL ILLUSTRATION/);
  assert.match(text,/SAVED CALCULATION BASIS/);
  assert.match(text,/EST\. MONTHLY PAYMENT/);
  assert.match(text,/not lending approval, financial advice or a property recommendation/);
  assert.doesNotMatch(text,/NEXT STEPS|WHY IT MATCHES|RECOMMENDED MATCHES/);
});

test('guided UI distinguishes Financial Illustration from investment recommendation content',()=>{
  const app=read('public/app.js');
  assert.match(app,/proposal\(\)\?\.templateType==='Financial Illustration'/);
  assert.match(app,/A Financial Illustration requires exactly one selected property/);
  assert.match(app,/Select a saved immutable financial scenario for the Financial Illustration/);
  assert.match(app,/Review saved calculation and assumptions/);
});
