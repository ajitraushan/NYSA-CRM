import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { requireAuth } from '../auth.js';
import { one, many, execute, uuid, audit } from '../db.js';
import { hasInternalCrmIdentity, canReadLead } from '../crm-policy.js';
import { aiConfiguration, requestStructuredOutput, redactSensitiveText, AI_SCHEMAS, AI_INSTRUCTIONS, AiServiceError } from '../ai-service.js';
import { buildMatchEvidence, buildCompletenessContext } from '../ai-domain.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'CRM AI assistance is restricted to NYSA staff'}));

async function scopedLead(req,res){const lead=await one('SELECT * FROM leads WHERE id=$1',[req.params.id]);if(!lead){res.status(404).json({error:'Lead not found'});return null;}if(!canReadLead(req.broker,lead)){res.status(403).json({error:'Lead is outside your permitted scope'});return null;}return lead;}
const safeErrorCode=error=>error instanceof AiServiceError?error.code:'ai_internal_error';

async function invoke(req,res,lead,functionCode,input){
  const config=aiConfiguration(),runId=uuid(),inputHash=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex'),started=Date.now();
  await execute(`INSERT INTO ai_assistance_runs(id,lead_id,function_code,model,input_hash,requested_by) VALUES($1,$2,$3,$4,$5,$6)`,[runId,lead.id,functionCode,config.model,inputHash,req.broker.id]);
  try{
    const response=await requestStructuredOutput({name:`nysa_${functionCode}`,instructions:AI_INSTRUCTIONS[functionCode],input,schema:AI_SCHEMAS[functionCode]});
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

r.get('/crm/ai/status',(req,res)=>{const config=aiConfiguration();res.json({configured:config.configured,model:config.model,functions:['requirements_draft','match_explanation','missing_information'],advisoryOnly:true});});

r.post('/crm/leads/:id/ai/requirements-draft',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  const notes=redactSensitiveText(req.body?.conversationNotes);if(notes.length<20)return res.status(400).json({error:'Provide at least 20 characters of requirement conversation notes'});
  const current=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id]);
  await invoke(req,res,lead,'requirements_draft',{conversationNotes:notes,existingStructuredRequirement:current?{businessLine:current.businessLine,purpose:current.purpose,propertyTypes:current.propertyTypes,areas:current.areas,budgetMin:current.budgetMin,budgetMax:current.budgetMax,fundingMethod:current.fundingMethod,bedroomsMin:current.bedroomsMin,bedroomsMax:current.bedroomsMax,timelineCode:current.timelineCode}:null,leadBusinessType:lead.businessType,policy:{draftOnly:true,maximumOptions:3,agentAndCustomerConfirmationRequired:true}});
});

r.post('/crm/leads/:id/ai/match-explanation',async(req,res)=>{
  const lead=await scopedLead(req,res);if(!lead)return;
  const requirement=await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id]);if(!requirement)return res.status(409).json({error:'A current structured requirement is required'});
  const listing=await one('SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL',[req.body?.listingId]);if(!listing)return res.status(404).json({error:'Inventory property not found'});
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
