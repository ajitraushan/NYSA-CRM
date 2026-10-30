import crypto from 'node:crypto';
import {Router} from '../lib/http-kit.js';
import {verifyMetaSignature,metaNotificationReferences} from '../lead-follow-up-domain.js';
import {persistMetaReferences} from '../lead-source-inbox.js';

function sameSecret(a,b) {
  if(typeof a!=='string'||typeof b!=='string') return false;
  const x=crypto.createHash('sha256').update(a).digest(), y=crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x,y);
}
export function createMetaIntakeRoutes({transaction, env=process.env,loadEnvironment}) {
  const r=Router();
  const configured=(configuration)=>configuration.META_INTAKE_ENABLED==='true' && configuration.META_APP_SECRET?.length>=32 &&
    configuration.META_WEBHOOK_VERIFY_TOKEN?.length>=32 && /^\d+(,\d+)*$/.test(configuration.META_ALLOWED_PAGE_IDS||'');
  r.get('/intake/meta',async(req,res)=>{
    let configuration;try{configuration=loadEnvironment?await loadEnvironment():env;}catch{return res.status(503).json({error:'META_INTAKE_DISABLED'});}
    if(!configured(configuration)) return res.status(503).json({error:'META_INTAKE_DISABLED'});
    const challenge=req.query['hub.challenge'];
    if(req.query['hub.mode']!=='subscribe'||!sameSecret(req.query['hub.verify_token'],configuration.META_WEBHOOK_VERIFY_TOKEN)||
      typeof challenge!=='string'||!/^\d{1,100}$/.test(challenge)) return res.status(403).json({error:'META_VERIFICATION_DENIED'});
    res.setHeader('Content-Type','text/plain');res.end(challenge);
  });
  r.post('/intake/meta',async(req,res)=>{
    let configuration;try{configuration=loadEnvironment?await loadEnvironment():env;}catch{return res.status(503).json({error:'META_INTAKE_DISABLED'});}
    if(!configured(configuration)) return res.status(503).json({error:'META_INTAKE_DISABLED'});
    if(typeof req.rawBody!=='string'||Buffer.byteLength(req.rawBody,'utf8')>256*1024) return res.status(413).json({error:'META_BODY_LIMIT'});
    if(!verifyMetaSignature(req.rawBody,req.headers['x-hub-signature-256'],configuration.META_APP_SECRET))
      return res.status(401).json({error:'META_SIGNATURE_DENIED'});
    let events;
    try { events=metaNotificationReferences(req.body,configuration.META_ALLOWED_PAGE_IDS.split(',')); }
    catch { return res.status(400).json({error:'META_ENVELOPE_INVALID'}); }
    try {
      const receipts=await transaction(client=>persistMetaReferences(events,client));
      // Deliberately not called a created lead: retrieval/mapping/CRM linking is the next increment.
      return res.status(200).json({status:'durably_received',count:receipts.length});
    } catch(error) {
      if(error.statusCode===409) return res.status(409).json({error:'META_REFERENCE_CONFLICT'});
      // Do not pass database/provider errors with parameters into the generic console error handler.
      return res.status(503).json({error:'META_RECEIPT_UNAVAILABLE'});
    }
  });
  return r;
}
