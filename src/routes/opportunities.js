import { Router } from '../lib/http-kit.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,canReadLead,canCreateOpportunity,canReadOpportunity,canWriteOpportunity,opportunityScopeSql,leadScopeSql } from '../crm-policy.js';
import { buildOpportunityAttribution,validateOpportunityCreate,validateOpportunityTransition,OPPORTUNITY_STAGES } from '../opportunity-domain.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>{
  if(!hasInternalCrmIdentity(req.broker))return res.status(403).json({error:'Opportunity data is restricted to NYSA staff'});
  next();
});

const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const SELECT_OPPORTUNITY=`SELECT o.*,c.full_name AS contact_name,l.title AS lead_title,l.stage AS lead_stage,
  req.version_no AS requirement_version,qa.final_temperature AS qualification_temperature,
  li.project AS listing_project,li.inventory_reference,owner.name AS owner_name,t.name AS team_name,
  attr.source AS attribution_source,attr.campaign_code,attr.external_source_id,attr.source_page,attr.source_form,
  attr.originating_listing_id,attr.attribution_basis,attr.provenance_hash,attr.captured_at AS attribution_captured_at
  FROM opportunities o
  JOIN contacts c ON c.id=o.contact_id
  JOIN leads l ON l.id=o.lead_id
  JOIN lead_requirements req ON req.id=o.requirement_id
  JOIN qualification_assessments qa ON qa.id=o.qualification_assessment_id
  LEFT JOIN listings li ON li.id=o.listing_id
  JOIN brokers owner ON owner.id=o.owner_id
  LEFT JOIN teams t ON t.id=o.assigned_team_id
  JOIN opportunity_attribution attr ON attr.opportunity_id=o.id`;

async function opportunityWithParticipants(id,client){
  const opportunity=await one(`${SELECT_OPPORTUNITY} WHERE o.id=$1`,[id],client);
  if(!opportunity)return null;
  const participants=await many(`SELECT op.*,b.name AS broker_name,b.job_role FROM opportunity_participants op
    JOIN brokers b ON b.id=op.broker_id WHERE op.opportunity_id=$1 AND op.active ORDER BY op.added_at`,[id],client);
  opportunity.participants=participants;
  opportunity.participantIds=participants.map(x=>x.brokerId);
  return opportunity;
}

async function scopedOpportunity(req,id,client){
  const opportunity=await opportunityWithParticipants(id,client);
  if(!opportunity)return {error:[404,'Opportunity not found']};
  if(!canReadOpportunity(req.broker,opportunity))return {error:[403,'Opportunity is outside your permitted scope']};
  return {opportunity};
}

r.get('/crm/opportunities',async(req,res)=>{
  const params=[],scope=opportunityScopeSql('o',req.broker,params),where=[scope.clause];
  if(req.query.stage){if(!OPPORTUNITY_STAGES.includes(req.query.stage))return res.status(400).json({error:'Invalid opportunity stage'});params.push(req.query.stage);where.push(`o.stage=$${params.length}`);}
  if(req.query.assignedTo==='me'){params.push(req.broker.id);where.push(`o.owner_id=$${params.length}`);}
  if(req.query.leadId){params.push(req.query.leadId);where.push(`o.lead_id=$${params.length}`);}
  if(clean(req.query.q)){params.push(`%${clean(req.query.q)}%`);where.push(`(o.title ILIKE $${params.length} OR o.opportunity_reference ILIKE $${params.length} OR c.full_name ILIKE $${params.length})`);}
  const opportunities=await many(`${SELECT_OPPORTUNITY} WHERE ${where.join(' AND ')} ORDER BY
    CASE WHEN o.stage IN ('Closed Won','Closed Lost') THEN 1 ELSE 0 END,o.next_action_due_at,o.created_at DESC`,params);
  res.json({count:opportunities.length,opportunities});
});

r.get('/crm/opportunities/:id',async(req,res)=>{
  const {opportunity,error}=await scopedOpportunity(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const [stageHistory,assignmentHistory]=await Promise.all([
    many(`SELECT h.*,b.name AS changed_by_name FROM opportunity_stage_history h
      JOIN brokers b ON b.id=h.changed_by WHERE h.opportunity_id=$1 ORDER BY h.changed_at`,[opportunity.id]),
    many(`SELECT h.*,old_owner.name AS from_owner_name,new_owner.name AS to_owner_name,old_team.name AS from_team_name,
      new_team.name AS to_team_name,actor.name AS changed_by_name FROM opportunity_assignment_history h
      LEFT JOIN brokers old_owner ON old_owner.id=h.from_owner_id JOIN brokers new_owner ON new_owner.id=h.to_owner_id
      LEFT JOIN teams old_team ON old_team.id=h.from_team_id LEFT JOIN teams new_team ON new_team.id=h.to_team_id
      JOIN brokers actor ON actor.id=h.changed_by WHERE h.opportunity_id=$1 ORDER BY h.changed_at`,[opportunity.id])
  ]);
  res.json({opportunity,stageHistory,assignmentHistory});
});

r.post('/crm/leads/:id/opportunities',async(req,res)=>{
  const checked=validateOpportunityCreate(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  try{
    const result=await transaction(async client=>{
      const lead=await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[req.params.id],client);
      if(!lead)return {code:404,error:'Lead not found'};
      if(!canReadLead(req.broker,lead))return {code:403,error:'Lead is outside your permitted scope'};
      if(!canCreateOpportunity(req.broker,lead))return {code:403,error:'Only the assigned Sales Agent, managed-team Manager or Administrator can create this opportunity'};
      if(!['Qualified','Viewing','Negotiation','Won'].includes(lead.stage))return {code:409,error:'Complete qualification before creating an opportunity'};
      if(!lead.assignedTo)return {code:409,error:'Assign the qualified lead to a responsible Sales Agent before creating an opportunity'};
      const requirement=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL FOR SHARE',[lead.id],client);
      if(!requirement)return {code:409,error:'A current structured requirement is required before creating an opportunity'};
      const assessment=await one('SELECT * FROM qualification_assessments WHERE lead_id=$1 ORDER BY assessed_at DESC LIMIT 1',[lead.id],client);
      if(!assessment)return {code:409,error:'A recorded qualification assessment is required before creating an opportunity'};
      const input=checked.value;
      if(input.listingId&&!await one("SELECT id FROM listings WHERE id=$1 AND deleted_at IS NULL AND workflow_status='approved'",[input.listingId],client))return {code:409,error:'Select approved active inventory or leave the property unselected'};
      const period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code;
      const counter=await one(`INSERT INTO opportunity_number_counters(period_code,last_value) VALUES($1,1)
        ON CONFLICT(period_code) DO UPDATE SET last_value=opportunity_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client);
      const opportunityReference=`NYSA-OP-${period}-${String(counter.lastValue).padStart(6,'0')}`,id=uuid();
      const opportunity=await one(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,qualification_assessment_id,
        listing_id,assigned_team_id,owner_id,title,transaction_type,priority,next_action,next_action_due_at,created_from_legacy_stage,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [id,opportunityReference,lead.id,lead.contactId,requirement.id,assessment.id,input.listingId,lead.assignedTeamId,lead.assignedTo,
          input.title,input.transactionType,input.priority,input.nextAction,input.nextActionDueAt,['Viewing','Negotiation','Won'].includes(lead.stage)?lead.stage:null,req.broker.id],client);
      await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,to_stage,reason_code,reason,changed_by)
        VALUES($1,$2,'Requirements','opportunity_created','Created explicitly from an approved qualified lead',$3)`,[uuid(),id,req.broker.id],client);
      await execute(`INSERT INTO opportunity_participants(id,opportunity_id,broker_id,participation_role,added_by)
        VALUES($1,$2,$3,'owner',$4)`,[uuid(),id,lead.assignedTo,req.broker.id],client);
      await execute(`INSERT INTO opportunity_assignment_history(id,opportunity_id,to_team_id,to_owner_id,change_scope,reason,changed_by)
        VALUES($1,$2,$3,$4,'opportunity_only','Initial owner captured from the qualified lead when the opportunity was created',$5)`,
        [uuid(),id,lead.assignedTeamId,lead.assignedTo,req.broker.id],client);
      const attribution=buildOpportunityAttribution(lead);
      const attributionId=uuid();
      await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,campaign_code,external_source_id,source_page,source_form,
        originating_listing_id,provenance_snapshot,provenance_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [attributionId,id,lead.id,attribution.source,attribution.campaignCode,attribution.externalSourceId,attribution.sourcePage,attribution.sourceForm,
          attribution.originatingListingId,JSON.stringify(attribution.provenanceSnapshot),attribution.provenanceHash],client);
      await execute(`UPDATE r2_legacy_lead_review SET review_status='linked_after_review',linked_opportunity_id=$1,reviewed_by=$2,
        reviewed_at=NOW(),review_note='Opportunity created explicitly after scoped review' WHERE lead_id=$3 AND review_status='pending'`,[id,req.broker.id,lead.id],client);
      await audit('Opportunity',id,'created',req.broker.id,{leadId:lead.id,opportunityReference,requirementId:requirement.id,qualificationAssessmentId:assessment.id,legacyLeadStage:lead.stage},client);
      await audit('OpportunityAttribution',attributionId,'captured',req.broker.id,{opportunityId:id,provenanceHash:attribution.provenanceHash,attributionBasis:'original_enquiry'},client);
      return opportunity;
    });
    if(result.error)return res.status(result.code).json({error:result.error});
    res.status(201).json(result);
  }catch(error){
    if(error.code==='23505')return res.status(409).json({error:'An open opportunity already exists for this lead, property and transaction type'});
    throw error;
  }
});

r.post('/crm/opportunities/:id/stage',async(req,res)=>{
  const expectedVersion=Number(req.body?.expectedVersion);
  if(!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'The current opportunity version is required'});
  try{const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(opportunity.version!==expectedVersion)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    const checked=validateOpportunityTransition(opportunity.stage,req.body?.toStage,{reasonCode:req.body?.reasonCode,reason:req.body?.reason});
    if(checked.error)return {code:409,error:checked.error};
    const next=checked.value,closed=next.toStage==='Closed Lost';
    const updated=await one(`UPDATE opportunities SET stage=$1,lost_reason_code=$2,lost_reason=$3,closed_at=CASE WHEN $4 THEN NOW() ELSE NULL END,
      version=version+1,updated_at=NOW() WHERE id=$5 AND version=$6 RETURNING *`,[next.toStage,next.reasonCode,next.reason,closed,opportunity.id,expectedVersion],client);
    if(!updated)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    const historyId=uuid();await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,from_stage,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[historyId,opportunity.id,opportunity.stage,next.toStage,next.reasonCode,next.reason,req.broker.id],client);
    await audit('OpportunityStage',historyId,'changed',req.broker.id,{opportunityId:opportunity.id,from:opportunity.stage,to:next.toStage,reasonCode:next.reasonCode,reason:next.reason},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'Another open Requirements opportunity conflicts with this return; review the lead opportunities'});throw error;}
});

r.patch('/crm/opportunities/:id/next-action',async(req,res)=>{
  const nextAction=clean(req.body?.nextAction),due=new Date(req.body?.nextActionDueAt),expectedVersion=Number(req.body?.expectedVersion);
  if(!nextAction||Number.isNaN(due.valueOf())||!Number.isInteger(expectedVersion)||expectedVersion<1)return res.status(400).json({error:'Next action, valid due time and current version are required'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scopedOpportunity(req,req.params.id,client);if(error)return {code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return {code:403,error:'Opportunity is outside your writable scope'};
    if(['Closed Won','Closed Lost'].includes(opportunity.stage))return {code:409,error:'A closed opportunity cannot receive a new next action'};
    const updated=await one(`UPDATE opportunities SET next_action=$1,next_action_due_at=$2,version=version+1,updated_at=NOW()
      WHERE id=$3 AND version=$4 RETURNING *`,[nextAction,due.toISOString(),opportunity.id,expectedVersion],client);
    if(!updated)return {code:409,error:'This opportunity changed after it was opened; reload before updating it'};
    await audit('Opportunity',opportunity.id,'next_action_updated',req.broker.id,{nextAction,nextActionDueAt:due.toISOString()},client);return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.get('/crm/release2/legacy-lead-review',async(req,res)=>{
  if(req.broker.role!=='admin'&&!['manager','director'].includes(req.broker.jobRole))return res.status(403).json({error:'Manager, Director or Administrator review access required'});
  const params=[],scope=leadScopeSql('l',req.broker,params);
  const records=await many(`SELECT review.*,l.title,c.full_name AS contact_name,l.assigned_to,l.assigned_team_id,owner.name AS owner_name,t.name AS team_name
    FROM r2_legacy_lead_review review JOIN leads l ON l.id=review.lead_id JOIN contacts c ON c.id=l.contact_id
    LEFT JOIN brokers owner ON owner.id=l.assigned_to LEFT JOIN teams t ON t.id=l.assigned_team_id
    WHERE ${scope.clause} ORDER BY CASE review.review_status WHEN 'pending' THEN 0 ELSE 1 END,review.created_at`,params);
  res.json({count:records.length,records,automaticConversion:false});
});

r.get('/crm/operations/guided-work',async(req,res)=>{
  const leadParams=[],leadScope=leadScopeSql('l',req.broker,leadParams),opportunityParams=[],opportunityScope=opportunityScopeSql('o',req.broker,opportunityParams),
    nextParams=[],nextLeadScope=leadScopeSql('l',req.broker,nextParams),nextOpportunityScope=opportunityScopeSql('x',req.broker,nextParams);
  const [leadCounts,opportunityCounts,nextCases]=await Promise.all([
    one(`SELECT COUNT(DISTINCT l.contact_id)::int AS customers,COUNT(*)::int AS leads,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL))::int AS requirements,
      COUNT(*) FILTER(WHERE EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id))::int AS qualified,
      COUNT(*) FILTER(WHERE l.assigned_to IS NULL AND l.stage NOT IN ('Won','Lost'))::int AS unassigned,
      COUNT(*) FILTER(WHERE l.assigned_to IS NOT NULL AND l.stage IN ('Qualified','Viewing','Negotiation','Won')
        AND EXISTS(SELECT 1 FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL)
        AND EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id)
        AND NOT EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=l.id AND o.stage NOT IN ('Closed Won','Closed Lost')))::int AS ready_opportunities
      FROM leads l WHERE ${leadScope.clause}`,leadScope.params),
    one(`SELECT COUNT(*) FILTER(WHERE o.stage NOT IN ('Closed Won','Closed Lost'))::int AS active,
      COUNT(*) FILTER(WHERE o.stage='Requirements')::int AS requirements,
      COUNT(*) FILTER(WHERE o.stage='Matching')::int AS matching,
      COUNT(*) FILTER(WHERE o.stage NOT IN ('Closed Won','Closed Lost') AND o.next_action_due_at<NOW())::int AS overdue
      FROM opportunities o WHERE ${opportunityScope.clause}`,opportunityScope.params),
    many(`SELECT l.id AS lead_id,l.title,c.full_name AS customer_name,l.stage AS lead_stage,l.assigned_to,
      b.name AS owner_name,o.id AS opportunity_id,o.opportunity_reference,o.stage AS opportunity_stage,
      COALESCE(o.next_action,CASE WHEN l.assigned_to IS NULL THEN 'Assign a responsible agent'
        WHEN NOT EXISTS(SELECT 1 FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL) THEN 'Record structured requirements'
        WHEN NOT EXISTS(SELECT 1 FROM qualification_assessments qa WHERE qa.lead_id=l.id) THEN 'Complete qualification'
        WHEN l.stage IN ('Qualified','Viewing','Negotiation','Won') THEN 'Create or review Opportunity'
        ELSE 'Continue Lead follow-up' END) AS next_action,
      COALESCE(o.next_action_due_at,l.next_follow_up_at,l.assignment_due_at) AS due_at
      FROM leads l JOIN contacts c ON c.id=l.contact_id LEFT JOIN brokers b ON b.id=l.assigned_to
      LEFT JOIN LATERAL (SELECT x.* FROM opportunities x WHERE x.lead_id=l.id AND ${nextOpportunityScope.clause} AND x.stage NOT IN ('Closed Won','Closed Lost') ORDER BY x.next_action_due_at LIMIT 1) o ON TRUE
      WHERE ${nextLeadScope.clause} AND l.stage NOT IN ('Won','Lost') ORDER BY COALESCE(o.next_action_due_at,l.next_follow_up_at,l.assignment_due_at) NULLS FIRST LIMIT 12`,nextLeadScope.params)
  ]);
  const steps=[
    {code:'customer',label:'Customer',status:'completed',count:leadCounts.customers,action:'Open the linked customer record'},
    {code:'lead',label:'Lead',status:leadCounts.unassigned?'blocked':'current',count:leadCounts.leads,action:leadCounts.unassigned?`${leadCounts.unassigned} need assignment`:'Continue customer follow-up'},
    {code:'qualification',label:'Qualification',status:leadCounts.qualified?'current':'ready',count:leadCounts.qualified,action:'Complete requirements and approved qualification'},
    {code:'opportunity',label:'Opportunity',status:leadCounts.readyOpportunities?'ready':opportunityCounts.active?'current':'blocked',count:opportunityCounts.active,action:leadCounts.readyOpportunities?`${leadCounts.readyOpportunities} qualified lead${leadCounts.readyOpportunities===1?' is':'s are'} ready`:opportunityCounts.overdue?`${opportunityCounts.overdue} next action${opportunityCounts.overdue===1?' is':'s are'} overdue`:'Create from a qualified lead'},
    {code:'matching',label:'Match',status:opportunityCounts.matching?'current':opportunityCounts.requirements?'ready':'blocked',count:opportunityCounts.matching,action:opportunityCounts.requirements?`${opportunityCounts.requirements} ready for matching`:'Requires an active Opportunity'},
    ...['Viewing','Offer','Booking','Deal'].map(label=>({code:label.toLowerCase(),label,status:'not_available',count:0,action:'Available in a later Release 2 slice'}))
  ];
  res.json({role:req.broker.jobRole,steps,nextCases,dataAsOf:new Date(),releaseBoundary:'R2.1A enables connected guidance through Matching; later steps remain visibly unavailable'});
});

export default r;
