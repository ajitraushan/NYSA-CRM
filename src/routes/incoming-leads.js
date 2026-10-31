import {Router} from '../lib/http-kit.js';
import {canManageUnassignedResponses,listUnassignedResponseOwners} from '../nonvoice-response-workflow.js';

const SOURCES=new Set(['all','contact_form','nia','meta','other']);
const STATUSES=new Set(['all','new','unassigned','needs_review','failed','assigned']);
const DATES=new Set(['today','7d','custom','all']);
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const maskEmail=value=>{const [name,domain]=String(value||'').split('@');return name&&domain?`${name.slice(0,1)}***@${domain}`:null;};
const maskPhone=value=>{const text=String(value||'').replace(/\s+/g,'');return text?`••••${text.slice(-4)}`:null;};
const managerTeams=broker=>broker?.managedTeamIds?.length?broker.managedTeamIds:[broker?.teamId].filter(Boolean);

const baseSql=`WITH latest_website AS (
 SELECT DISTINCT ON (COALESCE(e.journey_key,e.event_id))
  e.id,e.event_id,e.status,e.received_at,e.source_code,e.source_form,e.source_page,e.campaign_code,
  e.campaign_id,e.campaign_mapping_status,e.error_code,e.review_due_at,e.lead_id
 FROM website_intake_events e
 ORDER BY COALESCE(e.journey_key,e.event_id),e.received_at DESC,e.id
), unified AS (
 SELECT w.id::text AS intake_id,'website'::text AS source_system,
  CASE WHEN w.source_form IN ('ai_advisory_v1','ai_property_selection_v1') OR w.source_form LIKE 'nia_%' OR w.source_form LIKE 'ai_%' THEN 'nia'
       WHEN w.source_form IN ('contact_form','contact_us','speak_to_advisor_v2','brochure_download_v2') THEN 'contact_form'
       ELSE 'other' END AS source_category,
  w.event_id AS source_event_id,w.source_form,w.source_page,w.received_at,w.status AS intake_state,
  w.error_code,w.review_due_at,w.campaign_code AS external_campaign_code,NULL::text AS external_campaign_name,
  w.campaign_id,w.campaign_mapping_status,mc.campaign_code AS governed_campaign_code,mc.name AS governed_campaign_name,
  l.id AS lead_id,l.lead_reference,l.assigned_team_id,c.full_name,c.email,c.phone,
  f.id AS response_case_id,f.fallback_owner_id,owner.name AS response_owner_name
 FROM latest_website w
 LEFT JOIN leads l ON l.id=w.lead_id
 LEFT JOIN contacts c ON c.id=l.contact_id
 LEFT JOIN marketing_campaigns mc ON mc.id=w.campaign_id
 LEFT JOIN lead_source_inbox s ON s.website_intake_event_id=w.id
 LEFT JOIN lead_follow_up_cases f ON f.source_inbox_id=s.id
 LEFT JOIN brokers owner ON owner.id=f.fallback_owner_id
 UNION ALL
 SELECT s.id::text,'meta','meta',s.source_event_id,s.source_form_id,s.source_account_id,s.received_at,s.state,
  s.error_code,s.review_due_at,s.external_campaign_code,s.external_campaign_name,s.campaign_id,s.campaign_mapping_status,
  mc.campaign_code,mc.name,l.id,l.lead_reference,l.assigned_team_id,c.full_name,c.email,c.phone,
  f.id,f.fallback_owner_id,owner.name
 FROM lead_source_inbox s
 LEFT JOIN leads l ON l.id=s.lead_id
 LEFT JOIN contacts c ON c.id=l.contact_id
 LEFT JOIN marketing_campaigns mc ON mc.id=s.campaign_id
 LEFT JOIN lead_follow_up_cases f ON f.source_inbox_id=s.id
 LEFT JOIN brokers owner ON owner.id=f.fallback_owner_id
 WHERE s.source_system='meta'
), classified AS (
 SELECT u.*,
  CASE WHEN intake_state='failed' THEN 'failed'
       WHEN intake_state IN ('identity_review','duplicate_review','email_review','needs_review') THEN 'needs_review'
       WHEN response_case_id IS NOT NULL AND fallback_owner_id IS NULL THEN 'unassigned'
       WHEN response_case_id IS NOT NULL AND fallback_owner_id IS NOT NULL THEN 'assigned'
       ELSE 'new' END AS status_key,
  CASE WHEN campaign_id IS NOT NULL THEN 'governed:'||campaign_id::text
       WHEN campaign_mapping_status='unmapped' THEN 'unmapped'
       WHEN external_campaign_code IS NULL OR BTRIM(external_campaign_code)='' THEN 'none'
       ELSE 'external:'||source_system||':'||external_campaign_code END AS campaign_key
 FROM unified u
)`;

function validate(query){
 const source=String(query.source||'all'),status=String(query.status||'all'),dateRange=String(query.dateRange||'7d');
 const campaign=String(query.campaign||'all'),q=String(query.q||'').trim(),page=Number(query.page||0);
 if(!SOURCES.has(source)||!STATUSES.has(status)||!DATES.has(dateRange))throw Object.assign(new Error('Invalid Incoming Leads filter'),{statusCode:400});
 if(campaign.length>240||q.length>160||!Number.isInteger(page)||page<0||page>10000)throw Object.assign(new Error('Invalid Incoming Leads filter'),{statusCode:400});
 const from=String(query.from||''),to=String(query.to||'');
 if(dateRange==='custom'&&(!datePattern.test(from)||!datePattern.test(to)||from>to))throw Object.assign(new Error('Choose a valid received date range'),{statusCode:400});
 return {source,status,dateRange,campaign,q,page,from:from||null,to:to||null};
}

export function createIncomingLeadsRoutes({requireAuth,transaction}){
 const r=Router();
 r.use(requireAuth,(req,res,next)=>canManageUnassignedResponses(req.broker)?next():res.status(403).json({error:'Admin or Manager access required'}));
 r.get('/crm/incoming-leads',async(req,res)=>{
  try{
   const f=validate(req.query),isAdmin=req.broker?.role==='admin',teams=isAdmin?[]:managerTeams(req.broker);
   const where=`WHERE ($1='all' OR source_category=$1)
    AND ($2='all' OR status_key=$2) AND ($3='all' OR campaign_key=$3)
    AND ($4='all' OR ($4='today' AND received_at >= (date_trunc('day',NOW() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai'))
      OR ($4='7d' AND received_at>=NOW()-INTERVAL '7 days')
      OR ($4='custom' AND received_at>=($5::date::timestamp AT TIME ZONE 'Asia/Dubai') AND received_at<(($6::date+1)::timestamp AT TIME ZONE 'Asia/Dubai')))
    AND ($7='' OR LOWER(COALESCE(full_name,'')||' '||COALESCE(email,'')||' '||COALESCE(phone,'')||' '||COALESCE(lead_reference,'')||' '||COALESCE(source_event_id,'')) LIKE '%'||LOWER($7)||'%')
    AND ($8::boolean OR assigned_team_id IS NULL OR assigned_team_id=ANY($9::uuid[]))`;
   const params=[f.source,f.status,f.campaign,f.dateRange,f.from,f.to,f.q,isAdmin,teams];
   const result=await transaction(async client=>{
    const rows=(await client.query(`${baseSql} SELECT COUNT(*) OVER()::int AS total_count,* FROM classified ${where}
      ORDER BY received_at DESC,intake_id LIMIT 100 OFFSET $10`,[...params,f.page*100])).rows;
    const campaigns=(await client.query(`${baseSql} SELECT campaign_key,MAX(COALESCE(governed_campaign_name,external_campaign_name,external_campaign_code)) AS label,
      MAX(campaign_mapping_status) AS mapping_status,COUNT(*)::int AS lead_count FROM classified
      WHERE ($1='all' OR source_category=$1) AND ($2::boolean OR assigned_team_id IS NULL OR assigned_team_id=ANY($3::uuid[]))
      GROUP BY campaign_key ORDER BY label NULLS LAST,campaign_key`,[f.source,isAdmin,teams])).rows;
    const responseOwners=await listUnassignedResponseOwners(req.broker,client);
    return {rows,campaigns,responseOwners};
   });
   res.json({filters:f,total:result.rows[0]?.total_count||0,
    leads:result.rows.map(({email,phone,...row})=>({...row,email_hint:maskEmail(email),phone_hint:maskPhone(phone)})),
    campaigns:result.campaigns.map(row=>({...row,label:row.campaign_key==='none'?'No campaign':row.campaign_key==='unmapped'?'Unmapped campaign':row.label||row.campaign_key})),
    responseOwners:result.responseOwners,liveIntegrationsEnabled:false});
  }catch(error){res.status([400,403].includes(error.statusCode)?error.statusCode:503).json({error:error.statusCode?error.message:'Incoming Leads is unavailable'});}
 });
 return r;
}
