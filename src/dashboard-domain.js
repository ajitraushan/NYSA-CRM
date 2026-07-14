export function dashboardTypeFor(broker){
  if(broker?.role==='admin'||broker?.jobRole==='director')return 'executive';
  if(broker?.jobRole==='manager')return 'manager';
  if(broker?.jobRole==='accountant')return 'accounting';
  return 'agent';
}
export function buildDashboardMetric(code,label,current,prior,target,unit,definition){
  const c=Number(current||0),p=Number(prior||0),t=target===null||target===undefined?null:Number(target);
  return {code,label,current:c,prior:p,target:t,unit,varianceToPrior:c-p,varianceToTarget:t===null?null:c-t,trend:c>p?'up':c<p?'down':'flat',definition};
}
