const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
const esc=value=>clean(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const money=(amount,currency)=>`${currency} ${Number(amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date=value=>new Intl.DateTimeFormat('en-AE',{timeZone:'Asia/Dubai',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const wrap=(value,max=78)=>{
  const words=clean(value).split(' '),lines=[];let line='';
  for(const word of words){const next=line?`${line} ${word}`:word;if(next.length<=max)line=next;else{lines.push(line);line=word;}}
  if(line)lines.push(line);return lines;
};

export function makeOfferPdf({offer,revision,opportunity,customer,listing,agent}){
  const lines=[
    ['NYSA REALTY - COMMERCIAL OFFER',18,true],
    [`Offer ${offer.offerReference} | Revision ${revision.revisionNumber}`,11,true],
    [`Prepared: ${date(revision.createdAt)}`,9,false],
    ['',9,false],
    [`Customer: ${customer.fullName}`,11,true],
    [`Opportunity: ${opportunity.opportunityReference} - ${opportunity.title}`,9,false],
    [`Property: ${listing.project} | Inventory ${listing.inventoryReference||'Not recorded'}`,9,false],
    ['',9,false],
    ['COMMERCIAL TERMS',13,true],
    [`Offer amount: ${money(revision.amount,revision.currency)}`,11,true],
    [`Deposit: ${revision.depositAmount===null?'Not specified':money(revision.depositAmount,revision.currency)}`,9,false],
    [`Financing: ${revision.financingMethod||'Not specified'}`,9,false],
    [`Payment terms: ${revision.paymentTerms||'Not specified'}`,9,false],
    [`Valid until: ${date(revision.validityExpiresAt)} (Asia/Dubai)`,9,false],
    ['',9,false],
    ['CONDITIONS',13,true],
    ...wrap(revision.conditions||'No additional conditions recorded.').map(text=>[text,9,false]),
    ['',9,false],
    [`Direction: ${revision.direction} | Proposed by: ${revision.proposerRole}`,9,false],
    revision.materialCorrectionReason?[`Revision reason: ${revision.materialCorrectionReason}`,9,false]:null,
    ['',9,false],
    [`Prepared by ${agent.name}`,9,false],
    ['This document is the exact immutable version recorded in NYSA CORE.',8,false]
  ].filter(Boolean);
  let y=790,commands=['0.12 0.13 0.12 rg'];
  for(const [text,size,bold] of lines){commands.push(`BT /F${bold?'2':'1'} ${size} Tf 46 ${y} Td (${esc(text)}) Tj ET`);y-=size+8;}
  const content=commands.join('\n'),objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [5 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>`,
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let out=Buffer.from('%PDF-1.4\n'),offsets=[0];
  objects.forEach((object,index)=>{offsets.push(out.length);out=Buffer.concat([out,Buffer.from(`${index+1} 0 obj\n${object}\nendobj\n`)]);});
  const xref=out.length;
  return Buffer.concat([out,Buffer.from(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`)]);
}
