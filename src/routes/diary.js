import { Router } from '../lib/http-kit.js';
import { many } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,isCompanyReader } from '../crm-policy.js';
import { validateDiaryRange,diaryStatus,markDiaryConflicts,calendarDeliveryStatus } from '../diary-domain.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>{
  if(!hasInternalCrmIdentity(req.broker)||['accountant','listing_agent'].includes(req.broker.jobRole))return res.status(403).json({error:'The appointment diary is restricted to CRM operating roles'});
  next();
});

async function diaryAgents(broker){
  if(isCompanyReader(broker))return many(`SELECT id,name,job_role,team_id FROM brokers
    WHERE role IN ('admin','internal_broker') AND status='active' AND job_role NOT IN ('accountant','listing_agent')
    ORDER BY CASE job_role WHEN 'sales_agent' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,name`);
  if(broker.jobRole==='manager')return many(`SELECT DISTINCT b.id,b.name,b.job_role,b.team_id FROM brokers b
    WHERE b.status='active' AND b.role IN ('admin','internal_broker') AND (
      b.id=$1 OR (b.job_role='sales_agent' AND EXISTS (
        SELECT 1 FROM team_memberships member JOIN team_memberships manager ON manager.team_id=member.team_id
        WHERE member.broker_id=b.id AND member.ends_at IS NULL
          AND manager.broker_id=$1 AND manager.membership_role='manager' AND manager.ends_at IS NULL)))
    ORDER BY CASE WHEN b.id=$1 THEN 0 ELSE 1 END,b.name`,[broker.id]);
  return many('SELECT id,name,job_role,team_id FROM brokers WHERE id=$1',[broker.id]);
}

const cleanAgent=value=>typeof value==='string'&&value.trim()?value.trim():null;

r.get('/crm/diary',async(req,res)=>{
  const range=validateDiaryRange(req.query.from,req.query.to);
  if(range.error)return res.status(400).json({error:range.error});
  const allowedAgents=await diaryAgents(req.broker),allowedIds=new Set(allowedAgents.map(x=>x.id)),companyView=isCompanyReader(req.broker);
  let selectedAgentId=cleanAgent(req.query.agentId);
  if(!selectedAgentId)selectedAgentId=companyView?'all':req.broker.id;
  if(selectedAgentId==='all'&&!companyView)return res.status(403).json({error:'Company diary access is restricted to Directors and Administrators'});
  if(selectedAgentId!=='all'&&!allowedIds.has(selectedAgentId))return res.status(403).json({error:'The selected agent is outside your diary scope'});
  const ownerClause=selectedAgentId==='all'?'':` AND %ALIAS%=$3`;
  const params=selectedAgentId==='all'?[range.from,range.to]:[range.from,range.to,selectedAgentId];
  const [activities,tasks,viewings]=await Promise.all([
    many(`SELECT a.id,a.activity_type,a.subject,a.details,a.due_at AS starts_at,
      CASE WHEN a.meeting_duration_minutes IS NOT NULL THEN a.due_at+(a.meeting_duration_minutes||' minutes')::interval
        WHEN a.duration_seconds IS NOT NULL AND a.duration_seconds>0 THEN a.due_at+(a.duration_seconds||' seconds')::interval END AS ends_at,
      a.meeting_duration_minutes,a.duration_seconds,a.completed_at,a.voided_at,a.void_reason,a.owner_id AS agent_id,
      b.name AS agent_name,c.id AS customer_id,c.full_name AS customer_name,c.phone AS customer_phone,c.email AS customer_email,
      l.id AS lead_id,l.title AS lead_title,cal.event_url AS google_event_url,cal.meeting_url AS google_meeting_url,cal.sync_status AS calendar_sync_status
      FROM activities a JOIN brokers b ON b.id=a.owner_id JOIN contacts c ON c.id=a.contact_id JOIN leads l ON l.id=a.lead_id
      LEFT JOIN activity_calendar_events cal ON cal.activity_id=a.id AND cal.provider='google_calendar'
      WHERE a.due_at>=$1 AND a.due_at<$2 AND a.activity_type<>'Note'${ownerClause.replace('%ALIAS%','a.owner_id')}
      ORDER BY a.due_at`,params),
    many(`SELECT t.id,t.subject,t.details,t.due_at AS starts_at,t.completed_at,t.status AS record_status,t.assignee_id AS agent_id,
      b.name AS agent_name,c.id AS customer_id,c.full_name AS customer_name,c.phone AS customer_phone,c.email AS customer_email,
      l.id AS lead_id,l.title AS lead_title,t.priority
      FROM tasks t JOIN brokers b ON b.id=t.assignee_id JOIN contacts c ON c.id=t.contact_id JOIN leads l ON l.id=t.lead_id
      WHERE t.due_at>=$1 AND t.due_at<$2${ownerClause.replace('%ALIAS%','t.assignee_id')}
      ORDER BY t.due_at`,params),
    many(`SELECT v.id,v.starts_at,v.ends_at,v.status AS record_status,v.location,v.instructions,v.client_message,v.outcome,v.feedback,
      v.organizer_id AS agent_id,b.name AS agent_name,c.id AS customer_id,c.full_name AS customer_name,c.phone AS customer_phone,c.email AS customer_email,
      o.id AS opportunity_id,o.opportunity_reference,o.title AS opportunity_title,o.lead_id,l.project AS listing_project,
      cal.event_url AS google_event_url,cal.sync_status AS calendar_sync_status
      FROM viewings v JOIN brokers b ON b.id=v.organizer_id JOIN opportunities o ON o.id=v.opportunity_id
      JOIN contacts c ON c.id=o.contact_id JOIN listings l ON l.id=v.listing_id
      LEFT JOIN viewing_calendar_events cal ON cal.viewing_id=v.id AND cal.provider='google_calendar'
      WHERE v.starts_at>=$1 AND v.starts_at<$2${ownerClause.replace('%ALIAS%','v.organizer_id')}
      ORDER BY v.starts_at`,params)
  ]);
  const now=new Date(),items=[
    ...activities.map(x=>({...x,sourceKind:'activity',category:x.activityType==='Call'?'call':x.activityType==='Meeting'?'meeting':'task',appointmentType:x.activityType,durationMinutes:x.meetingDurationMinutes??(x.durationSeconds?Math.ceil(x.durationSeconds/60):null),recordStatus:null})),
    ...tasks.map(x=>({...x,sourceKind:'task',category:'task',appointmentType:'Task',endsAt:null,durationMinutes:null})),
    ...viewings.map(x=>({...x,sourceKind:'viewing',category:'viewing',appointmentType:'Physical viewing',durationMinutes:Math.round((new Date(x.endsAt)-new Date(x.startsAt))/60000)}))
  ].map(item=>({...item,status:diaryStatus(item,now),calendarDeliveryStatus:calendarDeliveryStatus(item)})).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt)||a.customerName.localeCompare(b.customerName));
  res.json({timezone:'Asia/Dubai',from:range.from,to:range.to,selectedAgentId,companyView,allowedAgents,items:markDiaryConflicts(items)});
});

export default r;
