import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareGovernedSharePreflight} from '../src/governed-share-preflight-domain.js';
import {validatePurchasedRowDecisions} from '../src/purchased-data-import.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('DEV211 migration carries assignment identity, governed approvals and row exclusions',()=>{
  const sql=read('src/migrations/128_dev211_uat210_remediation.sql');
  for(const marker of ['viewings ADD COLUMN IF NOT EXISTS inventory_assignment_id','offers ADD COLUMN IF NOT EXISTS inventory_assignment_id','excluded_count','customer_change_requests','deal_cancellation_requests',"'preparation_only'",'CustomerChangeRequest','DealCancellationRequest'])assert.match(sql,new RegExp(marker));
  assert.match(sql,/customer_change_requests_one_pending_uq/);
  assert.match(sql,/deal_cancellation_requests_one_pending_uq/);
});

test('DEF-PDI register is implemented as one governed Bulk Upload workflow',()=>{
  const route=read('src/routes/purchased-data-import.js'),domain=read('src/purchased-data-import.js'),ui=read('public/purchased-data-import-ui.js'),access=read('src/role-access.js');
  for(const marker of ['rowDecisions','excluded_count','original_file_name','link_batch_phone','create_separate','createdByPhone','full_name'])assert.match(route+domain+ui,new RegExp(marker));
  assert.match(domain,/candidates=referenceMatches\.length\?referenceMatches:emailMatches\.length\?emailMatches:phoneMatches/);
  assert.doesNotMatch(domain,/byName/);
  assert.match(domain,/NYSA Customer reference was not found/);
  assert.match(domain,/NYSA Customer reference and phone identify different Customers/);
  assert.match(domain,/Email and phone identify different Customers/);
  assert.match(domain,/workbook_phone_duplicate/);
  assert.match(ui,/Valid rows are selected by default/);
  assert.match(ui,/Source file/);
  assert.match(ui,/Customer and Lead Bulk Upload/);
  assert.match(ui,/Selected \$\{selected\} · Excluded \$\{excluded\} · Invalid/);
  assert.match(ui,/Reason for phone decision \(required\)/);
  assert.match(route,/phone_decision/);
  assert.match(route,/phoneDecisions/);
  assert.match(access,/sales_agent:frozen\(\[CAPABILITY\.PURCHASED_DATA_IMPORT/);
  assert.match(access,/CAPABILITY\.PURCHASED_DATA_IMPORT/);
});

test('DEF-PDI row review requires reasons and returns auditable normalized decisions',()=>{
  const ordinary={rowNumber:2,action:'create',errors:[]},phone={rowNumber:3,action:'phone_confirmation',errors:[],matchBasis:'phone'};
  let result=validatePurchasedRowDecisions([ordinary,phone],[{rowNumber:2,include:false},{rowNumber:3,include:true,phoneAction:'link_existing'}]);
  assert.equal(result.valid,false);assert.match(result.errors.join(' '),/exclusion reason/);assert.match(result.errors.join(' '),/duplicate-phone decision/);
  result=validatePurchasedRowDecisions([ordinary,phone],[{rowNumber:2,include:false,exclusionReason:'Not part of this campaign'},{rowNumber:3,include:true,phoneAction:'link_existing',decisionReason:'Confirmed same Customer by the uploader'}]);
  assert.equal(result.valid,true);assert.equal(result.selectedRows.length,1);assert.equal(result.byRowNumber.get(3).phoneAction,'link_existing');
});

test('DEF-PDI row review rejects missing, duplicate, unknown and invalid-row selections',()=>{
  const rows=[{rowNumber:2,action:'invalid',errors:['Email or phone is required']},{rowNumber:3,action:'create',errors:[]}];
  const result=validatePurchasedRowDecisions(rows,[{rowNumber:2,include:true},{rowNumber:2,include:false},{rowNumber:99,include:true}]);
  assert.equal(result.valid,false);for(const marker of ['duplicate row decision','Unknown upload row decision','cannot be imported','review decision is required'])assert.match(result.errors.join(' '),new RegExp(marker));
});

test('DEF-CUS-001 stages every Customer edit for Manager decision and audit',()=>{
  const route=read('src/routes/crm.js'),ui=read('public/app.js'),tasks=read('src/routes/lead-operations.js');
  assert.match(route,/Customer change submitted for Manager approval/);
  assert.match(route,/customer-change-requests\/:id\/decision/);
  assert.match(route,/if\(decision==='approved'\)/);
  assert.match(route,/audit\('CustomerChangeRequest'/);
  assert.match(ui,/Change reason \*/);
  assert.match(ui,/current record remains effective until a Manager approves it/);
  assert.match(ui,/Approve and apply/);
  assert.match(tasks,/customer_change_approval/);
});

test('DEF-LEAVE-001 compares database dates as ISO day keys',()=>{
  const route=read('src/routes/agent-leave.js'),domain=read('src/agent-leave-domain.js');
  assert.match(route,/toISOString\(\)\.slice\(0,10\)/);
  assert.match(domain,/employmentStart=dayKey\(date\(employmentStartDate\)\)/);
});

test('DEF-COMM-001 permits prepare-only evidence while delivery remains separate',async()=>{
  const now='2026-09-26T08:00:00.000Z',floorPlan={assetReference:'FP-1',approvalStatus:'approved',rightsStatus:'cleared'},property={reference:'INV-1',project:'Synthetic',community:'Dubai',bedrooms:1,sizeSqft:800,amount:1000000,currency:'AED',floorPlans:[floorPlan]},live={inventoryReference:'INV-1',project:'Synthetic',community:'Dubai',bedrooms:1,sizeSqft:800,price:1000000,currency:'AED',status:'Available',effectiveStatus:'Available',workflowStatus:'approved',verificationStatus:'verified',verificationExpiresAt:'2026-10-26T08:00:00.000Z',activeReservation:false,floorPlans:[floorPlan]};
  const result=await prepareGovernedSharePreflight({checkedAt:now,shortlist:{evidenceHash:'a'.repeat(64),properties:[property]},liveInventory:[live],policyDecision:{id:'P-1',outcome:'preparation_only',actorRef:'A-1',subjectRef:'C-1',scopeRef:'O-1',channel:'whatsapp',purpose:'transactional_share',validUntil:'2026-09-26T08:10:00.000Z'},actorRef:'A-1',subjectRef:'C-1',scopeRef:'O-1'});
  assert.equal(result.value.status,'prepared_not_sent');assert.equal(result.value.automaticSend,false);
  const route=read('src/routes/release3c-governed-shares.js');assert.match(route,/deliveryPolicy\.outcome==='allowed'/);assert.match(route,/deliveryWarnings/);
});

test('DEF-OPP and DEF-OFF bind Viewing and Offer evidence to the active assignment',()=>{
  const route=read('src/routes/opportunities.js'),app=read('public/app.js'),offer=read('public/offer-ui.js');
  for(const marker of ['inventory_assignment_id','This Inventory assignment ended or was delinked','Assign the Inventory to this Opportunity before scheduling a viewing','complete a new viewing before creating an Offer'])assert.match(route,new RegExp(marker));
  assert.match(route,/opportunity_id=\$1 AND property_match_id=\$2 AND listing_id=\$3/);
  assert.match(route,/v\.inventory_assignment_id=f\.inventory_assignment_id/);
  assert.match(app,/viewingProperties=activeMatches/);
  assert.match(app,/Schedule another viewing/);
  assert.match(offer,/activeMatchIds/);
  assert.doesNotMatch(app,/viewingProperties=matches/);
});

test('DEF-UI register removes technical release copy and reserves red for real errors',()=>{
  const offer=read('public/offer-ui.js'),deal=read('public/deal-ui.js'),styles=read('public/index.html');
  assert.doesNotMatch(offer,/R2\.3/);
  assert.match(offer,/Creating an Offer does not reserve the property/);
  assert.match(styles,/\.deal-gate\.pending/);
  assert.match(styles,/\.offer-reservation-note/);
  assert.doesNotMatch(styles,/body \.deal-gate\{background:#fff/);
  assert.match(deal,/deal-gate pending/);
});

test('DEF-DEAL-001 requires Sales Agent request, Manager decision and finance-safe atomic release',()=>{
  const route=read('src/routes/opportunities.js'),ui=read('public/deal-ui.js'),tasks=read('src/routes/lead-operations.js');
  for(const marker of ['deal_cancellation_requests','A Sales Agent cancellation request is required','Finance must record the governed reversal','inventory_assignments','booking_status_history','Closed Lost'])assert.match(route,new RegExp(marker));
  assert.match(route,/jobRole!=='sales_agent'/);
  assert.match(route,/deal-cancellation-requests\/:id\/reject/);
  assert.match(ui,/ME\.jobRole==='sales_agent'/);
  assert.match(ui,/Submit cancellation for Manager approval/);
  assert.match(ui,/Approve cancellation and release Inventory/);
  assert.match(tasks,/deal_cancellation_approval/);
});
