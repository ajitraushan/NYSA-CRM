export function dashboardTypeFor(broker){
  if(broker?.role==='admin'||broker?.jobRole==='director')return 'executive';
  if(broker?.jobRole==='manager')return 'manager';
  if(broker?.jobRole==='accountant')return 'accounting';
  return 'agent';
}
export function buildDashboardMetric(code,label,current,prior,target,unit,definition){
  const c=Number(current||0),hasPrior=prior!==null&&prior!==undefined,p=hasPrior?Number(prior):null,t=target===null||target===undefined?null:Number(target);
  return {code,label,current:c,prior:p,target:t,unit,varianceToPrior:hasPrior?c-p:null,varianceToTarget:t===null?null:c-t,trend:hasPrior?(c>p?'up':c<p?'down':'flat'):'unavailable',definition};
}

export const EXECUTIVE_DASHBOARD_VIEWS=['Executive','Sales','Inventory','Operations and Risk'];
export const EXECUTIVE_KPI_CODES={
  Executive:['new_leads','won_leads','sla_breaches','team_capacity_pressure','inventory_available','proposal_workload','customer_engagement','operational_exceptions'],
  Sales:['new_leads','won_leads','hot_leads','stale_risk'],
  Inventory:['inventory_available','inventory_stale','inventory_readiness_exposure','operational_exceptions'],
  'Operations and Risk':['sla_breaches','sla_risk','no_next_action','operational_exceptions']
};

export function dashboardViewFor(type,requested){
  if(type==='executive')return EXECUTIVE_DASHBOARD_VIEWS.includes(requested)?requested:'Executive';
  if(type==='manager')return 'Team performance';
  if(type==='agent')return 'My work';
  return 'Finance controls';
}

const number=value=>Number(value||0);
const sumValues=value=>Object.values(value||{}).reduce((total,item)=>total+number(item),0);

function targetFor(targets,code){return (targets||[]).find(item=>item.metricCode===code)||null;}

export function dashboardRecordBreadcrumb(record,root='NYSA CORE'){
  return [root,record?.businessType,record?.teamName,record?.managerName,record?.agentName,record?.title].filter(Boolean);
}

const severityWeight={critical:4,high:3,medium:2,clear:0};
export function rankManagementInterventions(items,accountabilityRows=[]){
  const fieldByCode={sla_breaches:'slaBreaches',unassigned_leads:'unassignedLeads',no_next_action:'noNextAction',stale_risk:'staleRisk',operational_exceptions:'operationalExceptions'};
  return items.map(item=>{
    const field=fieldByCode[item.code],owner=field?[...accountabilityRows].sort((a,b)=>number(b[field])-number(a[field]))[0]:null;
    const responsibleHierarchy=owner&&number(owner[field])>0?[owner.businessType,owner.teamName,owner.managerName,owner.agentName].filter(Boolean):[];
    return {...item,responsibleHierarchy,responsibleCount:owner?number(owner[field]):0};
  }).sort((a,b)=>severityWeight[b.severity]-severityWeight[a.severity]||b.value-a.value||a.label.localeCompare(b.label)).map((item,index)=>({...item,rank:index+1}));
}

export function buildDashboardKpi({code,label,current,prior=null,unit='records',definition,targets=[],series=[],direction='high_good',dataAsOf}){
  const target=targetFor(targets,code),metric=buildDashboardMetric(code,label,current,prior,target?.targetValue??null,unit,definition);
  const threshold=target?.exceptionThreshold===null||target?.exceptionThreshold===undefined?null:Number(target.exceptionThreshold);
  const thresholdDirection=target?.thresholdDirection||direction;
  const exceptionStatus=threshold===null?'not_configured':thresholdDirection==='high_bad'
    ?(metric.current>threshold?'exception':'within_threshold'):(metric.current<threshold?'exception':'within_threshold');
  return {...metric,series,exceptionThreshold:threshold,thresholdDirection,exceptionStatus,
    benchmarkSource:target?.benchmarkSource||null,lastRefresh:dataAsOf,calculationBasis:target?.definition||definition,drilldownSegment:code};
}

export function buildRoleDashboardPresentation(input){
  const {type,view:requested,current={},previous={},previousInventory={},targets=[],trend=[],tasks={},exceptions={},previousExceptions={},proposals={},calls={},inventory={},agents=[],sources=[],priorSources=[],accountabilityRows=[],dataAsOf}=input;
  const view=dashboardViewFor(type,requested),slaBreaches=number(current.acceptanceBreaches)+number(current.contactBreaches),
    priorSla=number(previous.acceptanceBreaches)+number(previous.contactBreaches),exceptionTotal=sumValues(exceptions),
    proposalWorkload=number(proposals.prepare)+number(proposals.review)+number(proposals.send),
    teamPressure=(agents||[]).filter(agent=>agent.id&&number(agent.open)>=10).length;
  const values={new_leads:number(current.leads),won_leads:number(current.won),sla_breaches:slaBreaches,no_next_action:number(current.noNextAction),
    hot_leads:number(current.hot),warm_leads:number(current.warm),stale_risk:number(current.staleRisk),unassigned_leads:number(current.unassigned),
    awaiting_acceptance:number(current.awaitingAcceptance),sla_risk:number(current.slaRisk),overdue_tasks:number(tasks.overdue),due_today:number(tasks.today),
    proposal_workload:proposalWorkload,customer_engagement:number(calls.total)+number(proposals.sent),inventory_available:number(inventory.available),inventory_stale:number(inventory.stale),
    inventory_media_not_ready:number(inventory.mediaNotReady),inventory_readiness_exposure:inventory.readinessExposure===undefined?number(inventory.availabilityUnconfirmed)+number(inventory.permitExposure)+number(inventory.verificationExposure)+number(inventory.mediaNotReady)+number(inventory.portalNotReady):number(inventory.readinessExposure),
    operational_exceptions:exceptionTotal,team_capacity_pressure:teamPressure};
  const priors={new_leads:number(previous.leads),won_leads:number(previous.won),sla_breaches:priorSla,sla_risk:number(previous.slaRisk),no_next_action:number(previous.noNextAction),
    hot_leads:number(previous.hot),warm_leads:number(previous.warm),stale_risk:number(previous.staleRisk),unassigned_leads:number(previous.unassigned),operational_exceptions:sumValues(previousExceptions),...previousInventory};
  const specs={
    new_leads:['New leads','leads','Distinct leads received in the selected period.','high_good'],won_leads:['Won leads','leads','Leads reaching Won in the selected creation cohort.','high_good'],
    sla_breaches:['SLA breaches','leads','Open leads beyond acceptance or first-contact deadline.','high_bad'],no_next_action:['No next action','leads','Open leads without a scheduled next action.','high_bad'],
    hot_leads:['Hot pipeline','leads','Accessible leads with the latest Hot qualification.','high_good'],warm_leads:['Warm pipeline','leads','Accessible leads with the latest Warm qualification.','high_good'],
    stale_risk:['Stale-risk leads','leads','Open leads unchanged for at least seven days.','high_bad'],unassigned_leads:['Unassigned queue','leads','Accessible leads without a responsible agent.','high_bad'],
    awaiting_acceptance:['Awaiting acceptance','leads','Assigned open leads not yet accepted.','high_bad'],sla_risk:['SLA risk next 60 min','leads','Open leads with an active deadline in the next 60 minutes.','high_bad'],
    overdue_tasks:['Overdue tasks','tasks','Open tasks whose due time has passed.','high_bad'],due_today:['Tasks due today','tasks','Open tasks due before the end of today.','high_bad'],
    proposal_workload:['Proposal workload','proposals','Draft, generated, or reviewed proposals requiring action.','high_bad'],inventory_available:['Available inventory','properties','Non-deleted properties currently marked Available.','high_good'],
    inventory_stale:['Aging inventory','properties','Non-closed inventory not updated for 30 days.','high_bad'],inventory_media_not_ready:['Media not ready','properties','Properties without approved customer-facing media.','high_bad'],
    inventory_readiness_exposure:['Inventory readiness exposure','exceptions','Availability confirmation, permit, verification, approved-media, or portal-readiness exceptions.','high_bad'],
    operational_exceptions:['Operational exceptions','exceptions','Consent, document, contact, requirement, and integration exceptions.','high_bad'],team_capacity_pressure:['Capacity pressure','agents','Agents carrying ten or more open leads; operational proxy until capacity settings are approved.','high_bad'],
    customer_engagement:['Customer engagement','touchpoints','Recorded calls plus proposals sent in the selected period.','high_good']
  };
  const make=code=>{const [label,unit,definition,direction]=specs[code],hasPrior=Object.hasOwn(priors,code),prior=hasPrior?priors[code]:null,series=code==='new_leads'&&trend.length?trend:[...(hasPrior?[{period:'prior',value:prior}]:[]),{period:'current',value:values[code]}];return buildDashboardKpi({code,label,current:values[code],prior,unit,definition,direction,targets,series,dataAsOf});};
  const kpiCodes=type==='agent'?['awaiting_acceptance','sla_risk','overdue_tasks','no_next_action']:
    type==='manager'?['unassigned_leads','sla_breaches','overdue_tasks','stale_risk']:
    view==='Sales'?['new_leads','won_leads','hot_leads','stale_risk']:
    EXECUTIVE_KPI_CODES[view]||EXECUTIVE_KPI_CODES.Executive;
  const panels=type==='agent'?['agent_actions','lead_status','qualification','tasks','proposals','recent_activity']:
    type==='manager'?['manager_interventions','agent_workload','team_queue','sla','lead_aging','source_conversion','activity','proposals','exceptions','manager_hierarchy']:
    view==='Sales'?['executive_sales_funnel','source_quality','lead_velocity','qualification_aging','team_capacity','sales_hierarchy']:
    view==='Inventory'?['inventory_availability','inventory_aging','inventory_readiness','inventory_maturity']:
    view==='Operations and Risk'?['risk_interventions','sla','follow_up','exceptions','proposal_exposure','integration_health']:
    ['executive_questions','executive_trend','executive_interventions','executive_leading','executive_hierarchy','data_maturity'];
  const interventions=rankManagementInterventions([
    {code:'sla_breaches',label:'SLA breaches require escalation',value:slaBreaches,severity:slaBreaches?'critical':'clear'},
    {code:'unassigned_leads',label:'Leads require assignment',value:values.unassigned_leads,severity:values.unassigned_leads?'high':'clear'},
    {code:'no_next_action',label:'Open leads need a next action',value:values.no_next_action,severity:values.no_next_action?'high':'clear'},
    {code:'stale_risk',label:'Leads are at risk of becoming stale',value:values.stale_risk,severity:values.stale_risk?'medium':'clear'},
    {code:'operational_exceptions',label:'Data, consent or integration exceptions',value:exceptionTotal,severity:exceptionTotal?'medium':'clear'}
  ].filter(item=>item.value>0||type==='executive'),accountabilityRows);
  const sourceTotals={current:sources.reduce((sum,row)=>sum+number(row.value),0),prior:priorSources.reduce((sum,row)=>sum+number(row.value),0)};
  const sourceMixShift=sources.reduce((largest,row)=>{const prior=priorSources.find(item=>item.label===row.label),currentShare=sourceTotals.current?number(row.value)/sourceTotals.current:0,priorShare=sourceTotals.prior?number(prior?.value)/sourceTotals.prior:0;return Math.max(largest,Math.abs(currentShare-priorShare));},0);
  const sourceQualityShift=sources.reduce((result,row)=>{const prior=priorSources.find(item=>item.label===row.label),currentRate=number(row.value)?number(row.won)/number(row.value):0,priorRate=number(prior?.value)?number(prior.won)/number(prior.value):0,change=(currentRate-priorRate)*100;return Math.abs(change)>Math.abs(result)?change:result;},0);
  const leadingIndicators=[
    {code:'lead_velocity',label:'New-lead velocity',value:values.new_leads-number(previous.leads),unit:'vs prior period',assumption:'Selected-period volume minus equal-length prior-period volume.'},
    {code:'hot_warm_pipeline',label:'Hot and Warm pipeline',value:values.hot_leads+values.warm_leads,unit:'leads',assumption:'Latest recorded qualification on accessible leads.'},
    {code:'source_mix_shift',label:'Source-mix trend',value:Math.round(sourceMixShift*1000)/10,unit:'percentage points',assumption:'Largest absolute source-share movement versus the equal-length prior period.'},
    {code:'source_quality_trend',label:'Source-quality trend',value:Math.round(sourceQualityShift*10)/10,unit:'conversion-rate points',assumption:'Largest source-level Won-rate movement versus the equal-length prior period; it is not a revenue forecast.'},
    {code:'hot_warm_aging',label:'Hot and Warm aging exposure',value:number(current.hotWarmAging),unit:'leads',assumption:'Open Hot or Warm leads unchanged for at least seven days.'},
    {code:'stale_risk',label:'Stale-risk exposure',value:values.stale_risk,unit:'leads',assumption:'Open lead unchanged for at least seven days.'},
    {code:'no_next_action',label:'Leads without a next action',value:values.no_next_action,unit:'leads',assumption:'Open accessible leads without a scheduled next follow-up.'},
    {code:'proposal_workload',label:'Expected proposal workload',value:proposalWorkload,unit:'proposals',assumption:'Draft, generated, and reviewed proposals still requiring action.'},
    {code:'team_capacity_pressure',label:'Team-capacity pressure',value:teamPressure,unit:'agents',assumption:'Operational proxy: ten or more open leads per agent until approved capacity is configured.'},
    {code:'inventory_aging_exposure',label:'Inventory aging and availability exposure',value:inventory.agingExposure===undefined?number(inventory.stale)+number(inventory.availabilityUnconfirmed):number(inventory.agingExposure),unit:'properties',assumption:'Distinct non-closed properties aged 30 days or without availability confirmation in the last seven days.'},
    {code:'inventory_compliance_exposure',label:'Permit, verification and media exposure',value:inventory.complianceExposure===undefined?number(inventory.permitExposure)+number(inventory.verificationExposure)+number(inventory.mediaNotReady):number(inventory.complianceExposure),unit:'properties',assumption:'Distinct non-closed properties with permit, verification, or approved-media exposure.'},
    {code:'sla_risk',label:'SLA risk forecast',value:values.sla_risk,unit:'leads',assumption:'Active acceptance or first-contact deadline within 60 minutes.'}
    ,{code:'exception_trend',label:'Consent, document, data and integration trend',value:exceptionTotal-sumValues(previousExceptions),unit:'vs prior period',assumption:'Current accessible operational exceptions minus the equal-length prior-period exception count.'}
  ];
  const decisionSummary=type==='executive'?{
    happening:`${values.new_leads} new leads, ${values.won_leads} won, and ${slaBreaches} SLA breaches in the selected period.`,
    why:`Primary drivers are visible through source, funnel, team-capacity, inventory, and exception drill-downs.`,
    next:`${values.stale_risk} leads are at stale risk, ${values.sla_risk} face near-term SLA risk, and ${proposalWorkload} proposals require action.`,
    intervene:interventions.filter(item=>item.value>0).slice(0,3).map(item=>item.label).join('; ')||'No configured material exception is currently active.'
  }:null;
  return {view,kpis:kpiCodes.map(make),panels,interventions,leadingIndicators,decisionSummary,
    unavailableMetrics:[{label:'Weighted opportunity pipeline',availableFrom:'Opportunity and deal records'},{label:'Revenue and commission forecast',availableFrom:'Transaction and commission records'},{label:'Security incident trend',availableFrom:'Authoritative security-event records'}]};
}
