import { Router } from '../lib/http-kit.js';
import { audit, execute, many, one, transaction, uuid } from '../db.js';
import { requireAuth } from '../auth.js';
import { LISTING_MAPPING_FIELDS, validateMappingEntry, validateMappingTransition, validateMappingVersion } from '../listing-mapping-domain.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>req.broker.role==='admin'?next():res.status(403).json({error:'Full Administrator access is required for provider mappings'}));
async function coreOptions(fieldCode,client){
  if(fieldCode==='areaCode')return (await many("SELECT stable_code AS value,business_label AS label FROM areas WHERE active=1 ORDER BY display_order,business_label",[],client));
  return (LISTING_MAPPING_FIELDS[fieldCode]?.values||[]).map(value=>({value,label:value}));
}

r.get('/admin/listing-mappings',async(req,res)=>{
  const versions=await many(`SELECT v.*,creator.name AS created_by_name,tester.name AS tested_by_name,approver.name AS approved_by_name,activator.name AS activated_by_name,
    (SELECT COUNT(*)::int FROM listing_value_mappings m WHERE m.version_id=v.id) AS mapping_count
    FROM listing_mapping_versions v JOIN brokers creator ON creator.id=v.created_by
    LEFT JOIN brokers tester ON tester.id=v.tested_by LEFT JOIN brokers approver ON approver.id=v.approved_by LEFT JOIN brokers activator ON activator.id=v.activated_by
    ORDER BY v.provider_code,v.created_at DESC`);
  const entries=await many('SELECT * FROM listing_value_mappings ORDER BY field_code,LOWER(external_value)');
  const fields=[];for(const [code,definition] of Object.entries(LISTING_MAPPING_FIELDS))fields.push({code,label:definition.label,options:await coreOptions(code)});
  res.json({versions,entries,fields});
});

r.post('/admin/listing-mappings',async(req,res)=>{
  const checked=validateMappingVersion(req.body);if(checked.error)return res.status(400).json({error:checked.error});const b=checked.value;
  try{const row=await transaction(async client=>{
    if(b.cloneFromId){const source=await one('SELECT id FROM listing_mapping_versions WHERE id=$1',[b.cloneFromId],client);if(!source)throw Object.assign(new Error('Mapping version to copy was not found'),{status:404});}
    const created=await one(`INSERT INTO listing_mapping_versions(id,provider_code,version_code,name,description,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[uuid(),b.providerCode,b.versionCode,b.name,b.description,req.broker.id],client);
    if(b.cloneFromId){const copied=await many('SELECT field_code,external_value,core_value FROM listing_value_mappings WHERE version_id=$1',[b.cloneFromId],client);for(const entry of copied)await execute('INSERT INTO listing_value_mappings(id,version_id,field_code,external_value,core_value,created_by) VALUES($1,$2,$3,$4,$5,$6)',[uuid(),created.id,entry.fieldCode,entry.externalValue,entry.coreValue,req.broker.id],client);}
    await audit('ListingMappingVersion',created.id,'draft_created',req.broker.id,{providerCode:b.providerCode,versionCode:b.versionCode,cloneFromId:b.cloneFromId},client);return created;
  });res.status(201).json(row);}catch(error){if(error.code==='23505')return res.status(409).json({error:'This provider and mapping version already exists'});if(error.status)return res.status(error.status).json({error:error.message});throw error;}
});

r.post('/admin/listing-mappings/:versionId/entries',async(req,res)=>{
  const version=await one('SELECT * FROM listing_mapping_versions WHERE id=$1',[req.params.versionId]);if(!version)return res.status(404).json({error:'Mapping version not found'});if(version.status!=='draft')return res.status(409).json({error:'Only Draft mapping versions can be edited'});
  const options=await coreOptions(req.body?.fieldCode),checked=validateMappingEntry(req.body,options.map(item=>item.value));if(checked.error)return res.status(400).json({error:checked.error});const b=checked.value;
  try{const row=await one('INSERT INTO listing_value_mappings(id,version_id,field_code,external_value,core_value,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[uuid(),version.id,b.fieldCode,b.externalValue,b.coreValue,req.broker.id]);await audit('ListingValueMapping',row.id,'created',req.broker.id,{versionId:version.id,...b});res.status(201).json(row);}catch(error){if(error.code==='23505')return res.status(409).json({error:'This external value is already mapped for the selected field'});throw error;}
});

r.delete('/admin/listing-mappings/:versionId/entries/:entryId',async(req,res)=>{
  const row=await one(`DELETE FROM listing_value_mappings m USING listing_mapping_versions v WHERE m.id=$1 AND m.version_id=$2 AND v.id=m.version_id AND v.status='draft' RETURNING m.id`,[req.params.entryId,req.params.versionId]);
  if(!row)return res.status(409).json({error:'Only entries in a Draft mapping version can be deleted'});await audit('ListingValueMapping',row.id,'draft_deleted',req.broker.id,{versionId:req.params.versionId});res.json({ok:true});
});

r.post('/admin/listing-mappings/:versionId/:action',async(req,res)=>{
  const action=req.params.action;if(!['test','approve','activate','retire'].includes(action))return res.status(404).json({error:'Unknown mapping lifecycle action'});
  const current=await one('SELECT * FROM listing_mapping_versions WHERE id=$1',[req.params.versionId]);if(!current)return res.status(404).json({error:'Mapping version not found'});
  const checked=validateMappingTransition(current.status,action,req.body);if(checked.error)return res.status(409).json({error:checked.error});const step=checked.value;
  const entries=await many('SELECT * FROM listing_value_mappings WHERE version_id=$1',[current.id]);if(action==='test'&&!entries.length)return res.status(400).json({error:'Add at least one mapping before testing this version'});
  if(['test','activate'].includes(action))for(const entry of entries){const options=await coreOptions(entry.fieldCode);if(!options.some(option=>option.value===entry.coreValue))return res.status(400).json({error:`${entry.fieldCode}: ${entry.coreValue} is no longer an active governed CORE value`});}
  const actorColumn={test:'tested_by',approve:'approved_by',activate:'activated_by',retire:'retired_by'}[action],timeColumn={test:'tested_at',approve:'approved_at',activate:'activated_at',retire:'retired_at'}[action],evidenceColumn={test:'test_evidence',approve:'approval_evidence'}[action];
  const updated=await transaction(async client=>{
    await execute('SELECT pg_advisory_xact_lock(hashtext($1))',[current.providerCode],client);
    if(action==='activate')await execute("UPDATE listing_mapping_versions SET status='retired',retired_by=$1,retired_at=NOW(),effective_to=NOW(),replaced_by_version_id=$4,lifecycle_reason=$2 WHERE provider_code=$3 AND status='active' AND id<>$4",[req.broker.id,`Replaced by ${current.versionCode}`,current.providerCode,current.id],client);
    const params=[step.nextStatus,step.reason,req.broker.id,current.id],sets=[`status=$1`,`lifecycle_reason=$2`,`${actorColumn}=$3`,`${timeColumn}=NOW()`];if(action==='activate')sets.push('effective_from=NOW()');if(action==='retire')sets.push('effective_to=NOW()');if(evidenceColumn){params.splice(3,0,step.evidence);sets.push(`${evidenceColumn}=$4`);params[params.length-1]=current.id;}
    const row=await one(`UPDATE listing_mapping_versions SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,params,client);
    await audit('ListingMappingVersion',row.id,action==='test'?'tested':`${action}d`,req.broker.id,{from:current.status,to:step.nextStatus,reason:step.reason,evidence:step.evidence,mappingCount:entries.length},client);return row;
  });res.json(updated);
});

export default r;
