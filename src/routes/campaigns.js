import { Router } from '../lib/http-kit.js';
import { requireAuth } from '../auth.js';
import { one,many,transaction,execute,uuid,audit } from '../db.js';
import { hasInternalCrmIdentity,isCompanyReader } from '../crm-policy.js';
import { normalizeDelimitedValues,parseBusinessAmount } from '../crm-domain.js';

const r=Router(),clean=(value,max=1000)=>String(value||'').trim().slice(0,max);
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'Campaign governance is restricted to NYSA staff'}));
const canMaintain=broker=>broker?.role==='admin'||isCompanyReader(broker);
function requireMaintainer(req,res){if(canMaintain(req.broker))return true;res.status(403).json({error:'Administrator or Director campaign authority is required'});return false;}

r.get('/crm/campaigns',async(req,res)=>{
  const campaigns=await many(`SELECT c.*,owner.name AS owner_name,creator.name AS created_by_name,
    (SELECT COUNT(*)::int FROM leads l WHERE l.campaign_id=c.id) AS lead_count,
    (SELECT COUNT(*)::int FROM leads l WHERE l.campaign_id=c.id AND l.accepted_at IS NOT NULL) AS accepted_count,
    (SELECT COUNT(*)::int FROM leads l WHERE l.campaign_id=c.id AND l.first_contact_at IS NOT NULL) AS responded_count,
    (SELECT COUNT(*)::int FROM leads l WHERE l.campaign_id=c.id AND EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id)) AS qualified_count,
    (SELECT COUNT(*)::int FROM leads l WHERE l.campaign_id=c.id AND EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=l.id)) AS opportunity_count,
    (SELECT COUNT(*)::int FROM leads l WHERE l.campaign_id=c.id AND l.current_status='closed_won') AS won_count,
    (SELECT COUNT(*)::int FROM campaign_external_mappings m WHERE m.campaign_id=c.id AND m.status='active') AS active_mapping_count
    FROM marketing_campaigns c JOIN brokers owner ON owner.id=c.owner_id JOIN brokers creator ON creator.id=c.created_by
    ORDER BY CASE c.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'paused' THEN 2 ELSE 3 END,c.starts_on DESC NULLS LAST,c.name`);
  const mappings=await many(`SELECT m.*,c.campaign_code,c.name AS campaign_name,b.name AS created_by_name FROM campaign_external_mappings m
    JOIN marketing_campaigns c ON c.id=m.campaign_id JOIN brokers b ON b.id=m.created_by ORDER BY m.status,m.source_code,m.external_campaign_code`);
  const owners=canMaintain(req.broker)?await many("SELECT id,name,job_role FROM brokers WHERE status='active' AND role IN ('admin','internal_broker') ORDER BY name"):[];
  res.json({campaigns,mappings,owners,canMaintain:canMaintain(req.broker)});
});

r.post('/crm/campaigns',async(req,res)=>{
  if(!requireMaintainer(req,res))return;const b=req.body||{},campaignCode=clean(b.campaignCode,40).toUpperCase(),name=clean(b.name,160),objective=clean(b.objective),ownerId=clean(b.ownerId,40);
  if(!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(campaignCode)||!name||!objective||!ownerId)return res.status(400).json({error:'Stable campaign code, name, owner and objective are required'});
  const owner=await one("SELECT id FROM brokers WHERE id=$1 AND status='active' AND role IN ('admin','internal_broker')",[ownerId]);if(!owner)return res.status(400).json({error:'Campaign owner must be an active NYSA user'});
  const budget=b.plannedBudget===''||b.plannedBudget===null||b.plannedBudget===undefined?null:parseBusinessAmount(b.plannedBudget);if(budget!==null&&(!Number.isFinite(budget)||budget<0))return res.status(400).json({error:'Planned budget must be a valid non-negative amount'});
  const row=await one(`INSERT INTO marketing_campaigns(id,campaign_code,name,owner_id,objective,audience,channels,applicable_property_references,
    starts_on,ends_on,planned_budget,operational_targets,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$13) RETURNING *`,
    [uuid(),campaignCode,name,owner.id,objective,clean(b.audience)||null,normalizeDelimitedValues(b.channels),normalizeDelimitedValues(b.applicablePropertyReferences),b.startsOn||null,b.endsOn||null,budget,JSON.stringify(b.operationalTargets||{}),req.broker.id]);
  await audit('MarketingCampaign',row.id,'created',req.broker.id,{campaignCode:row.campaignCode,status:row.status});res.status(201).json(row);
});

r.patch('/crm/campaigns/:id/status',async(req,res)=>{
  if(!requireMaintainer(req,res))return;const status=clean(req.body?.status,20),reason=clean(req.body?.reason);if(!['active','paused','completed','retired'].includes(status)||!reason)return res.status(400).json({error:'Valid campaign status and decision reason are required'});
  const transitions={draft:['active','retired'],active:['paused','completed','retired'],paused:['active','completed','retired'],completed:['retired'],retired:[]};
  const row=await transaction(async client=>{const current=await one('SELECT * FROM marketing_campaigns WHERE id=$1 FOR UPDATE',[req.params.id],client);if(!current)return null;if(!transitions[current.status].includes(status))return {conflict:true,current};const updated=await one('UPDATE marketing_campaigns SET status=$1,status_reason=$2,updated_by=$3,updated_at=NOW() WHERE id=$4 RETURNING *',[status,reason,req.broker.id,current.id],client);if(status==='retired')await execute("UPDATE campaign_external_mappings SET status='retired',retired_by=$1,retirement_reason=$2,retired_at=NOW() WHERE campaign_id=$3 AND status='active'",[req.broker.id,`Campaign retired: ${reason}`,current.id],client);await audit('MarketingCampaign',current.id,'status_changed',req.broker.id,{from:current.status,to:status,reason},client);return updated;});
  if(!row)return res.status(404).json({error:'Campaign not found'});if(row.conflict)return res.status(409).json({error:`Campaign cannot move from ${row.current.status} to ${status}`});res.json(row);
});

r.post('/crm/campaigns/:id/mappings',async(req,res)=>{
  if(!requireMaintainer(req,res))return;const sourceCode=clean(req.body?.sourceCode,80),externalCode=clean(req.body?.externalCampaignCode,160);if(!sourceCode||!externalCode)return res.status(400).json({error:'Source and external campaign code are required'});
  const campaign=await one("SELECT id,status FROM marketing_campaigns WHERE id=$1",[req.params.id]);if(!campaign)return res.status(404).json({error:'Campaign not found'});if(!['active','paused'].includes(campaign.status))return res.status(409).json({error:'Mappings may be added only to an active or paused campaign'});
  try{const result=await transaction(async client=>{const row=await one(`INSERT INTO campaign_external_mappings(id,source_code,external_campaign_code,campaign_id,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,[uuid(),sourceCode,externalCode,campaign.id,req.broker.id],client);const events=await execute(`UPDATE website_intake_events SET campaign_id=$1,campaign_mapping_status='mapped'
      WHERE campaign_mapping_status='unmapped' AND LOWER(source_code)=LOWER($2) AND LOWER(campaign_code)=LOWER($3)`,[campaign.id,sourceCode,externalCode],client);await execute(`UPDATE leads l SET campaign_id=$1,updated_at=NOW() FROM website_intake_events e
      WHERE e.lead_id=l.id AND e.campaign_id=$1 AND l.campaign_id IS NULL`,[campaign.id],client);await audit('CampaignMapping',row.id,'created',req.broker.id,{campaignId:campaign.id,sourceCode,externalCampaignCode:externalCode,reconciledEvents:events.rowCount},client);return {mapping:row,reconciledEvents:events.rowCount};});res.status(201).json(result);}catch(error){if(error?.code==='23505')return res.status(409).json({error:'That source campaign code is already actively mapped'});throw error;}
});

r.get('/crm/campaigns/unmapped/intake',async(req,res)=>{if(!requireMaintainer(req,res))return;const unmapped=await many(`SELECT source_code,campaign_code,COUNT(*)::int AS event_count,MIN(received_at) AS first_received_at,MAX(received_at) AS last_received_at
  FROM website_intake_events WHERE campaign_mapping_status='unmapped' GROUP BY source_code,campaign_code ORDER BY first_received_at`);res.json({unmapped});});

export default r;
