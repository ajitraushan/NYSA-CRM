import {mayReadFinanceQueues,queueFilters} from './finance-workspace-domain.js';
import {hasInternalCrmIdentity} from './crm-policy.js';
import {adviceReference,adviceDocument,adviceSnapshots} from './payout-advice-domain.js';
import crypto from 'node:crypto';
import {one,many,execute,transaction,uuid,audit} from './db.js';
import {savePrivate,readPrivate,removePrivate} from './private-files.js';
import {renderApprovedDocumentPdf,approvedTemplatePath} from './approved-document-renderer.js';
import {readFile} from 'node:fs/promises';
export async function createAdviceIntents(batch,actorId,client){
 const rows=await many(`SELECT p.agent_id,b.name AS agent_name,p.currency,p.agent_payout_amount,p.quarter_key,o.opportunity_reference,d.deal_reference,
 CONCAT_WS(' / ',l.project,l.unit_reference) AS property,
 CASE WHEN p.trigger_method='quarter_achieved_rate' THEN p.agent_payout_amount-ROUND(p.current_credited_amount*COALESCE((SELECT MAX(pb.agent_percent) FROM agent_payout_calculation_bands pb WHERE pb.calculation_id=p.id),0)/100,2) ELSE 0 END AS adjustment
 FROM commission_payment_batch_items bi JOIN agent_payout_calculations p ON p.id=bi.calculation_id JOIN brokers b ON b.id=p.agent_id JOIN deals d ON d.id=p.deal_id JOIN opportunities o ON o.id=d.opportunity_id LEFT JOIN listings l ON l.id=d.listing_id
 WHERE bi.batch_id=$1 AND bi.status='paid' ORDER BY p.agent_id,p.payout_reference`,[batch.id],client);
 for(const {agentId,currency,snapshot} of adviceSnapshots(rows,batch)){
  await execute(`INSERT INTO agent_payout_advices(id,batch_id,agent_id,currency,input_snapshot,created_by) VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(batch_id,agent_id,currency) DO NOTHING`,[uuid(),batch.id,agentId,currency,JSON.stringify(snapshot),actorId],client);
 }
}
export async function generateNextAdvice({render=renderApprovedDocumentPdf,save=savePrivate}={}){
 const row=await transaction(async client=>one(`UPDATE agent_payout_advices SET status='generating',locked_at=NOW(),attempts=attempts+1,error_code=NULL WHERE id=(SELECT id FROM agent_payout_advices WHERE ((status IN ('pending','failed') AND retry_at<=NOW() AND attempts<5) OR (status='generating' AND locked_at<NOW()-INTERVAL '10 minutes')) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[],client));
 if(!row)return false;let storageKey;
 try{
  const pdf=await render('payout_advice',adviceDocument(row.inputSnapshot,adviceReference(row)));storageKey=await save(pdf,'.pdf');
  const hash=crypto.createHash('sha256').update(pdf).digest('hex'),templateHash=crypto.createHash('sha256').update(await readFile(approvedTemplatePath('payout_advice'))).digest('hex');
  const updated=await one(`UPDATE agent_payout_advices SET status='generated',storage_key=$1,pdf_hash=$2,template_hash=$3,generated_at=NOW(),locked_at=NULL WHERE id=$4 AND status='generating' AND attempts=$5 RETURNING id`,[storageKey,hash,templateHash,row.id,row.attempts]);
  if(!updated)await removePrivate(storageKey);
 }catch{
  if(storageKey)await removePrivate(storageKey).catch(()=>{});
  await execute(`UPDATE agent_payout_advices SET status='failed',error_code='PDF_GENERATION_FAILED',locked_at=NULL,retry_at=NOW()+INTERVAL '5 minutes' WHERE id=$1 AND status='generating' AND attempts=$2`,[row.id,row.attempts]);
 }
 return true;
}
export function startAdviceWorker(){let busy=false;const tick=async()=>{if(busy)return;busy=true;try{await generateNextAdvice();}catch{}finally{busy=false;}};const timer=setInterval(tick,5000);timer.unref();void tick();return()=>clearInterval(timer);}
export function registerAdviceRoutes(r){
 const finance=mayReadFinanceQueues;
 r.get('/finance/payout-advice/:id/document',async(req,res)=>{
  if(!hasInternalCrmIdentity(req.broker))return res.status(403).json({error:'NYSA business staff access required'});
  queueFilters({agentId:req.params.id});
  const row=await one('SELECT * FROM agent_payout_advices WHERE id=$1',[req.params.id]);
  if(!row||(!finance(req.broker)&&row.agentId!==req.broker.id))return res.status(404).json({error:'Payout advice not found'});
  if(row.status!=='generated')return res.status(409).json({error:'Payout advice is not yet generated'});
  const pdf=await readPrivate(row.storageKey);await audit('CommissionPaymentBatch',row.batchId,'payout_advice_downloaded',req.broker.id,{adviceId:row.id});
  res.setHeader('Content-Type','application/pdf');res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition',`${req.query.download?'attachment':'inline'}; filename="${adviceReference(row)}.pdf"`);res.end(pdf);
 });
 r.post('/finance/payout-advice/:id/retry',async(req,res)=>{
  if(!finance(req.broker))return res.status(403).json({error:'Finance authority required'});
  queueFilters({agentId:req.params.id});
  const row=await one("UPDATE agent_payout_advices SET status='pending',attempts=0,retry_at=NOW(),error_code=NULL WHERE id=$1 AND status='failed' RETURNING *",[req.params.id]);
  if(!row)return res.status(409).json({error:'Only failed advice can be retried'});
  await audit('CommissionPaymentBatch',row.batchId,'payout_advice_retry_requested',req.broker.id,{adviceId:row.id});res.json({status:'pending'});
 });
}
