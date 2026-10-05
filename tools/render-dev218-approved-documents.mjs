import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderApprovedDocumentPdf} from '../src/approved-document-renderer.js';
import {proposalApprovedDocument} from '../src/proposal-pdf.js';
import {offerApprovedDocumentData} from '../src/offer-pdf.js';
import {commissionInvoiceApprovedDocument} from '../src/commission-invoice-pdf.js';
import {commissionPayoutApprovedDocument} from '../src/commission-payout-sheet-pdf.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),output=path.join(root,'tmp-dev218-render-smoke');
await fs.mkdir(output,{recursive:true});
const results=[];
async function write(name,code,data){const pdf=await renderApprovedDocumentPdf(code,data);if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error(`${name} did not render a PDF`);await fs.writeFile(path.join(output,`${name}.pdf`),pdf);results.push({name,code,bytes:pdf.length});}

const organization={displayName:'NYSA Realty',legalName:'NYSA Realty LLC',registeredAddress:'Dubai, United Arab Emirates',primaryEmail:'admin@nysarealty.com',primaryPhone:'+971 4 000 0000',defaultCurrency:'AED',vatRegistrationNumber:'100000000000003',bankAccountName:'NYSA Realty LLC',bankName:'Synthetic Test Bank',bankAccountNumber:'0000000000',bankIban:'AE000000000000000000000',bankSwiftCode:'SYNTAEAD',bankCurrency:'AED'};
const agent={name:'Synthetic Document Agent',email:'agent@example.test',phone:'+971500000000',brn:'BRN-TEST-001',brnIssuedOn:'2024-01-01'};
const property=index=>({id:`inventory-${index}`,inventoryReference:`NYSA-INV-TEST-${String(index).padStart(3,'0')}`,project:`Synthetic Property ${index}`,area:'Dubai Marina',community:'Dubai Marina',unitReference:`U-${index}`,propertyType:'Apartment',bedrooms:'2',sizeSqft:1200+index,price:2000000+index*100000,currency:'AED',developer:'Synthetic Developer',parkingSpaces:1,paymentPlanType:'Developer plan',downPaymentPercent:20,onHandoverPercent:50,postHandoverYears:2,paymentPlanNotes:'30% during construction',availabilityConfirmedAt:'2026-10-05T08:00:00Z'});
const proposal=count=>({proposal:{templateType:count===1?'Quick':count===2?'Investment':'Comparison',proposalNumber:`NYSA-PR-TEST-${count}`,title:`Synthetic ${count}-property proposal`},version:1,preparedAt:'05 Oct 2026',organization,recipient:{fullName:'Synthetic Customer',phone:'+971500000001',postalAddress:'Dubai, UAE'},requirement:{businessLine:'sale',purpose:'investment',areas:['Dubai Marina'],propertyTypes:['Apartment'],bedroomsMin:2,budgetMin:1500000,budgetMax:3500000,fundingMethod:'cash',timelineCode:'0_3_months'},properties:Array.from({length:count},(_,index)=>property(index+1)),media:[],valueBriefs:[],narrative:{suitability:'Aligned to the confirmed requirement.',highlights:'Synthetic verification content.',assumptions:'Availability and final terms require reconfirmation.'},disclaimer:'Synthetic CRM TEST document. Not for customer use.',agent});
for(const count of [1,2,5]){const approved=proposalApprovedDocument(proposal(count));await write(`buyer-proposal-${count}`,approved.documentCode,approved.data);}

const financial=proposal(1);financial.proposal.templateType='Financial Illustration';financial.proposal.proposalNumber='NYSA-FI-TEST-001';financial.financialScenario={scenarioType:'roi',scenarioName:'Synthetic saved ROI',currency:'AED',propertyPrice:2100000,inputSnapshot:{annualRent:160000,annualCosts:20000},outputSnapshot:{price:2100000,annualRent:160000,annualCosts:20000,netYield:6.6667},disclaimer:'Synthetic saved-scenario disclaimer.'};
{const approved=proposalApprovedDocument(financial);await write('financial-illustration',approved.documentCode,approved.data);}

await write('offer-letter','offer_letter',offerApprovedDocumentData({offer:{offerType:'purchase',offerReference:'NYSA-OF-TEST-001'},revision:{revisionNumber:1,createdAt:'2026-10-05T08:00:00Z',validityExpiresAt:'2026-10-12T08:00:00Z',amount:2100000,depositAmount:null,paymentTerms:'10% on MOU; balance on transfer',conditions:'Subject to contract'},opportunity:{sellerCounterpartyName:'Synthetic Seller'},customer:{fullName:'Synthetic Customer',phone:'+971500000001',email:'customer@example.test'},listing:{...property(1),ownerName:'Synthetic Seller'},agent,organization}));

const commonLines=[{label:'Date',value:'05/10/2026'},{label:'Ref. No.',value:'NYSA-TEST-001'},{label:'Name',value:'Synthetic Customer',index:0},{label:'Name',value:agent.name,index:1},{label:'BRN',value:agent.brn},{label:'Mobile',value:agent.phone}];
await write('viewing-confirmation','viewing_confirmation',{lineValues:commonLines,table:{selector:'table',headerRows:1,rows:Array.from({length:10},(_,index)=>[index+1,'05 Oct 2026, 10:00',`Synthetic Property ${index+1}`,`U-${index+1}`,`NYSA-INV-TEST-${index+1}`,'Viewing',''])}});
for(const code of ['a2a_buyer','a2a_seller'])await write(code.replaceAll('_','-'),code,{lineValues:[...commonLines,{label:'Property Address',value:'Synthetic Property, Dubai'},{label:'Listed Price (AED)',value:'2,100,000'},{label:"Buyer's Name",value:'Synthetic Customer'}]});
await write('listing-noc','listing_noc',{lineValues:[{label:'Date',value:'05/10/2026'},{label:'Ref. No.',value:'NYSA-INV-TEST-001'},{label:'Owner Name',value:'Synthetic Owner'},{label:'Building',value:'Synthetic Tower'},{label:'Unit No.',value:'U-1'},{label:'Community',value:'Dubai Marina'}],terms:{appointmentPeriod:'90 days',sellerCommissionPercent:'2%',buyerCommissionPercent:'2%'}});

await write('tax-invoice','tax_invoice',commissionInvoiceApprovedDocument({invoice:{invoiceReference:'NYSA-TI-TEST-001',invoiceDate:'2026-10-05',supplyDate:'2026-10-05',dueDate:'2026-10-12',description:'Agency commission',commissionCents:200000,vatCents:10000,totalCents:210000,quantity:2,unitRate:1000,currency:'AED'},organization,transaction:{project:'Synthetic Property',unitReference:'U-1',transactionType:'Sale',agreedValue:2100000},payer:{name:'Synthetic Payer',address:'Dubai, UAE'}}));

const payoutRows=Array.from({length:21},(_,index)=>({receiptDate:'2026-10-05',propertySold:`Synthetic Property ${index+1}`,inventoryReference:`INV-${index+1}`,opportunityReference:`OP-${index+1}`,dealReference:`DL-${index+1}`,salePrice:1000000,dealGrossCommissionExVat:20000,grossCommissionReceivedExVat:20000,quarterGrossCumulative:(index+1)*20000,achievedRate:50,agentCommissionSharePercent:100,commissionAmount:10000,tierAdjustment:0,totalCommission:10000,alreadyPaid:0}));
await write('agent-payout-21','agent_payout',commissionPayoutApprovedDocument({agent:agent.name,quarter:'2026-Q4',rows:payoutRows,generatedDate:'2026-10-05'}));

console.log(JSON.stringify({output,documents:results},null,2));
