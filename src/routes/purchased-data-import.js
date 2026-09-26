import crypto from 'node:crypto';
import {Router} from '../lib/http-kit.js';
import {requireAuth} from '../auth.js';
import {audit,execute,many,one,transaction,uuid} from '../db.js';
import {decodeAndValidateFile,removePrivate,savePrivate} from '../private-files.js';
import {parsePurchasedWorkbook,PURCHASED_DATA_IMPORT_VERSION,validatePurchasedRows} from '../purchased-data-import.js';
import {resolvePrimaryRoutingArea,selectRoutingRule} from '../routing-service.js';
import {calculateDeadlines} from './lead-operations.js';
import {CAPABILITY,hasCapability} from '../role-access.js';

const r=Router(),clean=value=>String(value??'').trim(),SOURCE=/^[a-z][a-z0-9_]{1,63}$/,XLSX='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
r.use(requireAuth);
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const token=(payload,session)=>crypto.createHmac('sha256',session).update(JSON.stringify(payload)).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);};
const normalizeMeta=value=>({contractVersion:clean(value.contractVersion),moduleType:clean(value.moduleType),sourceSystemCode:clean(value.sourceSystemCode).toLowerCase(),supplierName:clean(value.supplierName),acquisitionBatchReference:clean(value.acquisitionBatchReference),acquisitionDate:clean(value.acquisitionDate),campaignReference:clean(value.campaignReference)||null,processingBasis:clean(value.processingBasis)});
const metadataError=value=>value.contractVersion!==PURCHASED_DATA_IMPORT_VERSION?'Workbook contract version is not supported':Object.values(value).some(item=>/^replace(?:[-_ ]|$)/i.test(clean(item)))?'Replace every template placeholder in the Batch sheet before upload':!SOURCE.test(value.sourceSystemCode)?'Source-system code must use lowercase snake_case':!value.supplierName||!value.acquisitionBatchReference||!/^\d{4}-\d{2}-\d{2}$/.test(value.acquisitionDate)||!value.processingBasis?'Supplier, acquisition batch, acquisition date and processing basis are required':null;
const authority=broker=>hasCapability(broker,CAPABILITY.PURCHASED_DATA_IMPORT);
async function identities(client){return many(`SELECT c.id,c.customer_reference,c.full_name,c.email,c.phone,c.lifecycle_status,b.source_system_code,b.acquisition_batch_reference,r.external_row_reference
  FROM contacts c LEFT JOIN purchased_data_import_rows r ON r.contact_id=c.id AND r.outcome IN('created','linked')
  LEFT JOIN purchased_data_import_batches b ON b.id=r.batch_id WHERE c.lifecycle_status IN('active','restricted')`,[],client);}
async function priorRows(meta,client){return many(`SELECT r.external_row_reference,b.source_system_code,b.acquisition_batch_reference FROM purchased_data_import_rows r JOIN purchased_data_import_batches b ON b.id=r.batch_id WHERE b.source_system_code=$1 AND b.acquisition_batch_reference=$2 AND r.outcome IN('created','linked','skipped')`,[meta.sourceSystemCode,meta.acquisitionBatchReference],client);}
const validationOptions=(moduleType,meta,prior,contacts)=>({moduleType,sourceSystemCode:meta.sourceSystemCode,acquisitionBatchReference:meta.acquisitionBatchReference,existingSourceRows:prior,identityMatches:contacts});
const previewPayload=(moduleType,meta,fileHash,rows)=>({moduleType,meta,fileHash,rows:rows.map(row=>({rowNumber:row.rowNumber,externalRowReference:row.externalRowReference,normalized:row.normalized,matchedContactId:row.matchedContact?.id||null,matchBasis:row.matchBasis||null,action:row.action,errors:row.errors}))});
const decode=req=>decodeAndValidateFile({base64:req.body?.base64,mediaType:req.body?.mediaType,fileName:req.body?.fileName,maxBytes:5242880,allowedTypes:[XLSX]});

r.get('/crm/purchased-data-import/batches',async(req,res)=>{
  if(!authority(req.broker))return res.status(403).json({error:'Purchased-data import is limited to Sales Agent and Admin roles'});
  res.json({batches:await many(`SELECT b.id,b.batch_reference,b.module_type,b.original_file_name,b.source_system_code,b.supplier_name,b.acquisition_batch_reference,b.acquisition_date,b.campaign_reference,b.status,b.row_count,b.created_count,b.linked_count,b.skipped_count,b.excluded_count,b.review_count,b.invalid_count,b.failed_count,b.created_at,b.completed_at,u.name AS uploaded_by_name,c.name AS confirmed_by_name FROM purchased_data_import_batches b JOIN brokers u ON u.id=b.uploaded_by LEFT JOIN brokers c ON c.id=b.confirmed_by ORDER BY b.created_at DESC LIMIT 100`)});
});
r.get('/crm/purchased-data-import/batches/:id/reconciliation.csv',async(req,res)=>{
  if(!authority(req.broker))return res.status(403).json({error:'Purchased-data import is limited to Sales Agent and Admin roles'});
  const batch=await one('SELECT * FROM purchased_data_import_batches WHERE id=$1',[req.params.id]);if(!batch)return res.status(404).json({error:'Import batch not found'});
  const rows=await many(`SELECT r.row_number,r.external_row_reference,r.outcome,r.reason,c.customer_reference,l.lead_reference FROM purchased_data_import_rows r LEFT JOIN contacts c ON c.id=r.contact_id LEFT JOIN leads l ON l.id=r.lead_id WHERE r.batch_id=$1 ORDER BY r.row_number`,[batch.id]),quote=value=>`"${String(value??'').replaceAll('"','""')}"`,csv=['row_number,external_row_reference,outcome,customer_reference,lead_reference,reason',...rows.map(row=>[row.rowNumber,row.externalRowReference,row.outcome,row.customerReference,row.leadReference,row.reason].map(quote).join(','))].join('\r\n');
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="${batch.batchReference}-reconciliation.csv"`);res.end(csv);
});

r.post('/crm/purchased-data-import/:moduleType/preview',async(req,res)=>{
  if(!authority(req.broker))return res.status(403).json({error:'Purchased-data import is limited to Sales Agent and Admin roles'});
  const moduleType=req.params.moduleType;if(!['customer_only','lead'].includes(moduleType))return res.status(404).json({error:'Import module not found'});
  const file=decode(req);if(file.error)return res.status(400).json({error:file.error});
  try{
    const parsed=await parsePurchasedWorkbook(file.buffer,moduleType),meta=normalizeMeta(parsed.metadata),error=metadataError(meta);if(error)return res.status(400).json({error});
    const rows=validatePurchasedRows(parsed.rows,validationOptions(moduleType,meta,await priorRows(meta),await identities())),payload=previewPayload(moduleType,meta,file.fileHash,rows),previewHash=hash(payload),invalidCount=rows.filter(x=>x.action==='invalid').length,reviewCount=rows.filter(x=>x.action==='review_required').length,phoneConfirmationCount=rows.filter(x=>x.action==='phone_confirmation').length,skippedCount=rows.filter(x=>x.action==='skipped').length,readyCount=rows.length-invalidCount-reviewCount;
    res.json({...payload,fileName:file.fileName,fileSizeBytes:file.buffer.length,contractVersion:PURCHASED_DATA_IMPORT_VERSION,rowCount:rows.length,readyCount,invalidCount,reviewCount,phoneConfirmationCount,skippedCount,valid:readyCount>0,previewHash,reviewToken:token({previewHash,moduleType,meta,fileHash:file.fileHash},req.token),rows});
  }catch(error){res.status(400).json({error:`Workbook could not be reviewed: ${error.message}`});}
});

r.post('/crm/purchased-data-import/:moduleType/commit',async(req,res)=>{
  if(!authority(req.broker))return res.status(403).json({error:'Purchased-data import is limited to Sales Agent and Admin roles'});
  const moduleType=req.params.moduleType;if(!['customer_only','lead'].includes(moduleType))return res.status(404).json({error:'Import module not found'});
  const file=decode(req);if(file.error)return res.status(400).json({error:file.error});
  let parsed,meta,validated,payload,previewHash;
  try{
    parsed=await parsePurchasedWorkbook(file.buffer,moduleType);meta=normalizeMeta(parsed.metadata);const error=metadataError(meta);if(error)return res.status(400).json({error});
    validated=validatePurchasedRows(parsed.rows,validationOptions(moduleType,meta,await priorRows(meta),await identities()));payload=previewPayload(moduleType,meta,file.fileHash,validated);previewHash=hash(payload);
  }catch(error){return res.status(400).json({error:`Workbook could not be confirmed: ${error.message}`});}
  const submittedDecisions=new Map((Array.isArray(req.body?.rowDecisions)?req.body.rowDecisions:[]).map(item=>[Number(item.rowNumber),{include:Boolean(item.include),phoneAction:clean(item.phoneAction),exclusionReason:clean(item.exclusionReason)}])),decisionFor=row=>submittedDecisions.get(row.rowNumber)||{include:!['invalid','review_required'].includes(row.action),phoneAction:'',exclusionReason:''};
  const selected=validated.filter(row=>decisionFor(row).include);
  if(!selected.length)return res.status(400).json({error:'Select at least one valid row to import'});
  if(selected.some(row=>['invalid','review_required'].includes(row.action))||selected.some(row=>row.action==='phone_confirmation'&&!['link_existing','link_batch_phone','create_separate'].includes(decisionFor(row).phoneAction))||!equal(previewHash,req.body?.previewHash)||!equal(req.body?.reviewToken,token({previewHash,moduleType,meta,fileHash:file.fileHash},req.token)))return res.status(409).json({error:'The selected rows, phone confirmations or workbook identity changed after preview; review the workbook again'});
  const existing=await one(`SELECT * FROM purchased_data_import_batches WHERE module_type=$1 AND source_system_code=$2 AND acquisition_batch_reference=$3 AND file_hash=$4 AND status='completed'`,[moduleType,meta.sourceSystemCode,meta.acquisitionBatchReference,file.fileHash]);
  if(existing)return res.json({batchId:existing.id,batchReference:existing.batchReference,replayed:true,outcomes:await many(`SELECT r.row_number,r.external_row_reference,r.outcome,c.customer_reference,l.lead_reference FROM purchased_data_import_rows r LEFT JOIN contacts c ON c.id=r.contact_id LEFT JOIN leads l ON l.id=r.lead_id WHERE r.batch_id=$1 ORDER BY r.row_number`,[existing.id])});
  const storageKey=await savePrivate(file.buffer,'.xlsx');
  try{
    const result=await transaction(async client=>{
      await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${moduleType}:${meta.sourceSystemCode}:${meta.acquisitionBatchReference}`],client);
      const fresh=validatePurchasedRows(parsed.rows,validationOptions(moduleType,meta,await priorRows(meta,client),await identities(client))),freshSelected=fresh.filter(row=>decisionFor(row).include);if(freshSelected.some(row=>['invalid','review_required'].includes(row.action))||freshSelected.some(row=>row.action==='phone_confirmation'&&!['link_existing','link_batch_phone','create_separate'].includes(decisionFor(row).phoneAction)))return{code:409,error:'Identity or validation state changed after preview; review the workbook again'};
      const batchId=uuid(),batchReference=`PDI-${new Date().getUTCFullYear()}-${batchId.slice(0,8).toUpperCase()}`;
      await execute(`INSERT INTO purchased_data_import_batches(id,batch_reference,module_type,source_system_code,supplier_name,acquisition_batch_reference,acquisition_date,campaign_reference,processing_basis,original_file_name,media_type,file_size_bytes,file_hash,preview_hash,storage_key,status,row_count,uploaded_by,confirmed_by,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'processing',$16,$17,$17,NOW())`,[batchId,batchReference,moduleType,meta.sourceSystemCode,meta.supplierName,meta.acquisitionBatchReference,meta.acquisitionDate,meta.campaignReference,meta.processingBasis,file.fileName,XLSX,file.buffer.length,file.fileHash,previewHash,storageKey,fresh.length,req.broker.id],client);
      const outcomes=[],createdByPhone=new Map();
      for(const row of fresh){
        const rowDecision=decisionFor(row);let contact=row.matchedContact,lead=null,outcome=row.action;
        if(!rowDecision.include){const reason=rowDecision.exclusionReason||(['invalid','review_required'].includes(row.action)?row.errors.join('; '):'Excluded by importer after preview');await execute(`INSERT INTO purchased_data_import_rows(id,batch_id,row_number,external_row_reference,outcome,reason,normalized_payload) VALUES($1,$2,$3,$4,'excluded',$5,$6)`,[uuid(),batchId,row.rowNumber,row.externalRowReference,reason,{moduleType,sourceSystemCode:meta.sourceSystemCode,acquisitionBatchReference:meta.acquisitionBatchReference}],client);outcomes.push({rowNumber:row.rowNumber,externalRowReference:row.externalRowReference,outcome:'excluded',reason});continue;}
        if(row.action==='phone_confirmation'){
          if(rowDecision.phoneAction==='create_separate'){contact=null;outcome='create';}
          else if(rowDecision.phoneAction==='link_batch_phone'){
            contact=createdByPhone.get(row.normalized.phone)||null;
            if(!contact)return{code:409,error:`Row ${row.rowNumber}: select “create Customer” on an earlier row with this phone before linking another row to it`};
            outcome=moduleType==='customer_only'?'linked':'create';
          }else if(!contact)return{code:409,error:`Row ${row.rowNumber}: no existing Customer is available for this phone confirmation`};
          else outcome=moduleType==='customer_only'?'linked':'create';
        }
        if(row.action==='skipped'){
          await execute(`INSERT INTO purchased_data_import_rows(id,batch_id,row_number,external_row_reference,outcome,normalized_payload) VALUES($1,$2,$3,$4,'skipped',$5)`,[uuid(),batchId,row.rowNumber,row.externalRowReference,{moduleType,sourceSystemCode:meta.sourceSystemCode,acquisitionBatchReference:meta.acquisitionBatchReference}],client);
          outcomes.push({rowNumber:row.rowNumber,externalRowReference:row.externalRowReference,outcome:'skipped'});continue;
        }
        if(moduleType==='customer_only'&&!contact){
          const contactId=uuid(),customerReference=`NYSA-CUS-${new Date().getUTCFullYear()}-${contactId.slice(0,8).toUpperCase()}`,v=row.normalized,preferred=['Phone','Email','WhatsApp','SMS'].includes(clean(v.preferredChannel))?clean(v.preferredChannel):null,restricted=['do_not_contact','restricted'].includes(clean(v.restrictionStatus));
          contact=await one(`INSERT INTO contacts(id,customer_reference,full_name,email,phone,preferred_channel,notes,owner_id,created_by,email_status,phone_status,do_not_contact,lifecycle_status) VALUES($1,$2,$3,$4,$5,$6,$7,NULL,$8,'unverified','unverified',$9,$10) RETURNING *`,[contactId,customerReference,clean(v.fullName),v.email||null,v.phone||null,preferred,clean(v.sourceNotes)||null,req.broker.id,restricted?1:0,restricted?'restricted':'active'],client);
          for(const [kind,raw,normalized] of [['Email',v.email,v.email],['Phone',v.phone,v.phone]])if(raw)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,restriction_status,created_by) VALUES($1,$2,$3,$4,$5,$6,1,'unverified',$7,$8)`,[uuid(),contact.id,kind,raw,normalized,kind==='Phone'&&preferred==='WhatsApp'?1:0,restricted?'do_not_contact':'allowed',req.broker.id],client);
          outcome='created';
          if(v.phone&&!createdByPhone.has(v.phone))createdByPhone.set(v.phone,contact);
        }
        if(moduleType==='lead'){
          const v=row.normalized;if(!contact){const contactId=uuid(),customerReference=`NYSA-CUS-${new Date().getUTCFullYear()}-${contactId.slice(0,8).toUpperCase()}`;contact=await one(`INSERT INTO contacts(id,customer_reference,full_name,email,phone,owner_id,created_by,email_status,phone_status,lifecycle_status) VALUES($1,$2,$3,$4,$5,NULL,$6,'unverified','unverified','active') RETURNING *`,[contactId,customerReference,clean(v.fullName),v.email||null,v.phone||null,req.broker.id],client);for(const [kind,value] of [['Email',v.email],['Phone',v.phone]])if(value)await execute(`INSERT INTO contact_channels(id,contact_id,channel_kind,usage_label,raw_value,normalized_value,is_primary,verification_status,created_by) VALUES($1,$2,$3,'Primary',$4,$4,1,'unverified',$5)`,[uuid(),contact.id,kind,value,req.broker.id],client);if(v.phone&&!createdByPhone.has(v.phone))createdByPhone.set(v.phone,contact);}
          const receivedAt=new Date(),primary=await resolvePrimaryRoutingArea(null,v.preferredAreas,client);if(primary.error)return{code:409,error:`Row ${row.rowNumber}: ${primary.error}`};
          const rule=await selectRoutingRule({source:'Purchased data',businessType:clean(v.businessType),primaryAreaId:primary.areaId},client),due=await calculateDeadlines(receivedAt,client),leadId=uuid(),stableId=`${meta.sourceSystemCode}:${meta.acquisitionBatchReference}:${row.externalRowReference}`;
          lead=await one(`INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,preferred_areas,primary_routing_area_id,assigned_team_id,assigned_to,assignment_status,received_at,external_source_id,campaign_code,assignment_due_at,original_acceptance_due_at,acceptance_due_at,first_contact_due_at,sla_policy_id,created_by) VALUES($1,$2,$3,'Purchased data',$4,'New','Unassessed',$5,$6,$7,NULL,'unassigned',$8,$9,$10,$11,$11,$11,$12,$13,$14) RETURNING *`,[leadId,contact.id,clean(v.leadTitle),clean(v.businessType),v.preferredAreas.join(', ')||null,primary.areaId,rule?.teamId||null,receivedAt,stableId,clean(v.campaignReference)||meta.campaignReference,due.acceptanceDueAt,due.firstContactDueAt,due.policy?.id||null,req.broker.id],client);
          await execute('UPDATE leads SET routing_reason=$1,last_queue_entered_at=received_at WHERE id=$2',[rule?`Matched routing rule: ${rule.name}`:'Company unassigned fallback',lead.id],client);
          await execute(`INSERT INTO lead_assignments(id,lead_id,sequence_no,team_id,status,acceptance_due_at,assigned_by) VALUES($1,$2,1,$3,'queued',$4,$5)`,[uuid(),lead.id,rule?.teamId||null,due.acceptanceDueAt,req.broker.id],client);
          await execute(`INSERT INTO lead_stage_history(id,lead_id,to_stage,changed_by) VALUES($1,$2,'New',$3)`,[uuid(),lead.id,req.broker.id],client);
          const enriched=[v.budgetMin,v.budgetMax,v.preferredAreas.length,clean(v.propertyType),v.bedroomsMin,clean(v.objective),clean(v.purpose),clean(v.timeline)].some(value=>value!==null&&value!==''&&value!==0);
          if(enriched)await execute(`INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,property_types,areas,budget_min,budget_max,funding_method,bedrooms_min,bedrooms_max,timeline_code,notes,created_by,customer_objective,market_stage_requirement,property_segment_requirement,classification_version)
            VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,'unknown',$9,$9,$10,$11,$12,$13,$14,$15,'purchased-data-v1')`,[uuid(),lead.id,clean(v.businessType),clean(v.purpose),clean(v.propertyType)?[clean(v.propertyType)]:[],v.preferredAreas,v.budgetMin,v.budgetMax,v.bedroomsMin,clean(v.timeline),clean(v.sourceNotes)||null,req.broker.id,clean(v.objective)||'not_confirmed',clean(v.businessType)==='Off-plan'?'off_plan':'not_confirmed',clean(v.businessType)==='Commercial'?'commercial':'not_confirmed'],client);
          outcome='created';
        }
        const storedPayload={moduleType,sourceSystemCode:meta.sourceSystemCode,acquisitionBatchReference:meta.acquisitionBatchReference};
        await execute(`INSERT INTO purchased_data_import_rows(id,batch_id,row_number,external_row_reference,outcome,contact_id,lead_id,normalized_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[uuid(),batchId,row.rowNumber,row.externalRowReference,outcome,contact.id,lead?.id||null,storedPayload],client);
        outcomes.push({rowNumber:row.rowNumber,externalRowReference:row.externalRowReference,outcome,customerReference:contact.customerReference,contactId:contact.id,leadReference:lead?.leadReference||null,leadId:lead?.id||null});
      }
      const counts=Object.fromEntries(['created','linked','skipped','excluded'].map(status=>[status,outcomes.filter(item=>item.outcome===status).length]));
      await execute("UPDATE purchased_data_import_batches SET status='completed',created_count=$1,linked_count=$2,skipped_count=$3,excluded_count=$4,completed_at=NOW() WHERE id=$5",[counts.created,counts.linked,counts.skipped,counts.excluded,batchId],client);
      await audit('PurchasedDataImport',batchId,'completed',req.broker.id,{batchReference,moduleType,rowCount:outcomes.length,...counts},client);return{batchId,batchReference,outcomes};
    });
    if(result.error){await removePrivate(storageKey);return res.status(result.code||409).json({error:result.error});}res.status(201).json(result);
  }catch(error){await removePrivate(storageKey);throw error;}
});

export default r;
