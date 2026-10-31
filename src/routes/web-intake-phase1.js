import {Router} from '../lib/http-kit.js';
import {
  backfillContactMatchKeys,listMyWebIntakeQueue,listWebIntakeDesk,pickupWebIntake,promoteRecoveryCase,
  reconcileWebIntake,recordWebIntakeTaskOutcome
} from '../web-intake-workflow.js';

const isAdmin=broker=>broker?.role==='admin';
const isOperational=broker=>broker?.role==='internal_broker'&&['sales_agent','manager'].includes(broker.jobRole);
const isManager=broker=>broker?.role==='internal_broker'&&broker.jobRole==='manager';
const run=(transaction,work)=>(req,res)=>transaction(client=>work(req,client)).then(result=>res.json(result)).catch(error=>{
  const status=[400,403,404,409,503].includes(error.statusCode)?error.statusCode:503;
  res.status(status).json(error.responseBody||{error:error.statusCode?error.message:'WEB intake workflow is unavailable'});
});

export function createWebIntakePhase1Routes({requireAuth,transaction,env=process.env}){
  const r=Router();r.use(requireAuth);
  r.get('/crm/incoming-leads',run(transaction,async(req,client)=>{
    const items=await listWebIntakeDesk(req.broker,req.query,client);
    const campaigns=(await client.query(`SELECT COALESCE(j.campaign_id::text,CASE WHEN j.campaign_mapping_status='unmapped' THEN 'unmapped' ELSE 'none' END) AS campaign_key,
      COALESCE(m.name,j.source_campaign_code,CASE WHEN j.campaign_mapping_status='unmapped' THEN 'Unmapped campaign' ELSE 'No campaign' END) AS label,
      COUNT(*)::int AS intake_count FROM web_intake_journeys j LEFT JOIN marketing_campaigns m ON m.id=j.campaign_id
      GROUP BY campaign_key,label ORDER BY label`)).rows;
    return {items,leads:items,campaigns,liveIntegrationsEnabled:false,phase:'journey_and_pickup_foundation'};
  }));
  r.post('/crm/incoming-leads/:id/pickup',run(transaction,async(req,client)=>{
    if(!isOperational(req.broker))throw Object.assign(new Error('Only an active Sales Agent or Manager can pick up WEB intake'),{statusCode:403});
    return pickupWebIntake(req.params.id,req.broker,client,env);
  }));
  r.get('/crm/my-lead-queue',run(transaction,async(req,client)=>({items:await listMyWebIntakeQueue(req.broker,req.query.view,client),liveIntegrationsEnabled:false})));
  r.post('/crm/my-lead-queue/:id/promote',run(transaction,async(req,client)=>promoteRecoveryCase(req.params.id,req.body||{},req.broker,client)));
  r.post('/crm/my-lead-queue/tasks/:id/outcome',run(transaction,async(req,client)=>recordWebIntakeTaskOutcome(req.params.id,req.body||{},req.broker,client)));
  r.post('/admin/web-intake/reconcile',run(transaction,async(req,client)=>{
    if(!isManager(req.broker)&&!isAdmin(req.broker))throw Object.assign(new Error('Manager or Admin authority required'),{statusCode:403});
    const actorId=env.WEB_INTAKE_ACTOR_ID||env.WEBSITE_INTAKE_ACTOR_ID;
    return reconcileWebIntake({actorId,limit:req.body?.limit},client);
  }));
  r.post('/admin/web-intake/contact-match-keys/backfill',run(transaction,async(req,client)=>{
    if(!isManager(req.broker)&&!isAdmin(req.broker))throw Object.assign(new Error('Manager or Admin authority required'),{statusCode:403});
    return backfillContactMatchKeys({limit:req.body?.limit},client,env);
  }));
  return r;
}
