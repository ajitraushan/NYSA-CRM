import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parsePurchasedWorkbook,validatePurchasedRows} from '../src/purchased-data-import.js';

const source=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const customer={id:'customer-1',customerReference:'NYSA-CUS-2026-000001',fullName:'Synthetic Customer',email:'buyer@example.test',phone:'+971501112222'};
const options=(moduleType,extra={})=>({moduleType,sourceSystemCode:'synthetic_supplier',acquisitionBatchReference:'SYN-001',existingSourceRows:[],identityMatches:[],...extra});

test('approved RR-015 workbooks are safe templates and reject unchanged placeholders',async()=>{
  const customerWorkbook=fs.readFileSync(new URL('../public/templates/purchased-customer-import-template.xlsx',import.meta.url));
  const leadWorkbook=fs.readFileSync(new URL('../public/templates/purchased-lead-import-template.xlsx',import.meta.url));
  await assert.rejects(()=>parsePurchasedWorkbook(customerWorkbook,'customer_only'),/Replace every template placeholder/);
  await assert.rejects(()=>parsePurchasedWorkbook(leadWorkbook,'lead'),/Replace every template placeholder/);
});

test('customer-only import accepts email-only and phone-only identities without creating lead semantics',()=>{
  const rows=validatePurchasedRows([
    {rowNumber:2,externalRowReference:'C-1',fullName:'Synthetic Email',email:'EMAIL@EXAMPLE.TEST'},
    {rowNumber:3,externalRowReference:'C-2',fullName:'Synthetic Phone',phone:'+971 50 123 4567'}
  ],options('customer_only'));
  assert.deepEqual(rows.map(row=>row.action),['create','create']);
  assert.equal(rows[0].normalized.email,'email@example.test');
  assert.equal(rows[1].normalized.phone,'+971501234567');
  assert.ok(rows.every(row=>row.errors.length===0));
});

test('customer-only import holds unusable and ambiguous identities',()=>{
  const rows=validatePurchasedRows([
    {rowNumber:2,externalRowReference:'C-1',fullName:'Name only'},
    {rowNumber:3,externalRowReference:'C-2',fullName:'Conflict',email:'one@example.test',phone:'+971500000001'}
  ],options('customer_only',{identityMatches:[{id:'one',email:'one@example.test'},{id:'two',phone:'+971500000001'}]}));
  assert.equal(rows[0].action,'invalid');
  assert.equal(rows[1].action,'review_required');
});

test('customer exact match links without overwriting and committed provenance is idempotently skipped',()=>{
  const linked=validatePurchasedRows([{rowNumber:2,externalRowReference:'C-1',fullName:'Synthetic Customer',email:'buyer@example.test'}],options('customer_only',{identityMatches:[customer]}))[0];
  assert.equal(linked.action,'linked');assert.equal(linked.matchedContact.id,customer.id);
  const skipped=validatePurchasedRows([{rowNumber:2,externalRowReference:'C-1',fullName:'Synthetic Customer',email:'buyer@example.test'}],options('customer_only',{identityMatches:[customer],existingSourceRows:[{sourceSystemCode:'synthetic_supplier',acquisitionBatchReference:'SYN-001',externalRowReference:'C-1'}]}))[0];
  assert.equal(skipped.action,'skipped');
});

test('lead import resolves exactly one Customer and does not invent preferences',()=>{
  const row=validatePurchasedRows([{rowNumber:2,externalRowReference:'L-1',customerReference:customer.customerReference,leadTitle:'Synthetic enquiry',businessType:'Sale'}],options('lead',{identityMatches:[customer]}))[0];
  assert.equal(row.action,'create');assert.equal(row.matchedContact.id,customer.id);assert.deepEqual(row.normalized.preferredAreas,[]);assert.equal(row.normalized.budgetMin,null);
});

test('lead import creates a minimal Customer only when exact reference and email do not resolve',()=>{
  const unmatched=validatePurchasedRows([{rowNumber:2,externalRowReference:'L-NEW',fullName:'New Synthetic Customer',email:'new@example.test',leadTitle:'New enquiry',businessType:'Sale'}],options('lead'))[0];
  assert.equal(unmatched.action,'create');assert.equal(unmatched.matchedContact,null);assert.equal(unmatched.normalized.fullName,'New Synthetic Customer');
  const byNameOnly=validatePurchasedRows([{rowNumber:2,externalRowReference:'L-NAME',fullName:customer.fullName,phone:'+971500000099',leadTitle:'Name must not match',businessType:'Sale'}],options('lead',{identityMatches:[customer]}))[0];
  assert.equal(byNameOnly.matchedContact,null);assert.equal(byNameOnly.action,'create');
});

test('phone-only and repeated workbook phone matches require explicit confirmation',()=>{
  const existingPhone=validatePurchasedRows([{rowNumber:2,externalRowReference:'L-PHONE',fullName:'Phone enquiry',phone:customer.phone,leadTitle:'Phone enquiry',businessType:'Sale'}],options('lead',{identityMatches:[customer]}))[0];
  assert.equal(existingPhone.action,'phone_confirmation');assert.equal(existingPhone.matchBasis,'phone');
  const repeated=validatePurchasedRows([
    {rowNumber:2,externalRowReference:'L-A',fullName:'First',phone:'+971500001111',leadTitle:'First',businessType:'Sale'},
    {rowNumber:3,externalRowReference:'L-B',fullName:'Second',phone:'+971500001111',leadTitle:'Second',businessType:'Sale'}
  ],options('lead'));
  assert.ok(repeated.every(row=>row.action==='phone_confirmation'&&row.matchBasis==='workbook_phone_duplicate'));
});

test('enriched lead import requires explicit purpose and timing',()=>{
  const invalid=validatePurchasedRows([{rowNumber:2,externalRowReference:'L-1',customerReference:customer.customerReference,leadTitle:'Synthetic enquiry',businessType:'Sale',budgetMin:'1,000,000'}],options('lead',{identityMatches:[customer]}))[0];
  assert.equal(invalid.action,'invalid');assert.match(invalid.errors.join(' '),/purpose/);assert.match(invalid.errors.join(' '),/timing/);
  const valid=validatePurchasedRows([{rowNumber:2,externalRowReference:'L-2',customerReference:customer.customerReference,leadTitle:'Synthetic enquiry',businessType:'Sale',budgetMin:'1,000,000',budgetMax:'2,000,000',preferredAreas:'Dubai Marina; JLT',purpose:'investment',timeline:'0_3_months'}],options('lead',{identityMatches:[customer]}))[0];
  assert.equal(valid.action,'create');assert.deepEqual(valid.normalized.preferredAreas,['Dubai Marina','JLT']);
});

test('DEF-124 placement, Closure Steps and clearer booking text are present',()=>{
  const app=source('public/app.js'),deal=source('public/deal-ui.js'),offer=source('public/offer-ui.js');
  assert.match(app,/id="lead-record-contact">Record customer contact/);
  assert.ok(app.indexOf('Customer interaction &amp; enrichment')<app.indexOf('Conversation and activity history'));
  assert.match(app,/Closure Steps/);assert.doesNotMatch(deal,/Deal and completion/);assert.match(offer,/cannot be changed here/);assert.doesNotMatch(offer,/CORE carries forward/);
});

test('DEF-125 separates Admin configuration from operational evidence access',()=>{
  const route=source('src/routes/official-document-evidence.js');
  assert.match(route,/replace\(\/\^\\\/api\(\?=\\\/\)\//);
  assert.match(route,/routePath\.startsWith\('\/admin\/'\)/);
  assert.match(route,/return hasInternalCrmIdentity\(req\.broker\)/);
});

test('Marketing Compliance no longer calls an undefined assistant authorization helper',()=>{
  const route=source('src/routes/marketing-material-compliance.js');
  assert.doesNotMatch(route,/assistant\(req\.broker\)/);assert.match(route,/canDraftConfiguration:admin\(req\.broker\)/);
});

test('explicitly assigned Manager tasks bypass unrelated Lead-scope filtering',()=>{
  const route=source('src/routes/lead-operations.js');
  assert.match(route,/t\.task_type='leave_approval' AND t\.assignee_id=\$\{governedAssignee\}/);
  assert.match(route,/OR t\.assignee_id=\$\{governedAssignee\} OR \(\$\{scope\.clause\}\)/);
});

test('RR-015 has separate templates, private storage, unchanged-preview binding and reconciliation',()=>{
  const route=source('src/routes/purchased-data-import.js'),migration=source('src/migrations/127_governed_purchased_data_intake.sql'),ui=source('public/purchased-data-import-ui.js');
  for(const file of ['public/templates/purchased-customer-import-template.xlsx','public/templates/purchased-lead-import-template.xlsx'])assert.ok(fs.statSync(new URL(`../${file}`,import.meta.url)).size>1000,file);
  assert.match(route,/savePrivate\(file\.buffer,'\.xlsx'\)/);assert.match(route,/previewHash=hash\(payload\)/);assert.match(route,/reconciliation\.csv/);assert.match(migration,/storage_key TEXT NOT NULL/);assert.match(ui,/Customer-only upload creates Customer records/);assert.match(ui,/creates the minimum Customer and Lead together/);
});

test('Inventory reference is explicitly labelled in generated Offer and Proposal documents',()=>{
  assert.match(source('src/offer-pdf.js'),/Inventory reference:/);assert.match(source('src/proposal-pdf.js'),/INVENTORY REFERENCE/);assert.doesNotMatch(source('src/proposal-pdf.js'),/Inventory ID:/);
});
