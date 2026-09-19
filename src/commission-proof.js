import path from 'node:path';
import {one,many,execute,transaction,uuid,audit} from './db.js';
import {hasInternalCrmIdentity,canReadOpportunity,canWriteOpportunity} from './crm-policy.js';
import {decodeAndValidateFile,savePrivate,readPrivate,removePrivate} from './private-files.js';
import {payoutFingerprint} from './commission-payout-domain.js';

export const mayRecordFinanceReceipt=actor=>hasInternalCrmIdentity(actor)&&
  ['director','accountant'].includes(actor.jobRole);
const publicProof=({storageKey,requestFingerprint,idempotencyKey,...proof})=>proof;
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const validId=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value||'');

export async function commissionProofScope(actor,dealId,write=false,client){
  if(!hasInternalCrmIdentity(actor))throw fail('NYSA staff access required',403);
  if(!validId(dealId))throw fail('Valid Deal identifier required');
  const deal=await one(`SELECT d.id,d.deal_reference,o.id AS opportunity_id,o.owner_id,o.created_by,o.assigned_team_id
    FROM deals d JOIN opportunities o ON o.id=d.opportunity_id WHERE d.id=$1`,[dealId],client);
  if(!deal)throw fail('Deal not found',404);
  if(mayRecordFinanceReceipt(actor))return deal;
  const participants=await many('SELECT broker_id FROM opportunity_participants WHERE opportunity_id=$1 AND active=TRUE',[deal.opportunityId],client);
  const scope={...deal,participantIds:participants.map(x=>x.brokerId)};
  if(!(write?canWriteOpportunity(actor,scope):canReadOpportunity(actor,scope)))throw fail('Commission proof is outside your permitted Deal scope',403);
  return deal;
}

export async function resolveReceiptProof(dealId,proofId,client){
  const deal=await one('SELECT opportunity_id FROM deals WHERE id=$1',[dealId],client);
  return resolveOpportunityReceiptProof(deal?.opportunityId,proofId,client);
}
export async function resolveOpportunityReceiptProof(opportunityId,proofId,client){
  if(!proofId)return null; // Preserve existing governed reference-based receipt support.
  if(!validId(proofId))throw fail('Valid commission proof identifier required');
  const proof=await one('SELECT * FROM opportunity_commission_proofs WHERE id=$1 AND finance_opportunity_id=$2',[proofId,opportunityId],client);
  if(!proof)throw fail('Select commission proof uploaded to this Opportunity');
  return proof;
}

export function registerCommissionProofRoutes(r){
  r.get('/finance/commission-deals',async(req,res)=>{
    if(!mayRecordFinanceReceipt(req.broker))throw fail('Finance receipt authority required',403);
    const query=String(req.query.q||'').trim().slice(0,100);
    const deals=await many(`SELECT d.id,d.deal_reference,d.status,d.agreed_value,d.currency,
        o.id AS opportunity_id,o.opportunity_reference,o.stage AS opportunity_stage,
        e.expected_company_receipt,c.confirmed_actual_received,
        (SELECT COUNT(*)::int FROM opportunity_commission_proofs p WHERE p.finance_opportunity_id=o.id) AS proof_count
      FROM deals d JOIN opportunities o ON o.id=d.opportunity_id
      LEFT JOIN deal_commission_expectation_versions e ON e.deal_id=d.id AND e.status='frozen'
      LEFT JOIN deal_commission_receipt_confirmations c ON c.deal_id=d.id AND c.status='confirmed'
      WHERE ($1='' OR o.opportunity_reference ILIKE '%'||$1||'%' OR d.deal_reference ILIKE '%'||$1||'%')
      ORDER BY d.created_at DESC,d.id LIMIT 100`,[query]);
    res.json({deals,limit:100});
  });
  registerProofEndpoints(r);
}

async function opportunityProofScope(actor,id,write=false,client){
  if(!hasInternalCrmIdentity(actor))throw fail('NYSA staff access required',403);
  if(!validId(id))throw fail('Valid Opportunity identifier required');
  const opportunity=await one('SELECT id,id AS opportunity_id,opportunity_reference,owner_id,created_by,assigned_team_id FROM opportunities WHERE id=$1',[id],client);
  if(!opportunity)throw fail('Opportunity not found',404);
  if(mayRecordFinanceReceipt(actor))return opportunity;
  const participants=await many('SELECT broker_id FROM opportunity_participants WHERE opportunity_id=$1 AND active=TRUE',[id],client);
  const scope={...opportunity,participantIds:participants.map(x=>x.brokerId)};
  if(!(write?canWriteOpportunity(actor,scope):canReadOpportunity(actor,scope)))throw fail('Proof outside permitted Opportunity scope',403);
  return opportunity;
}
function registerProofEndpoints(r){
  for(const kind of ['deal','opportunity']){
  const base=kind==='deal'?'/crm/deals/:dealId':'/finance/opportunities/:dealId';
  const commissionProofScope=kind==='deal'?legacyProofScope:opportunityProofScope;
  r.get(base+'/commission-proofs',async(req,res)=>{
    const scope=await commissionProofScope(req.broker,req.params.dealId);
    const proofs=await many('SELECT * FROM opportunity_commission_proofs WHERE finance_opportunity_id=$1 ORDER BY uploaded_at DESC,id',[scope.opportunityId]);
    let canUpload=true;
    try{await commissionProofScope(req.broker,req.params.dealId,true);}catch(error){if(error.statusCode!==403)throw error;canUpload=false;}
    res.json({proofs:proofs.map(publicProof),canUpload});
  });
  r.post(base+'/commission-proofs',async(req,res)=>{
    await commissionProofScope(req.broker,req.params.dealId,true);
    const body=req.body||{},key=String(body.idempotencyKey||'').trim();
    if(key.length<8||key.length>200)throw fail('A stable idempotency key is required');
    const file=decodeAndValidateFile({...body,maxBytes:5*1024*1024,allowedTypes:['application/pdf','image/png','image/jpeg']});
    if(file.error)throw fail(file.error);
    const fingerprint=payoutFingerprint({dealId:req.params.dealId,fileHash:file.fileHash,fileName:file.fileName,mediaType:body.mediaType});
    let storageKey;
    try{
      const result=await transaction(async client=>{
        await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`commission-proof:${req.broker.id}:${key}`],client);
        const scope=await commissionProofScope(req.broker,req.params.dealId,true,client);
        const existing=await one('SELECT * FROM deal_commission_proofs WHERE uploaded_by=$1 AND idempotency_key=$2',[req.broker.id,key],client);
        if(existing){if(existing.requestFingerprint!==fingerprint)throw fail('This upload key was already used for different proof',409);return{proof:publicProof(existing),replayed:true};}
        storageKey=await savePrivate(file.buffer,path.extname(file.fileName).toLowerCase());
        const id=uuid(),proof=await one(`INSERT INTO deal_commission_proofs
          (id,opportunity_id,proof_reference,file_name,media_type,file_size_bytes,file_hash,storage_key,uploaded_by,idempotency_key,request_fingerprint)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [id,scope.opportunityId,`CP-${id}`,file.fileName,body.mediaType,file.buffer.length,file.fileHash,storageKey,req.broker.id,key,fingerprint],client);
        await audit('DealCommissionProof',id,'uploaded',req.broker.id,{opportunityId:scope.opportunityId,fileHash:file.fileHash,bytes:file.buffer.length},client);
        return{proof:publicProof(proof),replayed:false};
      });
      storageKey=undefined; // Committed immutable evidence must survive response-delivery failure.
      res.status(result.replayed?200:201).json(result);
    }catch(error){if(storageKey)await removePrivate(storageKey);throw error;}
  });
  r.get(base+'/commission-proofs/:proofId/download',async(req,res)=>{
    const scope=await commissionProofScope(req.broker,req.params.dealId);
    const proof=await resolveOpportunityReceiptProof(scope.opportunityId,req.params.proofId);
    if(!proof)throw fail('Commission proof not found',404);
    const bytes=await readPrivate(proof.storageKey);
    await audit('DealCommissionProof',proof.id,'downloaded',req.broker.id,{opportunityId:scope.opportunityId,fileHash:proof.fileHash});
    res.setHeader('Content-Type',proof.mediaType);
    res.setHeader('Content-Disposition',`attachment; filename="${proof.fileName.replace(/"/g,'')}"`);
    res.setHeader('Cache-Control','private, no-store');
    res.end(bytes);
  });
  }
}
const legacyProofScope=commissionProofScope;
