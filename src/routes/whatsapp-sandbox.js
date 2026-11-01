import {Router} from '../lib/http-kit.js';
import {verifySandboxRelay,verifySandboxBasic} from '../whatsapp-sandbox.js';
import {sandboxSetupAllowed,sandboxEnvironmentAllowed,saveSandboxConnection,sandboxStatus,setSandboxPaused,loadSandboxConnection,sendSandboxTest,receiveSandboxEvents,configureSandboxWebhook} from '../whatsapp-sandbox-store.js';

function respondError(res,e) {
 const code=typeof e?.message==='string' && /^SANDBOX_[A-Z_]+$/.test(e.message) ? e.message : 'SANDBOX_OPERATION_UNAVAILABLE';
 const status=[400,401,409,503].includes(e?.statusCode)?e.statusCode:code==='SANDBOX_OPERATION_UNAVAILABLE'?503:/(_INVALID|_UNSUPPORTED|_MISMATCH|_LIMIT)$/.test(code)?400:409;
 return res.status(status).json({error:code});
}
export function createWhatsAppSandboxAdminRoutes({requireAuth,transaction,env=process.env,fetchImpl=fetch}) {
 const r=Router();
 r.use(requireAuth,(req,res,next)=>req.broker?.role==='admin'?next():res.status(403).json({error:'Admin configuration access required'}));
 r.get('/admin/whatsapp-sandbox',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{res.json(await transaction(c=>sandboxStatus(c,env)));}catch(e){respondError(res,e);}
 });
 const guarded = handler => async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.headers['x-nysa-sandbox-action']!=='1')return res.status(403).json({error:'Sandbox action header required'});
  if(!sandboxSetupAllowed(env))return res.status(503).json({error:'SANDBOX_SETUP_DISABLED'});
  try{res.json(await handler(req));}catch(e){respondError(res,e);}
 };
 r.post('/admin/whatsapp-sandbox/connection',guarded(req=>transaction(c=>saveSandboxConnection({body:req.body,actorId:req.broker.id,env},c))));
 r.post('/admin/whatsapp-sandbox/pause',guarded(req=>{
  if(!req.body||Object.keys(req.body).some(k=>!['paused','confirmed'].includes(k))||req.body.confirmed!==true)throw Object.assign(new Error('SANDBOX_CONFIRMATION_REQUIRED'),{statusCode:400});
  return transaction(c=>setSandboxPaused({paused:req.body.paused,actorId:req.broker.id,env},c));
 }));
 r.post('/admin/whatsapp-sandbox/send-test',guarded(req=>sendSandboxTest({body:req.body,actorId:req.broker.id,env,transaction,fetchImpl})));
 r.post('/admin/whatsapp-sandbox/configure-webhook',guarded(req=>{
  if(!req.body||req.body.confirmed!==true||Object.keys(req.body).some(k=>k!=='confirmed'))throw Object.assign(new Error('SANDBOX_CONFIRMATION_REQUIRED'),{statusCode:400});
  return configureSandboxWebhook({actorId:req.broker.id,env,transaction,fetchImpl});
 }));
 return r;
}
export function createWhatsAppSandboxInboxRoutes({transaction,env=process.env}) {
 const r=Router();
 r.post('/providers/whatsapp-sandbox/events',async(req,res)=>{
  const basic=env.WHATSAPP_SANDBOX_AUTH_MODE==='basic';
  const probe=basic&&env.WHATSAPP_SANDBOX_NATIVE_PROBE_ENABLED==='true';
  if(!sandboxSetupAllowed(env)||!sandboxEnvironmentAllowed(env)||(env.WHATSAPP_SANDBOX_CALLBACK_APPROVED!=='true'&&!probe))return res.status(503).json({error:'SANDBOX_INGRESS_DISABLED'});
  if(typeof req.rawBody!=='string'||Buffer.byteLength(req.rawBody)>256*1024)return res.status(400).json({error:'SANDBOX_EVENT_INVALID'});
  try{
   const result=await transaction(async c=>{
    const row=await loadSandboxConnection(c,env,{lock:true});
    const authenticated=basic?verifySandboxBasic({authorization:req.headers.authorization,secret:row.credentials.relaySecret}):verifySandboxRelay({rawBody:req.rawBody,timestamp:req.headers['x-nysa-timestamp'],signature:req.headers['x-nysa-signature'],secret:row.credentials.relaySecret});
    if(!authenticated)throw Object.assign(new Error('SANDBOX_AUTH_DENIED'),{statusCode:401});
    return receiveSandboxEvents({body:req.body,env,authMode:basic?'basic':'relay'},c);
   });res.json(result);
  }catch(e){respondError(res,e);}
 });
 return r;
}
