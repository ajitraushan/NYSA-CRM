import { PdfDoc,canvas,header,footer,C } from './proposal-pdf.js';

const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
const money=(amount,currency)=>`${currency} ${Number(amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date=value=>new Intl.DateTimeFormat('en-AE',{timeZone:'Asia/Dubai',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));

export function makeOfferPdf({offer,revision,opportunity,customer,listing,agent,organization={},logo=null}){
  const doc=new PdfDoc(),logoImage=logo?doc.image(logo.buffer,logo.mediaType):null,d=canvas(),images={};
  if(logoImage)images.Logo=logoImage;
  header(d,organization,logoImage,1,1,'PRIVATE COMMERCIAL OFFER');
  d.text('COMMERCIAL OFFER',42,112,{size:20,bold:true,fill:C.gold});
  d.text(`${offer.offerReference} | Revision ${revision.revisionNumber}`,42,141,{size:9,bold:true});
  d.text(`Prepared ${date(revision.createdAt)} | Asia/Dubai`,42,158,{size:7.5,fill:C.muted});

  d.rect(42,180,511,92,C.pale,C.line);
  d.text('PREPARED FOR',54,193,{size:6.5,bold:true,fill:C.gold});
  d.text(customer.fullName||'Customer name not recorded',54,207,{size:11,bold:true});
  d.text(customer.email||'Email not recorded',54,226,{size:8});
  d.text(customer.phone||'Phone not recorded',54,241,{size:8});
  d.text('PROPERTY',310,193,{size:6.5,bold:true,fill:C.gold});
  d.paragraph(listing.project,310,207,228,{size:10,bold:true,maxLines:2});
  d.text(`Inventory ${listing.inventoryReference||'Not recorded'}`,310,241,{size:7.5,fill:C.muted});

  d.text('COMMERCIAL TERMS',42,300,{size:10,bold:true,fill:C.gold});
  const terms=[
    ['OFFER AMOUNT',money(revision.amount,revision.currency)],
    ['DEPOSIT',revision.depositAmount===null?'Not specified':money(revision.depositAmount,revision.currency)],
    ['VALID UNTIL',`${date(revision.validityExpiresAt)} (Dubai time)`],
    ['FINANCING',revision.financingMethod||'Not specified']
  ];
  terms.forEach(([label,value],index)=>{const col=index%2,row=Math.floor(index/2),x=42+col*258,y=318+row*62;d.rect(x,y,247,52,C.pale,C.line);d.text(label,x+10,y+8,{size:6.5,bold:true,fill:C.gold});d.paragraph(value,x+10,y+23,227,{size:9,bold:true,maxLines:2});});

  d.text('PAYMENT TERMS',42,458,{size:7,bold:true,fill:C.gold});
  d.paragraph(revision.paymentTerms||'Not specified',42,474,511,{size:9,leading:12,maxLines:5});
  d.text('CONDITIONS',42,552,{size:7,bold:true,fill:C.gold});
  d.paragraph(revision.conditions||'No additional conditions recorded.',42,568,511,{size:9,leading:12,maxLines:7});
  d.text('REVISION CONTROL',42,670,{size:7,bold:true,fill:C.gold});
  d.paragraph(`Direction: ${clean(revision.direction)} | Proposed by: ${clean(revision.proposerRole)}${revision.materialCorrectionReason?` | Revision reason: ${clean(revision.materialCorrectionReason)}`:''}`,42,686,511,{size:8,leading:11,maxLines:4});
  d.text(`Prepared by ${agent.name}`,42,746,{size:8,bold:true});
  d.text(`${organization.registeredAddress||'Registered address not recorded'} | ${organization.primaryEmail||''} ${organization.primaryPhone||''}`,42,762,{size:6.5,fill:C.muted});
  footer(d,organization,'This is the exact immutable offer revision recorded in NYSA CORE. Terms remain subject to the stated validity and conditions.');
  doc.page(d.c,images);
  return doc.finish();
}
