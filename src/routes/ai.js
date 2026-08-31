import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { requireAuth } from '../auth.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { hasInternalCrmIdentity, canReadLead, canOperateLead } from '../crm-policy.js';
import { aiConfiguration, requestStructuredOutput, redactSensitiveText, AI_SCHEMAS, AI_INSTRUCTIONS, AiServiceError, aiSchemaFor } from '../ai-service.js';
import { buildMatchEvidence, buildCompletenessContext } from '../ai-domain.js';
import { buildCustomerPriorityCase } from '../customer-intelligence-domain.js';
import { inventoryEvaluatorProjection } from '../inventory-eligibility-service.js';
import { loadActiveClassificationCatalogue } from '../classification-catalogue.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'CRM AI assistance is restricted to NYSA staff'}));

async function scopedLead(req,res){const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);if(!lead){res.status(404).json({error:'Lead not found'});return null;}if(!canReadLead(req.broker,lead)){res.status(403).json({error:'Lead is outside your permitted scope'});return null;}return lead;}
const safeErrorCode=error=>error instanceof AiServiceError?error.code:'ai_internal_error';
const RULESET_VERSION='release3a-v1';
const clean=(value,max=500)=>String(value||'').trim().slice(0,max);

async function invoke(req,res,lead,functionCode,input,schema=AI_SCHEMAS[functionCode]){
  const config=aiConfiguration(),runId=uuid(),inputHash=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex'),started=Date.now();
  await execute(`INSERT INTO ai_assistance_runs(id,lead_id,function_code,model,input_hash,requested_by) VALUES($1,$2,$3,$4,$5,$6)`,[runId,lead.id,functionCode,config.model,inputHash,req.broker.id]);
  try{
    const response=await requestStructuredOutput({name:`nysa_${functionCode}`,instructions:AI_INSTRUCTIONS[functionCode],input,schema});
    const latencyMs=Date.now()-started;
    await execute(`UPDATE ai_assistance_runs SET status='completed',provider_response_id=$1,latency_ms=$2,completed_at=NOW() WHERE id=$3`,[response.responseId,latencyMs,runId]);
    await audit('AiAssistanceRun',runId,'completed',req.broker.id,{leadId:lead.id,functionCode,model:response.model,inputHash,latencyMs});
    res.json({runId,function:functionCode,model:response.model,suggestion:response.result,advisoryOnly:true,requiresHumanConfirmation:true});
  }catch(error){
    const code=safeErrorCode(error),latencyMs=Date.now()-started;
    await execute(`UPDATE ai_assistance_runs SET status='failed',error_code=$1,latency_ms=$2,completed_at=NOW() WHERE id=$3`,[code,latencyMs,runId]).catch(()=>{});
    await audit('AiAssistanceRun',runId,'failed',req.broker.id,{leadId:lead.id,functionCode,model:config.model,inputHash,errorCode:code,latencyMs}).catch(()=>{});
    res.status(error instanceof AiServiceError?error.status:502).json({error:error instanceof AiServiceError?error.message:'AI assistance failed',code,runId});
  }
}

r.get('/crm/ai/status',(req,res)=>{const config=aiConfiguration();res.json({configured:config.configured,model:config.model,functions:['requirements_draft','match_explanation','missing_information','customer_next_action'],advisoryOnly:true});});

async function customerActionEvidence(lead){
  const row=await one(`SELECT l.*,c.email_status,c.phone_status,c.do_not_contact,c.contact_restriction_reason,
    (SELECT COUNT(*)::int FROM lead_requirements lr WHERE lr.lead_id=l.id AND lr.superseded_at IS NULL) AS requirement_count,
    (SELECT COUNT(*)::int FROM qualification_assessments qa WHERE qa.lead_id=l.id) AS qualification_count,
    (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id=l.id AND a.voided_at IS NULL) AS last_interaction_at,
    o.id AS opportunity_id,o.opportunity_reference,o.stage AS opportunity_stage,o.next_action AS opportunity_next_action,
    o.next_action_due_at AS opportunity_next_action_due_at
    FROM leads l JOIN contacts c ON c.id=l.contact_id
    LEFT JOIN LATERAL (SELECT x.* FROM opportunities x WHERE x.lead_id=l.id AND x.stage NOT IN ('Closed Won','Closed Lost')
      ORDER BY x.next_action_due_at NULLS LAST,x.updated_at DESC LIMIT 1) o ON TRUE WHERE l.id=$1`,[lead.id]);
  const dueAt=row.opportunityNextActionDueAt||row.nextFollowUpAt||row.acceptanceDueAt||row.firstContactDueAt||row.assignmentDueAt;
  return buildCustomerPriorityCase({...row,dueAt,receivedAt:row.receivedAt||row.createdAt,nextAction:row.opportunityNextAction||null});
}

function safeEvidence(record){return{
  leadReference:record.leadReference||null,source:record.source||null,campaignCode:record.campaignCode||null,businessType:record.businessType,
  currentStatus:record.currentStatus||null,leadStage:record.stage,temperature:record.temperature,assigned:Boolean(record.assignedTo),
  assignmentAccepted:Boolean(record.acceptedAt),firstContactRecorded:Boolean(record.firstContactAt),requirementsRecorded:Number(record.requirementCount||0)>0,
  qualificationRecorded:Number(record.qualificationCount||0)>0,emailStatus:record.emailStatus||'unverified',phoneStatus:record.phoneStatus||'unverified',
  communicationRestricted:Boolean(record.doNotContact),lastInteractionAt:record.lastInteractionAt||null,dueAt:record.dueAt||null,
  opportunity:record.opportunityId?{reference:record.opportunityReference,stage:record.opportunityStage,nextAction:record.opportunityNextAction||null}:null
};}

function deterministicSuggestion(record){return{
  summary:record.suggestedAction.label,actionCode:record.suggestedAction.code,actionLabel:record.suggestedAction.label,
  whyNow:record.whyNow,evidenceUsed:['Authoritative Lead workflow state','Recorded deadlines and Customer restrictions'],
  confidence:record.whyNow.some(x=>/missing|unverified|review/i.test(x))?'medium':'high',
  missingInformation:[!record.requirementCount?'Structured requirements':null,!record.qualificationCount?'Qualification assessment':null].filter(Boolean),
  delayConsequence:record.consequence
};}

async function storeCustomerSuggestion({lead,record,suggestion,source,runId,actorId,evidenceHash}){
  return transaction(async client=>{
    await execute(`UPDATE customer_action_suggestions SET status='superseded',decided_by=$1,decided_at=NOW(),
      decision_reason='Replaced by a newer suggestion',updated_at=NOW() WHERE lead_id=$2 AND status='proposed'`,[actorId,lead.id],client);
    return one(`INSERT INTO customer_action_suggestions(id,contact_id,lead_id,opportunity_id,ai_run_id,suggestion_source,ruleset_version,
      evidence_hash,priority_band,action_code,action_label,why_now,confidence,missing_information,delay_consequence,requested_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14::jsonb,$15,$16) RETURNING *`,
      [uuid(),lead.contactId,lead.id,record.opportunityId||null,runId||null,source,RULESET_VERSION,evidenceHash,record.priorityBand,
        suggestion.actionCode,clean(suggestion.actionLabel,240),JSON.stringify(suggestion.whyNow||[]),suggestion.confidence,
        JSON.stringify(suggestion.missingInformation||[]),clean(suggestion.delayConsequence,600),actorId],client);
  });
}

r.post('/crm/leads/:id/ai/next-action',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  if(!canOperateLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your operational scope'});
  const record=await customerActionEvidence(lead),evidence=safeEvidence(record),evidenceHash=crypto.createHash('sha256').update(JSON.stringify(evidence)).digest('hex'),
    fallback=deterministicSuggestion(record),config=aiConfiguration();
  if(!config.configured){
    const stored=await storeCustomerSuggestion({lead,record,suggestion:fallback,source:'deterministic_rules',actorId:req.broker.id,evidenceHash});
    await audit('Lead',lead.id,'customer_action_suggested',req.broker.id,{suggestionId:stored.id,source:'deterministic_rules',actionCode:stored.actionCode,evidenceHash});
    return res.json({suggestionId:stored.id,suggestion:fallback,priorityBand:record.priorityBand,suggestionSource:'deterministic_rules',aiUnavailable:true,advisoryOnly:true,requiresHumanConfirmation:true});
  }
  const runId=uuid(),started=Date.now();
  await execute(`INSERT INTO ai_assistance_runs(id,lead_id,function_code,model,input_hash,requested_by) VALUES($1,$2,'customer_next_action',$3,$4,$5)`,[runId,lead.id,config.model,evidenceHash,req.broker.id]);
  try{
    const response=await requestStructuredOutput({name:'nysa_customer_next_action',instructions:AI_INSTRUCTIONS.customer_next_action,
      input:{evidence,allowedActions:[{code:fallback.actionCode,governedMeaning:fallback.actionLabel}],deterministicPriority:{band:record.priorityBand,whyNow:record.whyNow,delayConsequence:record.consequence},policy:{brokerDecisionRequired:true,noAutonomousExecution:true}},schema:AI_SCHEMAS.customer_next_action});
    if(response.result.actionCode!==fallback.actionCode)throw new AiServiceError('AI proposed an action outside the governed workflow',{code:'ai_action_not_permitted',status:422});
    await execute(`UPDATE ai_assistance_runs SET status='completed',provider_response_id=$1,latency_ms=$2,completed_at=NOW() WHERE id=$3`,[response.responseId,Date.now()-started,runId]);
    const stored=await storeCustomerSuggestion({lead,record,suggestion:response.result,source:'ai_assisted',runId,actorId:req.broker.id,evidenceHash});
    await audit('AiAssistanceRun',runId,'completed',req.broker.id,{leadId:lead.id,functionCode:'customer_next_action',suggestionId:stored.id,inputHash:evidenceHash});
    return res.json({suggestionId:stored.id,suggestion:response.result,priorityBand:record.priorityBand,suggestionSource:'ai_assisted',model:response.model,advisoryOnly:true,requiresHumanConfirmation:true});
  }catch(error){
    const code=safeErrorCode(error);await execute(`UPDATE ai_assistance_runs SET status='failed',error_code=$1,latency_ms=$2,completed_at=NOW() WHERE id=$3`,[code,Date.now()-started,runId]).catch(()=>{});
    await audit('AiAssistanceRun',runId,'failed',req.broker.id,{leadId:lead.id,functionCode:'customer_next_action',inputHash:evidenceHash,errorCode:code}).catch(()=>{});
    const stored=await storeCustomerSuggestion({lead,record,suggestion:fallback,source:'deterministic_rules',actorId:req.broker.id,evidenceHash});
    await audit('Lead',lead.id,'customer_action_suggested',req.broker.id,{suggestionId:stored.id,source:'deterministic_rules',fallbackFrom:code,actionCode:stored.actionCode,evidenceHash});
    return res.json({suggestionId:stored.id,suggestion:fallback,priorityBand:record.priorityBand,suggestionSource:'deterministic_rules',aiUnavailable:true,warning:'AI assistance was unavailable; the governed rules suggestion is shown.',advisoryOnly:true,requiresHumanConfirmation:true});
  }
});

r.get('/crm/leads/:id/action-suggestions',async(req,res)=>{const lead=await scopedLead(req,res);if(!lead)return;const suggestions=await many(`SELECT s.*,b.name AS requested_by_name,d.name AS decided_by_name FROM customer_action_suggestions s JOIN brokers b ON b.id=s.requested_by LEFT JOIN brokers d ON d.id=s.decided_by WHERE s.lead_id=$1 ORDER BY s.created_at DESC LIMIT 25`,[lead.id]);res.json({suggestions});});

r.patch('/crm/leads/:id/action-suggestions/:suggestionId',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;if(!canOperateLead(req.broker,lead))return res.status(403).json({error:'Lead is outside your operational scope'});
  const decision=clean(req.body?.decision,30),reason=clean(req.body?.reason,500);if(!['do_now','schedule','dismiss'].includes(decision))return res.status(400).json({error:'Decision must be do_now, schedule or dismiss'});
  if(decision==='dismiss'&&!reason)return res.status(400).json({error:'A dismissal reason is required'});
  const dueAt=decision==='schedule'?new Date(req.body?.dueAt):null;if(decision==='schedule'&&(!dueAt||Number.isNaN(dueAt.valueOf())||dueAt<=new Date()))return res.status(400).json({error:'Schedule a valid future date and time'});
  const result=await transaction(async client=>{
    const suggestion=await one('SELECT * FROM customer_action_suggestions WHERE id=$1 AND lead_id=$2 FOR UPDATE',[req.params.suggestionId,lead.id],client);if(!suggestion)return {error:[404,'Suggestion not found']};if(suggestion.status!=='proposed')return {error:[409,'This suggestion has already been decided']};
    let task=null,status=decision==='dismiss'?'dismissed':decision==='schedule'?'scheduled':'accepted';
    if(decision==='schedule'){
      const subject=clean(req.body?.actionLabel,240)||suggestion.actionLabel,taskId=uuid(),assigneeId=lead.assignedTo||req.broker.id;
      task=await one(`INSERT INTO tasks(id,lead_id,contact_id,subject,details,assignee_id,priority,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [taskId,lead.id,lead.contactId,subject,`Scheduled from governed customer action suggestion ${suggestion.id}`,assigneeId,suggestion.priorityBand==='immediate'?'urgent':'normal',dueAt.toISOString(),req.broker.id],client);
      await execute('UPDATE leads SET next_follow_up_at=$1,updated_at=NOW() WHERE id=$2 AND (next_follow_up_at IS NULL OR next_follow_up_at>$1)',[dueAt.toISOString(),lead.id],client);
    }
    const updated=await one(`UPDATE customer_action_suggestions SET status=$1,decided_by=$2,decided_at=NOW(),decision_reason=$3,
      resulting_task_id=$4,updated_at=NOW() WHERE id=$5 RETURNING *`,[status,req.broker.id,reason||null,task?.id||null,suggestion.id],client);
    await audit('Lead',lead.id,`customer_action_${status}`,req.broker.id,{suggestionId:suggestion.id,actionCode:suggestion.actionCode,reason:reason||null,resultingTaskId:task?.id||null,dueAt:dueAt?.toISOString()||null},client);
    return {suggestion:updated,task,actionTarget:suggestion.actionCode};
  });
  if(result.error)return res.status(result.error[0]).json({error:result.error[1]});res.json(result);
});

r.post('/crm/leads/:id/ai/requirements-draft',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  const notes=redactSensitiveText(req.body?.conversationNotes);if(notes.length<20)return res.status(400).json({error:'Provide at least 20 characters of requirement conversation notes'});
  const current=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id]);
  const catalogue=await loadActiveClassificationCatalogue();
  await invoke(req,res,lead,'requirements_draft',{conversationNotes:notes,existingStructuredRequirement:current?{customerObjective:current.customerObjective,marketStageRequirement:current.marketStageRequirement,propertySegmentRequirement:current.propertySegmentRequirement,purpose:current.purpose,propertyTypes:current.propertyTypes,areas:current.areas,budgetMin:current.budgetMin,budgetMax:current.budgetMax,fundingMethod:current.fundingMethod,bedroomsMin:current.bedroomsMin,bedroomsMax:current.bedroomsMax,timelineCode:current.timelineCode}:null,leadClassification:{customerObjective:lead.customerObjective,marketStageRequirement:lead.marketStageRequirement,propertySegmentRequirement:lead.propertySegmentRequirement,classificationVersion:catalogue.version.code},policy:{draftOnly:true,maximumOptions:3,agentAndCustomerConfirmationRequired:true}},aiSchemaFor('requirements_draft',catalogue));
});

r.post('/crm/leads/:id/ai/match-explanation',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  const requirement=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id]);if(!requirement)return res.status(409).json({error:'A current structured requirement is required'});
  const listing=await one(`SELECT ${inventoryEvaluatorProjection('l')} FROM listings l WHERE l.id=$1 AND l.deleted_at IS NULL`,[req.body?.listingId]);if(!listing)return res.status(404).json({error:'Inventory property not found'});
  await invoke(req,res,lead,'match_explanation',{comparison:buildMatchEvidence(requirement,listing),policy:{deterministicEvidenceIsAuthoritative:true,noScoreCreation:true,noInventedFacts:true,agentReviewRequired:true}});
});

r.post('/crm/leads/:id/ai/missing-information',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  const listingIds=Array.isArray(req.body?.listingIds)?[...new Set(req.body.listingIds)].slice(0,3):[];
  if(Array.isArray(req.body?.listingIds)&&req.body.listingIds.length>3)return res.status(400).json({error:'No more than three inventory properties may be checked'});
  const requirement=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id]);
  const listings=listingIds.length?await many('SELECT * FROM listings WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL',[listingIds]):[];
  if(listings.length!==listingIds.length)return res.status(400).json({error:'One or more inventory properties are unavailable'});
  await invoke(req,res,lead,'missing_information',{purpose:req.body?.purpose==='matching'?'matching':'proposal',records:buildCompletenessContext(requirement,listings),policy:{doNotRequestFullIdentityNumbers:true,authoritativeRecordsMustBeCorrectedAtSource:true}});
});

export default r;
