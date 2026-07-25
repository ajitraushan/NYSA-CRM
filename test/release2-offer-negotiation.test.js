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
  assert.equal(validateOfferRevision({...base,amount:'1.2M',depositAmount:'120k'},1).value.amount,1200000);
  assert.equal(validateOfferRevision({...base,amount:'1,200,000',depositAmount:'120,000'},1).value.depositAmount,120000);
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
    agent:{name:'Controlled Agent'},
    organization:{displayName:'NYSA Realty',registeredAddress:'Dubai, UAE',primaryEmail:'info@nysarealty.com'}
  });
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert.ok(pdf.length>500);
  assert.match(pdf.toString('latin1'),/Revision 2/);
  assert.match(pdf.toString('latin1'),/NYSA Realty/);
  assert.match(pdf.toString('latin1'),/PRIVATE COMMERCIAL OFFER/);
});

test('R2.3A migration and API preserve immutable exact-document negotiation evidence',()=>{
  const sql=read('src/migrations/045_release2_offer_negotiation.sql'),routes=read('src/routes/opportunities.js');
  for(const marker of ['CREATE TABLE offers','CREATE TABLE offer_revisions','CREATE TABLE negotiation_events','offer_revisions_immutable','negotiation_events_immutable','document_version_id UUID NOT NULL UNIQUE','offers_accepted_revision_fk'])assert.match(sql,new RegExp(marker));
  for(const marker of ["'/crm/opportunities/:id/offers'","'/crm/offers/:offerId/revisions'","'/crm/offers/:offerId/send'","'/crm/offers/:offerId/events'",'materialCorrectionReason','documentVersionId','accepted_revision_id','This revision has expired','counterpartyRole'])assert.match(routes,new RegExp(marker));
  assert.match(routes,/Only the current draft revision can be sent/);
  assert.match(routes,/exact generated document/);
  assert.match(routes,/Complete the property viewing and record customer feedback/);
  assert.match(routes,/v\.updated_at<=f\.created_at/);
  assert.match(routes,/viewing_feedback_recorded/);
  assert.match(routes,/ORDER BY e\.offer_id,e\.occurred_at DESC,e\.id DESC/);
  assert.match(routes,/Only withdrawal is available because this offer has no viewing feedback evidence/);
  assert.match(routes,/organization_settings WHERE status='active'/);
  assert.match(routes,/must contain an approved JPEG or PNG logo/);
  assert.match(routes,/recipientName/);
});

test('Opportunity UI presents one clear immutable offer and negotiation flow',()=>{
  const ui=read('public/offer-ui.js'),page=read('public/index.html'),app=read('public/app.js');
  for(const marker of ['Create Offer Revision 1 and branded PDF','Review Revision','Record sending this exact revision','Material correction / revision reason','Negotiation timeline - latest first','Reason (required for rejection or withdrawal)','All immutable offer revisions','Draft - not sent','Customer confirmed receipt (recorded by agent)','Recipient name','recipientEmail','recipientPhone','Inventory remains available','R2.3B','No property is ready for an offer','Viewing-feedback prerequisite confirmed','Offer created without prior viewing-feedback evidence','writable&&governedEvidence&&offer.status'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(ui,/data-business-amount/);
  assert.match(ui,/completedViewingListings/);
  assert.match(page,/offer-ui\.js\?v=r2\.3b-dev40-6/);
  assert.match(app,/bindOfferWorkspace/);
  for(const marker of ['1. Inventory selection','2. Viewing and customer feedback','3. Offer and commercial terms','4. Negotiation','opportunity-flow-sequence',"flowButton('inventory'","flowButton('viewing'","flowButton('offer'","flowButton('negotiation'","flowButton('booking'",'showFlowStep','Viewing completed - customer feedback recorded','This property cannot proceed to Offer until customer feedback is saved'])assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['View or edit Opportunity reminder','Reminder only - not a workflow status','Opportunity reminder *','Update Opportunity reminder','Viewing status:','Scheduled - outcome pending','Record viewing outcome and feedback','Opportunity reminder updated; viewing status was not changed'])assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['Open Viewing &amp; feedback',"showFlowStep('viewing')"])assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  for(const marker of ['data-flow-pane="offer negotiation"','flow-offer-only','flow-negotiation-only'])assert.match(ui,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(page,/offer-workspace\.flow-show-negotiation \.flow-offer-only/);
  assert.match(page,/opportunity-modal \[data-flow-pane\]:not\(\.flow-pane-active\)\{display:none!important\}/);
  assert.match(app,/classList\.toggle\('flow-pane-active',active\)/);
  for(const marker of ['Completed','In progress','Not completed','Reminder only - not a workflow status','View or edit Opportunity reminder','Create and send an offer before negotiation can begin.','The record is labelled Negotiation, but no governed offer has been sent.','if(reminderDetails)evidence.append(reminderDetails)','opportunity-stage-guidance'])assert.match(app,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(page,/opportunity-flow-sequence button small/);
  assert.match(page,/opportunity-reminder-details/);
});
