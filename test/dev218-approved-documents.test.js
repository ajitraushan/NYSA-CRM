import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildApprovedDocumentHtml,approvedTemplatePath} from '../src/approved-document-renderer.js';
import {proposalApprovedDocument} from '../src/proposal-pdf.js';
import {offerApprovedDocumentData} from '../src/offer-pdf.js';
import {commissionInvoiceApprovedDocument} from '../src/commission-invoice-pdf.js';
import {commissionPayoutApprovedDocument} from '../src/commission-payout-sheet-pdf.js';
import {selectDocumentAgent,validateBrnDetails,validateDefaultDocumentAgent} from '../src/document-agent-domain.js';

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const properties=count=>Array.from({length:count},(_,index)=>({id:`inventory-${index+1}`,inventoryReference:`NYSA-INV-000${index+1}`,project:`Approved Property ${index+1}`,area:'Dubai Marina',propertyType:'Apartment',bedrooms:'2',sizeSqft:1200+index,price:2000000+index*100000,currency:'AED',paymentPlanType:'Developer plan',paymentPlanNotes:'20% booking, balance on handover'}));
const proposalInput=(templateType,count=1)=>({proposal:{templateType,proposalNumber:'NYSA-PR-000001',title:'Customer proposal'},version:2,preparedAt:'05 Oct 2026',organization:{defaultCurrency:'AED'},recipient:{fullName:'Synthetic Customer',phone:'+971500000000'},requirement:{businessLine:'sale',purpose:'investment',areas:['Dubai Marina'],propertyTypes:['Apartment'],fundingMethod:'cash'},properties:properties(count),media:[],valueBriefs:[],narrative:{suitability:'Suitable',highlights:'Clear fit',assumptions:'Subject to verification'},disclaimer:'Private proposal',agent:{name:'Sunita',brn:'BRN-001',brnIssuedOn:'2024-01-01'}});

test('DEV218 approved source layouts and fonts are packaged locally without remote font calls',()=>{
  const codes=['buyer_proposal','financial_illustration','offer_letter','viewing_confirmation','a2a_buyer','a2a_seller','listing_noc','tax_invoice','agent_payout'];
  for(const code of codes){
    const template=approvedTemplatePath(code);
    assert.ok(template,code);
    const html=buildApprovedDocumentHtml(code,{});
    assert.doesNotMatch(html,/fonts\.googleapis|fonts\.gstatic/i,`${code} rendered HTML must use local fonts`);
    assert.match(html,/@font-face\{font-family:'Inter'/);
    assert.match(html,/@font-face\{font-family:'GFS Baskerville'/);
    assert.match(html,/body\{font-family:Inter,Arial,sans-serif\}/);
  }
  for(const font of ['Inter-Regular.woff2','Inter-SemiBold.woff2','Inter-Bold.woff2','Inter-ExtraBold.woff2','GFSBaskerville.otf'])assert.ok(readFileSync(new URL(`../public/fonts/${font}`,import.meta.url)).length>1000,font);
});

test('DEV218 Buyer Proposal covers Quick, Investment and Comparison and scales property pages exactly',()=>{
  for(const type of ['Quick','Investment','Comparison'])for(const count of [1,2,5]){
    const approved=proposalApprovedDocument(proposalInput(type,count));
    assert.equal(approved.documentCode,'buyer_proposal');
    assert.equal(approved.data.properties.length,count);
    assert.deepEqual(approved.data.properties.map(item=>item.reference),properties(count).map(item=>item.inventoryReference));
    const html=buildApprovedDocumentHtml(approved.documentCode,approved.data);
    assert.ok(html.includes('"properties":[{"title":"Approved Property 1"'));
  }
});

test('DEV218 Financial Illustration retains the exact saved scenario snapshot',()=>{
  const input=proposalInput('Financial Illustration');
  input.financialScenario={scenarioType:'roi',currency:'AED',propertyPrice:2350000,inputSnapshot:{vacancyPercent:5},outputSnapshot:{price:2350000,annualRent:180000,annualCosts:25000,netYield:6.5957},disclaimer:'Saved scenario disclaimer'};
  const approved=proposalApprovedDocument(input);
  assert.equal(approved.documentCode,'financial_illustration');
  assert.deepEqual(approved.data.labelValues.map(x=>[x.label,x.value]),[
    ['Property price','AED 2,350,000'],['Expected annual rent','AED 180,000'],['Estimated annual costs','AED 25,000'],['Net yield','6.60%']
  ]);
  assert.deepEqual(approved.data.scenarioSnapshot,input.financialScenario);
  assert.match(JSON.stringify(approved.data),/Saved scenario disclaimer/);
});

test('DEV218 Offer Letter carries useful references and permits an unspecified deposit',()=>{
  const data=offerApprovedDocumentData({offer:{offerType:'purchase',offerReference:'NYSA-OF-202610-000001'},revision:{revisionNumber:2,createdAt:'2026-10-05T10:00:00Z',validityExpiresAt:'2026-10-10T10:00:00Z',amount:1800000,depositAmount:null,paymentTerms:'10% on MOU'},opportunity:{sellerCounterpartyName:'Seller'},customer:{fullName:'Synthetic Customer'},listing:{project:'207uat2',inventoryReference:'NYSA-INV-000074',propertyType:'Apartment'},agent:{name:'Sunita',brn:'BRN-001'},organization:{displayName:'NYSA Realty'}});
  const values=Object.fromEntries(data.lineValues.map(item=>[`${item.label}:${item.index||0}`,item.value]));
  assert.equal(values['Offer Ref. No.:0'],'NYSA-OF-202610-000001 · Revision 2');
  assert.equal(values['Listing Ref.:0'],'NYSA-INV-000074');
  assert.equal(values['Building / Project:0'],'207uat2');
  assert.equal(values['Deposit on MOU (AED):0'],'');
});

test('DEV218 Tax Invoice enforces quantity x rate, 5% VAT and reconciled total',()=>{
  const base={invoiceReference:'NYSA-INV-1',invoiceDate:'2026-10-05',commissionCents:200000,vatCents:10000,totalCents:210000,quantity:2,unitRate:1000,currency:'AED'};
  const mapped=commissionInvoiceApprovedDocument({invoice:base});
  assert.deepEqual(mapped.table.rows[0].slice(2),[2,'1,000.00','2,000.00']);
  assert.throws(()=>commissionInvoiceApprovedDocument({invoice:{...base,unitRate:999}}),/quantity x rate/);
  assert.throws(()=>commissionInvoiceApprovedDocument({invoice:{...base,vatCents:9000}}),/VAT must equal 5%/);
  assert.throws(()=>commissionInvoiceApprovedDocument({invoice:{...base,totalCents:209000}}),/subtotal plus VAT/);
});

test('DEV218 Agent Payout maps 20+ exact calculation rows and has no customer payout type',()=>{
  const rows=Array.from({length:21},(_,index)=>({receiptDate:'2026-10-05',propertySold:`Property ${index+1}`,inventoryReference:`INV-${index+1}`,opportunityReference:`OP-${index+1}`,dealReference:`DL-${index+1}`,salePrice:1000000,dealGrossCommissionExVat:20000,grossCommissionReceivedExVat:20000,quarterGrossCumulative:(index+1)*20000,achievedRate:50,agentCommissionSharePercent:100,commissionAmount:10000,tierAdjustment:0,totalCommission:10000,alreadyPaid:0}));
  const mapped=commissionPayoutApprovedDocument({agent:'Synthetic Agent',quarter:'2026-Q4',rows,generatedDate:'2026-10-05'});
  assert.equal(mapped.rows.length,21);
  assert.equal(mapped.summary['Total Commission Earned'],'AED 210,000.00');
  const html=buildApprovedDocumentHtml('agent_payout',mapped);
  assert.match(html,/for\(let i=0;i<rows\.length;i\+=8\)/);
  const migration=read('src/migrations/132_approved_documents_and_brand.sql');
  assert.doesNotMatch(migration,/customer_payout/i);
});

test('DEV218 document Agent selection obeys optional BRN and safe configured fallback',()=>{
  assert.equal(validateBrnDetails({}).value.brn,null);
  assert.match(validateBrnDetails({brn:'BRN-1'}).error,/issue date is required/);
  assert.match(validateBrnDetails({brnIssuedOn:'2026-01-01'}).error,/without a BRN/);
  const assigned={id:'assigned',name:'Assigned',brn:'BRN-A',brnIssuedOn:'2025-01-01'},fallback={id:'fallback',name:'Sunita',role:'internal_broker',status:'active',brn:'BRN-S',brnIssuedOn:'2024-01-01'};
  assert.equal(selectDocumentAgent(assigned,fallback).id,'assigned');
  assert.equal(selectDocumentAgent({...assigned,brn:null},fallback).id,'fallback');
  assert.equal(validateDefaultDocumentAgent(fallback).value.id,'fallback');
  assert.match(selectDocumentAgent(null,null).error,/both BRN and BRN issue date/);
});

test('DEV218 persistence freezes issued evidence and independently verifies signed Listing NOC',()=>{
  const migration=read('src/migrations/132_approved_documents_and_brand.sql'),routes=read('src/routes/approved-documents.js'),domain=read('src/approved-document-domain.js'),listingRoutes=read('src/routes/listings.js'),ui=read('public/app.js');
  for(const marker of ['template_hash CHAR(64)','data_snapshot JSONB','data_hash CHAR(64)','pdf_hash CHAR(64)','idempotency_key TEXT NOT NULL UNIQUE','prevent_listing_noc_evidence_fact_mutation','CHECK(reviewed_by IS NULL OR reviewed_by<>created_by)'])assert.match(migration,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
  assert.match(routes,/expectedVersion/);
  assert.match(routes,/The uploader cannot review their own Listing NOC evidence/);
  assert.match(domain,/Select between one and ten completed viewings/);
  assert.match(domain,/Every selected viewing must be completed and belong to this Customer Opportunity/);
  assert.match(domain,/Identify both agencies and agents, including agent BRN and BRN issue date, before preparing A2A/);
  assert.match(listingRoutes,/executed Listing NOC and obtain independent Manager\/Director verification before external publication/);
  assert.match(ui,/Save editable draft/);
  assert.match(ui,/Issue immutable Listing NOC/);
});

test('DEV218 approved documents are role-scoped, audited and opened outside the CRM workspace',()=>{
  const routes=read('src/routes/approved-documents.js'),server=read('src/server.js'),app=read('public/app.js');
  assert.match(routes,/r\.use\(requireAuth,/);
  assert.match(routes,/canWriteOpportunity/);
  assert.match(routes,/canWriteListingNoc/);
  assert.match(routes,/approved_document_issued/);
  assert.match(routes,/approved_document_draft_saved/);
  assert.match(server,/approvedDocumentRoutes/);
  assert.match(app,/openCrmPdfTab/);
  assert.match(app,/target="_blank" rel="noopener"/);
});

test('DEV218 A2A requires complete agency, agent BRN evidence and maintained NYSA ORN',()=>{
  const routes=read('src/routes/approved-documents.js'),domain=read('src/approved-document-domain.js'),migration=read('src/migrations/132_approved_documents_and_brand.sql'),ui=read('public/app.js');
  assert.match(routes,/sellerAgentBrn,brnIssuedOn:opportunity\.sellerAgentBrnIssuedOn/);
  assert.match(routes,/buyerAgentBrn,brnIssuedOn:opportunity\.buyerAgentBrnIssuedOn/);
  assert.match(domain,/Maintain the NYSA ORN in Company Profile before issuing A2A/);
  assert.match(migration,/ADD COLUMN orn TEXT/);
  assert.match(ui,/<label>ORN<\/label><input name="orn">/);
});

test('DEV218 authenticated theme follows the approved brand while login remains unchanged',()=>{
  const html=read('public/index.html'),dev218=html.slice(html.indexOf('/* DEV218 approved NYSA light workspace'));
  for(const marker of ["@font-face{font-family:Inter","@font-face{font-family:'GFS Baskerville'",'--workspace:#f4f1eb','--charcoal:#14232c','--gold:#8f6a30','#app.shell-layout>header','#app.shell-layout table th{background:#14232c;color:#fff}'])assert.match(dev218,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(dev218,/dubai-skyline-auth/);
  assert.match(html,/\.auth-wrap\{[^}]*dubai-skyline-auth-golden-hour-palms/);
  assert.match(html,/\.auth-card\{[^}]*border-radius:22px/);
});
