import {PdfDoc,canvas,header,footer,C} from './proposal-pdf.js';
import {renderApprovedDocumentPdf} from './approved-document-renderer.js';

const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
const money=(value,currency='AED')=>`${currency} ${Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const date=value=>clean(String(value||'').slice(0,10));
const month=value=>{const text=date(value),[year,number]=text.split('-').map(Number);return year&&number?`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][number-1]} ${year}`:text;};

export function commissionPayoutApprovedDocument({agent,quarter,currency='AED',rows=[],summary=null,generatedDate}={}){
  if(!agent||!/^[0-9]{4}-Q[1-4]$/.test(String(quarter))||!rows.length)throw new Error('Agent, quarter and payout calculation rows are required');
  const fmt=value=>Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),totals=summary||{totalCommissionEarned:rows.reduce((sum,row)=>sum+Number(row.totalCommission||0),0),alreadyPaid:rows.reduce((sum,row)=>sum+Number(row.alreadyPaid||0),0),tierAdjustmentDue:rows.reduce((sum,row)=>sum+Number(row.tierAdjustment||0),0),toBePaid:rows.reduce((sum,row)=>sum+Number(row.amountDue||0),0),status:'Pending payment'};
  return{header:{Agent:agent,'Settlement Quarter':quarter,'Tier Earned By':rows[0]?.tierAgentName||agent,Generated:date(generatedDate)},rows:rows.map(row=>{const received=Number(row.grossCommissionReceivedExVat??row.currentGrossCommissionAmount??0),dealTotal=Number(row.dealGrossCommissionExVat||0),tranchePercent=dealTotal>0?received/dealTotal*100:null,split=Number(row.agentCommissionSharePercent??row.agentSharePercent??0);return{date:date(row.receiptDate),property:`${clean(row.propertySold)} · ${clean(row.inventoryReference)}`,references:`${clean(row.opportunityReference)} · ${clean(row.dealReference)}`,salePrice:fmt(row.salePrice),dealCommission:fmt(dealTotal),grossReceived:fmt(received),tranche:tranchePercent==null?'-':`${tranchePercent.toFixed(2)}%`,cumulative:fmt(row.quarterGrossCumulative??row.resultingGrossCommissionAmount??row.resultingCumulativeAmount),agentShare:`${Number(row.achievedRate||0).toFixed(2)}%`,splitRequired:split<100?'Yes':'No',split:`${split.toFixed(2)}%`,afterSplit:`${(Number(row.achievedRate||0)*split/100).toFixed(2)}%`,commission:fmt(row.commissionAmount),tierAdjustment:fmt(row.tierAdjustment),total:fmt(row.totalCommission),alreadyPaid:fmt(row.alreadyPaid)}}),summary:{'Total Commission Earned':`${currency} ${fmt(totals.totalCommissionEarned)}`,'Already Paid':`${currency} ${fmt(totals.alreadyPaid)}`,'Tier Adjustment':`${currency} ${fmt(totals.tierAdjustmentDue)}`,'To Be Paid':`${currency} ${fmt(totals.toBePaid)}`,Status:totals.status}};
}

export async function makeCommissionPayoutSheetPdf(input={}){
  return renderApprovedDocumentPdf('agent_payout',commissionPayoutApprovedDocument(input));
  const {agent,quarter,currency='AED',rows=[],summary=null,organization={},logo=null,generatedDate}=input;
  /* Legacy renderer retained below only as a rollback reference until DEV218 is accepted. */
  const page={width:842,height:595,margin:42},doc=new PdfDoc(page),logoImage=logo?doc.image(logo.buffer,logo.mediaType):null,pageSize=8,totalPages=Math.ceil(rows.length/pageSize),images={};
  if(logoImage)images.Logo=logoImage;
  const widths=[36,92,60,48,52,55,40,45,34,30,32,43,45,42,45,55],headers=['Month','Unit particulars / Project','Internal ref no','Sale Price','Total Deal Commission - Excluding VAT','Company Gross Commission Received - Excluding VAT','Commission Received in This Tranche (%)','Cumulative Commission','Agent Share (%)','Split required','Split %','Commission after split (%)','Commission Amount','Tier Adjustment','Total Commission','Already Paid'];
  for(let page=0;page<totalPages;page++){
    const draw=canvas(C.ink,{width:842,height:595,margin:42}),pageRows=rows.slice(page*pageSize,(page+1)*pageSize);
    header(draw,organization,logoImage,page+1,totalPages,'COMMISSION PAYMENT · AGENT CALCULATION SHEET',{width:842,height:595,margin:42});
    draw.text('AGENT PAYOUT CALCULATION SHEET',42,108,{size:16,bold:true,fill:C.gold});
    draw.text(clean(agent),42,134,{size:11,bold:true});
    draw.text(`Settlement quarter: ${clean(quarter)}`,570,117,{size:8,bold:true});
    draw.text(`Tier earned by: ${clean(pageRows[0]?.tierAgentName||'Deal executing Agent')}`,570,130,{size:7.2,bold:true});
    draw.text(`Generated: ${date(generatedDate)}`,570,142,{size:7.2,fill:C.muted});
    let x=42,y=165;
    headers.forEach((label,index)=>{draw.rect(x,y,widths[index],42,C.pale,C.line);draw.paragraph(label,x+3,y+4,widths[index]-6,{size:5.15,bold:true,fill:C.gold,leading:5.6,maxLines:7});x+=widths[index];});
    y+=42;
    pageRows.forEach((row,index)=>{
      x=42;const received=Number(row.grossCommissionReceivedExVat??row.currentGrossCommissionAmount??0),dealTotal=Number(row.dealGrossCommissionExVat||0),tranchePercent=dealTotal>0?received/dealTotal*100:null,trancheStatus=tranchePercent==null?'Total not recorded':tranchePercent<99.995?'Partial payment':tranchePercent<=100.005?'Full payment':'Above Deal total',split=Number(row.agentCommissionSharePercent??row.agentSharePercent??0),values=[month(row.receiptDate),clean(row.propertySold),`${clean(row.opportunityReference)}\n${clean(row.dealReference)}`,money(row.salePrice,currency),dealTotal>0?money(dealTotal,currency):'-',money(received,currency),tranchePercent==null?`-\n${trancheStatus}`:`${tranchePercent.toFixed(2)}%\n${trancheStatus}`,money(row.quarterGrossCumulative??row.resultingGrossCommissionAmount??row.resultingCumulativeAmount,currency),`${Number(row.achievedRate||0).toFixed(2)}%`,split<100?'Yes':'No',`${split.toFixed(2)}%`,`${(Number(row.achievedRate||0)*split/100).toFixed(2)}%`,money(row.commissionAmount,currency),money(row.tierAdjustment,currency),money(row.totalCommission,currency),money(row.alreadyPaid,currency)];
      values.forEach((value,column)=>{draw.rect(x,y,widths[column],30,index%2?C.white:C.pale,C.line);draw.paragraph(value,x+3,y+5,widths[column]-6,{size:4.95,bold:(column===8&&row.tierChanged)||(column===13&&Number(row.tierAdjustment)>0)||column===14,fill:column===13&&Number(row.tierAdjustment)>0?C.gold:C.ink,leading:5.6,maxLines:4});x+=widths[column];});
      y+=30;
    });
    if(page===totalPages-1){
      const totals=summary||{totalCommissionEarned:rows.reduce((sum,row)=>sum+Number(row.totalCommission||0),0),alreadyPaid:rows.reduce((sum,row)=>sum+Number(row.alreadyPaid||0),0),tierAdjustmentDue:rows.reduce((sum,row)=>sum+Number(row.tierAdjustment||0),0),toBePaid:rows.reduce((sum,row)=>sum+Number(row.amountDue||0),0),status:'Pending payment'},labels=[['Total Commission Earned',totals.totalCommissionEarned],['Already Paid',totals.alreadyPaid],['Tier Adjustment',totals.tierAdjustmentDue],['To be Paid',totals.toBePaid],['Status',totals.status]];
      x=42;labels.forEach(([label,value],index)=>{const width=index===4?154:151;draw.rect(x,491,width,40,C.pale,C.line);draw.text(label,x+6,500,{size:6.2,bold:true,fill:C.gold});draw.paragraph(index===4?clean(value):money(value,currency),x+6,513,width-12,{size:7.1,bold:true,leading:8,maxLines:2});x+=width;});
    }
    footer(draw,organization,'Internal commission-payment calculation generated from governed NYSA receipts, Deal splits, tier policy and payment records.',{width:842,height:595,margin:42});
    doc.page(draw.c,images);
  }
  return doc.finish();
}
