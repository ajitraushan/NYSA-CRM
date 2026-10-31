import {Router} from '../lib/http-kit.js';
import {randomUUID} from 'node:crypto';
import {applyNonvoiceEvent} from '../nonvoice-follow-up-store.js';
import {listResponseCases,scopedResponseCase,decideResponseTier,takeOverResponseCase,bookResponseCallback,responseMetrics,
 canManageUnassignedResponses,listUnassignedResponseCases,listUnassignedResponseOwners,scopedUnassignedResponseCase,assignUnassignedResponseOwner} from '../nonvoice-response-workflow.js';
export function createLeadResponseRoutes({requireAuth,transaction,env=process.env}){
 const r=Router();r.use(requireAuth,(req,res,next)=>(req.broker?.role==='admin'||(req.broker?.role==='internal_broker'&&['sales_agent','manager'].includes(req.broker.jobRole)))?next():res.status(403).json({error:'Lead response access required'}));
 const run=fn=>async(req,res)=>{try{res.json(await transaction(c=>fn(req,c)));}catch(e){res.status([400,403,404,409].includes(e.statusCode)?e.statusCode:503).json({error:e.statusCode?e.message:'Lead response is unavailable'});}};
 r.get('/crm/lead-response',run(async(req,c)=>{
  const view=req.query.view||(req.broker.role==='admin'?'unassigned':'mine'),offset=Number(req.query.page||0)*100;
  if(!['mine','unassigned'].includes(view))throw Object.assign(new Error('Invalid response view'),{statusCode:400});
  if(view==='unassigned'&&!canManageUnassignedResponses(req.broker))throw Object.assign(new Error('Admin or Manager access required'),{statusCode:403});
  const unassigned=view==='unassigned';
  return {view,canViewUnassigned:canManageUnassignedResponses(req.broker),
   cases:unassigned?await listUnassignedResponseCases(req.broker,c,{offset}):await listResponseCases(req.broker,c,{offset,filter:req.query.filter||'all'}),
   responseOwners:unassigned?await listUnassignedResponseOwners(req.broker,c):[],
   intakeExceptions:unassigned?[]:(await c.query("SELECT id,state,error_code,review_due_at FROM lead_source_inbox WHERE review_owner_id=$1 AND state IN ('pending_retrieval','needs_review') ORDER BY received_at LIMIT 100",[req.broker.id])).rows,
   metrics:unassigned?null:await responseMetrics(req.broker,c),
   replyExceptions:unassigned?[]:(await c.query("SELECT id,provider,error_code,review_due_at FROM lead_response_provider_inbox WHERE review_owner_id=$1 AND state='needs_review' ORDER BY received_at LIMIT 100",[req.broker.id])).rows,
   liveSendingEnabled:env.LEAD_RESPONSE_LIVE_ENABLED==='true'&&['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT)&&(await c.query('SELECT paused FROM lead_integration_setup WHERE singleton=TRUE')).rows[0]?.paused===false};
 }));
 r.get('/crm/lead-response/:id',run(async(req,c)=>{
  const identity=(await c.query('SELECT fallback_owner_id FROM lead_follow_up_cases WHERE id=$1',[req.params.id])).rows[0];
  const row=identity&&!identity.fallback_owner_id?await scopedUnassignedResponseCase(req.params.id,req.broker,c):await scopedResponseCase(req.params.id,req.broker,c);
  const jobs=(await c.query('SELECT step,channel,state,due_at,attempt_count FROM lead_follow_up_jobs WHERE case_id=$1 ORDER BY generation DESC,step',[row.id])).rows;
  const callbacks=(await c.query('SELECT id,starts_at,ends_at,status FROM lead_response_callbacks WHERE case_id=$1 ORDER BY starts_at',[row.id])).rows;
  return {case:row,jobs,callbacks,unassigned:!row.fallback_owner_id,responseOwners:!row.fallback_owner_id?await listUnassignedResponseOwners(req.broker,c):[],
   liveSendingEnabled:env.LEAD_RESPONSE_LIVE_ENABLED==='true'&&['local','crm-test'].includes(env.LEAD_RESPONSE_ENVIRONMENT)&&(await c.query('SELECT paused FROM lead_integration_setup WHERE singleton=TRUE')).rows[0]?.paused===false};
 }));
 r.post('/crm/lead-response/:id/assign-owner',run((req,c)=>assignUnassignedResponseOwner(req.params.id,req.body?.ownerId,req.broker,c)));
 r.post('/crm/lead-response/:id/tier',run((req,c)=>decideResponseTier({...req.body,caseId:req.params.id},req.broker,c)));
 r.post('/crm/lead-response/:id/takeover',run((req,c)=>{
  if(req.body.confirmed!==true)throw Object.assign(new Error('Confirm human takeover'),{statusCode:400});
  return takeOverResponseCase(req.params.id,req.broker,c);
 }));
 r.post('/crm/lead-response/:id/confirm-enquiry',run(async(req,c)=>{
  const row=await scopedResponseCase(req.params.id,req.broker,c,true);
  if(req.body.confirmed!==true)throw Object.assign(new Error('Confirm the customer acknowledged this enquiry'),{statusCode:400});
  await c.query("UPDATE lead_follow_up_cases SET declared_requirements=declared_requirements||jsonb_build_object('enquiryConfirmed',TRUE,'confirmationSource','human_confirmed'),updated_at=NOW() WHERE id=$1",[row.id]);
  await c.query("INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details) VALUES($1,'Lead',$2,'enquiry_confirmed',$3,$4)",[randomUUID(),row.lead_id,req.broker.id,JSON.stringify({caseRef:row.id})]);
  return {confirmed:true};
 }));
 r.post('/crm/lead-response/:id/restriction',run(async(req,c)=>{
  const row=await scopedResponseCase(req.params.id,req.broker,c,true);
  if(req.body.confirmed!==true||!['opt_out','wrong_person'].includes(req.body.reason))throw Object.assign(new Error('Confirm the customer restriction'),{statusCode:400});
  return applyNonvoiceEvent({caseId:row.id,generation:row.generation,connectionRef:'human:'+req.broker.id,eventRef:randomUUID(),type:req.body.reason},c);
 }));
 r.post('/crm/lead-response/:id/callback',run((req,c)=>bookResponseCallback({...req.body,caseId:req.params.id},req.broker,c)));
 return r;
}
