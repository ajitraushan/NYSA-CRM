// AED receivables use integer fils. VAT is the explicitly requested 5% per invoice.
import {parseReceiptAmount} from '../public/money-input.js';
export const badRequest=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export function moneyCents(value,label='Amount'){
  const text=String(value??'').trim();
  if(/^0+(\.0{1,2})?$/.test(text))return 0;
  try{
    const cents=Math.round(parseReceiptAmount(text)*100);
    if(cents>999999999999)throw new Error('Amount cannot exceed AED 9,999,999,999.99');
    return cents;
  }catch(error){throw badRequest(`${label}: ${error.message}`);}
}
export const decimal=cents=>(cents/100).toFixed(2);
// Cumulative proportional allocation avoids rounding drift over many partial payments.
// Reversals remove their ORIGINAL split; the next payment catches up safely.
export function paymentSplit(invoice,grossCents,activeNetCents=0){
  const total=BigInt(invoice.totalCents),commission=BigInt(invoice.commissionCents);
  const after=BigInt(invoice.collectedCents||0)+BigInt(grossCents);
  const target=(after*commission+total/2n)/total;
  const delta=target-BigInt(activeNetCents);
  const net=Number(delta<0n?0n:delta>BigInt(grossCents)?BigInt(grossCents):delta);
  return{netCommissionCents:net,vatCents:grossCents-net};
}
export function dateOnly(value,label='Date'){
  const text=String(value??'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||text<'2000-01-01'||text>'2199-12-31'||!Number.isFinite(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)throw badRequest(`${label} must be a valid calendar date`);
  return text;
}
export const dubaiToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function invoiceAmounts(value){
  const commissionCents=moneyCents(value,'Commission');
  if(commissionCents<=0)throw badRequest('Commission must be greater than zero');
  const vatCents=Math.floor((commissionCents*5+50)/100);
  return{commissionCents,vatCents,totalCents:commissionCents+vatCents};
}
export function invoiceState(row,today=dubaiToday()){
  const total=Number(row.totalCents),collected=Number(row.collectedCents||0),balance=total-collected;
  const status=row.state==='cancelled'?(row.supersededByInvoiceId?'superseded':'cancelled'):row.state==='planned'?'scheduled':balance===0?'paid':collected>0?'part_paid':'unpaid';
  return{...row,totalCents:total,commissionCents:Number(row.commissionCents),vatCents:Number(row.vatCents),collectedCents:collected,balanceCents:row.state==='cancelled'?0:balance,status,
    overdue:row.state==='issued'&&balance>0&&row.dueDate<today};
}
export function scheduleInput(body){
  if(!['customer','agency','developer'].includes(body.payerType))throw badRequest('Choose a customer, agency or developer payer');
  if(!Array.isArray(body.instalments)||body.instalments.length<1||body.instalments.length>60)throw badRequest('A schedule requires between 1 and 60 instalments');
  if(body.instalments.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw badRequest('Each instalment must contain commission and due date');
  const instalments=body.instalments.map((row,index)=>({number:index+1,...invoiceAmounts(row.commissionAmount),dueDate:dateOnly(row.dueDate,'Due date'),milestone:String(row.milestone||'').trim().slice(0,200)}));
  const sum=instalments.reduce((n,row)=>n+row.commissionCents,0);
  if(sum!==moneyCents(body.commissionAmount,'Schedule commission'))throw badRequest('Instalment commission amounts must equal the schedule commission total');
  return{payerType:body.payerType,payerId:String(body.payerId||''),opportunityId:String(body.opportunityId||''),commissionCents:sum,instalments};
}
