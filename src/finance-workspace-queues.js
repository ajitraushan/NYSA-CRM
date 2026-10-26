import {queuePage,queueDefinition,queueFilters,mayReadFinanceQueues} from './finance-workspace-domain.js';
import {one,many,transaction,audit} from './db.js';
import {financeQueueQuery,financeQueueRow} from './finance-queue-query.js';
import {createAdviceIntents} from './payout-advice.js';
export function registerFinanceQueues(r){
 r.post('/finance/workspace/batches/:id/advice',async(req,res)=>{
  if(!mayReadFinanceQueues(req.broker))return res.status(403).json({error:'Finance authority required'});
  queueFilters({agentId:req.params.id});
  const result=await transaction(async client=>{
   const batch=await one('SELECT * FROM commission_payment_batches WHERE id=$1 FOR UPDATE',[req.params.id],client);
   if(!batch)return{status:404,error:'Batch not found'};
   if(batch.paymentStatus!=='paid'||!batch.paymentDate||!batch.paymentReference||!batch.decidedAt||!batch.evidenceReference)return{status:409,error:'Recorded payment and approval evidence are required for retrospective advice'};
   const paid=await one("SELECT COUNT(*)::int AS count FROM commission_payment_batch_items WHERE batch_id=$1 AND status='paid'",[batch.id],client);
   if(!paid.count)return{status:409,error:'Recorded paid agent rows are required for retrospective advice'};
   await createAdviceIntents({...batch,retrospective:true},req.broker.id,client);
   await audit('CommissionPaymentBatch',batch.id,'retrospective_payout_advice_requested',req.broker.id,{retrospective:true},client);
   return{status:200,message:'Advice is queued or already available. The payment record is unchanged.'};
  });res.status(result.status).json(result);
 });
 r.get('/finance/workspace/filters',async(req,res)=>{
  if(!mayReadFinanceQueues(req.broker))return res.status(403).json({error:'Finance authority required'});
  const agents=await many('SELECT id,name FROM brokers WHERE id IN (SELECT agent_id FROM agent_payout_calculations UNION SELECT agent_id FROM deal_agent_credit_lines) ORDER BY name,id'),teams=await many('SELECT id,name FROM teams ORDER BY name,id');res.json({agents,teams});
 });
 r.get('/finance/workspace/counts',async(req,res)=>{
  const categories=req.query.group?{invoices:['invoice-awaiting','invoice-issued','invoice-changes'],collections:['collection-unpaid','collection-part','collection-overdue','collection-paid'],payouts:['payout-prepare','payout-ready','payout-pending','payout-approved','payout-paid'],advice:['advice-generated','advice-pending','advice-failed'],statements:['statements']}[req.query.group]:['invoice-awaiting','collection-overdue','payout-prepare','payout-ready','payout-pending','payout-approved','advice-failed'];if(!categories)return res.status(400).json({error:'Unknown work group'});const counts={};
  const params=[],queries=categories.map(category=>{
   const definition=queueDefinition(category,req.broker),offset=params.length;params.push(...definition.params);
   const source=definition.sql.replace(/\$(\d+)/g,(_,index)=>'$'+(Number(index)+offset));
   counts[category]={count:0,totals:[]};return `SELECT '${category}' AS category,currency,COUNT(*)::int AS count,SUM(amount) AS amount FROM (${source}) queue GROUP BY currency`;
  });
  for(const row of await many(queries.join(' UNION ALL '),params)){counts[row.category].count+=row.count;counts[row.category].totals.push({currency:row.currency,amount:row.amount});}
  res.json({counts,asOf:new Date().toISOString()});
 });
 r.get('/finance/workspace/batches/:id',async(req,res)=>{
  if(!mayReadFinanceQueues(req.broker))return res.status(403).json({error:'Finance authority required'});
  queueFilters({agentId:req.params.id});
  const batch=await one('SELECT * FROM commission_payment_batches WHERE id=$1',[req.params.id]);if(!batch)return res.status(404).json({error:'Batch not found'});
  const page=queuePage(req.query),items=await many(`SELECT bi.id,bi.status,p.payout_reference,p.agent_payout_amount,b.name AS agent_name,o.opportunity_reference,d.deal_reference FROM commission_payment_batch_items bi JOIN agent_payout_calculations p ON p.id=bi.calculation_id JOIN brokers b ON b.id=p.agent_id JOIN deals d ON d.id=p.deal_id JOIN opportunities o ON o.id=d.opportunity_id WHERE bi.batch_id=$1 ORDER BY b.name,bi.id LIMIT $2 OFFSET $3`,[batch.id,page.size,page.offset]);
  const summary=await one(`SELECT COUNT(*)::int AS count,COALESCE(SUM(p.agent_payout_amount) FILTER(WHERE bi.status='approved'),0) AS payable FROM commission_payment_batch_items bi JOIN agent_payout_calculations p ON p.id=bi.calculation_id WHERE bi.batch_id=$1`,[batch.id]);
  res.json({batch,items,...summary,page:page.page,pageCount:Math.max(1,Math.ceil(summary.count/page.size))});
 });
 r.get('/finance/workspace/queue',async(req,res)=>{
  queueFilters(req.query);
  const page=queuePage(req.query),definition=queueDefinition(String(req.query.category||''),req.broker),params=[...definition.params],qIndex=params.push(`%${page.q}%`);
  const adviceMatch=String(req.query.category||'').startsWith('advice-')?` OR EXISTS(SELECT 1 FROM agent_payout_advices advice,jsonb_array_elements(advice.input_snapshot->'items') item WHERE advice.id=queue.id AND (item->>'opportunityReference' ILIKE $${qIndex} OR item->>'dealReference' ILIKE $${qIndex}))`:'';
  const filter=`(reference ILIKE $${qIndex} OR COALESCE(to_jsonb(queue)->>'party','') ILIKE $${qIndex} OR COALESCE(to_jsonb(queue)->>'invoice_reference','') ILIKE $${qIndex} OR COALESCE(to_jsonb(queue)->>'batch_reference','') ILIKE $${qIndex}${adviceMatch})`;
  let extra='';
  const category=String(req.query.category||'');
  if(req.query.agentId&&/^(payout-|advice-|statements)/.test(category)){const i=params.push(req.query.agentId);extra+=` AND $${i}::uuid=ANY(agent_ids)`;}
  if(req.query.teamId&&/^(payout-|advice-|statements)/.test(category)){const i=params.push(req.query.teamId);extra+=` AND EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.team_id=$${i}::uuid AND tm.broker_id=ANY(agent_ids) AND tm.ends_at IS NULL)`;}
  if(req.query.quarter&&category==='statements'){const i=params.push(req.query.quarter);extra+=` AND reference=$${i}`;}
  if(req.query.status){const i=params.push(req.query.status);extra+=` AND COALESCE(to_jsonb(queue)->>'status',to_jsonb(queue)->>'state')=$${i}`;}

  if(req.query.currency){const i=params.push(String(req.query.currency));extra+=` AND currency=$${i}`;}
  if(req.query.from){const i=params.push(String(req.query.from));extra+=` AND COALESCE(to_jsonb(queue)->>'date',to_jsonb(queue)->>'invoice_date')::date>=$${i}::date`;}
  if(req.query.to){const i=params.push(String(req.query.to));extra+=` AND COALESCE(to_jsonb(queue)->>'date',to_jsonb(queue)->>'invoice_date')::date<=$${i}::date`;}
  const sql=`SELECT * FROM (${definition.sql}) queue WHERE ${filter}${extra}`;
  const limitIndex=params.push(page.size),offsetIndex=params.push(page.offset),data=await one(financeQueueQuery(sql,{sort:req.query.sort,direction:req.query.direction,limitIndex,offsetIndex}),params);
  res.json({items:data.items.map(financeQueueRow),count:data.count,totals:data.totals,page:page.page,size:page.size,pageCount:Math.max(1,Math.ceil(data.count/page.size)),asOf:new Date().toISOString()});
 });
}
