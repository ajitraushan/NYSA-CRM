import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateExternalProperty } from '../src/transaction-representation-domain.js';
import { dealClosureGates } from '../src/deal-domain.js';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('Administration feature modules load before app workspace restoration',()=>{
  const source=read('public/bootstrap.js');
  const app=source.indexOf("'app.js'");
  for(const module of ['official-document-ui.js','market-intelligence-ui.js','commission-payout-ui.js','document-compliance-ui.js']){
    assert.ok(source.indexOf(`'${module}'`)>0);
    assert.ok(source.indexOf(`'${module}'`)<app,`${module} must load before app.js`);
  }
});

test('Opportunity stage refresh remains masked and stage header carries OP reference',()=>{
  const app=read('public/app.js'),css=read('public/index.html');
  assert.match(app,/opportunity-stage-refresh-mask/);
  assert.match(app,/data-stage-version>No draft saved<\/div>.*opportunity\.opportunityReference|\$\{esc\(opportunity\.opportunityReference\)\}/s);
  assert.match(css,/\.opportunity-stage-refresh-mask/);
  assert.doesNotMatch(app,/data-stage-save-draft>Save as draft<\/button>.*<\/footer>/);
});

test('Offer booking and closure identify OP Inventory and commercial values',()=>{
  const offer=read('public/offer-ui.js'),deal=read('public/deal-ui.js'),route=read('src/routes/opportunities.js');
  assert.match(offer,/inventoryDisplay/);
  assert.match(offer,/opportunity\.opportunityReference/);
  assert.match(deal,/Agreed property value/);
  assert.match(deal,/Reservation \/ deposit amount/);
  assert.match(route,/accepted_offer_amount/);
  assert.match(route,/inventory_headline/);
});

test('Dark guidance panels and separated booking helper text are enforced',()=>{
  const css=read('public/index.html');
  assert.match(css,/offer-reservation-note.*background:var\(--panel2\)/s);
  assert.match(css,/#booking-create-form output\{display:block/);
  assert.match(css,/#booking-create-form small\{display:block/);
});

test('Authority-issued completion documents can upload and auto-link in context',()=>{
  const ui=read('public/document-compliance-ui.js'),route=read('src/routes/document-compliance.js');
  assert.match(ui,/Upload received authority document/);
  assert.match(ui,/official-document-evidence/);
  assert.match(ui,/official-evidence-link/);
  assert.match(route,/definitionVersionId:instance\.officialDefinitionVersionId/);
  assert.match(route,/officialEvidenceFingerprint/);
});

test('Customer proposal exposes the maintained developer payment plan',()=>{
  const pdf=read('src/proposal-pdf.js');
  assert.match(pdf,/PAYMENT PLAN \/ AVAILABILITY.*paymentPlan/s);
  assert.match(pdf,/paymentPlanNotes/);
  assert.match(pdf,/postHandoverYears/);
});

test('Off-plan developer stock bypasses internal reservation and promotes only after Closed Won',()=>{
  const migration=read('src/migrations/129_dev214_offplan_developer_stock.sql'),route=read('src/routes/opportunities.js'),
    offer=read('public/offer-ui.js'),deal=read('public/deal-ui.js'),app=read('public/app.js'),
    deploy=read('scripts/deploy-crm-test-dev214.sh');
  assert.match(migration,/usage_kind IN \('external_cobroker','developer_stock'\)/);
  assert.match(migration,/developer_stock_attached/);
  assert.match(route,/\/crm\/opportunities\/:id\/developer-stock/);
  assert.match(route,/\/crm\/offers\/:offerId\/off-plan-deal/);
  assert.match(route,/internalInventoryCreated:false/);
  assert.match(route,/sold_inventory_created_from_off_plan_close/);
  assert.match(route,/ARRAY\['Off-plan'\]::text\[\]/);
  assert.match(route,/if\(!offer\.viewingFeedbackRecorded&&!developerStock\)/);
  assert.match(route,/developerStock\?'complete_deal':'create_reservation'/);
  assert.match(route,/Create the Off-plan Deal from this accepted revision/);
  assert.match(offer,/Internal reservation not applicable/);
  assert.match(deal,/Create Off-plan Deal from accepted Offer/);
  assert.match(app,/Capture current off-plan developer stock/);
  assert.match(deploy,/EXPECTED_VERSION=2\.1\.0-dev\.214/);
  assert.match(deploy,/PREVIOUS_VERSION=2\.1\.0-dev\.213/);
  assert.match(deploy,/LATEST_MIGRATION=129_dev214_offplan_developer_stock\.sql/);
  assert.match(deploy,/developer_stock_attached/);
  assert.match(deploy,/Production and R2 clone snapshots: unchanged/);
});

test('Off-plan developer stock requires enough evidence to create accurate Sold Inventory later',()=>{
  const base={usageKind:'developer_stock',projectOrBuilding:'Harbour Residences',propertyAddress:'Unit A-1204',propertyType:'Apartment',source:'Developer sales desk',sourceEvidence:'Price list dated 28 Sep 2026'};
  assert.match(validateExternalProperty(base).error,/Developer, community\/area, property type and current price/);
  const valid=validateExternalProperty({...base,developerName:'Example Developer',communityOrArea:'Dubai Harbour',propertyType:'Apartment',askingPrice:'5200000',currency:'aed'});
  assert.equal(valid.value.usageKind,'developer_stock');
  assert.equal(valid.value.askingPrice,5200000);
  assert.equal(valid.value.currency,'AED');
});

test('Off-plan Deal closure does not invent an internal reservation gate',()=>{
  const gates=dealClosureGates({deal:{dealType:'off_plan',acceptedOfferRevisionId:'revision-1',bookingId:null,status:'completion_in_progress'},
    parties:[{partyRole:'buyer'},{partyRole:'developer'}],items:[]});
  assert.equal(gates.find(gate=>gate.code==='reservation').complete,true);
  assert.match(gates.find(gate=>gate.code==='reservation').label,/without internal reservation/);
});

test('DEV214 keeps the linked-phone call outcome enhancement in the governed future backlog',()=>{
  const backlog=read('docs/CRM_FUTURE_CHANGE_BACKLOG.md');
  assert.match(backlog,/ENH-LEAD-CALL-001/);
  assert.match(backlog,/Starting or opening a call must never by itself change Lead status/);
});
