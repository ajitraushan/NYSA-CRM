import { Router } from '../lib/http-kit.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { requireAuth } from '../auth.js';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { decodeAndValidateFile,savePrivate,removePrivate } from '../private-files.js';
import {
  PARTNER_COMPANY_ROLE,findPartnerOrganizationDuplicates,validatePartnerDuplicateDecision,
  validatePartnerOrganizationVersionInput,validatePartnerVerificationDecision
} from '../partner-organization-domain.js';

const r=Router();
r.use(requireAuth);
const isAdmin=broker=>broker.role==='admin';
const isGovernanceAuthority=broker=>isAdmin(broker)||['manager','director'].includes(broker.jobRole);
const canCreateGovernanceDraft=broker=>isGovernanceAuthority(broker)||broker.jobRole==='listing_agent';
const canReadGovernance=broker=>canCreateGovernanceDraft(broker)||broker.jobRole==='admin_assistant';
const clean=value=>String(value??'').trim();
const evidenceDigest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const meaningful=(value,label,min=3)=>{const text=clean(value);return text.length>=min?text:{error:`${label} is required`};};
const dateOnly=(value,label,required=true)=>{const text=clean(value);if(!text&&!required)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(Date.parse(`${text}T00:00:00Z`)))return{error:`${label} must be a valid date`};return text;};

async function immutableEvidenceDocument({file,documentType,title,companyId,listingId,brokerId},client){
  const documentId=uuid(),documentVersionId=uuid(),documentReference=`DOC-${Date.now()}-${documentId.slice(0,8)}`,key=await savePrivate(file.buffer,path.extname(file.fileName));
  try{
    await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,listing_id)
      VALUES($1,$2,$3,$4,'Inbound','restricted','active',$5,$5,$6)`,[documentId,documentReference,documentType,title,brokerId,listingId||null],client);
    await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by,received_at)
      VALUES($1,$2,1,$3,'application/pdf',$4,$5,$6,1,'upload','restricted','received',$7,$7,NOW())`,[documentVersionId,documentId,file.fileName,file.buffer.length,key,file.fileHash,brokerId],client);
    await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES($1,$2,'Company',$3,$4)`,[uuid(),documentId,companyId,brokerId],client);
    if(listingId)await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES($1,$2,'Listing',$3,$4) ON CONFLICT DO NOTHING`,[uuid(),documentId,listingId,brokerId],client);
    await audit('DocumentVersion',documentVersionId,'uploaded',brokerId,{documentId,version:1,hash:file.fileHash,direction:'Inbound',classification:'restricted',status:'received'},client);
    return{documentVersionId,key,fileHash:file.fileHash};
  }catch(error){await removePrivate(key);throw error;}
}

async function duplicateCandidates(value,companyId,client){
  const governed=await many(`SELECT v.company_id,c.name,v.legal_name,v.normalized_legal_name,v.licence_reference,
      v.normalized_licence_reference,v.classification,v.status
    FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id
    WHERE v.company_id<>$1 AND c.archived_at IS NULL AND c.status<>'merged'
      AND v.status NOT IN ('duplicate_closed','retired')`,[companyId],client);
  const ungoverned=await many(`SELECT c.id AS company_id,c.name,c.legal_name,c.trade_license_number AS licence_reference,'active' AS status
    FROM companies c WHERE c.id<>$1 AND c.archived_at IS NULL AND c.status<>'merged'
      AND NOT EXISTS(SELECT 1 FROM partner_organization_versions v WHERE v.company_id=c.id AND v.status NOT IN ('duplicate_closed','retired'))`,[companyId],client);
  return findPartnerOrganizationDuplicates(value,[...governed,...ungoverned]);
}

r.get('/admin/partner-organizations',async(req,res)=>{
  if(!canReadGovernance(req.broker))return res.status(403).json({error:'Listing Executive, Manager, Director, Administrator or Admin Assistant access required'});
  const params=[],ownerFilter=req.broker.jobRole==='listing_agent'?(params.push(req.broker.id),' AND c.owner_id=$1'):'';
  const rows=await many(`SELECT c.id AS company_id,c.name,c.company_type,c.status,
      active.id AS active_version_id,active.version_number AS active_version_number,active.classification AS active_classification,
      open.id AS open_version_id,open.version_number AS open_version_number,open.status AS open_status
    FROM companies c
    LEFT JOIN partner_organization_versions active ON active.company_id=c.id AND active.status='active'
    LEFT JOIN partner_organization_versions open ON open.company_id=c.id AND open.status IN ('duplicate_review','pending_verification')
    WHERE c.archived_at IS NULL AND c.status<>'merged'${ownerFilter}
    ORDER BY LOWER(c.name),c.id`,params);
  res.json({partnerOrganizations:rows.map(row=>({...row,governanceStatus:row.openStatus|| (row.activeVersionId?'active':'not_governed')}))});
});

r.get('/admin/partner-organizations/:companyId',async(req,res)=>{
  if(!canReadGovernance(req.broker))return res.status(403).json({error:'Listing Executive, Manager, Director, Administrator or Admin Assistant access required'});
  const params=[req.params.companyId],ownerFilter=req.broker.jobRole==='listing_agent'?(params.push(req.broker.id),' AND owner_id=$2'):'';
  const company=await one(`SELECT id AS company_id,name,company_type,status FROM companies
    WHERE id=$1 AND archived_at IS NULL AND status<>'merged'${ownerFilter}`,params);
  if(!company)return res.status(404).json({error:'Company not found'});
  const versions=await many(`SELECT id,version_number,policy_version,classification,legal_structure,legal_name,trade_name,licence_reference,
      licence_issuer,licence_expires_at,licence_evidence_status,source_evidence_reference,status,supersedes_version_id,
      created_by,created_at,duplicate_decision,duplicate_company_id,duplicate_reason,duplicate_reviewed_at,
      verification_decision,verification_reason,verified_at,retirement_reason,retired_at
    FROM partner_organization_versions WHERE company_id=$1 ORDER BY version_number DESC`,[company.companyId]);
  const arrangements=await many(`SELECT a.*,dv.file_name,dv.file_hash,p.version_number AS partner_version_number
    FROM developer_brokerage_arrangement_versions a
    JOIN partner_organization_versions p ON p.id=a.partner_version_id
    JOIN document_versions dv ON dv.id=a.document_version_id
    WHERE p.company_id=$1 ORDER BY a.created_at DESC`,[company.companyId]);
  const listingNocs=await many(`SELECT n.*,dv.file_name,dv.file_hash,l.inventory_reference,l.inventory_headline,l.project,
      p.version_number AS partner_version_number
    FROM property_listing_noc_versions n
    JOIN partner_organization_versions p ON p.id=n.partner_version_id
    JOIN listings l ON l.id=n.listing_id
    JOIN document_versions dv ON dv.id=n.document_version_id
    WHERE p.company_id=$1 ORDER BY n.created_at DESC`,[company.companyId]);
  const eligibleInventories=await many(`WITH latest AS (
      SELECT DISTINCT ON (e.listing_id) e.listing_id,e.partner_version_id,e.action
      FROM inventory_organization_link_events e WHERE e.relationship='developer'
      ORDER BY e.listing_id,e.performed_at DESC,e.id DESC)
    SELECT l.id,l.inventory_reference,l.inventory_headline,l.project FROM latest x
    JOIN partner_organization_versions p ON p.id=x.partner_version_id
    JOIN listings l ON l.id=x.listing_id
    WHERE p.company_id=$1 AND x.action<>'unlinked' AND l.deleted_at IS NULL
    ORDER BY LOWER(COALESCE(l.inventory_headline,l.project)),l.id`,[company.companyId]);
  res.json({company,versions:versions.map(version=>({...version,createdByCurrentUser:version.createdBy===req.broker.id})),
    arrangements:arrangements.map(item=>({...item,createdByCurrentUser:item.createdBy===req.broker.id})),
    listingNocs:listingNocs.map(item=>({...item,createdByCurrentUser:item.createdBy===req.broker.id})),eligibleInventories});
});

r.post('/admin/partner-organizations/:companyId/versions',async(req,res)=>{
  if(!canCreateGovernanceDraft(req.broker))return res.status(403).json({error:'Listing Executive, Manager, Director or Administrator authority is required'});
  const checked=validatePartnerOrganizationVersionInput(req.body||{});
  if(!checked.valid)return res.status(400).json({error:checked.errors[0],errors:checked.errors});
  const result=await transaction(async client=>{
    const listingExecutiveOwner=req.broker.jobRole==='listing_agent'?req.broker.id:null,company=await one(`SELECT id,name,status FROM companies WHERE id=$1 AND archived_at IS NULL AND ($2::uuid IS NULL OR owner_id=$2) FOR UPDATE`,[req.params.companyId,listingExecutiveOwner],client);
    if(!company)return{code:404,error:'Company not found'};
    if(company.status!=='active')return{code:409,error:'Only an active existing Company can receive a governed version'};
    if(await one(`SELECT id FROM partner_organization_versions WHERE company_id=$1 AND status IN ('duplicate_review','pending_verification')`,[company.id],client))return{code:409,error:'This Company already has an open governed version'};
    const latest=await one('SELECT COALESCE(MAX(version_number),0)::int AS version_number FROM partner_organization_versions WHERE company_id=$1',[company.id],client);
    const prior=await one("SELECT id FROM partner_organization_versions WHERE company_id=$1 AND status='active'",[company.id],client);
    const duplicates=await duplicateCandidates(checked.value,company.id,client),status=duplicates.length?'duplicate_review':isGovernanceAuthority(req.broker)?'active':'pending_verification',id=uuid(),sourceEvidenceSha256=evidenceDigest({
      policyVersion:checked.value.policyVersion,classification:checked.value.classification,legalStructure:checked.value.legalStructure,
      legalName:checked.value.legalName,tradeName:checked.value.tradeName,licenceReference:checked.value.licenceReference,
      licenceIssuer:checked.value.licenceIssuer,licenceExpiresAt:checked.value.licenceExpiresAt,sourceEvidenceReference:checked.value.sourceEvidenceReference
    });
    if(status==='active'&&prior)await execute("UPDATE partner_organization_versions SET status='superseded' WHERE id=$1",[prior.id],client);
    const version=await one(`INSERT INTO partner_organization_versions(
      id,company_id,version_number,policy_version,classification,legal_structure,legal_name,normalized_legal_name,trade_name,
      licence_reference,normalized_licence_reference,licence_issuer,licence_expires_at,licence_evidence_status,
      source_evidence_reference,source_evidence_sha256,status,supersedes_version_id,created_by,verification_decision,verification_reason,verified_by,verified_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,[
      id,company.id,Number(latest.versionNumber||0)+1,checked.value.policyVersion,checked.value.classification,checked.value.legalStructure,
      checked.value.legalName,checked.value.normalizedLegalName,checked.value.tradeName,checked.value.licenceReference,checked.value.normalizedLicenceReference,
      checked.value.licenceIssuer,checked.value.licenceExpiresAt,checked.value.licenceEvidenceStatus,checked.value.sourceEvidenceReference,
      sourceEvidenceSha256,status,prior?.id||null,req.broker.id,status==='active'?'activated':null,status==='active'?'Auto-activated by authorized creator':null,
      status==='active'?req.broker.id:null,status==='active'?new Date().toISOString():null],client);
    if(status==='active'){
      await execute(`INSERT INTO external_company_roles(id,company_id,role_code,is_primary,created_by)
        VALUES($1,$2,$3,0,$4) ON CONFLICT (company_id,role_code) WHERE status='active' DO NOTHING`,[uuid(),company.id,PARTNER_COMPANY_ROLE[checked.value.classification],req.broker.id],client);
    }
    await audit('PartnerOrganization',version.id,status==='active'?'verification_auto_activated':'draft_created',req.broker.id,{companyId:company.id,companyName:company.name,versionNumber:version.versionNumber,classification:version.classification,legalStructure:version.legalStructure,status,duplicateMatchCount:duplicates.length,sourceEvidenceSha256,requiresIndependentVerification:status==='pending_verification'},client);
    return{version,duplicates};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.status(201).json(result);
});

r.post('/admin/partner-organization-versions/:versionId/duplicate-decision',async(req,res)=>{
  if(!isAdmin(req.broker))return res.status(403).json({error:'Administrator access required'});
  const checked=validatePartnerDuplicateDecision(req.body||{});
  if(!checked.valid)return res.status(400).json({error:checked.errors[0],errors:checked.errors});
  const result=await transaction(async client=>{
    const version=await one('SELECT * FROM partner_organization_versions WHERE id=$1 FOR UPDATE',[req.params.versionId],client);
    if(!version)return{code:404,error:'Governed organization version not found'};
    if(version.status!=='duplicate_review')return{code:409,error:'Only a duplicate-review version can receive this decision'};
    if(version.createdBy===req.broker.id)return{code:403,error:'The draft creator cannot decide its duplicate review'};
    if(checked.value.decision==='use_existing'){
      const existing=await one(`SELECT id FROM companies WHERE id=$1 AND id<>$2 AND archived_at IS NULL AND status<>'merged'`,[checked.value.existingCompanyId,version.companyId],client);
      if(!existing)return{code:400,error:'Select a valid different existing Company'};
    }
    const status=checked.value.decision==='use_existing'?'duplicate_closed':'pending_verification';
    const updated=await one(`UPDATE partner_organization_versions SET status=$1,duplicate_decision=$2,duplicate_company_id=$3,
      duplicate_reason=$4,duplicate_reviewed_by=$5,duplicate_reviewed_at=NOW() WHERE id=$6 RETURNING *`,[
      status,checked.value.decision,checked.value.existingCompanyId,checked.value.reason,req.broker.id,version.id],client);
    await audit('PartnerOrganization',version.id,'duplicate_review_decided',req.broker.id,{companyId:version.companyId,versionNumber:version.versionNumber,decision:checked.value.decision,existingCompanyId:checked.value.existingCompanyId,reason:checked.value.reason},client);
    return{version:updated};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/admin/partner-organization-versions/:versionId/verification',async(req,res)=>{
  if(!isAdmin(req.broker))return res.status(403).json({error:'Administrator access required'});
  const result=await transaction(async client=>{
    const version=await one('SELECT * FROM partner_organization_versions WHERE id=$1 FOR UPDATE',[req.params.versionId],client);
    if(!version)return{code:404,error:'Governed organization version not found'};
    if(version.status!=='pending_verification')return{code:409,error:'Only a pending governed version can be verified'};
    if(version.createdBy===req.broker.id)return{code:403,error:'The draft creator cannot verify or reject this version'};
    const checked=validatePartnerVerificationDecision(req.body||{},version,new Date().toISOString());
    if(!checked.valid)return{code:400,error:checked.errors[0],errors:checked.errors};
    if(checked.value.decision==='reject'){
      const rejected=await one(`UPDATE partner_organization_versions SET status='rejected',verification_decision='rejected',
        verification_reason=$1,verified_by=$2,verified_at=NOW() WHERE id=$3 RETURNING *`,[checked.value.reason,req.broker.id,version.id],client);
      await audit('PartnerOrganization',version.id,'verification_rejected',req.broker.id,{companyId:version.companyId,versionNumber:version.versionNumber,reason:checked.value.reason},client);
      return{version:rejected};
    }
    const candidate={normalizedLegalName:version.normalizedLegalName,normalizedLicenceReference:version.normalizedLicenceReference};
    const duplicates=await duplicateCandidates(candidate,version.companyId,client);
    if(duplicates.length&&version.duplicateDecision!=='continue_distinct'){
      await execute("UPDATE partner_organization_versions SET status='duplicate_review' WHERE id=$1",[version.id],client);
      return{code:409,error:'New duplicate evidence requires an independent duplicate decision before activation',duplicates};
    }
    const prior=await one("SELECT id,version_number FROM partner_organization_versions WHERE company_id=$1 AND status='active' FOR UPDATE",[version.companyId],client);
    if(prior){await execute("UPDATE partner_organization_versions SET status='superseded' WHERE id=$1",[prior.id],client);await audit('PartnerOrganization',prior.id,'version_superseded',req.broker.id,{companyId:version.companyId,versionNumber:prior.versionNumber,supersededByVersion:version.versionNumber},client);}
    const activated=await one(`UPDATE partner_organization_versions SET status='active',verification_decision='activated',
      verification_reason=$1,verified_by=$2,verified_at=NOW() WHERE id=$3 RETURNING *`,[checked.value.reason,req.broker.id,version.id],client);
    const role=PARTNER_COMPANY_ROLE[version.classification];
    await execute(`INSERT INTO external_company_roles(id,company_id,role_code,is_primary,created_by)
      VALUES($1,$2,$3,0,$4) ON CONFLICT (company_id,role_code) WHERE status='active' DO NOTHING`,[uuid(),version.companyId,role,req.broker.id],client);
    await audit('PartnerOrganization',version.id,'verification_activated',req.broker.id,{companyId:version.companyId,versionNumber:version.versionNumber,classification:version.classification,companyRole:role,reason:checked.value.reason},client);
    return{version:activated};
  });
  if(result.error)return res.status(result.code).json({error:result.error,errors:result.errors,duplicates:result.duplicates});res.json(result);
});

r.post('/admin/partner-organization-versions/:versionId/retirement',async(req,res)=>{
  if(!isAdmin(req.broker))return res.status(403).json({error:'Administrator access required'});
  const reason=clean(req.body?.reason);if(reason.length<10)return res.status(400).json({error:'A meaningful retirement reason is required'});
  const result=await transaction(async client=>{
    const version=await one('SELECT * FROM partner_organization_versions WHERE id=$1 FOR UPDATE',[req.params.versionId],client);
    if(!version)return{code:404,error:'Governed organization version not found'};
    if(version.status!=='active')return{code:409,error:'Only the active governed version can be retired'};
    if(version.createdBy===req.broker.id)return{code:403,error:'The active-version creator cannot retire that version'};
    const retired=await one(`UPDATE partner_organization_versions SET status='retired',retired_by=$1,retirement_reason=$2,retired_at=NOW()
      WHERE id=$3 RETURNING *`,[req.broker.id,reason,version.id],client);
    await audit('PartnerOrganization',version.id,'version_retired',req.broker.id,{companyId:version.companyId,versionNumber:version.versionNumber,reason},client);
    return{version:retired};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/admin/partner-organization-versions/:versionId/brokerage-arrangements',async(req,res)=>{
  if(!isAdmin(req.broker))return res.status(403).json({error:'Administrator access required'});
  const file=decodeAndValidateFile({...req.body,maxBytes:Number(process.env.MAX_DOCUMENT_BYTES||10485760),allowedTypes:['application/pdf']});
  if(file.error)return res.status(400).json({error:file.error});
  const reference=meaningful(req.body?.arrangementReference,'Arrangement reference'),scope=meaningful(req.body?.scope,'Arrangement scope',10),
    effectiveFrom=dateOnly(req.body?.effectiveFrom,'Effective from'),effectiveTo=dateOnly(req.body?.effectiveTo,'Effective to',false);
  const error=[reference,scope,effectiveFrom,effectiveTo].find(value=>value?.error)?.error;
  if(error)return res.status(400).json({error});if(effectiveTo&&effectiveTo<effectiveFrom)return res.status(400).json({error:'Arrangement expiry cannot precede its effective date'});
  const result=await transaction(async client=>{
    const partner=await one("SELECT * FROM partner_organization_versions WHERE id=$1 AND classification='developer' AND status='active' FOR SHARE",[req.params.versionId],client);
    if(!partner)return{code:409,error:'An active governed Developer version is required'};
    if(await one("SELECT id FROM developer_brokerage_arrangement_versions WHERE partner_version_id=$1 AND status='pending_verification'",[partner.id],client))return{code:409,error:'A Developer Brokerage Arrangement is already pending review'};
    const prior=await one("SELECT id FROM developer_brokerage_arrangement_versions WHERE partner_version_id=$1 AND status='active'",[partner.id],client),
      latest=await one('SELECT COALESCE(MAX(version_number),0)::int AS version_number FROM developer_brokerage_arrangement_versions WHERE partner_version_id=$1',[partner.id],client),
      evidence=await immutableEvidenceDocument({file,documentType:'developer_brokerage_arrangement',title:`Developer Brokerage Arrangement · ${reference}`,companyId:partner.companyId,brokerId:req.broker.id},client),id=uuid();
    const arrangement=await one(`INSERT INTO developer_brokerage_arrangement_versions(id,partner_version_id,version_number,arrangement_reference,scope,effective_from,effective_to,document_version_id,status,supersedes_version_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending_verification',$9,$10) RETURNING *`,[id,partner.id,Number(latest.versionNumber||0)+1,reference,scope,effectiveFrom,effectiveTo,evidence.documentVersionId,prior?.id||null,req.broker.id],client);
    await audit('DeveloperBrokerageArrangement',id,'submitted',req.broker.id,{partnerVersionId:partner.id,companyId:partner.companyId,reference,documentVersionId:evidence.documentVersionId,fileHash:evidence.fileHash},client);return{arrangement};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});

r.post('/admin/partner-organization-versions/:versionId/listing-nocs',async(req,res)=>{
  if(!isAdmin(req.broker))return res.status(403).json({error:'Administrator access required'});
  const file=decodeAndValidateFile({...req.body,maxBytes:Number(process.env.MAX_DOCUMENT_BYTES||10485760),allowedTypes:['application/pdf']});
  if(file.error)return res.status(400).json({error:file.error});
  const listingId=clean(req.body?.listingId),reference=meaningful(req.body?.nocReference,'NOC reference'),issuedAt=dateOnly(req.body?.issuedAt,'Issue date'),expiresAt=dateOnly(req.body?.expiresAt,'Expiry',false),
    error=[reference,issuedAt,expiresAt].find(value=>value?.error)?.error;
  if(!listingId)return res.status(400).json({error:'Select the exact Internal Inventory record'});if(error)return res.status(400).json({error});if(expiresAt&&expiresAt<issuedAt)return res.status(400).json({error:'NOC expiry cannot precede its issue date'});
  const result=await transaction(async client=>{
    const partner=await one("SELECT * FROM partner_organization_versions WHERE id=$1 AND classification='developer' AND status='active' FOR SHARE",[req.params.versionId],client);
    if(!partner)return{code:409,error:'An active governed Developer version is required'};
    const currentLink=await one(`SELECT e.* FROM inventory_organization_link_events e WHERE e.listing_id=$1 AND e.relationship='developer' ORDER BY e.performed_at DESC,e.id DESC LIMIT 1`,[listingId],client);
    if(!currentLink||currentLink.action==='unlinked'||currentLink.partnerVersionId!==partner.id)return{code:409,error:'The selected Inventory is not currently linked to this exact governed Developer version'};
    if(await one("SELECT id FROM property_listing_noc_versions WHERE listing_id=$1 AND partner_version_id=$2 AND status='pending_verification'",[listingId,partner.id],client))return{code:409,error:'A property-specific Listing NOC is already pending review'};
    const listing=await one('SELECT id,inventory_reference,inventory_headline,project FROM listings WHERE id=$1 AND deleted_at IS NULL FOR SHARE',[listingId],client);if(!listing)return{code:404,error:'Inventory not found'};
    const prior=await one("SELECT id FROM property_listing_noc_versions WHERE listing_id=$1 AND partner_version_id=$2 AND status='active'",[listingId,partner.id],client),
      latest=await one('SELECT COALESCE(MAX(version_number),0)::int AS version_number FROM property_listing_noc_versions WHERE listing_id=$1 AND partner_version_id=$2',[listingId,partner.id],client),
      evidence=await immutableEvidenceDocument({file,documentType:'property_listing_noc',title:`Property Listing NOC · ${reference}`,companyId:partner.companyId,listingId,brokerId:req.broker.id},client),id=uuid();
    const noc=await one(`INSERT INTO property_listing_noc_versions(id,listing_id,partner_version_id,version_number,noc_reference,issued_at,expires_at,document_version_id,status,supersedes_version_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending_verification',$9,$10) RETURNING *`,[id,listingId,partner.id,Number(latest.versionNumber||0)+1,reference,issuedAt,expiresAt,evidence.documentVersionId,prior?.id||null,req.broker.id],client);
    await audit('PropertyListingNoc',id,'submitted',req.broker.id,{partnerVersionId:partner.id,companyId:partner.companyId,listingId,reference,documentVersionId:evidence.documentVersionId,fileHash:evidence.fileHash},client);return{noc};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});

async function reviewDeveloperEvidence({table,entityType,id,decision,reason,broker},client){
  const allowedTables=new Set(['developer_brokerage_arrangement_versions','property_listing_noc_versions']);if(!allowedTables.has(table))throw new Error('Unsupported evidence table');
  const row=await one(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id],client);if(!row)return{code:404,error:'Developer authority evidence not found'};
  if(row.status!=='pending_verification')return{code:409,error:'Only pending evidence can receive a review decision'};
  if(row.createdBy===broker.id)return{code:403,error:'The evidence uploader cannot review their own submission'};
  if(!['activate','reject'].includes(decision)||clean(reason).length<10)return{code:400,error:'Select a valid decision and record a meaningful reason'};
  if(decision==='activate'){
    const expiry=row.effectiveTo||row.expiresAt;if(expiry&&expiry<new Date().toISOString().slice(0,10))return{code:409,error:'Expired evidence cannot be activated'};
    const activeWhere=table==='property_listing_noc_versions'?'listing_id=$1 AND partner_version_id=$2':'partner_version_id=$1',activeParams=table==='property_listing_noc_versions'?[row.listingId,row.partnerVersionId]:[row.partnerVersionId];
    const prior=await one(`SELECT id FROM ${table} WHERE ${activeWhere} AND status='active' FOR UPDATE`,activeParams,client);if(prior)await execute(`UPDATE ${table} SET status='superseded' WHERE id=$1`,[prior.id],client);
  }
  const status=decision==='activate'?'active':'rejected',updated=await one(`UPDATE ${table} SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_reason=$3 WHERE id=$4 RETURNING *`,[status,broker.id,clean(reason),row.id],client);
  await audit(entityType,row.id,decision==='activate'?'activated':'rejected',broker.id,{partnerVersionId:row.partnerVersionId,listingId:row.listingId||null,reason:clean(reason)},client);return{evidence:updated};
}

r.post('/admin/developer-brokerage-arrangements/:id/review',async(req,res)=>{if(!isAdmin(req.broker))return res.status(403).json({error:'Administrator access required'});const result=await transaction(client=>reviewDeveloperEvidence({table:'developer_brokerage_arrangement_versions',entityType:'DeveloperBrokerageArrangement',id:req.params.id,decision:clean(req.body?.decision),reason:req.body?.reason,broker:req.broker},client));if(result.error)return res.status(result.code).json({error:result.error});res.json(result);});
r.post('/admin/property-listing-nocs/:id/review',async(req,res)=>{if(!isAdmin(req.broker))return res.status(403).json({error:'Administrator access required'});const result=await transaction(client=>reviewDeveloperEvidence({table:'property_listing_noc_versions',entityType:'PropertyListingNoc',id:req.params.id,decision:clean(req.body?.decision),reason:req.body?.reason,broker:req.broker},client));if(result.error)return res.status(result.code).json({error:result.error});res.json(result);});

export default r;
