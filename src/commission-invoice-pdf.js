import {PdfDoc,canvas,C} from './proposal-pdf.js';

const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
const amount=cents=>(Number(cents||0)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const valueAmount=value=>Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const percentage=(cents,value)=>Number(value)>0?`${(Number(cents)/100/Number(value)*100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}%`:'-';
const date=value=>{if(!value)return'-';const [year,month,day]=String(value).slice(0,10).split('-');return `${day}/${month}/${year}`;};
const ordinal=value=>{const n=Number(value),mod=n%100;return `${n}${mod>=11&&mod<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th')}`;};
const TEXT=[.2,.2,.2]; // #333333
const BORDER=[.902,.882,.847]; // warm off-white #e6e1d8

function cell(draw,x,y,width,height,text,{label=false,bold=false,size=7,fill=C.white,padding=6,maxLines=3}={}){
  draw.rect(x,y,width,height,fill,BORDER,.25);
  draw.paragraph(clean(text)||'-',x+padding,y+Math.max(3,(height-size)/2-2),width-padding*2,{size,bold:label||bold,leading:size+.5,maxLines});
}

export function makeCommissionInvoicePdf({invoice,organization={},transaction={},payer={},logo=null}){
  const doc=new PdfDoc(),logoImage=logo?doc.image(logo.buffer,logo.mediaType):null,d=canvas(TEXT),images={};
  if(logoImage){images.Logo=logoImage;d.image('Logo',logoImage,24,25,125,63);}else d.text(clean(organization.displayName||'NYSA REALTY'),24,47,{size:18,bold:true,fill:C.gold});

  d.line(16,96,579,96,C.gold,1.5);
  d.text('Invoice Number:',369,105,{size:9,bold:true});
  d.text(clean(invoice.invoiceReference),451,105,{size:9});
  d.text('TAX INVOICE',220,139,{size:14,bold:true,fill:C.gold});

  const x=16,leftLabel=110,leftValue=170,rightLabel=110,rightValue=173,top=166;
  const detailRow=20,addressRow=32;
  cell(d,x,top,leftLabel,detailRow,'Company Name:',{label:true,fill:C.pale});
  cell(d,x+leftLabel,top,leftValue,detailRow,organization.legalName,{size:7.5});
  cell(d,x+leftLabel+leftValue,top,rightLabel,detailRow,'Invoice Date:',{label:true,fill:C.pale});
  cell(d,x+leftLabel+leftValue+rightLabel,top,rightValue,detailRow,date(invoice.invoiceDate),{size:7.5});
  cell(d,x,top+detailRow,leftLabel,detailRow,'Contact Details:',{label:true,fill:C.pale});
  cell(d,x+leftLabel,top+detailRow,leftValue,detailRow,organization.primaryPhone,{size:7.5});
  cell(d,x+leftLabel+leftValue,top+detailRow,rightLabel,detailRow,'Invoice To:',{label:true,fill:C.pale});
  cell(d,x+leftLabel+leftValue+rightLabel,top+detailRow,rightValue,detailRow,payer.name||invoice.payerName,{size:7.5});
  cell(d,x,top+detailRow*2,leftLabel,detailRow,'Trade Licence No.:',{label:true,fill:C.pale});
  cell(d,x+leftLabel,top+detailRow*2,leftValue,detailRow,organization.tradeLicenseNumber,{size:7.5});
  cell(d,x+leftLabel+leftValue,top+detailRow*2,rightLabel,detailRow,'Payer TRN:',{label:true,fill:C.pale});
  cell(d,x+leftLabel+leftValue+rightLabel,top+detailRow*2,rightValue,detailRow,payer.vatRegistrationNumber||'Not applicable',{size:7.5});
  cell(d,x,top+detailRow*3,leftLabel,detailRow,'Company TRN:',{label:true,fill:C.pale});
  cell(d,x+leftLabel,top+detailRow*3,leftValue,detailRow,organization.vatRegistrationNumber,{size:7.5,maxLines:2});
  cell(d,x+leftLabel+leftValue,top+detailRow*3,rightLabel,detailRow,'Payer details:',{label:true,fill:C.pale});
  cell(d,x+leftLabel+leftValue+rightLabel,top+detailRow*3,rightValue,detailRow,payer.tradeLicenseNumber?`Trade licence: ${payer.tradeLicenseNumber}`:'Invoice recipient',{size:7,maxLines:2});
  cell(d,x,top+detailRow*4,leftLabel,addressRow,'NYSA Office Address:',{label:true,fill:C.pale});
  cell(d,x+leftLabel,top+detailRow*4,leftValue,addressRow,organization.registeredAddress,{size:7,maxLines:3});
  cell(d,x+leftLabel+leftValue,top+detailRow*4,rightLabel,addressRow,'Recipient Address:',{label:true,fill:C.pale});
  cell(d,x+leftLabel+leftValue+rightLabel,top+detailRow*4,rightValue,addressRow,payer.address||'Not maintained',{size:7,maxLines:3});

  d.text('Commission Details',x,295,{size:9,bold:true,fill:C.gold});
  const columns=[
    ['Unit No.',51,transaction.unitReference||transaction.inventoryReference],
    ['Project Name',55,transaction.project],
    ['Booked Date',48,date(transaction.bookedDate)],
    [`Purchase Price (in ${invoice.currency||'AED'})`,62,valueAmount(transaction.agreedValue)],
    ['Total Commission %',55,percentage(transaction.scheduleCommissionCents,transaction.agreedValue)],
    ['Eligible Commission %',55,percentage(invoice.commissionCents,transaction.agreedValue)],
    [`Eligible Commission Amount (in ${invoice.currency||'AED'})`,72,amount(invoice.commissionCents)],
    ['VAT (5%)',45,amount(invoice.vatCents)],
    ['Eligible Commission Amount with VAT',68,amount(invoice.totalCents)],
    ['Remarks',52,invoice.milestone||`${ordinal(invoice.instalmentNumber)} Instalment`]
  ];
  let cx=x;for(const [heading,width] of columns){cell(d,cx,306,width,44,heading,{label:true,size:5.8,fill:C.pale,maxLines:5,padding:4});cx+=width;}
  cx=x;for(const [,width,content] of columns){cell(d,cx,350,width,34,content,{size:6.2,maxLines:4,padding:4});cx+=width;}

  d.text('Bank A/C Details',x,413,{size:9,bold:true,fill:C.gold});
  const bankRows=[['Account Name:',organization.bankAccountName],['Bank Name:',organization.bankName],['Account Number:',organization.bankAccountNumber],['IBAN Number:',organization.bankIban],['Swift Code:',organization.bankSwiftCode],['Currency:',organization.bankCurrency],['Branch:',organization.bankBranch]];
  bankRows.forEach(([label,value],index)=>{const y=424+index*20;cell(d,x,y,160,20,label,{label:true,fill:C.pale});cell(d,x+160,y,403,20,value,{size:7.5});});

  const noteY=584;
  d.text('*',35,noteY,{size:8,bold:true,fill:C.gold});d.paragraph('This tax invoice is issued by NYSA Realty for brokerage commission on the referenced real-estate transaction.',47,noteY-1,500,{size:7.2,maxLines:2,leading:8.5});

  d.text('For:',x,755,{size:7,bold:true,fill:C.gold});d.text(clean(organization.legalName),38,755,{size:8,bold:true});
  d.line(x,783,220,783,C.ink,.8);
  d.text('Authorised Signatory',x,793,{size:6.2,fill:TEXT});
  d.text(`Opportunity: ${clean(invoice.opportunityReference)} | Receivable: ${clean(invoice.scheduleReference)} | Due: ${date(invoice.dueDate)}`,x,806,{size:6.2,fill:TEXT});
  doc.page(d.c,images);
  return doc.finish();
}
