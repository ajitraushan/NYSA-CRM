const dubaiDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const adviceReference=row=>`NYSA-PA-${dubaiDate(row.createdAt).slice(0,4)}-${String(row.adviceNumber).padStart(6,'0')}`;
export function adviceSnapshots(rows,batch){
 const groups=new Map();
 for(const row of rows){const key=`${row.agentId}|${row.currency}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 return [...groups.values()].map(group=>({agentId:group[0].agentId,currency:group[0].currency,snapshot:{
  agentName:group[0].agentName,currency:group[0].currency,batchReference:batch.batchReference,retrospective:batch.retrospective===true,
  approvalReference:batch.evidenceReference,approvalDate:dubaiDate(batch.decidedAt),
  paymentDate:dubaiDate(batch.paymentDate),paymentReference:batch.paymentReference,
  total:group.reduce((n,x)=>n+Math.round(Number(x.agentPayoutAmount)*100),0)/100,
  items:group.map(x=>({opportunityReference:x.opportunityReference,dealReference:x.dealReference,property:x.property,quarter:x.quarterKey,paid:Number(x.agentPayoutAmount),adjustment:Number(x.adjustment)}))
 }}));
}
export function adviceDocument(snapshot,reference){
 const money=v=>`${snapshot.currency} ${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 const sum=snapshot.items.reduce((n,x)=>n+Math.round(Number(x.paid)*100),0);
 if(sum!==Math.round(Number(snapshot.total)*100)||!snapshot.items.length)throw new Error('Advice payment reconciliation failed');
 return{header:{'Advice reference':reference,Agent:snapshot.agentName,'Approval batch':snapshot.batchReference,'Approval reference':snapshot.approvalReference||'Not maintained','Generation context':snapshot.retrospective?'Retrospective from recorded payment':'Recorded payment','Approval date':snapshot.approvalDate,'Payment date':snapshot.paymentDate,'Bank payment reference':snapshot.paymentReference,Currency:snapshot.currency},table:{selector:'table',rows:snapshot.items.map(x=>[`${x.opportunityReference} / ${x.dealReference}`,`${x.property||'Not maintained'} / ${x.quarter}`,money(Number(x.paid)-Number(x.adjustment)),money(x.adjustment),money(x.paid)])},total:`Total paid: ${money(snapshot.total)}`};
}
