export const TARGET_CADENCES=['one_off','daily','weekly','monthly'];
// pg DATE values are local-midnight Dates, not UTC timestamps.
export const targetDate=value=>value instanceof Date?`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`:String(value||'').slice(0,10);
export const dubaiToday=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const addDays=(value,n)=>new Date(Date.parse(value)+n*86400000).toISOString().slice(0,10);
export function alignedTargetDate(date,cadence){return validDate(date)&&(cadence!=='weekly'||new Date(date).getUTCDay()===1)&&(cadence!=='monthly'||date.endsWith('-01'));}
export function targetPeriod(date,cadence){
  if(cadence==='weekly'){const day=new Date(date).getUTCDay(),start=addDays(date,-((day+6)%7));return{from:start,to:addDays(start,6)};}
  if(cadence==='monthly'){const from=date.slice(0,7)+'-01',next=new Date(from);next.setUTCMonth(next.getUTCMonth()+1);return{from,to:addDays(next.toISOString().slice(0,10),-1)};}
  return{from:date,to:date};
}
export function validateTarget(body,metrics,{businessTypes=[],teamIds=[],agentIds=[]}={}){
  const metric=Object.hasOwn(metrics,body.metricCode)?metrics[body.metricCode]:null,cadence=body.cadence||'one_off',start=targetDate(body.periodStart),end=body.periodEnd?targetDate(body.periodEnd):null;
  if(!metric||!TARGET_CADENCES.includes(cadence))return{error:'Select a supported KPI and frequency'};
  if(!alignedTargetDate(start,cadence))return{error:cadence==='weekly'?'Weekly targets must start on Monday':cadence==='monthly'?'Monthly targets must start on the first day of a month':'Enter a valid start date'};
  if((cadence==='one_off'&&!end)||(end&&(!validDate(end)||end<start)))return{error:'Enter a valid end date on or after the start date'};
  if(end&&cadence==='weekly'&&new Date(end).getUTCDay()!==0)return{error:'A weekly end date must be Sunday'};
  if(end&&cadence==='monthly'&&targetPeriod(end,'monthly').to!==end)return{error:'A monthly end date must be the last day of a month'};
  if(!['company','business_line','team','agent'].includes(body.scopeType))return{error:'Select who this target applies to'};
  const scopeId=body.scopeType==='company'?null:String(body.scopeId||'');
  if(body.scopeType==='business_line'&&!businessTypes.includes(scopeId))return{error:'Select a maintained Business line'};
  if(body.scopeType==='team'&&!teamIds.includes(scopeId))return{error:'Select a maintained Team'};
  if(body.scopeType==='agent'&&!agentIds.includes(scopeId))return{error:'Select a maintained Agent'};
  const targetValue=Number(body.targetValue),exceptionThreshold=body.exceptionThreshold===''||body.exceptionThreshold==null?null:Number(body.exceptionThreshold);
  if(body.targetValue===''||body.targetValue==null||!Number.isFinite(targetValue)||targetValue<0||targetValue>9999999999999999||(exceptionThreshold!==null&&(!Number.isFinite(exceptionThreshold)||exceptionThreshold<0)))return{error:'Target and exception numbers must be non-negative numbers'};
  const thresholdDirection=body.thresholdDirection||metric.direction;
  if(!['high_bad','low_bad'].includes(thresholdDirection))return{error:'Select above or below for the exception rule'};
  return{value:{metricCode:body.metricCode,scopeType:body.scopeType,scopeId,cadence,periodStart:start,periodEnd:end,targetValue,exceptionThreshold,thresholdDirection,unit:metric.unit,definition:metric.definition,approvalBasis:String(body.approvalBasis||'').trim()||null}};
}
export function expandTargetPeriods(target,from,to,{today=dubaiToday(),limit=400}={}){
  const start=targetDate(target.periodStart),end=target.periodEnd?targetDate(target.periodEnd):'9999-12-31',cadence=target.cadence||'one_off';
  const first=from>start?from:start,last=to<end?to:end;if(first>last)return[];
  const periods=[];let period=cadence==='one_off'?{from:start,to:end}:targetPeriod(first,cadence);
  while(period.from<=last){
    if(period.to>=first){const actualFrom=period.from>from?period.from:from,actualTo=[period.to,to,today].sort()[0],inProgress=today>=period.from&&today<=period.to,partial=actualFrom>period.from||actualTo<period.to||inProgress;
      periods.push({...period,actualFrom,actualTo,partial,inProgress,future:period.from>today,targetValue:Number(target.targetValue),unit:target.unit,targetId:target.id,cadence,revision:target.revision,exceptionThreshold:target.exceptionThreshold==null?null:Number(target.exceptionThreshold),thresholdDirection:target.thresholdDirection});}
    if(periods.length>limit)throw Object.assign(new Error('Select a shorter range: at most 400 target periods can be displayed'),{statusCode:400});
    if(cadence==='one_off')break;period=targetPeriod(addDays(period.to,1),cadence);
  }
  return periods;
}
export function targetVersions(target,versions=[]){return versions.length?versions:[{...target,validFrom:targetDate(target.periodStart),validTo:target.periodEnd?targetDate(target.periodEnd):null}];}
export function periodsForTarget(target,versions,from,to,options){
  return targetVersions(target,versions).flatMap(version=>expandTargetPeriods({...target,...version},from,to,options)
    .filter(period=>period.from>=targetDate(version.validFrom||version.periodStart)&&(!version.validTo||period.from<=targetDate(version.validTo))));
}
