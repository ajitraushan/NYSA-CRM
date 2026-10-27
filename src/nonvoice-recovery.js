import {randomUUID} from 'node:crypto';
import {hotResponseDeadlines} from './nonvoice-response-workflow.js';
export async function ensureResponseNextActions(client){
 const rows=(await client.query(`SELECT c.*,l.contact_id FROM lead_follow_up_cases c JOIN leads l ON l.id=c.lead_id JOIN tasks t ON t.id=c.next_action_task_id
  WHERE c.state NOT IN ('opted_out','wrong_person','complete') AND t.status NOT IN ('open','in_progress') ORDER BY c.id FOR UPDATE OF c SKIP LOCKED`)).rows;
 for(const row of rows){
  const existing=(await client.query("SELECT id,due_at FROM tasks WHERE lead_id=$1 AND status IN ('open','in_progress') ORDER BY due_at,id LIMIT 1",[row.lead_id])).rows[0];
  if(existing){await client.query('UPDATE lead_follow_up_cases SET next_action_task_id=$2,updated_at=NOW() WHERE id=$1',[row.id,existing.id]);await client.query('UPDATE leads SET next_follow_up_at=$2 WHERE id=$1',[row.lead_id,existing.due_at]);continue;}
  const taskId=randomUUID();await client.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,priority,status,due_at,created_by)
   VALUES($1,$2,$3,'Resolve missing lead response next action',$4,'high','open',NOW(),$5)`,[taskId,row.lead_id,row.contact_id,row.fallback_owner_id,row.created_by]);
  await client.query("UPDATE lead_follow_up_cases SET next_action_task_id=$2,state='needs_review',updated_at=NOW() WHERE id=$1",[row.id,taskId]);
  await client.query('UPDATE leads SET next_follow_up_at=NOW() WHERE id=$1',[row.lead_id]);
 }
 return rows.length;
}
export async function purgeExpiredResponseEvidence(client){
 const drafts=await client.query(`DELETE FROM lead_response_chat_drafts WHERE expires_at<=NOW() OR provider_inbox_id IN (SELECT id FROM lead_response_provider_inbox WHERE expires_at<=NOW())`);
 const inbox=await client.query('DELETE FROM lead_response_provider_inbox WHERE expires_at<=NOW()');
 const source=await client.query('DELETE FROM lead_response_evidence WHERE expires_at<=NOW()');
 return {drafts:drafts.rowCount,inbox:inbox.rowCount,source:source.rowCount};
}

export async function escalateOverdueHotResponses(client,{now=new Date()}={}){
 const rows=(await client.query(`SELECT c.*,l.contact_id,l.assigned_team_id,b.team_id AS fallback_team_id FROM lead_follow_up_cases c
 JOIN leads l ON l.id=c.lead_id JOIN brokers b ON b.id=c.fallback_owner_id
 WHERE c.handoff_requested_at IS NOT NULL AND c.handoff_accepted_at IS NULL AND c.manager_alert_task_id IS NULL
 AND c.state NOT IN ('opted_out','wrong_person','complete','booked','human_owned')
 AND (c.accepted_tier='Hot' OR c.tier_suggestion->>'suggestedTier'='Hot')
 ORDER BY c.id FOR UPDATE OF c SKIP LOCKED`)).rows;
 let alerted=0,missingManager=0;
 for(const row of rows){
  if(new Date(hotResponseDeadlines(row.handoff_requested_at).escalationDueAt)>now)continue;
  const teamId=row.assigned_team_id||row.fallback_team_id;
  const manager=teamId?(await client.query(`SELECT b.id FROM teams t JOIN brokers b ON b.id=t.manager_id
   WHERE t.id=$1 AND t.active=1 AND b.status='active' AND b.role='internal_broker' AND b.job_role='manager'`,[teamId])).rows[0]:null;
  const taskId=randomUUID();
  await client.query(`INSERT INTO tasks(id,lead_id,contact_id,subject,assignee_id,priority,status,due_at,created_by)
   VALUES($1,$2,$3,$4,$5,'urgent','open',$6,$7)`,[taskId,row.lead_id,row.contact_id,
   manager?'Hot lead unaccepted: manager review and reassign':'Hot lead overdue: configure an active team manager',manager?.id||row.fallback_owner_id,now,row.created_by]);
  await client.query(`UPDATE lead_follow_up_cases SET manager_alert_task_id=$2,manager_alerted_at=$3,manager_alert_setup_missing=$4,updated_at=NOW() WHERE id=$1`,[row.id,taskId,now,!manager]);
  await client.query(`INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,'Lead',$2,'response_manager_alert',$3,$4)`,[randomUUID(),row.lead_id,row.created_by,JSON.stringify({caseRef:row.id,taskRef:taskId,managerConfigured:!!manager,automaticReassignment:false})]);
  await client.query("UPDATE leads SET next_follow_up_at=(SELECT MIN(due_at) FROM tasks WHERE lead_id=$1 AND status IN ('open','in_progress')) WHERE id=$1",[row.lead_id]);
  alerted++;if(!manager)missingManager++;
 }
 return {alerted,missingManager};
}
