import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateVerificationSubmission } from '../src/inventory-verification-domain.js';
import { evaluateInventoryEligibilityV2 } from '../src/inventory-eligibility-domain.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('R3B-INVENTORY-BOUNDARY-52 separates Internal Inventory from portal Listing evidence',()=>{
  const ui=read('public/app.js'),start=ui.indexOf('async function openListingForm'),end=ui.indexOf('\nasync function',start+20),inventoryForm=ui.slice(start,end);
  assert.ok(start>0&&end>start);assert.match(inventoryForm,/Who or what supplied this property to NYSA\?/);assert.match(inventoryForm,/Enter the owner only when the owner contacted NYSA directly/);assert.match(inventoryForm,/does not prove ownership or authorize NYSA to list the property/);assert.match(inventoryForm,/Owner and authority are completed after the Draft is saved/);
  for(const portalOnly of ['Agreement type','Agreement evidence','Portal permit number','Portal \/ channel'])assert.doesNotMatch(inventoryForm,new RegExp(portalOnly));
  assert.match(ui,/NYSA CORE \/ EXTERNAL PORTAL LISTINGS/);assert.match(ui,/Marketing agreement and permit evidence/);assert.match(ui,/No automatic portal publication/);
});

test('R3B-INVENTORY-BOUNDARY-52 verifies owner authority without an unapproved availability-age gate',()=>{
  const route=read('src/routes/listings.js'),opportunities=read('src/routes/opportunities.js'),ui=read('public/app.js'),start=route.indexOf("r.post('/listings/:id/verification-requests'"),end=route.indexOf("r.post('/inventory-verification-requests/:id/decision'",start),submissionRoute=route.slice(start,end);
  assert.ok(start>0&&end>start);assert.match(submissionRoute,/Add and save the Inventory owner or represented party before submitting for verification/);assert.doesNotMatch(submissionRoute,/availabilityConfirmedAt|availability confirmation|older than seven days/i);assert.match(route,/noOwnerCreated:true,noAgreementCreated:true/);
  const submission=validateVerificationSubmission({currentStatus:'unverified',requestType:'verification',reason:'Manager review of owner authority',evidenceReference:'OWNER-AUTH-011',availabilityConfirmedAt:null});assert.equal(submission.value.requestType,'verification');
  assert.doesNotMatch(opportunities,/\$\{alias\}\.availability_confirmed_at IS NOT NULL|availability_confirmed_at>=NOW\(\)-INTERVAL '7 days'/);assert.match(opportunities,/cannot be scheduled for viewing/);assert.match(opportunities,/cannot create a customer reservation/);
  assert.match(ui,/Availability is not part of this verification and will be confirmed by the Sales Agent when assigning the Inventory inside an Opportunity/);
});

test('R3B-OPPORTUNITY-INVENTORY-62 accepts verified active Inventory without treating Opportunity creation as an availability commitment',()=>{
  const opportunities=read('src/routes/opportunities.js'),helperStart=opportunities.indexOf('async function requireOpportunityInventory'),helperEnd=opportunities.indexOf('async function inheritInventoryOwner',helperStart),helper=opportunities.slice(helperStart,helperEnd),creationStart=opportunities.indexOf("r.post('/crm/leads/:id/opportunities'"),creationEnd=opportunities.indexOf('\nr.',creationStart+10),creation=opportunities.slice(creationStart,creationEnd);
  assert.ok(helperStart>0&&helperEnd>helperStart&&creationStart>0&&creationEnd>creationStart);
  assert.match(helper,/workflow_status='approved'/);
  assert.match(helper,/verification_status IN \('verified','not_required'\)/);
  assert.match(helper,/nysa_inventory_effective_status\(l\.id\) NOT IN \('Sold','Rented','Closed'\)/);
  assert.match(helper,/verification_expires_at/);
  assert.match(opportunities,/Property is already reserved under/);
  assert.doesNotMatch(helper,/availability_confirmed_at|INTERVAL '7 days'/);
  assert.match(creation,/requireOpportunityInventory\(listingId,requirement,input\.transactionType,client\)/);
  assert.doesNotMatch(creation,/requireLiveInventory\(listingId,null,client\)/);
  assert.match(opportunities,/requireLiveInventory\(checked\.value\.listingId,opportunity\.id,client\)/);
  assert.match(opportunities,/requireLiveInventory\(match\.listingId,opportunity\.id,client\)/);
});

test('R3A-OPPORTUNITY-AUTHORITY-CARRYOVER-68 uses verified internal authority for buyer representation and reserves mandates for seller-side paths',()=>{
  const opportunities=read('src/routes/opportunities.js'),ui=read('public/app.js'),creationStart=opportunities.indexOf("r.post('/crm/leads/:id/opportunities'"),creationEnd=opportunities.indexOf('\nr.',creationStart+10),creation=opportunities.slice(creationStart,creationEnd);
  assert.ok(creationStart>0&&creationEnd>creationStart);
  assert.match(creation,/if\(\['inventory','dual'\]\.includes\(input\.representationPath\)\)/);
  assert.match(creation,/representationAgreement\?\.evidenceReference\|\|inventoryParty\.authorityEvidence/);
  assert.match(creation,/Seller\/landlord or dual representation requires an active mandate agreement/);
  assert.doesNotMatch(creation,/The selected Inventory must have an active mandate or authority agreement/);
  assert.match(ui,/An active mandate is required only when NYSA represents the seller\/landlord or both sides/);
});

test('R3B-OPPORTUNITY-REQUIREMENT-64 binds conversion to the exact current requirement instead of stale Lead summaries',()=>{
  const ui=read('public/app.js'),crm=read('src/routes/crm.js'),start=ui.indexOf('async function openCreateOpportunity'),end=ui.indexOf('\nasync function',start+20),form=ui.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(crm,/lead_requirement_confirmations confirmation ON confirmation\.requirement_id=lr\.id/);
  assert.match(form,/operatingContext\.requirement/);
  assert.match(form,/requirement\.budgetMin/);
  assert.match(form,/requirement\.budgetMax/);
  assert.match(form,/Current requirement budget/);
  assert.match(form,/This Opportunity will bind to the exact current requirement version shown above/);
  assert.match(form,/Broker-confirmed by/);
});

test('R3B-OPPORTUNITY-COMMERCIAL-65 distinguishes inherited agent identity from manually governed commercial terms',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/Agent identity is inherited\. Commission, minimum and internal split values are not inferred/);
  assert.match(ui,/enter only terms that have actually been agreed/);
});

test('R3B-OPPORTUNITY-FORM-66 prevents accidental backdrop closure while a business form is open',()=>{
  const ui=read('public/app.js');
  assert.match(ui,/e\.target === o&&!o\.querySelector\('form'\)/);
  assert.match(ui,/forms[\s\S]*explicit close\/cancel control/);
});

test('R3B-AGENT-PRIORITY-67 removes the duplicate priority column for every role',()=>{
  const dashboard=read('public/dashboard-ui.js');
  const styles=read('public/index.html');
  assert.match(dashboard,/dashboard-priority-flow'\)\.replaceChildren\(\)/);
  assert.match(styles,/#dashboard-priority-flow\{display:none\}/);
  assert.match(dashboard,/What needs attention now/);
});

test('R3B-PORTAL-LISTING-69 exposes portal-only fields while keeping owner and authority evidence internal',()=>{
  const route=read('src/routes/listings.js'),ui=read('public/app.js'),start=ui.indexOf('async function renderExternalPortalListings'),end=ui.indexOf('\nasync function',start+20),workspace=ui.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(route,/canMaintainPortalEvidence:canEdit\(req\.broker,listing\)/);
  assert.match(route,/canCreateExternalPublication:canEdit\(req\.broker,listing\)\|\|await canReview/);
  assert.doesNotMatch(route,/res\.json\(\{inventories,publications,inventoryParties/);
  assert.match(workspace,/x\.canMaintainPortalEvidence/);
  assert.doesNotMatch(workspace,/\['listing_agent','admin_assistant'\]\.includes\(ME\.jobRole\)/);
  assert.doesNotMatch(workspace,/Owner \/ represented party \*/);
  assert.doesNotMatch(workspace,/name="counterpartyId" required/);
  assert.match(workspace,/Owner identity, contact details, agreements and private evidence remain internal-only/);
  for(const field of ['Portal / channel','Internal marketing authority','Permit number','Permit expiry'])assert.match(workspace,new RegExp(field));
});

test('R3A-OPPORTUNITY-CORRECTION-LINK-70 links mandate correction to External Portal Listings and distinguishes placeholder guidance',()=>{
  const ui=read('public/app.js'),styles=read('public/index.html');
  assert.match(ui,/Open External Portal Listings to maintain mandate/);
  assert.match(ui,/portalCorrection\.hidden=form\.elements\.representationPath\.value==='buyer'/);
  assert.match(ui,/switchTab\('externalListings'\)/);
  assert.match(styles,/input::placeholder,textarea::placeholder/);
  assert.match(styles,/font-style:italic/);
  assert.match(styles,/color:#9a9488!important/);
});

test('OPP-INVENTORY-ELIGIBILITY-PARITY-72 keeps customer fit advisory and uses canonical operational status',()=>{
  const checkedAt='2026-08-17T12:00:00.000Z',requirement={businessLine:'Sale',budgetMax:1500000,mustHaves:['Unobstructed sea view'],exclusions:['Tenanted property']};
  const listing={id:'inventory-72',inventoryReference:'NYSA-INV-PARITY-72',deletedAt:null,workflowStatus:'approved',verificationStatus:'verified',
    effectiveStatus:'Available',storedStatus:'Closed',verificationExpiresAt:'2026-09-17T12:00:00.000Z',availabilityConfirmedAt:null,
    transactionTypes:['Sale'],price:1000000,sizeSqft:900,area:'Dubai Marina',community:'Dubai Marina',propertyType:'Apartment',bedrooms:'2',paymentPlanType:'Cash',handoverStatus:'ready'};
  const unassessed=evaluateInventoryEligibilityV2({listing,requirement,assessments:[],checkedAt});
  assert.equal(unassessed.eligible,true);
  assert.equal(unassessed.state,'eligible');
  assert.deepEqual(unassessed.advisories.filter(item=>item.code.endsWith('_fit_variance')).map(item=>item.code),['must_have_fit_variance','exclusion_fit_variance']);
  const assessed=evaluateInventoryEligibilityV2({listing,requirement,assessments:[
    {declarationKind:'must_have',declarationIndex:0,sequenceNo:1,result:'met'},
    {declarationKind:'exclusion',declarationIndex:0,sequenceNo:1,result:'not_met'}
  ],checkedAt});
  assert.equal(assessed.eligible,true,'Stored Closed must not override canonical Available');
  assert.equal(assessed.evidence.status,'Available');
  const canonicallyClosed=evaluateInventoryEligibilityV2({listing:{...listing,storedStatus:'Available',effectiveStatus:'Closed'},requirement,assessments:[
    {declarationKind:'must_have',declarationIndex:0,sequenceNo:1,result:'met'},
    {declarationKind:'exclusion',declarationIndex:0,sequenceNo:1,result:'not_met'}
  ],checkedAt});
  assert.equal(canonicallyClosed.eligible,false,'Canonical Closed must block even when stored status is Available');
  assert.ok(canonicallyClosed.reasons.some(item=>item.code==='not_available'));
});

test('BOOKING-DEPOSIT-CARRYFORWARD-73 derives reservation value from the exact accepted deposit and evidence-gates blocking',()=>{
  const route=read('src/routes/opportunities.js'),ui=read('public/offer-ui.js'),domain=read('src/booking-domain.js'),start=ui.indexOf('function bookingWorkspaceHTML'),end=ui.indexOf('function bindOfferWorkspace',start),bookingUi=ui.slice(start,end);
  assert.match(route,/SELECT id,deposit_amount,currency,validity_expires_at,document_version_id FROM offer_revisions WHERE id=\$1 AND offer_id=\$2/);
  assert.match(route,/Number\(acceptedRevision\.depositAmount\)/);
  assert.match(route,/acceptedRevision\.currency/);
  assert.doesNotMatch(domain,/input\.bookingAmount|input\.currency/);
  assert.match(ui,/Reservation amount from accepted revision/);
  assert.match(ui,/Read-only\. CORE carries forward the exact accepted Offer deposit/);
  assert.match(ui,/Evidence required before Inventory blocking/);
  assert.match(ui,/button\.disabled=!\(file&&allowed&&withinLimit\)/);
  assert.doesNotMatch(bookingUi,/name="bookingAmount"|name="currency"/);
});

test('BOOKING-EXPIRY-GOVERNANCE-74 defaults seven days and records Manager-only extensions within fourteen cumulative days',()=>{
  const route=read('src/routes/opportunities.js'),ui=read('public/offer-ui.js'),domain=read('src/booking-domain.js'),migration=read('src/migrations/079_release3b_reservation_expiry_governance.sql');
  assert.match(domain,/expiry=new Date\(start\.getTime\(\)\+7\*DAY_MS\)/);
  assert.match(domain,/fourteen cumulative days from the original start/);
  assert.match(route,/Only the maintained manager for this Opportunity may approve a reservation extension/);
  assert.match(route,/INSERT INTO booking_reservation_extensions/);
  assert.match(route,/FOR UPDATE OF b/);
  assert.match(ui,/Exactly 7 days from confirmation/);
  assert.doesNotMatch(ui,/name="reservationStartsAt"/);
  assert.match(ui,/Maximum cumulative reservation: 14 days from the original start/);
  assert.match(migration,/CREATE TABLE booking_reservation_extensions/);
  assert.match(migration,/booking_reservation_extensions_immutable/);
  assert.match(migration,/bookings_reservation_expiry_policy/);
  assert.match(migration,/initial reservation cannot exceed seven days/);
  assert.match(migration,/reservation cannot exceed fourteen cumulative days/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/);
});

test('R3B-IMPORT-ATTRIBUTION-53 retains historical attribution while disabling transferable custody',()=>{
  const migration=read('src/migrations/078_release3b_inventory_progressive_governance.sql'),route=read('src/routes/listings.js'),importRoute=read('src/routes/inventory-import.js'),agentGovernance=read('src/inventory-agent-governance.js');
  assert.match(migration,/CREATE TABLE inventory_agent_assignment_history/);assert.match(migration,/BEFORE UPDATE OR DELETE/);assert.match(migration,/Historical Inventory attribution snapshot/);assert.doesNotMatch(migration,/INSERT INTO schema_migrations/);
  assert.match(route,/Inventory has no transferable custodian/);assert.doesNotMatch(route,/expectedResponsibleAgentId/);assert.match(importRoute,/inventoryAgentResolutionDirectory/);assert.match(importRoute,/defaultOriginatingAgentReference/);assert.match(importRoute,/FOR SHARE/);assert.match(importRoute,/requestedAgentReferences\(sourceRows\)/);assert.match(agentGovernance,/\['admin_assistant','listing_agent'\]/);assert.doesNotMatch(importRoute,/listing@nysarealty\.com/);
});

test('R3B-INVENTORY-VERIFY-55 makes pending verification a manager operating queue',()=>{
  const dashboard=read('public/dashboard-ui.js'),opportunities=read('src/routes/opportunities.js');assert.match(dashboard,/data-inventory-verification-shortcut/);assert.match(dashboard,/data-guided-verification/);assert.match(opportunities,/inventory_verification_requests/);assert.match(opportunities,/Verify, return or reject Inventory/);
});
