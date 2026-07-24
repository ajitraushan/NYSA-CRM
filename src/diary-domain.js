const DAY_MS=24*60*60*1000;

export function validateDiaryRange(fromValue,toValue){
  const from=new Date(fromValue),to=new Date(toValue);
  if(!fromValue||!toValue||Number.isNaN(from.getTime())||Number.isNaN(to.getTime()))return {error:'Valid from and to timestamps are required'};
  if(to<=from)return {error:'Diary end must be after its start'};
  if(to-from>8*DAY_MS)return {error:'Diary range cannot exceed eight days'};
  return {from,to};
}

export function diaryStatus(item,now=new Date()){
  if(item.cancelledAt||['cancelled','no_show'].includes(item.recordStatus))return 'cancelled';
  if(item.completedAt||item.recordStatus==='completed')return 'completed';
  return new Date(item.startsAt)<now?'overdue':'upcoming';
}

export function markDiaryConflicts(items){
  const result=items.map(item=>({...item,conflict:false}));
  const active=result.filter(item=>!['cancelled','completed'].includes(item.status)&&item.endsAt&&new Date(item.endsAt)>new Date(item.startsAt));
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j];
    if(a.agentId!==b.agentId)continue;
    if(new Date(a.startsAt)<new Date(b.endsAt)&&new Date(b.startsAt)<new Date(a.endsAt)){a.conflict=true;b.conflict=true;}
  }
  return result;
}

export function calendarDeliveryStatus(item){
  if(!['meeting','viewing'].includes(item.category))return 'crm_only';
  if(item.calendarSyncStatus==='error')return 'error';
  if(item.googleEventUrl)return 'synced';
  return 'not_sent';
}
