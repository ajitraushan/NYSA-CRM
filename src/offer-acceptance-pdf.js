import {PdfDoc,canvas,header,footer,C} from './proposal-pdf.js';

const date=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));
const printable=value=>String(value??'').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();

// This is a record of the saved confirmations, not a signature or a replacement
// for the exact issued Offer. Never derive an acceptance from narrative remarks.
export function acceptancePdfData(offer,revision,events){
  if(offer.acceptedRevisionId!==revision.id)throw Object.assign(new Error('This revision is not the accepted Offer revision'),{status:409});
  const parties=['buyer','seller'].map(side=>{
    const matches=events.filter(e=>e.eventType==='accepted'&&e.offerRevisionId===revision.id&&e.acceptingSide===side&&e.acceptingPartyId&&String(e.acceptanceEvidence||'').trim());
    if(matches.length!==1||!matches[0].partyName||!Number.isFinite(Date.parse(matches[0].occurredAt)))throw Object.assign(new Error('Both parties require separately recorded acceptance, identity, evidence and timestamp for this exact revision'),{status:409});
    return{side,name:matches[0].partyName,acceptedAt:matches[0].occurredAt,evidence:matches[0].acceptanceEvidence,recordedBy:matches[0].actorName};
  });
  return{offerReference:offer.offerReference,opportunityReference:offer.opportunityReference,property:offer.listingProject,inventoryReference:offer.inventoryReference,revisionNumber:revision.revisionNumber,amount:revision.amount,currency:revision.currency,originalFileName:revision.fileName,originalFileHash:revision.fileHash,parties};
}

export function makeAcceptancePdf(data,organization={}){
  const doc=new PdfDoc();let draw=canvas(),y=110;const pages=[];
  const finish=()=>{pages.push(draw);draw=canvas();y=110;};
  // Fixed-width text lines with pagination preserve long evidence references.
  const line=(value,{bold=false,size=10,fill=C.ink}={})=>{
    const words=printable(value).split(' ');let text='';
    for(const word of words){for(const part of word.match(/.{1,85}/g)||['']){if(text.length+part.length+1>85){emit(text);text='';}text+=(text?' ':'')+part;}}
    if(text)emit(text);
    function emit(text){if(y>745)finish();draw.text(text,42,y,{bold,size,fill});y+=16;}
  };
  line('OFFER ACCEPTANCE RECORD',{bold:true,size:17,fill:C.gold});y+=12;
  line('Accepted by both parties',{bold:true,size:12});y+=10;
  line(`${data.offerReference} | Revision ${data.revisionNumber}`,{bold:true});
  line(`Opportunity: ${data.opportunityReference}`);
  line(`Property: ${data.property} | ${data.inventoryReference}`);
  line(`Agreed amount: ${data.currency} ${Number(data.amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`);y+=12;
  for(const party of data.parties){
    if(y>570)finish();
    draw.line(42,y,553,y,C.line);y+=14;
    line(party.side==='buyer'?'BUYER / TENANT - ACCEPTED':'SELLER / LANDLORD - ACCEPTED',{bold:true,fill:C.gold});
    line(`Party: ${party.name}`,{bold:true});
    line(`Recorded acceptance: ${date(party.acceptedAt)} | Asia/Dubai`);
    line(`Recorded by: ${party.recordedBy||'Not recorded'}`);
    line(`Evidence reference: ${party.evidence}`);y+=12;
  }
  line(`Original issued file: ${data.originalFileName}`);
  line(`Original PDF SHA-256: ${data.originalFileHash}`,{size:8});y+=12;
  line('This record reports confirmations entered in CRM. It does not add party signatures or replace the original issued Offer or a signed acceptance document.',{size:9});
  finish();pages.forEach((page,index)=>{header(page,organization,null,index+1,pages.length,'OFFER ACCEPTANCE RECORD');footer(page,{...organization,proposalFooter:'NYSA Realty | Offer acceptance record'},'Exact Offer revision | Acceptance times shown in Asia/Dubai');doc.page(page.c);});
  return doc.finish();
}
