import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { INVENTORY_IMPORT_CONTRACT_VERSION,INVENTORY_IMPORT_HEADERS,INVENTORY_IMPORT_PAYMENT_PLANS,parseInventoryWorkbook,validateInventoryImportRows } from '../src/inventory-import.js';
import { inventoryAgentScopeSql } from '../src/inventory-agent-governance.js';

const agentDirectory=[
  {id:'00000000-0000-4000-8000-000000000041',email:'origin@nysa.test',name:'Origin Agent'},
  {id:'00000000-0000-4000-8000-000000000042',email:'responsible@nysa.test',name:'Responsible Agent'}
];
const validRow={rowNumber:2,externalRecordId:'LEGACY-1001',inventoryHeadline:'Marina Gate · 2 bedroom',project:'Marina Gate',developer:'Select Group',
  areaCode:'dubai_marina',community:'Dubai Marina',unitReference:'1204',building:'Marina Gate Tower 1',propertyType:'Apartment',bedrooms:'2',sizeSqft:1234,price:2500000,referencePrice:2600000,
  currency:'AED',paymentPlanType:'Developer plan',handoverStatus:'ready',exclusivityTier:'Off-market',originatingAgentReference:'origin@nysa.test',responsibleAgentReference:'responsible@nysa.test',
  ownerRole:'seller',ownerType:'person',ownerName:'Inventory Owner',ownerPhone:'+971501234567',ownerEmail:'owner@example.com',ownerSource:'Owner instruction',ownerAuthorityEvidence:'Instruction REF-1001',
  contact:'Legacy CRM owner desk',notes:'Migration review required'};
const options={sourceCode:'current_crm',activeAreaCodes:['dubai_marina'],agentDirectory};

test('Inventory Excel contract creates governed provider-neutral Draft payloads',()=>{
  assert.equal(INVENTORY_IMPORT_CONTRACT_VERSION,'inventory-import-v1.4');assert.deepEqual(INVENTORY_IMPORT_PAYMENT_PLANS,['Developer plan','Post-handover']);assert.equal(INVENTORY_IMPORT_HEADERS.length,33);
  assert.deepEqual(INVENTORY_IMPORT_HEADERS.slice(4,9),['area_code','community','unit_reference','building','property_type']);
  const [row]=validateInventoryImportRows([validRow],options);
  assert.deepEqual(row.errors,[]);assert.equal(row.skipped,false);assert.equal(row.intake.provider,'current_crm');assert.equal(row.intake.sourceKind,'import');
  assert.equal(row.intake.listing.inventoryHeadline,validRow.inventoryHeadline);assert.equal(row.intake.listing.originatingAgentId,agentDirectory[0].id);assert.equal(row.intake.listing.responsibleAgentId,agentDirectory[1].id);
  assert.deepEqual(row.intake.listing.owner,{partyRole:'seller',partyType:'person',displayName:'Inventory Owner',phone:'+971501234567',email:'owner@example.com',source:'Owner instruction',authorityEvidence:'Instruction REF-1001'});
});

test('Inventory Excel permits owner enrichment after Draft but rejects a partial owner group',()=>{
  const ownerless={...validRow,ownerRole:'',ownerType:'',ownerName:'',ownerPhone:'',ownerEmail:'',ownerSource:'',ownerAuthorityEvidence:''};
  const [draft]=validateInventoryImportRows([ownerless],options);assert.deepEqual(draft.errors,[]);assert.equal(draft.intake.listing.owner,null);assert.match(draft.warnings.join(' '),/add owner and authority evidence before verification/i);
  for(const field of ['ownerRole','ownerType','ownerName','ownerSource','ownerAuthorityEvidence']){
    const [row]=validateInventoryImportRows([{...validRow,[field]:''}],options);assert.match(row.errors.join(' '),/listing\.owner/i,field);
  }
  for(const excluded of ['agreement_type','representation','agreement_evidence_reference','permit_number','portal_status'])assert.ok(!INVENTORY_IMPORT_HEADERS.includes(excluded));
});

test('Inventory Excel requires governed agent attribution and respects assignment scope',()=>{
  const missing=validateInventoryImportRows([{...validRow,originatingAgentReference:'',responsibleAgentReference:''}],{...options,defaultOriginatingAgentReference:'',defaultResponsibleAgentReference:''})[0];
  assert.match(missing.errors.join(' '),/Originating agent reference/);
  const outsideDirectory=[...agentDirectory,{id:'00000000-0000-4000-8000-000000000043',email:'outside@nysa.test',name:'Outside Agent',status:'active',eligible:true,inScope:false}];
  const outside=validateInventoryImportRows([{...validRow,responsibleAgentReference:'outside@nysa.test'}],{...options,agentDirectory:outsideDirectory})[0];assert.match(outside.errors.join(' '),/outside your Inventory assignment scope/);
  const defaulted=validateInventoryImportRows([{...validRow,originatingAgentReference:'',responsibleAgentReference:''}],{...options,defaultOriginatingAgentReference:'origin@nysa.test'})[0];
  assert.deepEqual(defaulted.errors,[]);assert.equal(defaulted.responsibleAgentId,agentDirectory[0].id);
});

test('Inventory agent resolution distinguishes governed failure causes and has no uploader-email dependency',()=>{
  const maintained={id:'00000000-0000-4000-8000-000000000044',email:'ajit@nysarealty.com',name:'Ajitr',status:'active',eligible:true,inScope:true};
  const resolved=validateInventoryImportRows([{...validRow,originatingAgentReference:maintained.email,responsibleAgentReference:maintained.email}],{...options,agentDirectory:[maintained]})[0];
  assert.deepEqual(resolved.errors,[]);assert.equal(resolved.originatingAgentId,maintained.id);assert.equal(resolved.responsibleAgentId,maintained.id);
  const defaulted=validateInventoryImportRows([{...validRow,originatingAgentReference:maintained.email,responsibleAgentReference:''}],{...options,agentDirectory:[maintained]})[0];
  assert.deepEqual(defaulted.errors,[]);assert.equal(defaulted.responsibleAgentId,maintained.id);
  const cases=[
    {directory:[],message:/not a maintained NYSA login email/},
    {directory:[{...maintained,status:'suspended'}],message:/inactive NYSA user/},
    {directory:[maintained,{...maintained,id:'00000000-0000-4000-8000-000000000045'}],message:/ambiguous/},
    {directory:[{...maintained,inScope:false}],message:/outside your Inventory assignment scope/}
  ];
  for(const item of cases){const row=validateInventoryImportRows([{...validRow,originatingAgentReference:maintained.email,responsibleAgentReference:maintained.email}],{...options,agentDirectory:item.directory})[0];assert.match(row.errors.join(' '),item.message);}
  const params=[];assert.equal(inventoryAgentScopeSql({id:'listing-user',role:'internal_broker',jobRole:'listing_agent'},'b',params),'TRUE');assert.deepEqual(params,[]);
  const salesParams=[];assert.equal(inventoryAgentScopeSql({id:'sales-user',role:'internal_broker',jobRole:'sales_agent'},'b',salesParams),'b.id=$1');assert.deepEqual(salesParams,['sales-user']);
});

test('Inventory Excel keeps customer funding outside property-specific payment terms',()=>{
  for(const customerFunding of ['Cash','Mortgage']){const [row]=validateInventoryImportRows([{...validRow,paymentPlanType:customerFunding}],options);assert.match(row.errors.join(' '),/customer requirement/);assert.equal(row.skipped,false);}
  const blank=validateInventoryImportRows([{...validRow,paymentPlanType:''}],options)[0];assert.deepEqual(blank.errors,[]);
});

test('Inventory import never overwrites a source record and detects conflicting workbook IDs',()=>{
  const existing=validateInventoryImportRows([validRow],{...options,existingRecords:[{sourceProvider:'current_crm',externalRecordId:'LEGACY-1001'}]})[0];assert.equal(existing.skipped,true);assert.match(existing.skipReason,/never overwritten/);
  const rows=validateInventoryImportRows([validRow,{...validRow,rowNumber:3,price:2700000}],options);assert.equal(rows[0].errors.length,0);assert.match(rows[1].errors.join(' '),/conflicts with Excel row 2/);
});

test('Inventory Excel blocks an active exact identity and links the existing readable Inventory',()=>{
  const [row]=validateInventoryImportRows([validRow],{...options,inventoryRecords:[{id:'existing-active-id',inventoryReference:'NYSA-INV-000018',status:'Available',
    areaCode:'dubai_marina',community:' Dubai   Marina ',unitReference:'1204',building:'marina gate tower 1',sizeSqft:1234}]});
  assert.deepEqual(row.errors,[]);assert.equal(row.skipped,true);assert.equal(row.duplicateOutcome,'active_duplicate');
  assert.equal(row.matchedListingId,'existing-active-id');assert.equal(row.matchedInventoryReference,'NYSA-INV-000018');assert.match(row.skipReason,/no second Inventory/i);
});

test('Inventory Excel routes a closed exact identity to manager-approved reopening',()=>{
  const [row]=validateInventoryImportRows([validRow],{...options,inventoryRecords:[{id:'existing-closed-id',inventoryReference:'NYSA-INV-000019',status:'closed',
    areaCode:'dubai_marina',community:'Dubai Marina',unitReference:'1204',building:'Marina Gate Tower 1',sizeSqft:1234}]});
  assert.deepEqual(row.errors,[]);assert.equal(row.skipped,true);assert.equal(row.duplicateOutcome,'closed_match');
  assert.equal(row.matchedListingId,'existing-closed-id');assert.match(row.skipReason,/Manager approval to reopen/i);
});

test('Inventory import rejects unmapped or incomplete property facts before commit',()=>{
  const [row]=validateInventoryImportRows([{...validRow,areaCode:'Not a stable code',propertyType:'Office'}],{...options,sourceCode:'inventory_excel'});assert.ok(row.errors.length);assert.match(row.errors.join(' '),/areaCode|governed|propertyType|mapped/i);
  const inactive=validateInventoryImportRows([{...validRow,areaCode:'palm_jumeirah'}],{...options,sourceCode:'inventory_excel'})[0];assert.match(inactive.errors.join(' '),/not active in NYSA Area Maintenance/);
});

test('approved Inventory workbook is readable and deliberately contains no live sample rows',async()=>{
  const buffer=fs.readFileSync(new URL('../public/templates/inventory-import-template.xlsx',import.meta.url));await assert.rejects(()=>parseInventoryWorkbook(buffer),/contains no Inventory rows/);
});

test('Inventory Excel API is authenticated atomic draft-only intake and UI exposes preview commit',()=>{
  const route=fs.readFileSync(new URL('../src/routes/inventory-import.js',import.meta.url),'utf8'),server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8'),ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),provider=fs.readFileSync(new URL('../src/routes/listing-intake.js',import.meta.url),'utf8');
  for(const marker of ["r.use(requireAuth)","/inventory-import/preview","/inventory-import/commit","transaction(async client",'pg_advisory_xact_lock','createHmac','reviewToken',"'processing'",'processEventWithClient','noAutomaticVerification:true',"['23502','23503','23514']",'Zero records were imported','inventoryAgentResolutionDirectory','requestedAgentReferences'])assert.ok(route.includes(marker),`missing route control ${marker}`);
  assert.match(server,/import inventoryImportRoutes from '.\/routes\/inventory-import\.js'/);assert.match(server,/app\.mount\('\/api', inventoryImportRoutes\)/);
  for(const marker of ['Upload Inventory Excel','Download approved Excel template','Review workbook','Create reviewed Draft Inventory','No automatic activation','Duplicate identity control','Matched CORE Inventory','data-open-import-match','Review complete:','0 Draft Inventory records created'])assert.ok(ui.includes(marker),`missing UI contract ${marker}`);
  assert.match(provider,/portal_status,workflow_status,source_kind/);assert.match(provider,/'blocked','draft'/);assert.doesNotMatch(route,/verification_status\s*=\s*'verified'|workflow_status\s*=\s*'approved'/);assert.match(provider,/responsible_agent_id,originating_agent_id/);assert.match(provider,/\$33,\$34/);
});

test('listing intake commit preserves resolved origin and responsibility with immutable history',async()=>{
  process.env.PGDATABASE||='unit_contract';process.env.PGUSER||='unit_contract';process.env.PGPASSWORD||='unit_contract';
  const {processEventWithClient}=await import('../src/routes/listing-intake.js'),queries=[],actor={id:'00000000-0000-4000-8000-000000000031'};
  const client={query:async(sql,params=[])=>{queries.push({sql,params});if(sql.includes('FROM areas'))return{rows:[{id:'00000000-0000-0000-0000-000000000032',business_label:'Dubai Marina'}]};if(sql.includes('SELECT id,workflow_status FROM listings'))return{rows:[]};if(sql.includes('FROM listings')&&sql.includes('REGEXP_REPLACE'))return{rows:[]};if(sql.includes('INSERT INTO listings')){assert.match(sql,/\$33,\$34/);assert.equal(params.length,34);assert.equal(params[32],agentDirectory[1].id);assert.equal(params[33],agentDirectory[0].id);return{rows:[{id:params[0],inventoryReference:'NYSA-INV-000901',responsibleAgentId:params[32],originatingAgentId:params[33]}]};}return{rows:[]};}};
  const value={eventId:'xlsx-test-row-2',provider:'inventory_excel',sourceKind:'import',externalRecordId:'UAT-INV-001',mappingVersion:INVENTORY_IMPORT_CONTRACT_VERSION,listing:{inventoryHeadline:'UAT apartment',project:'UAT project',developer:null,areaCode:'dubai_marina',community:'Dubai Marina',unitReference:'1204',building:'UAT Tower',propertyType:'Apartment',bedrooms:'2',sizeSqft:1000,price:1000000,referencePrice:null,currency:'AED',paymentPlanType:null,downPaymentPercent:null,onHandoverPercent:null,postHandoverYears:null,paymentPlanNotes:null,handoverDate:'Ready',handoverStatus:'ready',handoverExpectedDate:null,exclusivityTier:'Off-market',contact:null,notes:null,originatingAgentId:agentDirectory[0].id,responsibleAgentId:agentDirectory[1].id,owner:{partyRole:'seller',partyType:'person',displayName:'UAT Owner',phone:'+971501234567',email:null,source:'Owner instruction',authorityEvidence:'UAT owner evidence'}}};
  const result=await processEventWithClient({id:'00000000-0000-4000-8000-000000000033',eventId:value.eventId},value,actor,{},client);assert.equal(result.status,'accepted');assert.equal(result.inventoryReference,'NYSA-INV-000901');
  const ownerInsert=queries.find(query=>query.sql.includes('INSERT INTO inventory_counterparties'));assert.ok(ownerInsert);assert.equal(ownerInsert.params[4],'UAT Owner');
  const historyInsert=queries.find(query=>query.sql.includes('INSERT INTO inventory_agent_assignment_history'));assert.ok(historyInsert);assert.equal(historyInsert.params[2],agentDirectory[0].id);assert.equal(historyInsert.params[3],agentDirectory[1].id);
  assert.equal(queries.filter(query=>query.sql.includes('INSERT INTO audit_log')).length,3);
});
