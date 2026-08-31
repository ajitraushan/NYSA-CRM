import crypto from 'node:crypto';
import { Router } from '../lib/http-kit.js';
import { requireAuth } from '../auth.js';
import { audit,execute,many,one,transaction,uuid } from '../db.js';
import { decodeAndValidateFile } from '../private-files.js';
import { INVENTORY_IMPORT_CONTRACT_VERSION,parseInventoryWorkbook,validateInventoryImportRows } from '../inventory-import.js';
import { inventoryAgentEligibilitySql,inventoryAgentScopeSql } from '../inventory-agent-governance.js';
import { processEventWithClient } from './listing-intake.js';

const r=Router(),SOURCE_CODE=/^[a-z][a-z0-9_]{1,63}$/;
r.use(requireAuth);

const canImport=broker=>broker.role==='admin'||['listing_agent','manager','admin_assistant'].includes(broker.jobRole);
const allowed=(req,res)=>canImport(req.broker)?true:(res.status(403).json({error:'Inventory import requires a Listing Executive, Manager, Admin Assistant or Administrator'}),false);
const cleanSource=value=>String(value||'inventory_excel').trim().toLowerCase();
const payloadHash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reviewToken=(rows,fileHash,sourceCode,sessionToken)=>crypto.createHmac('sha256',sessionToken).update(JSON.stringify({fileHash,sourceCode,
  contractVersion:INVENTORY_IMPORT_CONTRACT_VERSION,rows:rows.map(row=>({rowNumber:row.rowNumber,intake:row.intake}))})).digest('hex');
const safeEqual=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);};
const requestedAgentReferences=(rows,defaults={})=>[...new Set(rows.flatMap(row=>[row.originatingAgentReference,row.responsibleAgentReference])
  .concat([defaults.defaultOriginatingAgentReference,defaults.defaultResponsibleAgentReference]).map(value=>String(value||'').trim().toLowerCase()).filter(Boolean))];
async function inventoryAgentResolutionDirectory(broker,references,client){
  if(!references.length)return[];
  const params=[references],scope=inventoryAgentScopeSql(broker,'b',params),eligibility=inventoryAgentEligibilitySql('b');
  return many(`SELECT b.id,b.name,b.email,b.status,b.role,b.job_role,
      (b.role IN ('admin','internal_broker') AND ${eligibility}) AS eligible,
      (${scope}) AS in_scope
    FROM brokers b WHERE LOWER(b.email)=ANY($1::text[]) ORDER BY LOWER(b.email),b.id`,params,client);
}

r.post('/inventory-import/preview',async(req,res)=>{
  if(!allowed(req,res))return;
  const sourceCode=cleanSource(req.body?.sourceCode);
  if(!SOURCE_CODE.test(sourceCode))return res.status(400).json({error:'Source system code must use lowercase snake_case'});
  const file=decodeAndValidateFile({base64:req.body?.base64,mediaType:req.body?.mediaType,fileName:req.body?.fileName,maxBytes:5242880,
    allowedTypes:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']});
  if(file.error)return res.status(400).json({error:file.error});
  try{
    const sourceRows=await parseInventoryWorkbook(file.buffer),defaults={defaultOriginatingAgentReference:req.body?.defaultOriginatingAgentReference,
      defaultResponsibleAgentReference:req.body?.defaultResponsibleAgentReference},[existingRecords,inventoryRecords,areas,agentDirectory]=await Promise.all([many(
      'SELECT source_provider,external_record_id FROM listings WHERE source_provider=$1 AND external_record_id IS NOT NULL AND deleted_at IS NULL',[sourceCode]),
      many(`SELECT l.id,l.inventory_reference,l.status,l.community,l.unit_reference,l.building,l.size_sqft,a.stable_code AS area_code
        FROM listings l JOIN areas a ON a.id=l.area_id WHERE l.deleted_at IS NULL`),
      many('SELECT stable_code FROM areas WHERE active=1'),inventoryAgentResolutionDirectory(req.broker,requestedAgentReferences(sourceRows,defaults))]);
    const rows=validateInventoryImportRows(sourceRows,{sourceCode,existingRecords,inventoryRecords,activeAreaCodes:areas.map(area=>area.stableCode),agentDirectory,
      ...defaults}),invalidCount=rows.filter(row=>row.errors.length).length,
      skippedCount=rows.filter(row=>row.skipped).length,readyCount=rows.length-invalidCount-skippedCount;
    res.json({fileName:file.fileName,fileHash:file.fileHash,sourceCode,contractVersion:INVENTORY_IMPORT_CONTRACT_VERSION,rowCount:rows.length,
      readyCount,skippedCount,invalidCount,valid:invalidCount===0,reviewToken:reviewToken(rows,file.fileHash,sourceCode,req.token),rows});
  }catch(error){res.status(400).json({error:`Workbook could not be reviewed: ${error.message}`});}
});

r.post('/inventory-import/commit',async(req,res)=>{
  if(!allowed(req,res))return;
  const reason=String(req.body?.reason||'').trim(),sourceCode=cleanSource(req.body?.sourceCode),fileHash=String(req.body?.fileHash||'').toLowerCase(),
    fileName=String(req.body?.fileName||'').trim(),submittedReviewToken=String(req.body?.reviewToken||''),sourceRows=Array.isArray(req.body?.rows)?req.body.rows:[];
  if(!reason)return res.status(400).json({error:'An Inventory import reason is required'});
  if(!SOURCE_CODE.test(sourceCode))return res.status(400).json({error:'Source system code must use lowercase snake_case'});
  if(!/^[a-f0-9]{64}$/.test(fileHash))return res.status(400).json({error:'Review the workbook again before importing'});
  if(!sourceRows.length||sourceRows.length>1000)return res.status(400).json({error:'Provide between 1 and 1,000 reviewed Inventory rows'});
  try{
    const result=await transaction(async client=>{
      await execute("SELECT pg_advisory_xact_lock(hashtext('inventory-import'),hashtext($1))",[fileHash],client);
      const existingRecords=await many('SELECT source_provider,external_record_id FROM listings WHERE source_provider=$1 AND external_record_id IS NOT NULL AND deleted_at IS NULL FOR SHARE',[sourceCode],client),
        inventoryRecords=await many(`SELECT l.id,l.inventory_reference,l.status,l.community,l.unit_reference,l.building,l.size_sqft,a.stable_code AS area_code
          FROM listings l JOIN areas a ON a.id=l.area_id WHERE l.deleted_at IS NULL FOR SHARE`,[],client),
        areas=await many('SELECT stable_code FROM areas WHERE active=1 FOR SHARE',[],client),agentDirectory=await inventoryAgentResolutionDirectory(req.broker,requestedAgentReferences(sourceRows),client),
        rows=validateInventoryImportRows(sourceRows,{sourceCode,existingRecords,inventoryRecords,activeAreaCodes:areas.map(area=>area.stableCode),agentDirectory}),invalid=rows.filter(row=>row.errors.length),ready=rows.filter(row=>!row.errors.length&&!row.skipped);
      if(!safeEqual(submittedReviewToken,reviewToken(rows,fileHash,sourceCode,req.token))){const error=new Error('The reviewed workbook data changed; preview it again');error.statusCode=409;throw error;}
      if(invalid.length){const error=new Error('The reviewed Inventory import is no longer valid; preview it again');error.statusCode=409;error.rows=rows;throw error;}
      if(!ready.length){const error=new Error('No new Inventory rows remain to import');error.statusCode=409;error.rows=rows;throw error;}
      const created=[];
      for(const row of ready){
        const value={...row.intake,eventId:`xlsx-${fileHash.slice(0,24)}-${row.rowNumber}`},hash=payloadHash(value),eventId=uuid();
        const event=await one(`INSERT INTO listing_intake_events(id,event_id,provider_code,source_kind,external_record_id,mapping_version,received_mapping_version,
          mapping_version_id,payload_hash,received_payload_hash,payload,received_payload,status,assigned_to)
          VALUES($1,$2,$3,'import',$4,$5,$5,NULL,$6,$6,$7,$7,'processing',$8)
          ON CONFLICT(provider_code,event_id) DO NOTHING RETURNING *`,
          [eventId,value.eventId,sourceCode,value.externalRecordId,INVENTORY_IMPORT_CONTRACT_VERSION,hash,value,req.broker.id],client);
        if(!event){const error=new Error(`Excel row ${row.rowNumber} was already submitted; preview the workbook again`);error.statusCode=409;throw error;}
        const processed=await processEventWithClient(event,value,req.broker,{},client);
        if(processed.status!=='accepted'){const error=new Error(`Excel row ${row.rowNumber} changed after preview: ${processed.error||processed.status}`);error.statusCode=409;throw error;}
        await audit('ListingIntake',event.id,'excel_import_committed',req.broker.id,{listingId:processed.listingId,rowNumber:row.rowNumber,
          fileName,fileHash,sourceCode,contractVersion:INVENTORY_IMPORT_CONTRACT_VERSION,reason},client);
        if(!processed.inventoryReference){const error=new Error(`Excel row ${row.rowNumber} did not receive a CORE Inventory ID`);error.statusCode=500;throw error;}
        created.push({rowNumber:row.rowNumber,listingId:processed.listingId,inventoryReference:processed.inventoryReference,externalRecordId:value.externalRecordId});
      }
      return{created,skippedCount:rows.length-ready.length};
    });
    res.status(201).json({importedCount:result.created.length,skippedCount:result.skippedCount,contractVersion:INVENTORY_IMPORT_CONTRACT_VERSION,
      created:result.created,drafts:result.created,noAutomaticVerification:true});
  }catch(error){
    if(error.statusCode)return res.status(error.statusCode).json({error:error.message,rows:error.rows});
    if(error.code==='23505')return res.status(409).json({error:'Inventory changed after preview. Review the workbook again before importing.'});
    if(['23502','23503','23514'].includes(error.code))return res.status(409).json({error:'CORE could not create the reviewed Draft Inventory because a governed Inventory requirement was not satisfied. Zero records were imported; ask the CORE administrator to review the server error using this import time.'});
    throw error;
  }
});

export default r;
