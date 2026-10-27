import crypto from 'node:crypto';
import {FOLLOW_UP_POLICY_VERSION,applySequenceEvent} from './lead-follow-up-domain.js';
const id=()=>crypto.randomUUID();
const fail=code=>{throw Object.assign(new Error(code),{statusCode:409});};
const boundedRef=value=>typeof value==='string' && /^[A-Za-z0-9_.:-]{1,160}$/.test(value);
const one=async(client,sql,params)=>(await client.query(sql,params)).rows[0];

// Internal transaction-scoped commands. No public arbitrary-lead update endpoint.
// Caller must supply the existing governed CRM authentication/scope checks before invoking.
export async function openNonvoiceCase(input,client) {
  const source=await one(client,'SELECT * FROM lead_source_inbox WHERE id=$1 FOR UPDATE',[input.sourceInboxId]);
  if(!source || source.lead_id!==input.leadId || source.state!=='accepted') fail('SOURCE_NOT_LINKED');
  const existing=await one(client,'SELECT * FROM lead_follow_up_cases WHERE source_inbox_id=$1',[source.id]);
  if(existing) return {...existing,duplicate:true};
  const lead=await one(client,`SELECT l.*,c.do_not_contact,c.phone AS contact_phone,c.email AS contact_email FROM leads l JOIN contacts c ON c.id=l.contact_id WHERE l.id=$1 FOR UPDATE OF l,c`,[input.leadId]);
  if(!lead || lead.assigned_to || new Date(lead.created_at)<new Date(source.received_at)) fail('EXISTING_HUMAN_LEAD');
  const owner=await one(client,"SELECT id,role,job_role FROM brokers WHERE id=$1 AND status='active'",[input.fallbackOwnerId]);
  if(!owner || owner.role!=='internal_broker' || !['sales_agent','manager'].includes(owner.job_role)) fail('OPERATIONAL_OWNER_REQUIRED');
  const actor=await one(client,"SELECT id FROM brokers WHERE id=$1 AND status='active'",[input.actorId]);
  if(!actor) fail('ACTIVE_ACTOR_REQUIRED');
  const consent=input.consent||{},evidenced=boundedRef(consent.statementVersion)&&boundedRef(consent.evidenceRef);
  const eligible=input.locationConfirmed===true && ((input.country==='AE'&&input.timeZone==='Asia/Dubai')||
    (input.country==='IN'&&input.timeZone==='Asia/Kolkata')) && evidenced && !lead.do_not_contact;
  const whatsapp=eligible&&consent.whatsapp===true&&Boolean(lead.contact_phone),email=eligible&&consent.email===true&&Boolean(lead.contact_email);
  const ready=whatsapp&&email; // Incomplete multichannel permission requires deliberate human review.
  const caseId=id(),taskId=id();
  await client.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,status,due_at,created_by)
    VALUES($1,$2,$3,$4,$5,$6,'normal','open',NOW(),$7)`,[taskId,lead.id,lead.contact_id,
    ready?'Monitor AI lead response':'Review lead contact eligibility','Reference-only automation recovery task; no customer content.',owner.id,actor.id]);
  const created=await one(client,`INSERT INTO lead_follow_up_cases(id,source_inbox_id,lead_id,fallback_owner_id,created_by,policy_version,
    country,time_zone,location_confirmed,consent_statement_version,consent_evidence_ref,whatsapp_permitted,email_permitted,state,next_action_task_id)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [caseId,source.id,lead.id,owner.id,actor.id,FOLLOW_UP_POLICY_VERSION,input.country||null,input.timeZone||null,
      input.locationConfirmed===true,evidenced?consent.statementVersion:null,evidenced?consent.evidenceRef:null,
      whatsapp,email,ready?'ready':'needs_review',taskId]);
  if(ready) for(const [step,channel,prerequisite] of [[0,'whatsapp',null],[2,'whatsapp','first_missed_call'],[3,'email','first_call_ended'],
    [5,'whatsapp','second_missed_call'],[6,'email','first_call_day3'],[7,'handoff','first_call_day3']]) {
    await client.query(`INSERT INTO lead_follow_up_jobs(id,case_id,generation,step,channel,prerequisite,state,due_at)
      VALUES($1,$2,1,$3,$4,$5,$6,CASE WHEN $3=0 THEN NOW() ELSE NULL END)`,[id(),caseId,step,channel,prerequisite,step===0?'queued':'waiting']);
  }
  await client.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
    VALUES($1,'Lead',$2,'nonvoice_case_opened',$3,$4)`,[id(),lead.id,actor.id,JSON.stringify({caseRef:caseId,state:created.state,policyVersion:FOLLOW_UP_POLICY_VERSION})]);
  await client.query('UPDATE leads SET next_follow_up_at=(SELECT due_at FROM tasks WHERE id=$2) WHERE id=$1',[lead.id,taskId]);
  return created;
}

export async function applyNonvoiceEvent(input,client) {
  if(!boundedRef(input.connectionRef)||!boundedRef(input.eventRef)||!Number.isSafeInteger(input.generation)||input.generation<1)
    fail('INVALID_EVENT_REFERENCE');
  const current=await one(client,'SELECT * FROM lead_follow_up_cases WHERE id=$1 FOR UPDATE',[input.caseId]);
  if(!current) fail('CASE_NOT_FOUND');
  const digest=crypto.createHash('sha256').update(JSON.stringify([current.id,input.generation,input.type])).digest('hex');
  const previous=await one(client,'SELECT * FROM lead_follow_up_events WHERE provider_connection_ref=$1 AND provider_event_ref=$2',[input.connectionRef,input.eventRef]);
  if(previous){if(previous.event_digest!==digest)fail('ALTERED_CHANNEL_EVENT');return {duplicate:true,applied:previous.applied};}
  const next=applySequenceEvent({state:current.state,generation:current.generation},{type:input.type,generation:input.generation});
  await client.query(`INSERT INTO lead_follow_up_events(id,case_id,provider_connection_ref,provider_event_ref,event_type,event_digest,generation,applied)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id(),current.id,input.connectionRef,input.eventRef,input.type,digest,input.generation,!next.ignored]);
  if(next.ignored) return {applied:false};
  await client.query("UPDATE lead_response_chat_drafts SET state='cancelled' WHERE case_id=$1 AND state IN ('preparing','ready')",[current.id]);
  const affected=await client.query(`UPDATE lead_follow_up_jobs SET state=CASE WHEN state='claimed' THEN 'outcome_unknown' ELSE 'cancelled' END
    WHERE case_id=$1 AND state IN ('waiting','queued','claimed') RETURNING state`,[current.id]);
  await client.query(`UPDATE lead_follow_up_cases SET state=$2,generation=$3,updated_at=NOW() WHERE id=$1`,[current.id,next.state,next.generation]);
  await client.query(`UPDATE tasks SET subject=$2,priority=CASE WHEN $3 THEN 'urgent' ELSE priority END,updated_at=NOW()
    WHERE id=$1 AND status IN ('open','in_progress')`,[current.next_action_task_id,
      input.type==='reply'?'Supervise AI booking conversation':input.type==='opt_out'?'Review recorded contact restriction':
      input.type==='booking'?'Follow up confirmed booking':'Resolve lead follow-up outcome',input.type==='unknown_outcome']);
  if(input.type==='opt_out'||input.type==='wrong_person'){await client.query("UPDATE tasks SET status='cancelled',outcome='Stopped by verified contact restriction',updated_at=NOW() WHERE id=$1 AND status IN ('open','in_progress')",[current.next_action_task_id]);
   await client.query("UPDATE lead_response_callbacks SET status='cancelled' WHERE case_id=$1 AND status='confirmed_callback'",[current.id]);
  }
  if(input.type==='opt_out'||input.type==='wrong_person') await client.query(`UPDATE contacts SET do_not_contact=1,
    contact_restriction_reason=$2,updated_at=NOW() WHERE id=(SELECT contact_id FROM leads WHERE id=$1)`,
    [current.lead_id,input.type==='opt_out'?'Customer opted out through verified integration':'Wrong person reported through verified integration']);
  await client.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
    VALUES($1,'Lead',$2,'nonvoice_event_applied',$3,$4)`,[id(),current.lead_id,current.created_by,
    JSON.stringify({caseRef:current.id,type:input.type,generation:next.generation})]);
  return {applied:true,state:next.state,generation:next.generation,requiresProviderReconciliation:affected.rows.some(r=>r.state==='outcome_unknown')};
}

// A claim is not permission to transmit. The adapter must acquire the case lock, recheck
// fresh restrictions/generation and reserve budget immediately before an external send.
export async function claimNonvoiceJobs({limit=10,liveEnabled=false},client) {
  if(liveEnabled!==true) return [];
  if(!Number.isInteger(limit)||limit<1||limit>20) fail('INVALID_CLAIM_LIMIT');
  const results=await client.query(`WITH due AS (
    SELECT j.id FROM lead_follow_up_jobs j JOIN lead_follow_up_cases c ON c.id=j.case_id
    JOIN leads l ON l.id=c.lead_id JOIN contacts ct ON ct.id=l.contact_id
    WHERE j.state='queued' AND j.due_at<=NOW() AND c.state='ready' AND j.generation=c.generation
      AND ct.do_not_contact=0 AND l.assigned_to IS NULL
      AND c.location_confirmed=TRUE AND ((c.country='AE' AND c.time_zone='Asia/Dubai') OR (c.country='IN' AND c.time_zone='Asia/Kolkata'))
      AND ((j.channel='whatsapp' AND c.whatsapp_permitted) OR (j.channel='email' AND c.email_permitted) OR j.channel='handoff')
    ORDER BY j.due_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT $1
  ) UPDATE lead_follow_up_jobs j SET state='claimed',lease_token=gen_random_uuid(),
    lease_expires_at=NOW()+INTERVAL '60 seconds',attempt_count=attempt_count+1 FROM due WHERE j.id=due.id RETURNING j.*`,[limit]);
  return results.rows;
}
export async function expireNonvoiceClaims(client) {
  // Match event-application lock order: case first, then jobs, to avoid deadlock.
  const cases=await client.query(`SELECT c.id FROM lead_follow_up_cases c WHERE EXISTS
    (SELECT 1 FROM lead_follow_up_jobs j WHERE j.case_id=c.id AND j.state='claimed' AND j.lease_expires_at<=NOW())
    ORDER BY c.id FOR UPDATE OF c SKIP LOCKED`);
  let count=0;
  for(const {id:caseId} of cases.rows){
    const result=await client.query(`UPDATE lead_follow_up_jobs SET state='outcome_unknown'
      WHERE case_id=$1 AND state='claimed' AND lease_expires_at<=NOW()`,[caseId]);
    if(!result.rowCount) continue;
    count+=result.rowCount;
    await client.query("UPDATE lead_follow_up_cases SET state='outcome_unknown',generation=generation+1,updated_at=NOW() WHERE id=$1 AND state='ready'",[caseId]);
    await client.query("UPDATE lead_follow_up_jobs SET state='cancelled' WHERE case_id=$1 AND state IN ('queued','waiting')",[caseId]);
    await client.query(`UPDATE tasks SET subject='Reconcile unknown message outcome',priority='urgent',updated_at=NOW()
      WHERE id=(SELECT next_action_task_id FROM lead_follow_up_cases WHERE id=$1) AND status IN ('open','in_progress')`,[caseId]);
  }
  return count;
}
