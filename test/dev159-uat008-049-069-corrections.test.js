import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('dev159 migration preserves legacy evidence and adds governed masters and canonical classifications',()=>{
  const sql=read('src/migrations/102_dev159_uat008_049_069_corrections.sql');
  for(const marker of ['CREATE TABLE inventory_buildings','ALTER TABLE listings ADD COLUMN building_id','Existing Community/Building text is retained verbatim','NOT VALID','customer_objective','market_stage_requirement','property_segment_requirement','legacy_classification_review_required','qualification_models_objective_status_idx','create_reservation'])assert.match(sql,new RegExp(marker));
  assert.doesNotMatch(sql,/UPDATE listings SET building_id/);
  assert.doesNotMatch(sql,/UPDATE listings SET community_id/);
});

test('UAT-008 and UAT-069 require contact-first objective-specific qualification',()=>{
  const api=read('src/routes/qualification-finance.js'),ui=read('public/app.js');
  assert.match(api,/completed substantive Customer discussion before assessing qualification/);
  assert.match(api,/contact_outcome_code IN/);
  assert.match(api,/customer_objective=\$1/);
  assert.match(api,/exact objective-specific questions, weights and thresholds/);
  assert.match(ui,/Qualification locked until Customer contact/);
  assert.match(ui,/Active questionnaire coverage/);
  assert.match(ui,/Questions, weights and thresholds are business configuration and are not inferred by CORE/);
});

test('UAT-049 through UAT-051 use clean Developer labels, full availability period and governed locations',()=>{
  const app=read('public/app.js'),listings=read('src/routes/listings.js'),market=read('public/market-intelligence-ui.js'),api=read('src/routes/dld-market-intelligence.js');
  assert.doesNotMatch(app,/Developer Master v\$\{/);
  assert.match(app,/availabilityExpiresAt/);
  assert.match(listings,/Availability expiry must be later than the effective confirmation time/);
  assert.match(listings,/inventory-location-options/);
  assert.match(listings,/buildingId/);
  assert.match(market,/Maintain governed Building/);
  assert.match(api,/admin\/inventory-buildings/);
});

test('UAT-052 through UAT-056 preserve ranking choice, visible recovery and verification navigation without custody',()=>{
  const app=read('public/app.js'),matching=read('public/matching-completion-ui.js'),offer=read('public/offer-ui.js');
  assert.match(app,/Rank available Inventory/);
  assert.doesNotMatch(app,/Run AI-assisted Inventory ranking/);
  assert.match(matching,/Differences affect score and explanation, not eligibility/);
  assert.match(offer,/Renegotiate this same property as a new governed Offer/);
  assert.match(offer,/Revised amount/);
  assert.match(app,/if\(afterWorkflow\)return afterWorkflow\(\)/);
  assert.match(app,/Verification does not assign a custodian/);
});

test('UAT-057 through UAT-064 remove ambiguous maintenance and pagination restrictions',()=>{
  const app=read('public/app.js'),crm=read('src/routes/crm.js'),offer=read('public/offer-ui.js'),opportunities=read('src/routes/opportunities.js'),listings=read('src/routes/listings.js');
  assert.match(app,/Corporate Developers are maintained in Companies/);
  assert.match(crm,/Developers must be maintained as governed Companies/);
  assert.match(crm,/New customers require email and phone/);
  for(const marker of ['data-customer-page','data-lead-page','data-listing-page','pageSize=25'])assert.match(app,new RegExp(marker));
  assert.match(app,/Customer objective/);
  assert.match(app,/Market-stage requirement/);
  assert.match(app,/Property-segment requirement/);
  assert.match(app,/Seller and Landlord requirements inherit the governed Inventory location/);
  assert.match(offer,/The Offer direction is derived from the confirmed Customer objective/);
  assert.match(opportunities,/Offer direction must follow the confirmed Customer objective/);
  assert.equal((crm.match(/Number\.parseInt\(req\.query\.pageSize,10\)\|\|25/g)||[]).length,3,'contacts, KYC reviews and Leads must default to 25');
  assert.match(opportunities,/Number\.parseInt\(req\.query\.pageSize,10\)\|\|25/);
  assert.match(listings,/Number\.parseInt\(q\.pageSize,10\)\|\|25/);
  assert.match(crm,/ORDER BY l\.created_at DESC,l\.id DESC LIMIT \$\$\{params\.length\+1\} OFFSET \$\$\{params\.length\+2\}/);
  assert.match(listings,/LIMIT \$\$\{params\.length\+1\} OFFSET \$\$\{params\.length\+2\}/);
  assert.match(app,/pageSize=25/);
});

test('UAT-065 through UAT-068 static source-parity guard (not runtime or database evidence)',()=>{
  const pdf=read('src/offer-pdf.js'),admin=read('src/routes/admin.js'),leave=read('src/routes/agent-leave.js'),offer=read('public/offer-ui.js'),routes=read('src/routes/opportunities.js'),deal=read('src/deal-domain.js');
  for(const marker of ['OFFER TO PURCHASE','NYSA acts as the brokerage facilitator','not the buyer, seller, landlord or tenant','not legally binding','memorandum of understanding','sale and purchase agreement','tenancy contract'])assert.match(pdf,new RegExp(marker,'i'));
  assert.match(admin,/operationalOwnershipImpact/);
  assert.match(admin,/operational-impact/);
  assert.match(leave,/employmentEndOwnershipGate/);
  assert.match(offer,/accepted:'Customer \/ counterparty accepted this revision'/);
  assert.match(offer,/Customer acceptance is already recorded in Negotiation/);
  assert.match(routes,/accepted_offer_revision_id/);
  assert.match(routes,/INSERT INTO deals\(id,deal_reference,opportunity_id,deal_type/);
  assert.match(routes,/Initial Deal linkage from exact accepted Offer and Booking/);
  assert.match(deal,/\['purchase','sale'\]/);
  assert.match(deal,/\['rent','rent_out','rental'\]/);
});
