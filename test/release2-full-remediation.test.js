import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateVerificationSubmission,validateVerificationDecision,listingStatusForVerificationDecision
} from '../src/inventory-verification-domain.js';
import {validateRepresentation,validateCounterparty,validateExternalProperty} from '../src/transaction-representation-domain.js';
import {validateViewingCreate,validateViewingOutcome} from '../src/matching-viewing-domain.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Release 2.6 final migration governs Inventory counterparties, agreements and DBR thresholds',()=>{
  const migration=read('src/migrations/055_release26_transaction_inventory_finance.sql');
  for(const marker of ['inventory_counterparties','inventory_agreements','inventory_counterparty_id','prudent_dbr_percent','regulatory_dbr_percent','lessor','co_broker','marketing_authorized'])
    assert.match(migration,new RegExp(marker));
});

test('selected NYSA Inventory automatically supplies the Opportunity and Deal seller party',()=>{
  const origin=read('src/routes/transaction-representation.js'),opportunities=read('src/routes/opportunities.js'),ui=read('public/app.js');
  for(const marker of ['inventory_counterparties','ON CONFLICT\\(inventory_counterparty_id\\)','v\\.sellerCounterpartyId=inherited\\.id'])
    assert.match(origin,new RegExp(marker));
  assert.match(opportunities,/o\.seller_counterparty_id/);
  assert.match(opportunities,/Inherited from selected NYSA Inventory/);
  assert.match(ui,/inherited from Inventory/);
  assert.match(ui,/sellerCounterparty\.disabled=!isExternal/);
});

test('Inventory verification status is system controlled from submission through decision',()=>{
  assert.equal(validateVerificationSubmission({currentStatus:'verified',requestType:'verification',reason:'Again',evidenceReference:'E-1'}).error,'Verified Inventory does not require verification');
  assert.match(validateVerificationSubmission({currentStatus:'unverified',requestType:'verification',reason:'Check authority'}).error,/evidence/);
  assert.equal(validateVerificationSubmission({currentStatus:'expired',requestType:'verification',reason:'Renew',evidenceReference:'DOC-2'}).value.requestType,'verification');
  assert.match(validateVerificationSubmission({currentStatus:'unverified',requestType:'exemption'}).error,/exemption reason/);
  assert.equal(validateVerificationSubmission({currentStatus:'unverified',requestType:'exemption',reason:'Developer master inventory'}).value.requestType,'exemption');
  assert.match(validateVerificationDecision({requestStatus:'verified',requestType:'verification',decision:'verified',reason:'Done'}).error,/pending/);
  assert.match(validateVerificationDecision({requestStatus:'pending',requestType:'exemption',decision:'verified',reason:'Done'}).error,/Approve exemption/);
  assert.equal(validateVerificationDecision({requestStatus:'pending',requestType:'verification',decision:'returned',reason:'Evidence unclear'}).value.decision,'returned');
  assert.equal(listingStatusForVerificationDecision('verification','verified'),'verified');
  assert.equal(listingStatusForVerificationDecision('exemption','exempted'),'not_required');
  assert.equal(listingStatusForVerificationDecision('verification','rejected'),'unverified');
});

test('Inventory verification migration API and Manager queue preserve separate workflows',()=>{
  const migration=read('src/migrations/052_release2_full_remediation_foundation.sql');
  const routes=read('src/routes/listings.js');
  const app=read('public/app.js');
  const dashboard=read('public/dashboard-ui.js');
  for(const marker of ['inventory_verification_requests','inventory_verification_one_pending_uq','external_listing_publications','lead_inventory_selections','transaction_counterparties','provisional_external_properties','representation_path'])
    assert.match(migration,new RegExp(marker));
  for(const marker of ['/inventory-verification-queue','/listings/:id/verification-requests','/inventory-verification-requests/:id/decision','decision_'])
    assert.match(routes,new RegExp(marker.replaceAll('/','\\/')));
  for(const marker of ['Submit for verification','Request Not required exemption','Verification cleared — Not required','Status is system-controlled'])
    assert.match(app,new RegExp(marker));
  for(const marker of ['Inventory verification','Approve exemption','data-verification-decision','Every decision requires a reason'])
    assert.match(dashboard,new RegExp(marker));
  assert.doesNotMatch(app,/select name="verificationStatus"/);
});

test('all three representation paths enforce their distinct governed origins',()=>{
  const evidence={authorityEvidence:'Signed mandate NYSA-M-1'};
  assert.equal(validateRepresentation({...evidence,representationPath:'buyer',propertySource:'external_cobroker',
    buyerSource:'nysa_customer',leadId:'lead-1',externalPropertyId:'ext-1',buyerSideAgentId:'agent-1'}).value.representationPath,'buyer');
  assert.equal(validateRepresentation({...evidence,representationPath:'inventory',propertySource:'nysa_inventory',
    buyerSource:'external_buyer_agent',listingId:'listing-1',buyerCounterpartyId:'party-1',inventorySideAgentId:'agent-2'}).value.representationPath,'inventory');
  assert.equal(validateRepresentation({...evidence,representationPath:'dual',propertySource:'nysa_inventory',
    buyerSource:'nysa_customer',leadId:'lead-1',listingId:'listing-1',buyerSideAgentId:'agent-1',
    inventorySideAgentId:'agent-2',disclosureEvidence:'Conflict disclosure D-1'}).value.representationPath,'dual');
  assert.match(validateRepresentation({...evidence,representationPath:'inventory',propertySource:'external_cobroker',
    buyerSource:'external_buyer_agent',listingId:'listing-1',externalPropertyId:'ext-1',buyerCounterpartyId:'party-1',
    inventorySideAgentId:'agent-2'}).error,/must use approved NYSA Inventory/);
});

test('transaction-only parties and provisional property do not silently create Customer or Inventory',()=>{
  assert.equal(validateCounterparty({displayName:'External Seller',partyType:'transaction_only',role:'seller',
    source:'Co-broker email',evidenceReference:'EMAIL-22'}).value.contactId,null);
  assert.equal(validateExternalProperty({projectOrBuilding:'External Tower',propertyAddress:'Dubai',
    source:'Co-broker',sourceEvidence:'MOU-7'}).value.projectOrBuilding,'External Tower');
  const route=read('src/routes/transaction-representation.js'),migration=read('src/migrations/052_release2_full_remediation_foundation.sql');
  for(const marker of ['customerCreated:false','normalInventory:false','externalListing:false','/link-customer','/link-inventory',
    'approved_for_opportunity','opportunity_representation_history'])assert.match(route+ migration,new RegExp(marker.replaceAll('/','\\/')));
});

test('external property remains a separate governed transaction source through closure',()=>{
  const migration=read('src/migrations/052_release2_full_remediation_foundation.sql'),routes=read('src/routes/opportunities.js');
  for(const table of ['property_matches','viewings','offers','bookings','deals'])
    assert.match(migration,new RegExp(`ALTER TABLE ${table}[\\s\\S]*external_property_id`));
  for(const marker of ['property_matches_single_property_ck','viewings_single_property_ck','offers_single_property_ck',
    'bookings_single_property_ck','deals_single_property_ck','bookings_active_external_property_uq'])
    assert.match(migration,new RegExp(marker));
  for(const marker of ['provisional_external_properties','externalPropertyId',"'under_offer'","status='reserved'","status='closed'"])
    assert.match(routes,new RegExp(marker));
});

test('finance, multi-Inventory and viewing remediation contracts are visible and immutable',()=>{
  const app=read('public/app.js'),routes=read('src/routes/opportunities.js'),crm=read('src/routes/crm.js');
  for(const marker of ['Expected occupancy rate (%)','occupancyPercent','100-Number(f.occupancyPercent)',
    'Investment scenario comparison','separate immutable record','Annual rent','Net yield'])
    assert.match(app,new RegExp(marker.replace(/[()]/g,'\\$&')));
  for(const marker of ['listingIds','lead_inventory_selections','Carried forward from originating Lead','property_match_history'])
    assert.match(routes+crm,new RegExp(marker));
  assert.equal(validateViewingCreate({propertyMatchId:'m1',startsAt:'2099-01-01T10:00:00Z',endsAt:'2099-01-01T11:00:00Z',
    timezone:'Asia/Dubai',location:'Tower',instructions:'Lobby',rescheduledFromViewingId:'v1'}).value.rescheduleReason,null);
  assert.equal(validateViewingOutcome({status:'cancelled',expectedVersion:1}).value.followUpDueAt,null);
  for(const marker of ['Reschedule the previous viewing','Rescheduling reason / note (optional)','original viewing and invitation remain unchanged'])
    assert.match(app,new RegExp(marker.replace(/[()]/g,'\\$&')));
});

test('UI shell, calendar, closure, diary and cache regressions have explicit controls',()=>{
  const page=read('public/index.html'),app=read('public/app.js'),deal=read('public/deal-ui.js'),diary=read('src/routes/diary.js'),
    integrations=read('src/routes/integrations.js'),opportunities=read('src/routes/opportunities.js'),
    migration=read('src/migrations/051_release2_final_uat_remediation.sql');
  for(const marker of ['body{','overflow:hidden','#app{display:flex','main{width:100%;min-height:0;overflow-y:auto',
    'environment-badge'])assert.match(page,new RegExp(marker.replace(/[{}[\]]/g,'\\$&')));
  for(const marker of ['representative email and phone','Administration','User management','correctionRoute'])
    assert.match(integrations,new RegExp(marker));
  for(const marker of ['Return for correction','Reject closure request','Record management decision'])
    assert.match(deal,new RegExp(marker));
  assert.match(opportunities,/Complete mandatory transaction parties before management review/);
  assert.match(migration,/GRANT UPDATE ON deal_checklists/);
  assert.match(diary,/SELECT DISTINCT b\.id,b\.name,b\.job_role,b\.team_id,[\s\S]*AS diary_order[\s\S]*ORDER BY diary_order,b\.name/);
  assert.match(app,/NYSA CORE \$\{esc\(APP_VERSION\)\}/);
});
