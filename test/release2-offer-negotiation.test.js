import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateOfferRevision,validateOfferEvent,offerStatusAfterRevision } from '../src/offer-domain.js';
import { makeOfferPdf } from '../src/offer-pdf.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const future=()=>new Date(Date.now()+86400000).toISOString();

test('offer revisions require typed commercial terms and reasons for every later revision',()=>{
  const base={offerType:'purchase',direction:'outbound',proposerRole:'customer',amount:'1250000',currency:'aed',depositAmount:'125000',validityExpiresAt:future()};
  assert.equal(validateOfferRevision(base,1).value.currency,'AED');
  assert.match(validateOfferRevision({...base,amount:0},1).error,/greater than zero/);
  assert.match(validateOfferRevision(base,2).error,/reason is required/);
  assert.equal(validateOfferRevision({...base,materialCorrectionReason:'Seller returned revised payment timing'},2).value.materialCorrectionReason,'Seller returned revised payment timing');
  assert.equal(offerStatusAfterRevision('inbound'),'countered');
});

test('offer state changes require governed sequence and adverse reasons',()=>{
  assert.equal(validateOfferEvent('sent',{eventType:'viewed'}).value.eventType,'viewed');
  assert.equal(validateOfferEvent('sent',{eventType:'acknowledged'}).value.eventType,'acknowledged');
  assert.match(validateOfferEvent('sent',{eventType:'rejected'}).error,/reason is required/);
  assert.match(validateOfferEvent('accepted',{eventType:'withdrawn',reason:'invalid'}).error,/cannot follow/);
  assert.equal(validateOfferEvent('viewed',{eventType:'accepted',summary:'Customer accepted exact terms'}).value.eventType,'accepted');
});

test('offer document is a valid deterministic PDF containing the exact revision',()=>{
  const pdf=makeOfferPdf({
    offer:{offerReference:'NYSA-OF-202607-000001'},
    revision:{revisionNumber:2,createdAt:new Date(),amount:1250000,currency:'AED',depositAmount:125000,financingMethod:'Mortgage',paymentTerms:'10 percent deposit',conditions:'Subject to finance',validityExpiresAt:future(),direction:'outbound',proposerRole:'customer',materialCorrectionReason:'Payment timing corrected'},
    opportunity:{opportunityReference:'NYSA-OP-202607-000001',title:'Marina purchase'},
    customer:{fullName:'Controlled Test Customer'},
    listing:{project:'Controlled Property',inventoryReference:'INV-001'},
    agent:{name:'Controlled Agent'}
  });
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert.ok(pdf.length>500);
  assert.match(pdf.toString('latin1'),/Revision 2/);
});

test('R2.3A migration and API preserve immutable exact-document negotiation evidence',()=>{
  const sql=read('src/migrations/045_release2_offer_negotiation.sql'),routes=read('src/routes/opportunities.js');
  for(const marker of ['CREATE TABLE offers','CREATE TABLE offer_revisions','CREATE TABLE negotiation_events','offer_revisions_immutable','negotiation_events_immutable','document_version_id UUID NOT NULL UNIQUE','offers_accepted_revision_fk'])assert.match(sql,new RegExp(marker));
  for(const marker of ["'/crm/opportunities/:id/offers'","'/crm/offers/:offerId/revisions'","'/crm/offers/:offerId/send'","'/crm/offers/:offerId/events'",'materialCorrectionReason','documentVersionId','accepted_revision_id','This revision has expired','counterpartyRole'])assert.match(routes,new RegExp(marker));
  assert.match(routes,/Only the current draft revision can be sent/);
  assert.match(routes,/exact generated document/);
});

test('Opportunity UI presents one clear immutable offer and negotiation flow',()=>{
  const ui=read('public/offer-ui.js'),page=read('public/index.html'),app=read('public/app.js');
  for(const marker of ['Create Offer Revision 1 and exact PDF','Review exact PDF','Send this exact revision','Material correction / revision reason','Negotiation timeline','Reason (required for rejection or withdrawal)'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(page,/offer-ui\.js\?v=r2\.3a-dev39/);
  assert.match(app,/bindOfferWorkspace/);
});
