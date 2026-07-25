import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dealTypeForOffer,validateDealCreate,validateDealParty,dealClosureGates } from '../src/deal-domain.js';

test('deal type follows the accepted offer and requires a commercial mode',()=>{
  assert.equal(dealTypeForOffer('purchase'),'sale');
  assert.equal(dealTypeForOffer('rental'),'rental');
  assert.equal(dealTypeForOffer('off_plan'),'off_plan');
  assert.equal(dealTypeForOffer('commercial','sale'),'commercial_sale');
  assert.equal(dealTypeForOffer('commercial'),null);
});

test('deal creation inherits exact terms and requires a future completion target',()=>{
  const future=new Date(Date.now()+86400000).toISOString();
  const valid=validateDealCreate({targetCompletionAt:future},{offerType:'purchase',agreedValue:'1.2M',currency:'aed'});
  assert.equal(valid.value.dealType,'sale');
  assert.equal(valid.value.agreedValue,1200000);
  assert.equal(valid.value.currency,'AED');
  assert.match(validateDealCreate({targetCompletionAt:future},{offerType:'commercial',agreedValue:1,currency:'AED'}).error,/Commercial/);
});

test('a party is exactly one maintained Contact or Company with source evidence',()=>{
  assert.equal(validateDealParty({partyRole:'seller',side:'seller_side',contactId:'c1',sourceEvidence:'Mandate'}).value.partyRole,'seller');
  assert.match(validateDealParty({partyRole:'seller',side:'seller_side',contactId:'c1',companyId:'co1',sourceEvidence:'Mandate'}).error,/exactly one/);
  assert.match(validateDealParty({partyRole:'seller',side:'seller_side',contactId:'c1'}).error,/source evidence/);
});

test('closure gates clearly expose missing parties, checklist and later approval',()=>{
  const deal={dealType:'sale',acceptedOfferRevisionId:'r1',status:'completion_in_progress'};
  const gates=dealClosureGates({deal,parties:[{partyRole:'buyer'}],items:[{required:true,status:'pending'}]});
  assert.equal(gates.find(x=>x.code==='terms').complete,true);
  assert.match(gates.find(x=>x.code==='parties').label,/seller/);
  assert.equal(gates.find(x=>x.code==='checklist').complete,false);
  assert.match(gates.find(x=>x.code==='approval').label,/R2.4B/);
});

test('R2.4A migration, API and workspace preserve exact commercial evidence and closure gates',()=>{
  const migration=fs.readFileSync(new URL('../src/migrations/047_release2_deal_foundation.sql',import.meta.url),'utf8');
  const correction=fs.readFileSync(new URL('../src/migrations/048_release2_deal_stage_constraint.sql',import.meta.url),'utf8');
  const routes=fs.readFileSync(new URL('../src/routes/opportunities.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/deal-ui.js',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(migration,/accepted_offer_revision_id UUID NOT NULL/);
  assert.match(migration,/checklist_templates/);
  assert.match(migration,/deal_parties/);
  assert.match(routes,/A Deal can only start from an active governed reservation/);
  assert.match(routes,/Complete mandatory Deal parties and completion checklist/);
  assert.match(routes,/THEN \$3::uuid ELSE NULL END/);
  assert.match(ui,/Closure readiness/);
  assert.match(ui,/Closed Won is deliberately unavailable in R2\.4A/);
  assert.match(ui,/dealEditable=writable&&\['draft','completion_in_progress'\]\.includes\(deal\.status\)/);
  assert.match(ui,/dealEditable&&!requiredPartiesComplete/);
  assert.doesNotMatch(ui,/add another transaction party/i);
  assert.match(ui,/Transaction parties are locked because this Deal has entered approval or closure/);
  assert.match(correction,/DROP CONSTRAINT opportunities_stage_check/);
  assert.match(correction,/'Deal'/);
  assert.match(app,/opportunity-source-evidence/);
  assert.match(app,/sourceEvidenceDetails\.append\(summary,attributionNote\)/);
});
