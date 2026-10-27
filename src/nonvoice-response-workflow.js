import {randomUUID} from 'node:crypto';
import {applyNonvoiceEvent} from './nonvoice-follow-up-store.js';
import {suggestLeadTier,nextMessageWindow} from './lead-follow-up-domain.js';
import {addBusinessMinutes} from './crm-domain.js';
export function hotResponseDeadlines(at){const start=new Date(at),calendar={workDays:[0,1,2,3,4,5,6],startMinute:600,endMinute:1200,utcOffsetMinutes:240};return {acceptanceDueAt:addBusinessMinutes(start,10,calendar),escalationDueAt:addBusinessMinutes(start,30,calendar)};}
const get=async(c,s,p)=>(await c.query(s,p)).rows[0];
function reject(code){throw Object.assign(new Error(code),{statusCode:409});}
export async function scopedResponseCase(caseId,broker,client,lock=false){
 if(broker?.role!=='internal_broker'||!['sales_agent','manager'].includes(broker.jobRole))throw Object.assign(new Error('Operational lead access required'),{statusCode:403});
 const row=await get(client,`SELECT c.*,s.source_system,l.contact_id,l.assigned_team_id,l.assigned_to,ct.full_name,(SELECT assignee_id FROM tasks WHERE id=c.manager_alert_task_id AND status IN ('open','in_progress')) AS alert_assignee_id FROM lead_follow_up_cases c
  JOIN lead_source_inbox s ON s.id=c.source_inbox_id JOIN leads l ON l.id=c.lead_id JOIN contacts ct ON ct.id=l.contact_id WHERE c.id=$1 ${lock?'FOR UPDATE OF c,l':''}`,[caseId]);
 if(!row)throw Object.assign(new Error('Lead response case not found'),{statusCode:404});
 const teams=broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean);
 if(row.fallback_owner_id!==broker.id&&row.assigned_to!==broker.id&&!(broker.jobRole==='manager'&&(teams.includes(row.assigned_team_id)||row.alert_assignee_id===broker.id)))
  throw Object.assign(new Error('Lead response is outside your scope'),{statusCode:403});
 const normalScope=row.fallback_owner_id===broker.id||row.assigned_to===broker.id||(broker.jobRole==='manager'&&teams.includes(row.assigned_team_id));
 if(lock&&!normalScope)throw Object.assign(new Error('Manager alert permits review only; use existing governed reassignment'),{statusCode:403});
 return row;
}
export async function listResponseCases(broker,client,{offset=0,filter='all'}={}){
 if(!Number.isInteger(offset)||offset<0||offset>1000000||!['all','digest','ready','engaged','needs_review','outcome_unknown','booked','human_owned','handoff_pending'].includes(filter))throw Object.assign(new Error('Invalid response filter'),{statusCode:400});
 if(broker?.role!=='internal_broker'||!['sales_agent','manager'].includes(broker.jobRole))throw Object.assign(new Error('Operational lead access required'),{statusCode:403});
 const teams=broker.jobRole==='manager'?(broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean)):[];
 return (await client.query(`SELECT COUNT(*) OVER()::int AS total_count,c.id,c.lead_id,c.state,c.generation,c.country,c.time_zone,c.created_at,c.declared_requirements,
 c.tier_suggestion,c.accepted_tier,c.handoff_requested_at,c.handoff_accepted_at,ct.full_name,l.lead_reference,s.source_system,
 t.due_at,t.subject AS next_action,t.status AS task_status,
 (SELECT COUNT(*)::int FROM lead_follow_up_jobs j WHERE j.case_id=c.id AND j.state='waiting') AS waiting_steps
 FROM lead_follow_up_cases c JOIN lead_source_inbox s ON s.id=c.source_inbox_id JOIN leads l ON l.id=c.lead_id JOIN contacts ct ON ct.id=l.contact_id
 JOIN tasks t ON t.id=c.next_action_task_id WHERE (c.fallback_owner_id=$1 OR l.assigned_to=$1 OR l.assigned_team_id=ANY($2::uuid[]) OR ($5::boolean AND EXISTS(SELECT 1 FROM tasks alert WHERE alert.id=c.manager_alert_task_id AND alert.assignee_id=$1 AND alert.status IN ('open','in_progress'))))
 AND ($3='all' OR ($3='digest' AND c.accepted_tier IN ('Cold','Unreached')) OR c.state=$3)
 ORDER BY t.due_at,c.created_at,c.id LIMIT 100 OFFSET $4`,[broker.id,teams,filter,offset,broker.jobRole==='manager'])).rows;
}
export async function decideResponseTier(input,broker,client){
 const row=await scopedResponseCase(input.caseId,broker,client,true);
 if(!['Hot','Warm','Cold','Unreached','Stopped'].includes(input.tier)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)reject('Tier and concise reason are required');
 if(['opted_out','wrong_person'].includes(row.state)&&input.tier!=='Stopped')reject('Restricted enquiries cannot enter nurture');
 if(input.tier==='Stopped'&&!['opted_out','wrong_person'].includes(row.state))reject('Record a customer contact restriction before selecting Stopped');
 const requestedAt=row.accepted_tier==='Hot'&&row.handoff_requested_at?row.handoff_requested_at:new Date();
 const hotDeadline=hotResponseDeadlines(requestedAt).acceptanceDueAt;
 const suggestion=input.dimensions?suggestLeadTier({dimensions:input.dimensions,requestedBooking:input.requestedBooking===true,timelineConflict:input.timelineConflict===true,noResponse:input.tier==='Unreached'}):(row.tier_suggestion||suggestLeadTier({dimensions:{},noResponse:input.tier==='Unreached'}));
 await client.query(`UPDATE lead_follow_up_cases SET accepted_tier=$2,tier_suggestion=$3::jsonb,tier_decided_by=$4,tier_decision_reason=$5,
  handoff_requested_at=$6,updated_at=NOW() WHERE id=$1`,[row.id,input.tier,JSON.stringify(suggestion),broker.id,input.reason.trim(),requestedAt]);
 await client.query(`UPDATE tasks SET priority=CASE WHEN $2='Hot' THEN 'urgent' ELSE 'normal' END,
  subject=$3,due_at=CASE WHEN $2='Hot' THEN $4::timestamptz WHEN $2='Warm' THEN NOW()+INTERVAL '24 hours' WHEN $2='Cold' THEN NOW()+INTERVAL '30 days'
  WHEN $2='Unreached' THEN NOW()+INTERVAL '48 hours' ELSE NOW() END,updated_at=NOW() WHERE id=$1 AND status IN ('open','in_progress')`,
  [row.next_action_task_id,input.tier,`${input.tier} lead response follow-up`,hotDeadline]);
 await client.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,'Lead',$2,'response_tier_confirmed',$3,$4)`,
  [randomUUID(),row.lead_id,broker.id,JSON.stringify({caseRef:row.id,tier:input.tier,rubricVersion:suggestion.rubricVersion||null})]);
 await client.query("UPDATE leads SET next_follow_up_at=(SELECT MIN(due_at) FROM tasks WHERE lead_id=$1 AND status IN ('open','in_progress')) WHERE id=$1",[row.lead_id]);
 return {tier:input.tier,suggestion};
}
export async function takeOverResponseCase(caseId,broker,client){
 const row=await scopedResponseCase(caseId,broker,client,true);
 if(row.assigned_to && row.assigned_to!==broker.id)reject('Existing lead owner must be preserved');
 const result=await applyNonvoiceEvent({caseId:row.id,connectionRef:'human:'+broker.id,eventRef:randomUUID(),type:'takeover',generation:row.generation},client);
 if(result.applied){
  await client.query(`UPDATE leads SET assigned_to=$2,assignment_status='assigned',accepted_at=COALESCE(accepted_at,NOW()),updated_at=NOW() WHERE id=$1`,[row.lead_id,broker.id]);
  await client.query(`UPDATE lead_assignments SET agent_id=$2,status='accepted',responded_at=NOW() WHERE lead_id=$1 AND superseded_at IS NULL`,[row.lead_id,broker.id]);
  await client.query(`UPDATE lead_follow_up_cases SET handoff_accepted_at=NOW(),fallback_owner_id=$2 WHERE id=$1`,[row.id,broker.id]);
  await client.query("UPDATE tasks SET assignee_id=$2,updated_at=NOW() WHERE id=$1 AND status IN ('open','in_progress')",[row.next_action_task_id,broker.id]);
 }
 return result;
}
export async function bookResponseCallback(input,broker,client){
 const row=await scopedResponseCase(input.caseId,broker,client,true);
 if(input.confirmed!==true||['opted_out','wrong_person','outcome_unknown'].includes(row.state))reject('Confirmed eligible callback required');
 if(typeof input.startsAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.startsAt))reject('Include the callback timezone');
 const start=new Date(input.startsAt),end=new Date(start.valueOf()+30*60000);
 if(!Number.isFinite(start.valueOf())||start<=new Date())reject('Choose a future callback slot');
 const p=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:'Asia/Dubai',hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(start).map(x=>[x.type,x.value]));
 const minutes=Number(p.hour)*60+Number(p.minute),close=row.country==='IN'?1050:1080;
 if(!['AE','IN'].includes(row.country)||!row.time_zone||minutes<600||minutes+30>close)reject('Choose a slot inside approved calling hours');
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['response-calendar:'+row.fallback_owner_id]);
 const existing=await get(client,`SELECT * FROM lead_response_callbacks WHERE case_id=$1 AND starts_at=$2 AND status='confirmed_callback'`,[row.id,start]);
 if(existing)return {id:existing.id,status:existing.status,duplicate:true};
 if(row.state==='booked')reject('Change the existing callback through its follow-up task');
 const conflict=await get(client,`SELECT id FROM lead_response_callbacks WHERE owner_id=$1 AND status='confirmed_callback' AND starts_at<$3 AND ends_at>$2`,[row.fallback_owner_id,start,end]);
 if(conflict)reject('Callback slot is no longer available');
 const id=randomUUID();await client.query(`INSERT INTO lead_response_callbacks(id,case_id,owner_id,starts_at,ends_at,customer_confirmed,status,created_by)
  VALUES($1,$2,$3,$4,$5,TRUE,'confirmed_callback',$6)`,[id,row.id,row.fallback_owner_id,start,end,broker.id]);
 await applyNonvoiceEvent({caseId:row.id,connectionRef:'booking:core',eventRef:id,type:'booking',generation:row.generation},client);
 await client.query("UPDATE tasks SET subject='Customer-confirmed callback',due_at=$2,status='open',updated_at=NOW() WHERE id=$1",[row.next_action_task_id,start]);
 await client.query("UPDATE leads SET next_follow_up_at=(SELECT MIN(due_at) FROM tasks WHERE lead_id=$1 AND status IN ('open','in_progress')) WHERE id=$1",[row.lead_id]);
 return {id,status:'confirmed_callback',startsAt:start.toISOString(),calendarSync:'not_connected'};
}
export async function releaseDependentMessages({caseId,kind,anchorAt},client){
 const row=await get(client,'SELECT * FROM lead_follow_up_cases WHERE id=$1 FOR UPDATE',[caseId]);if(!row||row.state!=='ready')return {released:0};
 if(!['first_missed_call','first_call_ended','second_missed_call','first_call_day3'].includes(kind))reject('Invalid sequence anchor');
 const anchor=new Date(anchorAt);if(!Number.isFinite(anchor.valueOf())||anchor>new Date())reject('Verified past anchor required');
 const old=await get(client,'SELECT * FROM lead_response_anchors WHERE case_id=$1 AND kind=$2',[row.id,kind]);
 if(old){if(new Date(old.anchor_at).valueOf()!==anchor.valueOf())reject('Sequence anchor cannot change');return {released:0,duplicate:true};}
 await client.query('INSERT INTO lead_response_anchors(case_id,kind,anchor_at) VALUES($1,$2,$3)',[row.id,kind,anchor]);
 const jobs=(await client.query("SELECT * FROM lead_follow_up_jobs WHERE case_id=$1 AND generation=$2 AND prerequisite=$3 AND state='waiting'",[row.id,row.generation,kind])).rows;
 for(const job of jobs){
  let due;
  if(kind==='first_call_day3'){
   const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:row.time_zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(anchor).map(p=>[p.type,p.value]));
   due=new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);due.setUTCDate(due.getUTCDate()+2);
   due.setUTCMinutes((job.step===6?600:1080)-(row.country==='IN'?330:240));
  }else due=new Date(anchor.valueOf()+({first_missed_call:15,first_call_ended:120,second_missed_call:30}[kind])*60000);
  const adjusted=job.channel==='handoff'?due.toISOString():nextMessageWindow(due,row.time_zone);
  await client.query("UPDATE lead_follow_up_jobs SET state='queued',due_at=$2 WHERE id=$1",[job.id,adjusted]);
 }
 return {released:jobs.length};
}
export async function responseMetrics(broker,client){
 if(broker?.role!=='internal_broker'||!['sales_agent','manager'].includes(broker.jobRole))throw Object.assign(new Error('Operational lead access required'),{statusCode:403});
 const teams=broker.jobRole==='manager'?(broker.managedTeamIds?.length?broker.managedTeamIds:[broker.teamId].filter(Boolean)):[];
 return (await client.query(`WITH scoped AS (SELECT c.* FROM lead_follow_up_cases c JOIN leads l ON l.id=c.lead_id
 WHERE (c.fallback_owner_id=$1 OR l.assigned_to=$1 OR l.assigned_team_id=ANY($2::uuid[]) OR ($3::boolean AND EXISTS(SELECT 1 FROM tasks alert WHERE alert.id=c.manager_alert_task_id AND alert.assignee_id=$1 AND alert.status IN ('open','in_progress')))) AND c.created_at>=NOW()-INTERVAL '30 days')
 SELECT COUNT(*)::int AS leads,
 COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM lead_follow_up_events e WHERE e.case_id=scoped.id AND e.applied AND e.event_type IN ('reply','opt_out','wrong_person')))::int AS contacted,
 COUNT(*) FILTER(WHERE declared_requirements->>'enquiryConfirmed'='true')::int AS enquiry_confirmed,
 COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM lead_response_callbacks b WHERE b.case_id=scoped.id AND b.status='confirmed_callback'))::int AS callbacks_booked,
 COUNT(*) FILTER(WHERE state='opted_out')::int AS opted_out,
 COUNT(*) FILTER(WHERE handoff_requested_at IS NOT NULL AND handoff_accepted_at IS NULL)::int AS unaccepted,
 AVG(EXTRACT(EPOCH FROM(handoff_accepted_at-handoff_requested_at))/60) FILTER(WHERE handoff_accepted_at>=handoff_requested_at) AS acceptance_elapsed_minutes
 FROM scoped`,[broker.id,teams,broker.jobRole==='manager'])).rows[0];
}
