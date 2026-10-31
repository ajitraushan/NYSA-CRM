import {randomUUID} from 'node:crypto';
import {evaluateNonvoiceDispatch} from './lead-follow-up-domain.js';
const get=async(c,s,p)=>(await c.query(s,p)).rows[0];
function fail(code){throw Object.assign(new Error(code),{statusCode:409});}
export async function reserveMessageBudget({jobId,leaseToken,maxCostUsd},client){
 if(typeof maxCostUsd!=='number'||!Number.isFinite(maxCostUsd)||maxCostUsd<=0||maxCostUsd>10)fail('INVALID_MESSAGE_COST_RESERVATION');
 // Serialize on case before job, matching reply/opt-out processing.
 const control=await get(client,'SELECT paused FROM lead_integration_setup WHERE singleton=TRUE',[]);if(control?.paused!==false)fail('DISPATCH_PAUSED');
 const ref=await get(client,'SELECT case_id FROM lead_follow_up_jobs WHERE id=$1',[jobId]);if(!ref)fail('JOB_NOT_FOUND');
 const row=await get(client,`SELECT c.*,ct.do_not_contact,l.assigned_to FROM lead_follow_up_cases c
 JOIN leads l ON l.id=c.lead_id JOIN contacts ct ON ct.id=l.contact_id WHERE c.id=$1 FOR UPDATE OF c,l,ct`,[ref.case_id]);
 const job=await get(client,'SELECT * FROM lead_follow_up_jobs WHERE id=$1 FOR UPDATE',[jobId]);
 if(job.state!=='claimed'||job.lease_token!==leaseToken||new Date(job.lease_expires_at)<=new Date())fail('JOB_LEASE_EXPIRED');
 const old=await get(client,'SELECT * FROM lead_response_message_attempts WHERE job_id=$1',[job.id]);
 if(old)return {attempt:old,duplicate:true};
 const count=await get(client,`SELECT COUNT(*)::int AS n FROM lead_response_message_attempts a JOIN lead_follow_up_jobs j ON j.id=a.job_id
 WHERE j.case_id=$1 AND j.channel=$2 AND a.state IN ('reserved','accepted','outcome_unknown')`,[row.id,job.channel]);
 const gate=evaluateNonvoiceDispatch({liveEnabled:true,channel:job.channel,step:job.step,country:row.country,timeZone:row.time_zone,
 locationConfirmed:row.location_confirmed,at:new Date().toISOString(),jobGeneration:job.generation,caseGeneration:row.generation,state:row.state,
 permissionConfirmed:job.channel==='whatsapp'?row.whatsapp_permitted:row.email_permitted,restrictionClear:!row.do_not_contact,
 identityClear:true,providerOutcomeUnknown:false,scheduledCount:count.n,templateApproved:true,budgetReserved:true});
 if(!gate.allowed||row.assigned_to)fail(gate.allowed?'HUMAN_OWNS_LEAD':gate.reason);
 const day=(await get(client,"SELECT (NOW() AT TIME ZONE 'Asia/Dubai')::date AS day",[])).day;
 await client.query('INSERT INTO lead_response_messaging_budgets(budget_day) VALUES($1) ON CONFLICT DO NOTHING',[day]);
 const ledger=await get(client,'SELECT * FROM lead_response_messaging_budgets WHERE budget_day=$1 FOR UPDATE',[day]);
 // Round upward so floating-point truncation cannot underreserve fractional provider tariffs.
 const cost=Math.ceil(maxCostUsd*1e6)/1e6;
 if(Number(ledger.reserved_usd)+cost>10)fail('MESSAGING_DAILY_CAP');
 await client.query('UPDATE lead_response_messaging_budgets SET reserved_usd=reserved_usd+$2 WHERE budget_day=$1',[day,cost]);
 const attempt=await get(client,`INSERT INTO lead_response_message_attempts(id,job_id,budget_day,reserved_usd,state)
 VALUES($1,$2,$3,$4,'reserved') RETURNING *`,[randomUUID(),job.id,day,cost]);return {attempt,duplicate:false};
}
export async function recordMessageSubmission({attemptId,providerRef,outcome},client){
 if(!['accepted','outcome_unknown','cancelled'].includes(outcome))fail('INVALID_SUBMISSION_OUTCOME');
 const attempt=await get(client,'SELECT * FROM lead_response_message_attempts WHERE id=$1 FOR UPDATE',[attemptId]);if(!attempt)fail('ATTEMPT_NOT_FOUND');
 if(attempt.state!=='reserved')return {duplicate:true,state:attempt.state};
 if(outcome==='accepted'&&(typeof providerRef!=='string'||!providerRef||providerRef.length>200))fail('PROVIDER_REFERENCE_REQUIRED');
 await client.query('UPDATE lead_response_message_attempts SET state=$2,provider_ref=$3 WHERE id=$1',[attempt.id,outcome,providerRef||null]);
 await client.query('UPDATE lead_follow_up_jobs SET state=$2 WHERE id=$1',[attempt.job_id,outcome==='accepted'?'complete':outcome]);
 // Unknown/accepted retains the full reservation. Cancelled is safe only before remote submit.
 if(outcome==='cancelled')await client.query('UPDATE lead_response_messaging_budgets SET reserved_usd=reserved_usd-$2 WHERE budget_day=$1',[attempt.budget_day,attempt.reserved_usd]);
 return {state:outcome};
}
export function createDisabledMessageTransport(){return {send:async()=>{throw new Error('LIVE_MESSAGING_NOT_CONFIGURED');}};}
