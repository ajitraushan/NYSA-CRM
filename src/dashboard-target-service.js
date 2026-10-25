import {one,many,execute,transaction,uuid,audit} from './db.js';
import {DASHBOARD_METRICS} from './admin-governance.js';
import {loadActiveClassificationCatalogue,legacyBusinessType} from './classification-catalogue.js';
import {validateTarget,targetDate,dubaiToday,alignedTargetDate,periodsForTarget} from './dashboard-target-domain.js';
export const TARGET_METRICS=Object.fromEntries(Object.entries(DASHBOARD_METRICS).map(([code,metric])=>[code,{...metric,
  ...({won_leads:{definition:'Leads created in the selected period whose current status is Won (existing dashboard creation-cohort calculation).'},
    team_capacity_pressure:{label:'Capacity pressure',unit:'agents',definition:'Agents carrying ten or more open Leads; existing dashboard workload proxy, not a percentage.'},
    customer_engagement:{unit:'touchpoints',definition:'Recorded calls plus proposals sent in the selected period.'},
    inventory_available:{unit:'properties'},inventory_stale:{unit:'properties'},inventory_readiness_exposure:{unit:'exceptions'},operational_exceptions:{unit:'exceptions'}}[code]||{})}]));
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
const camelPayload=p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v]));
export const normalizeTargetRow=row=>({...row,periodStart:targetDate(row.periodStart),periodEnd:row.periodEnd?targetDate(row.periodEnd):null});
export async function targetSetup(client){
  const [catalogue,teams,agents]=await Promise.all([loadActiveClassificationCatalogue(client),many('SELECT id,name FROM teams WHERE active=1 ORDER BY name',[],client),many("SELECT id,name FROM brokers WHERE status='active' AND role='internal_broker' AND job_role IN ('sales_agent','listing_agent') ORDER BY name",[],client)]);
  const businessTypes=[...new Set(catalogue.mappings.filter(m=>m.targetContext==='derived_transaction').map(m=>legacyBusinessType(m.targetValueCode)).filter(v=>v!=='Unconfirmed'))];
  return{metrics:Object.entries(TARGET_METRICS).map(([code,m])=>({code,...m})),businessTypes,teams,agents};
}
async function validated(body,client){const setup=await targetSetup(client),result=validateTarget(body,TARGET_METRICS,{businessTypes:setup.businessTypes,teamIds:setup.teams.map(x=>x.id),agentIds:setup.agents.map(x=>x.id)});if(result.error)fail(result.error);return result.value;}
async function snapshot(row,effectiveOn,reason,actor,client){await execute('INSERT INTO dashboard_target_revisions(id,target_id,revision,effective_on,payload,reason,changed_by) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)',[uuid(),row.id,row.revision,effectiveOn,JSON.stringify(normalizeTargetRow(row)),reason,actor],client);}
async function overlap(target,client){
  // Serialize approvals, edits and activations for the same metric/scope/cadence.
  await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[`dashboard-target:${target.metricCode}:${target.scopeType}:${target.scopeId||''}:${target.cadence}`],client);
  return one(`SELECT id FROM dashboard_targets WHERE id<>$1 AND metric_code=$2 AND scope_type=$3 AND COALESCE(scope_id,'')=COALESCE($4,'') AND cadence=$5 AND status IN ('approved','active') AND daterange(period_start,period_end,'[]') && daterange($6::date,$7::date,'[]') LIMIT 1`,[target.id,target.metricCode,target.scopeType,target.scopeId,target.cadence,target.periodStart,target.periodEnd],client);
}
const fields=['metricCode','scopeType','scopeId','periodStart','periodEnd','targetValue','unit','definition','exceptionThreshold','thresholdDirection','approvalBasis','cadence'];
const columns=fields.map(k=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()));
export async function createTarget(body,actor){return transaction(async client=>{const value=await validated(body,client),id=uuid(),row=await one(`INSERT INTO dashboard_targets(id,${columns.join(',')},created_by,status) VALUES($1,${fields.map((_,i)=>'$'+(i+2)).join(',')},$${fields.length+2},'draft') RETURNING *`,[id,...fields.map(k=>value[k]),actor],client);await snapshot(row,value.periodStart,'Draft created',actor,client);await audit('DashboardTarget',id,'draft_created',actor,{after:row},client);return normalizeTargetRow(row);});}
export async function changeTarget(id,action,body,actor){return transaction(async client=>{
  const before=await one('SELECT * FROM dashboard_targets WHERE id=$1 FOR UPDATE',[id],client);if(!before)fail('Target not found',404);
  if(Number(body.expectedRevision)!==Number(before.revision))fail('This target changed. Refresh and review the latest version.',409);
  const reason=String(body.reason||'').trim();if(reason.length<3)fail('Enter a reason for this change');
  if(action==='delete'){
    if(before.status!=='draft')fail('Only drafts can be deleted; retire an activated target instead',409);
    await audit('DashboardTarget',id,'draft_deleted',actor,{reason,before},client);await execute('DELETE FROM dashboard_targets WHERE id=$1',[id],client);return{deleted:true};
  }
  let row,effectiveOn=targetDate(before.periodStart);
  if(action==='edit'){
    if(!['draft','active'].includes(before.status))fail('Only draft or active targets can be edited',409);
    const value=await validated(body,client);
    if(before.status==='active'){
      if(['metricCode','scopeType','scopeId','cadence'].some(k=>(value[k]||null)!==(before[k]||null)))fail('Keep the KPI, scope and frequency of an active target; create a separate target to change them');
      if(value.periodStart!==targetDate(before.periodStart))fail('Keep the original start date; use Change effective from for an active target');
      effectiveOn=targetDate(body.changeEffectiveOn);
      if(!alignedTargetDate(effectiveOn,before.cadence)||effectiveOn<=dubaiToday()||effectiveOn<value.periodStart||(value.periodEnd&&effectiveOn>value.periodEnd))fail('Choose a future, period-aligned change date within the target schedule');
      if(before.cadence==='one_off'&&effectiveOn!==value.periodStart)fail('A one-off active target can only be edited before it starts, effective on its original start date');
      const latest=await one('SELECT MAX(effective_on) AS latest FROM dashboard_target_revisions WHERE target_id=$1',[id],client);
      if(effectiveOn<targetDate(latest.latest))fail('A new edit cannot take effect before the last scheduled version',409);
      if(await overlap({...before,...value},client))fail('Another approved or active target overlaps this KPI, scope and frequency',409);
    }
    row=await one(`UPDATE dashboard_targets SET ${columns.map((k,i)=>k+'=$'+(i+1)).join(',')},revision=revision+1,updated_at=NOW() WHERE id=$${fields.length+1} RETURNING *`,[...fields.map(k=>value[k]),id],client);
  }else{
    const expected={approve:'draft',activate:'approved'};
    if(action==='retire'){if(!['draft','approved','active'].includes(before.status))fail('Target is already retired',409);}
    else if(!expected[action]||before.status!==expected[action])fail('This action is not available in the current target status',409);
    if(['approve','activate'].includes(action)&&await overlap(before,client))fail('Another approved or active target overlaps this KPI, scope and frequency',409);
    const status={approve:'approved',activate:'active',retire:'retired'}[action];
    row=await one(`UPDATE dashboard_targets SET status=$1,revision=revision+1,updated_at=NOW(),approved_by=CASE WHEN $1='approved' THEN $2 ELSE approved_by END,approved_at=CASE WHEN $1='approved' THEN NOW() ELSE approved_at END,approval_reason=CASE WHEN $1='approved' THEN $3 ELSE approval_reason END,effective_from=CASE WHEN $1='active' THEN NOW() ELSE effective_from END,effective_to=CASE WHEN $1='retired' THEN NOW() ELSE effective_to END WHERE id=$4 RETURNING *`,[status,actor,reason,id],client);
    effectiveOn=action==='retire'?dubaiToday():targetDate(before.periodStart);
  }
  await snapshot(row,effectiveOn,reason,actor,client);await audit('DashboardTarget',id,action==='edit'?'edited':action,actor,{reason,effectiveOn,before,after:row},client);return normalizeTargetRow(row);
});}
export async function listTargetVersions(ids){if(!ids.length)return[];return many('SELECT r.*,r.effective_on::text AS effective_on,b.name AS changed_by_name FROM dashboard_target_revisions r JOIN brokers b ON b.id=r.changed_by WHERE target_id=ANY($1::uuid[]) ORDER BY r.target_id,r.effective_on,r.revision',[ids]);}
export function comparisonPeriods(target,revisions,from,to,options){
  const versions=revisions.filter(v=>v.targetId===target.id&&camelPayload(v.payload).status==='active').map(v=>({...camelPayload(v.payload),validFrom:targetDate(v.effectiveOn),effectiveOn:targetDate(v.effectiveOn),revision:v.revision}));
  // Approval/activation snapshots may share the first date; only active value versions are used.
  const ordered=[...new Map(versions.map(v=>[v.validFrom,v])).values()].sort((a,b)=>a.validFrom.localeCompare(b.validFrom));
  if(!ordered.length)return[];
  for(let i=0;i<ordered.length-1;i++)ordered[i].validTo=new Date(Date.parse(ordered[i+1].validFrom)-86400000).toISOString().slice(0,10);
  let periods=periodsForTarget(target,ordered,from,to,options);
  if(target.status==='retired'&&target.effectiveTo){const end=new Date(Date.parse(dubaiToday(new Date(target.effectiveTo)))-86400000).toISOString().slice(0,10);periods=periods.filter(p=>p.from<=end).map(p=>({...p,actualTo:p.actualTo<end?p.actualTo:end,partial:p.partial||end<p.to}));}
  return periods;
}
