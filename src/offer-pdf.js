import { PdfDoc,canvas,header,footer,C } from './proposal-pdf.js';
import {renderApprovedDocumentPdf} from './approved-document-renderer.js';

const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
const money=(amount,currency='AED')=>`${currency} ${Number(amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date=value=>new Intl.DateTimeFormat('en-AE',{timeZone:'Asia/Dubai',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const offerLabels={purchase:'OFFER TO PURCHASE',sale:'OFFER TO SELL',rent:'OFFER TO RENT',rental:'OFFER TO RENT',rent_out:'OFFER TO RENT OUT / LEASE',off_plan:'OFFER TO PURCHASE',commercial:'PROPERTY OFFER'};

export function offerApprovedDocumentData({offer,revision,opportunity,customer,listing,agent,organization={}}){
  const purchase=!['rent','rental','rent_out'].includes(offer.offerType),formatMoney=value=>value===null||value===undefined?'':Number(value).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
  return{
    lineValues:[
      {label:'Date',value:date(revision.createdAt)},{label:'Offer Ref. No.',value:`${offer.offerReference} · Revision ${revision.revisionNumber}`},{label:'Offer valid until',value:date(revision.validityExpiresAt)},
      {label:'Building / Project',value:listing.project},{label:'Unit No.',value:listing.unitReference},{label:'Community',value:listing.community||listing.area},{label:'Property Type',value:listing.propertyType},{label:'Bedrooms',value:listing.bedrooms},{label:'Size (sq ft)',value:listing.sizeSqft},{label:'Listing Ref.',value:listing.inventoryReference},
      {label:'Full Name',value:customer.fullName,index:0},{label:'Nationality',value:customer.nationality},{label:'Passport / EID No.',value:customer.idDocumentLast4?`${customer.idDocumentType||'ID'} ending ${customer.idDocumentLast4}`:'Not recorded'},{label:'Mobile',value:customer.phone},{label:'Email',value:customer.email},
      {label:'Full Name',value:listing.ownerName||opportunity.sellerCounterpartyName||'Seller / Landlord',index:1},{label:'Represented by',value:organization.displayName||organization.legalName||'NYSA Realty LLC'},{label:'Agent',value:agent.name},{label:'BRN',value:agent.brn},{label:'Agent Email',value:agent.email},
      {label:'Offer Amount (AED)',value:formatMoney(revision.amount)},{label:'In words',value:revision.amountInWords||''},{label:'Deposit on MOU (AED)',value:formatMoney(revision.depositAmount)},{label:'Proposed Transfer Date',value:revision.proposedTransferDate?date(revision.proposedTransferDate):''},{label:'Annual Rent (AED)',value:purchase?'':formatMoney(revision.amount)},{label:'Security Deposit (AED)',value:purchase?'':formatMoney(revision.depositAmount)},{label:'Special Conditions',value:[revision.paymentTerms,revision.conditions].filter(Boolean).join(' · ')||'No additional conditions'}
    ],checkboxes:[{label:purchase?'Offer to Purchase':'Offer to Lease'},{label:String(revision.financingMethod||'').toLowerCase().includes('mortgage')?'Mortgage':'Cash'}]
  };
}

export async function makeOfferPdf(input){
  return renderApprovedDocumentPdf('offer_letter',offerApprovedDocumentData(input));
  /* Legacy renderer retained below only as a rollback reference until DEV218 is accepted. */
  const doc=new PdfDoc(),logoImage=logo?doc.image(logo.buffer,logo.mediaType):null,d=canvas(),images={};
  if(logoImage)images.Logo=logoImage;
  const title=offerLabels[offer.offerType]||'PROPERTY OFFER',property=[listing.project,listing.community||listing.area,listing.building,listing.unitReference].map(clean).filter(Boolean).join(' | '),facts=[listing.propertyType,listing.bedrooms?`${listing.bedrooms} bedroom`:null,listing.sizeSqft?`${Number(listing.sizeSqft).toLocaleString('en-US')} sq ft`:null,listing.handoverStatus?clean(listing.handoverStatus).replaceAll('_',' '):null].filter(Boolean).join(' | ');
  header(d,organization,logoImage,1,1,`PRIVATE ${title}`);
  d.text(title,42,108,{size:18,bold:true,fill:C.gold});
  d.text(`${offer.offerReference} | Revision ${revision.revisionNumber}`,42,134,{size:9,bold:true});
  d.text(`Prepared ${date(revision.createdAt)} | Dubai time`,42,151,{size:7.5,fill:C.muted});
  d.paragraph(`NYSA Realty is pleased to present this ${title.toLowerCase()} for consideration and to facilitate discussions between the relevant transaction parties. NYSA acts as the brokerage facilitator and is not the buyer, seller, landlord or tenant.`,42,174,511,{size:8.5,leading:12,maxLines:5});

  d.rect(42,234,511,116,C.pale,C.line);
  d.text('PREPARED FOR',54,247,{size:6.5,bold:true,fill:C.gold});
  d.text(clean(customer.fullName)||'Customer name not recorded',54,263,{size:10.5,bold:true});
  d.text('PROPERTY',310,247,{size:6.5,bold:true,fill:C.gold});
  d.paragraph(property||'Property description not recorded',310,263,228,{size:9.5,bold:true,leading:12,maxLines:3});
  d.text(`Inventory reference: ${clean(listing.inventoryReference)||'Not assigned'}`,310,305,{size:7.5,fill:C.muted});
  d.paragraph(facts||'Property facts not recorded',310,320,228,{size:7.5,leading:10,maxLines:2});

  d.text('PROPOSED TERMS',42,377,{size:10,bold:true,fill:C.gold});
  const terms=[
    ['OFFER AMOUNT',money(revision.amount,revision.currency)],
    ['DEPOSIT',revision.depositAmount===null?'Not specified':money(revision.depositAmount,revision.currency)],
    ['VALID UNTIL',`${date(revision.validityExpiresAt)} (Dubai time)`],
    ['FINANCING',revision.financingMethod||'Not specified']
  ];
  terms.forEach(([label,value],index)=>{const col=index%2,row=Math.floor(index/2),x=42+col*258,y=395+row*61;d.rect(x,y,247,51,C.pale,C.line);d.text(label,x+10,y+8,{size:6.5,bold:true,fill:C.gold});d.paragraph(value,x+10,y+23,227,{size:8.5,bold:true,maxLines:2});});

  d.text('PAYMENT TERMS AND CONDITIONS',42,532,{size:8,bold:true,fill:C.gold});
  d.paragraph(clean(revision.paymentTerms)||'No additional payment terms recorded.',42,550,511,{size:8,leading:11,maxLines:4});
  d.paragraph(clean(revision.conditions)||'No additional conditions recorded.',42,596,511,{size:8,leading:11,maxLines:4});
  d.rect(42,650,511,78,C.pale,C.line);
  d.text('IMPORTANT STATUS AND DISCLAIMER',54,663,{size:7,bold:true,fill:C.gold});
  d.paragraph(`This proposal remains open only until ${date(revision.validityExpiresAt)} and is subject to the other party's consideration, acceptance, rejection, counteroffer or withdrawal, continued property availability, verification and the parties' final agreement. It is not a reservation, memorandum of understanding, sale and purchase agreement or tenancy contract, and is not legally binding unless and until the relevant parties execute the required definitive documents.`,54,680,487,{size:7.2,leading:9.4,maxLines:6});
  d.text(`Prepared by ${clean(agent.name)}`,42,748,{size:8,bold:true});
  d.text(clean(organization.registeredAddress)||'NYSA Realty',42,763,{size:6.5,fill:C.muted});
  footer(d,organization,`Private brokerage communication | Exact immutable ${offer.offerReference} Revision ${revision.revisionNumber}`);
  doc.page(d.c,images);
  return doc.finish();
}
