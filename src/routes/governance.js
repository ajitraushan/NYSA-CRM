import path from 'node:path';
import { Router } from '../lib/http-kit.js';
import { one, many, execute, transaction, uuid, audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity, isCompanyReader, isManager, isCrmReadOnly, contactScopeSql, companyScopeSql } from '../crm-policy.js';
import { normalizePhone, isValidEmail } from '../crm-domain.js';
import { decodeAndValidateFile,savePrivate,readPrivate,removePrivate } from '../private-files.js';
import { validateOrganizationProfile,publicOrganization } from '../organization-domain.js';
import { stableCodeError } from '../admin-governance.js';

const r=Router();
r.use(requireAuth,requireGovernanceAccess);

function requireGovernanceAccess(req,res,next){
  if(!hasInternalCrmIdentity(req.broker)) return res.status(403).json({error:'CRM governance is restricted to NYSA staff'});
  next();
}

function clean(value){const v=typeof value==='string'?value.trim():value;return v===''?null:v;}
function adminOnly(req,res){if(req.broker.role!=='admin'){res.status(403).json({error:'Administrator access required'});return false;}return true;}
function settingsOnly(req,res){if(req.broker.role!=='admin'&&req.broker.jobRole!=='admin_assistant'){res.status(403).json({error:'Administrator or Admin Assistant access required'});return false;}return true;}

async function scopedContact(req,id){
  const params=[id],scope=contactScopeSql('c',req.broker,params);
  return one(`SELECT c.* FROM contacts c WHERE c.id=$1 AND c.archived_at IS NULL AND ${scope.clause}`,scope.params);
}

async function scopedCompany(req,id){
  const params=[id],scope=companyScopeSql('c',req.broker,params);
  return one(`SELECT c.* FROM companies c WHERE c.id=$1 AND c.archived_at IS NULL AND ${scope.clause}`,scope.params);
}

function normalizeChannel(kind,value){
  const raw=String(value||'').trim();
  if(kind==='Email') return isValidEmail(raw)?raw.toLowerCase():null;
  if(kind==='Phone') return normalizePhone(raw);
  return null;
}

r.get('/crm/organization',async(req,res)=>{
  const organization=await one("SELECT * FROM organization_settings WHERE status='active' ORDER BY version DESC LIMIT 1");
  res.json({organization:publicOrganization(organization)});
});

async function createOrganizationDraft(req,res){
  const checked=validateOrganizationProfile(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const b=checked.profile,id=uuid();
  const organization=await transaction(async client=>{
    await execute("SELECT pg_advisory_xact_lock(hashtext('organization_settings_version'))",[],client);
    const current=await one('SELECT COALESCE(MAX(version),0)::int AS version FROM organization_settings',[],client);
    const active=await one("SELECT logo_file_name,logo_media_type,logo_file_size_bytes,logo_storage_key,logo_file_hash FROM organization_settings WHERE status='active'",[],client);
    const row=await one(`INSERT INTO organization_settings
      (id,version,legal_name,display_name,trade_license_number,registration_authority,registered_address,primary_phone,primary_email,
       website_url,default_currency,timezone,locale,brand_version,proposal_footer,default_disclaimer,status,created_by,
       logo_file_name,logo_media_type,logo_file_size_bytes,logo_storage_key,logo_file_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'draft',$17,$18,$19,$20,$21,$22) RETURNING *`,
      [id,current.version+1,b.legalName,b.displayName,b.tradeLicenseNumber,b.registrationAuthority,b.registeredAddress,b.primaryPhone,b.primaryEmail,
       b.websiteUrl,b.defaultCurrency,b.timezone,b.locale,b.brandVersion,b.proposalFooter,b.defaultDisclaimer,req.broker.id,active?.logoFileName||null,
       active?.logoMediaType||null,active?.logoFileSizeBytes||null,active?.logoStorageKey||null,active?.logoFileHash||null],client);
    await audit('OrganizationSettings',id,'draft_created',req.broker.id,{version:row.version},client);return row;
  });
  res.status(201).json(publicOrganization(organization));
}

r.get('/admin/organization-settings',async(req,res)=>{if(!adminOnly(req,res))return;res.json({versions:(await many('SELECT * FROM organization_settings ORDER BY version DESC')).map(publicOrganization)});});
r.post('/admin/organization-settings',async(req,res)=>{if(!adminOnly(req,res))return;return createOrganizationDraft(req,res);});
r.post('/crm/organization/versions',async(req,res)=>{if(!adminOnly(req,res))return;if(req.body?.status&&req.body.status!=='draft')return res.status(409).json({error:'Organization versions must be created as drafts, approved, then activated'});return createOrganizationDraft(req,res);});

r.patch('/admin/organization-settings/:id',async(req,res)=>{
  if(!adminOnly(req,res))return;const current=await one('SELECT * FROM organization_settings WHERE id=$1',[req.params.id]);if(!current)return res.status(404).json({error:'Organization version not found'});if(current.status!=='draft')return res.status(409).json({error:'Only a draft organization version can be edited'});
  const checked=validateOrganizationProfile(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});const b=checked.profile;
  const row=await one(`UPDATE organization_settings SET legal_name=$1,display_name=$2,trade_license_number=$3,registration_authority=$4,registered_address=$5,
    primary_phone=$6,primary_email=$7,website_url=$8,default_currency=$9,timezone=$10,locale=$11,brand_version=$12,proposal_footer=$13,
    default_disclaimer=$14,updated_at=NOW() WHERE id=$15 AND status='draft' RETURNING *`,[b.legalName,b.displayName,b.tradeLicenseNumber,b.registrationAuthority,b.registeredAddress,b.primaryPhone,b.primaryEmail,b.websiteUrl,b.defaultCurrency,b.timezone,b.locale,b.brandVersion,b.proposalFooter,b.defaultDisclaimer,current.id]);
  await audit('OrganizationSettings',row.id,'draft_edited',req.broker.id,{version:row.version});res.json(publicOrganization(row));
});

r.post('/admin/organization-settings/:id/logo',async(req,res)=>{
  if(!adminOnly(req,res))return;const current=await one('SELECT * FROM organization_settings WHERE id=$1',[req.params.id]);if(!current)return res.status(404).json({error:'Organization version not found'});if(current.status!=='draft')return res.status(409).json({error:'Logo can be changed only on a draft version'});
  const file=decodeAndValidateFile({...req.body,maxBytes:Number(process.env.MAX_BRAND_ASSET_BYTES||2097152),allowedTypes:['image/jpeg','image/png','image/webp']});if(file.error)return res.status(400).json({error:file.error});
  const key=await savePrivate(file.buffer,path.extname(file.fileName));try{const row=await transaction(async client=>{const updated=await one(`UPDATE organization_settings SET logo_file_name=$1,logo_media_type=$2,logo_file_size_bytes=$3,logo_storage_key=$4,logo_file_hash=$5,updated_at=NOW() WHERE id=$6 AND status='draft' RETURNING *`,[file.fileName,req.body.mediaType,file.buffer.length,key,file.fileHash,current.id],client);await audit('OrganizationSettings',updated.id,'logo_replaced',req.broker.id,{version:updated.version,fileHash:file.fileHash},client);return updated;});res.json(publicOrganization(row));}catch(error){await removePrivate(key);throw error;}
});
r.get('/admin/organization-settings/:id/logo',async(req,res)=>{if(!adminOnly(req,res))return;const row=await one('SELECT * FROM organization_settings WHERE id=$1',[req.params.id]);if(!row?.logoStorageKey)return res.status(404).json({error:'Logo not found'});const data=await readPrivate(row.logoStorageKey);res.setHeader('Content-Type',row.logoMediaType);res.setHeader('Content-Disposition',`inline; filename="${row.logoFileName.replace(/"/g,'')}"`);res.end(data);});
r.post('/admin/organization-settings/:id/approve',async(req,res)=>{if(!adminOnly(req,res))return;const reason=clean(req.body?.reason);if(!reason)return res.status(400).json({error:'Approval reason is required'});const row=await one("UPDATE organization_settings SET status='approved',approved_by=$1,approved_at=NOW(),approval_reason=$2,updated_at=NOW() WHERE id=$3 AND status='draft' RETURNING *",[req.broker.id,reason,req.params.id]);if(!row)return res.status(409).json({error:'Only a draft organization version can be approved'});await audit('OrganizationSettings',row.id,'approved',req.broker.id,{version:row.version,reason});res.json(publicOrganization(row));});
r.post('/admin/organization-settings/:id/activate',async(req,res)=>{if(!adminOnly(req,res))return;const row=await transaction(async client=>{const target=await one('SELECT * FROM organization_settings WHERE id=$1 FOR UPDATE',[req.params.id],client);if(!target||target.status!=='approved')return null;await execute("UPDATE organization_settings SET status='retired',effective_to=NOW(),updated_at=NOW() WHERE status='active'",[],client);const active=await one("UPDATE organization_settings SET status='active',effective_from=NOW(),effective_to=NULL,updated_at=NOW() WHERE id=$1 RETURNING *",[target.id],client);await audit('OrganizationSettings',active.id,'activated',req.broker.id,{version:active.version},client);return active;});if(!row)return res.status(409).json({error:'Only an approved organization version can be activated'});res.json(publicOrganization(row));});
r.post('/admin/organization-settings/:id/retire',async(req,res)=>{if(!adminOnly(req,res))return;const row=await one("UPDATE organization_settings SET status='retired',effective_to=COALESCE(effective_to,NOW()),updated_at=NOW() WHERE id=$1 AND status IN ('draft','approved') RETURNING *",[req.params.id]);if(!row)return res.status(409).json({error:'Draft or approved versions can be retired; activate a replacement to retire the active version'});await audit('OrganizationSettings',row.id,'retired',req.broker.id,{version:row.version});res.json(publicOrganization(row));
});
r.delete('/admin/organization-settings/:id',async(req,res)=>{
  if(!adminOnly(req,res))return;const reason=clean(req.body?.reason);if(!reason)return res.status(400).json({error:'Deletion reason is required'});
  const removed=await transaction(async client=>{const row=await one("DELETE FROM organization_settings WHERE id=$1 AND status='draft' RETURNING *",[req.params.id],client);if(!row)return null;await audit('OrganizationSettings',row.id,'unused_draft_deleted',req.broker.id,{version:row.version,reason},client);return row;});
  if(!removed)return res.status(409).json({error:'Only an unused draft company profile can be deleted; approved, active and historical versions are retained'});
  if(removed.logoStorageKey){const shared=await one('SELECT COUNT(*)::int AS count FROM organization_settings WHERE logo_storage_key=$1',[removed.logoStorageKey]);if(!shared.count)await removePrivate(removed.logoStorageKey).catch(()=>{});}
  res.json({deleted:true,id:removed.id,version:removed.version});
});

r.get('/crm/contacts/:id/channels',async(req,res)=>{
  const contact=await scopedContact(req,req.params.id);if(!contact)return res.status(404).json({error:'Contact not found'});
  const channels=await many('SELECT * FROM contact_channels WHERE contact_id=$1 ORDER BY is_primary DESC,created_at',[contact.id]);
  res.json({channels});
});

r.post('/crm/contacts/:id/channels',async(req,res)=>{
  const contact=await scopedContact(req,req.params.id);if(!contact)return res.status(404).json({error:'Contact not found'});
  if(isCrmReadOnly(req.broker))return res.status(403).json({error:'This role has read-only CRM access'});
  const b=req.body||{},kind=b.channelKind,raw=clean(b.rawValue),normalized=normalizeChannel(kind,raw);
  if(!['Phone','Email'].includes(kind)||!normalized) return res.status(400).json({error:'A valid Phone or Email channel is required'});
  if(kind==='Email'&&b.whatsappEnabled) return res.status(400).json({error:'WhatsApp capability is valid only for phone channels'});
  const duplicates=await many(`SELECT cc.id,cc.contact_id,c.full_name FROM contact_channels cc JOIN contacts c ON c.id=cc.contact_id
    WHERE cc.channel_kind=$1 AND cc.normalized_value=$2 AND cc.contact_id<>$3 AND c.lifecycle_status<>'merged'`,[kind,normalized,contact.id]);
  if(duplicates.length&&!b.duplicateReviewed) return res.status(409).json({error:'Duplicate contact channel requires review',duplicates});
  const id=uuid();const channel=await one(`INSERT INTO contact_channels
    (id,contact_id,channel_kind,usage_label,raw_value,normalized_value,whatsapp_enabled,is_primary,verification_status,restriction_status,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [id,contact.id,kind,clean(b.usageLabel)||'Primary',raw,normalized,b.whatsappEnabled?1:0,b.isPrimary?1:0,
     b.verificationStatus||'format_valid',b.restrictionStatus||'allowed',req.broker.id]);
  await audit('ContactChannel',id,'created',req.broker.id,{contactId:contact.id,kind,duplicateReviewed:Boolean(b.duplicateReviewed)});
  res.status(201).json({...channel,duplicateWarnings:duplicates});
});

r.patch('/crm/contact-channels/:id',async(req,res)=>{
  const channel=await one('SELECT * FROM contact_channels WHERE id=$1',[req.params.id]);if(!channel)return res.status(404).json({error:'Channel not found'});
  const contact=await scopedContact(req,channel.contactId);if(!contact)return res.status(404).json({error:'Channel not found'});
  if(isCrmReadOnly(req.broker))return res.status(403).json({error:'This role has read-only CRM access'});
  const b=req.body||{},sets=[],params=[],changes={};
  if(b.rawValue!==undefined){const normalized=normalizeChannel(channel.channelKind,b.rawValue);if(!normalized)return res.status(400).json({error:'Channel value is invalid'});params.push(clean(b.rawValue));sets.push(`raw_value=$${params.length}`);params.push(normalized);sets.push(`normalized_value=$${params.length}`);changes.value=true;}
  for(const [field,column,convert] of [['usageLabel','usage_label',clean],['whatsappEnabled','whatsapp_enabled',v=>v?1:0],['isPrimary','is_primary',v=>v?1:0],['verificationStatus','verification_status',clean],['restrictionStatus','restriction_status',clean]]){
    if(b[field]!==undefined){if(field==='whatsappEnabled'&&channel.channelKind!=='Phone'&&b[field])return res.status(400).json({error:'WhatsApp capability is valid only for phone channels'});params.push(convert(b[field]));sets.push(`${column}=$${params.length}`);changes[field]=b[field];}
  }
  if(!sets.length)return res.json(channel);params.push(channel.id);
  const updated=await one(`UPDATE contact_channels SET ${sets.join(',')},verified_at=CASE WHEN verification_status='verified' THEN COALESCE(verified_at,NOW()) ELSE verified_at END,updated_at=NOW() WHERE id=$${params.length} RETURNING *`,params);
  await audit('ContactChannel',channel.id,'edited',req.broker.id,changes);res.json(updated);
});

r.get('/crm/contacts/:id/duplicates',async(req,res)=>{
  const contact=await scopedContact(req,req.params.id);if(!contact)return res.status(404).json({error:'Contact not found'});
  const candidates=await many(`SELECT DISTINCT c.id,c.full_name,c.email,c.phone,
    CASE WHEN EXISTS(SELECT 1 FROM contact_channels a JOIN contact_channels b ON a.channel_kind=b.channel_kind AND a.normalized_value=b.normalized_value
      WHERE a.contact_id=$1 AND b.contact_id=c.id) THEN 'exact_channel' ELSE 'similar_name' END AS match_type
    FROM contacts c WHERE c.id<>$1 AND c.archived_at IS NULL AND c.lifecycle_status<>'merged'
      AND (LOWER(c.full_name)=LOWER($2) OR EXISTS(SELECT 1 FROM contact_channels a JOIN contact_channels b
        ON a.channel_kind=b.channel_kind AND a.normalized_value=b.normalized_value WHERE a.contact_id=$1 AND b.contact_id=c.id))
    ORDER BY match_type,c.full_name`,[contact.id,contact.fullName]);
  res.json({candidates});
});

r.post('/crm/contacts/:id/merge',async(req,res)=>{
  const source=await scopedContact(req,req.params.id),target=await scopedContact(req,req.body?.targetContactId);
  if(!source||!target)return res.status(404).json({error:'Source or target contact not found'});
  if(source.id===target.id)return res.status(400).json({error:'A contact cannot be merged into itself'});
  if(!(req.broker.role==='admin'||isManager(req.broker))||!clean(req.body?.reason))return res.status(403).json({error:'Manager/admin permission and a merge reason are required'});
  await transaction(async client=>{
    await execute(`DELETE FROM contact_channels s USING contact_channels t WHERE s.contact_id=$1 AND t.contact_id=$2
      AND s.channel_kind=t.channel_kind AND s.normalized_value=t.normalized_value`,[source.id,target.id],client);
    await execute('UPDATE contact_channels SET contact_id=$1 WHERE contact_id=$2',[target.id,source.id],client);
    await execute(`DELETE FROM contact_roles s USING contact_roles t WHERE s.contact_id=$1 AND t.contact_id=$2 AND s.role_code=t.role_code AND s.status=t.status`,[source.id,target.id],client);
    await execute('UPDATE contact_roles SET contact_id=$1 WHERE contact_id=$2',[target.id,source.id],client);
    await execute(`DELETE FROM company_contacts s USING company_contacts t WHERE s.contact_id=$1 AND t.contact_id=$2 AND s.company_id=t.company_id AND s.ends_at IS NULL AND t.ends_at IS NULL`,[source.id,target.id],client);
    await execute('UPDATE company_contacts SET contact_id=$1 WHERE contact_id=$2',[target.id,source.id],client);
    await execute('UPDATE leads SET contact_id=$1,updated_at=NOW() WHERE contact_id=$2',[target.id,source.id],client);
    await execute('UPDATE activities SET contact_id=$1,updated_at=NOW() WHERE contact_id=$2',[target.id,source.id],client);
    await execute('UPDATE marketing_agreements SET contact_id=$1 WHERE contact_id=$2',[target.id,source.id],client);
    await execute(`UPDATE contacts SET lifecycle_status='merged',merged_into_contact_id=$1,merged_at=NOW(),merged_by=$2,merge_reason=$3,archived_at=NOW(),updated_at=NOW() WHERE id=$4`,
      [target.id,req.broker.id,clean(req.body.reason),source.id],client);
    await audit('ContactMerge',source.id,'merged',req.broker.id,{targetContactId:target.id,reason:clean(req.body.reason)},client);
  });
  res.json({ok:true,sourceContactId:source.id,targetContactId:target.id});
});

r.post('/crm/contacts/:id/roles',async(req,res)=>{
  const contact=await scopedContact(req,req.params.id);if(!contact)return res.status(404).json({error:'Contact not found'});
  if(isCrmReadOnly(req.broker))return res.status(403).json({error:'This role has read-only CRM access'});
  const role=req.body?.roleCode,allowed=['buyer','seller','landlord','tenant','developer','investor','other'];
  if(!allowed.includes(role))return res.status(400).json({error:'Invalid roleCode'});
  const row=await one(`INSERT INTO contact_roles (id,contact_id,role_code,created_by) VALUES ($1,$2,$3,$4)
    ON CONFLICT (contact_id,role_code) WHERE status='active' DO UPDATE SET status='active' RETURNING *`,[uuid(),contact.id,role,req.broker.id]);
  await audit('Contact',contact.id,'role_added',req.broker.id,{role});res.status(201).json(row);
});

r.get('/crm/companies/:id/roles',async(req,res)=>{
  const company=await scopedCompany(req,req.params.id);if(!company)return res.status(404).json({error:'Company not found'});
  const roles=await many('SELECT * FROM external_company_roles WHERE company_id=$1 ORDER BY is_primary DESC,created_at',[company.id]);
  res.json({roles});
});

r.post('/crm/companies/:id/roles',async(req,res)=>{
  const company=await scopedCompany(req,req.params.id);if(!company)return res.status(404).json({error:'Company not found'});
  if(isCrmReadOnly(req.broker))return res.status(403).json({error:'This role has read-only CRM access'});
  const role=req.body?.roleCode,allowed=['developer','agency','employer','supplier','corporate_client','landlord','vendor','other'];
  if(!allowed.includes(role))return res.status(400).json({error:'Invalid roleCode'});
  const row=await one(`INSERT INTO external_company_roles (id,company_id,role_code,is_primary,created_by) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (company_id,role_code) WHERE status='active' DO UPDATE SET is_primary=EXCLUDED.is_primary RETURNING *`,
    [uuid(),company.id,role,req.body?.isPrimary?1:0,req.broker.id]);
  await audit('CompanyRole',row.id,'created',req.broker.id,{companyId:company.id,role});res.status(201).json(row);
});

r.get('/crm/contacts/:id/consent',async(req,res)=>{
  const contact=await scopedContact(req,req.params.id);if(!contact)return res.status(404).json({error:'Contact not found'});
  const agreements=await many(`SELECT m.*,dt.name AS template_name,dt.version AS template_version,dv.file_name,dv.file_hash
    FROM marketing_agreements m JOIN document_versions dv ON dv.id=m.document_version_id JOIN document_templates dt ON dt.id=m.template_id
    WHERE m.contact_id=$1 ORDER BY m.created_at DESC`,[contact.id]);
  const active=agreements.find(a=>a.status==='executed'&&new Date(a.effectiveAt)<=new Date()&&(!a.expiresAt||new Date(a.expiresAt)>new Date()));
  const evidence=await many(`SELECT id,evidence_type,purpose,status,statement_version,captured_at,evidence_hash,source_event_id,superseded_at
    FROM consent_evidence WHERE contact_id=$1 ORDER BY captured_at DESC`,[contact.id]);
  const websiteEvidence=evidence.find(e=>e.purpose==='marketing'&&!e.supersededAt);
  res.json({effectiveConsent:contact.doNotContact?false:Boolean(active),restricted:Boolean(contact.doNotContact),activeAgreement:active||null,
    websiteEvidence:websiteEvidence||null,agreements,evidence});
});

r.post('/crm/contacts/:id/marketing-agreements',async(req,res)=>{
  const contact=await scopedContact(req,req.params.id);if(!contact)return res.status(404).json({error:'Contact not found'});
  if(isCrmReadOnly(req.broker))return res.status(403).json({error:'This role has read-only CRM access'});
  const b=req.body||{};
  const evidence=await one(`SELECT dv.*,dt.id AS approved_template_id,dt.status AS template_status FROM document_versions dv
    JOIN document_templates dt ON dt.id=dv.template_id WHERE dv.id=$1 AND dt.id=$2 AND dt.status='approved'`,[b.documentVersionId,b.templateId]);
  if(!evidence)return res.status(400).json({error:'An executed document version from the approved template is required'});
  if(!Array.isArray(b.consentScope)||!b.consentScope.length||!Array.isArray(b.permittedChannels)||!b.permittedChannels.length)
    return res.status(400).json({error:'consentScope and permittedChannels are required'});
  const id=uuid();const agreement=await transaction(async client=>{
    await execute('UPDATE document_versions SET immutable=1 WHERE id=$1',[evidence.id],client);
    const row=await one(`INSERT INTO marketing_agreements
      (id,contact_id,document_version_id,template_id,status,consent_scope,permitted_channels,signed_at,effective_at,expires_at,created_by)
      VALUES ($1,$2,$3,$4,'executed',$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id,contact.id,evidence.id,b.templateId,b.consentScope,b.permittedChannels,b.signedAt||new Date(),b.effectiveAt||new Date(),b.expiresAt||null,req.broker.id],client);
    await execute("UPDATE marketing_agreements SET status='superseded',superseded_by=$2 WHERE contact_id=$1 AND status='executed' AND id<>$2",[contact.id,id],client);
    await audit('MarketingAgreement',id,'executed',req.broker.id,{contactId:contact.id,documentVersionId:evidence.id},client);return row;
  });
  res.status(201).json(agreement);
});

r.post('/crm/marketing-agreements/:id/withdraw',async(req,res)=>{
  const agreement=await one('SELECT * FROM marketing_agreements WHERE id=$1',[req.params.id]);if(!agreement)return res.status(404).json({error:'Agreement not found'});
  const contact=await scopedContact(req,agreement.contactId);if(!contact)return res.status(404).json({error:'Agreement not found'});
  if(isCrmReadOnly(req.broker))return res.status(403).json({error:'This role has read-only CRM access'});
  if(!clean(req.body?.reason))return res.status(400).json({error:'Withdrawal reason is required'});
  const updated=await one(`UPDATE marketing_agreements SET status='withdrawn',withdrawn_at=NOW(),withdrawal_reason=$1 WHERE id=$2 AND status='executed' RETURNING *`,[clean(req.body.reason),agreement.id]);
  if(!updated)return res.status(409).json({error:'Agreement is not active'});
  await audit('MarketingAgreement',agreement.id,'withdrawn',req.broker.id,{reason:clean(req.body.reason)});res.json(updated);
});

r.get('/admin/value-sets',async(req,res)=>{
  if(!settingsOnly(req,res))return;
  const sets=await many(`SELECT vs.*,(SELECT COALESCE(json_agg(json_build_object('id',vd.id,'stableCode',vd.stable_code,
    'displayLabelEn',vd.display_label_en,'displayLabelAr',vd.display_label_ar,'definitionStatus',vd.definition_status,'displayOrder',vd.display_order,
    'isDefault',vd.is_default,'effectiveFrom',vd.effective_from,'effectiveTo',vd.effective_to,'replacementValueId',vd.replacement_value_id,
    'usageCount',(SELECT COUNT(*)::int FROM value_definition_usage u WHERE u.value_definition_id=vd.id))
    ORDER BY vd.display_order,vd.display_label_en),'[]'::json) FROM value_definitions vd WHERE vd.value_set_id=vs.id) AS definitions FROM value_sets vs ORDER BY vs.name`);
  for(const set of sets)set.consumers=await many('SELECT * FROM controlled_value_consumers WHERE value_set_id=$1 ORDER BY module_name,business_label',[set.id]);
  res.json({sets});
});

r.get('/crm/controlled-values/:setCode',async(req,res)=>{const set=await one('SELECT id FROM value_sets WHERE stable_code=$1 AND status=$2',[req.params.setCode,'active']);if(!set)return res.status(404).json({error:'Active controlled-value set not found'});res.json({definitions:await many("SELECT stable_code,display_label_en,display_label_ar,display_order,is_default FROM value_definitions WHERE value_set_id=$1 AND definition_status='active' AND (effective_from IS NULL OR effective_from<=NOW()) AND (effective_to IS NULL OR effective_to>NOW()) ORDER BY display_order,display_label_en",[set.id])});});

r.post('/admin/value-sets',async(req,res)=>{
  if(!settingsOnly(req,res))return;const b=req.body||{};
  const codeError=stableCodeError(b.stableCode);if(codeError||!clean(b.name)||!['A','B','C'].includes(b.configurationClass))return res.status(400).json({error:codeError||'name and configurationClass are required'});
  const id=uuid(),row=await one(`INSERT INTO value_sets (id,stable_code,name,configuration_class,description,status,created_by) VALUES ($1,$2,$3,$4,$5,'draft',$6) RETURNING *`,
    [id,clean(b.stableCode),clean(b.name),b.configurationClass,clean(b.description),req.broker.id]);
  await audit('ValueSet',id,'created',req.broker.id,{stableCode:row.stableCode});res.status(201).json(row);
});

r.post('/admin/value-sets/:id/definitions',async(req,res)=>{
  if(!settingsOnly(req,res))return;const set=await one('SELECT * FROM value_sets WHERE id=$1',[req.params.id]);if(!set)return res.status(404).json({error:'Value set not found'});
  const b=req.body||{},codeError=stableCodeError(b.stableCode);if(codeError||!clean(b.displayLabelEn))return res.status(400).json({error:codeError||'displayLabelEn is required'});
  const id=uuid(),row=await one(`INSERT INTO value_definitions
    (id,value_set_id,stable_code,display_label_en,display_label_ar,description,definition_status,display_order,is_default,effective_from,created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[id,set.id,clean(b.stableCode),clean(b.displayLabelEn),clean(b.displayLabelAr),
      clean(b.description),'draft',Number(b.displayOrder)||0,b.isDefault?1:0,b.effectiveFrom||null,req.broker.id]);
  await audit('ValueDefinition',id,'created',req.broker.id,{valueSetId:set.id,stableCode:row.stableCode});res.status(201).json(row);
});

r.patch('/admin/value-definitions/:id',async(req,res)=>{
  if(!settingsOnly(req,res))return;const current=await one('SELECT * FROM value_definitions WHERE id=$1',[req.params.id]);if(!current)return res.status(404).json({error:'Value definition not found'});
  const usage=Number((await one('SELECT COUNT(*)::int AS count FROM value_definition_usage WHERE value_definition_id=$1',[current.id])).count);
  if(req.body?.stableCode!==undefined&&req.body.stableCode!==current.stableCode){const error=stableCodeError(req.body.stableCode);if(error)return res.status(400).json({error});if(current.definitionStatus!=='draft'||usage)return res.status(400).json({error:'Stable codes are immutable after activation or use'});}
  const b=req.body||{};if(b.definitionStatus&&b.definitionStatus!==current.definitionStatus&&(!clean(b.changeReason)||!clean(b.impactReview)))return res.status(400).json({error:'Status changes require changeReason and impactReview'});
  if(b.definitionStatus&&b.definitionStatus!==current.definitionStatus&&req.broker.role!=='admin')return res.status(403).json({error:'Administrator approval is required for controlled-value status changes'});
  if(['deprecated','retired'].includes(b.definitionStatus)&&usage>0&&!b.effectiveTo)return res.status(400).json({error:'Used values require an effectiveTo date when deprecated or retired'});
  const map={stableCode:'stable_code',displayLabelEn:'display_label_en',displayLabelAr:'display_label_ar',description:'description',definitionStatus:'definition_status',displayOrder:'display_order',isDefault:'is_default',effectiveFrom:'effective_from',effectiveTo:'effective_to',replacementValueId:'replacement_value_id',changeReason:'change_reason',impactReview:'impact_review'};
  const sets=[],params=[],changes={};for(const [f,c] of Object.entries(map))if(b[f]!==undefined){let v=b[f];if(f==='isDefault')v=v?1:0;params.push(v);sets.push(`${c}=$${params.length}`);changes[f]=v;}
  if(!sets.length)return res.json(current);params.push(req.broker.id);sets.push(`approved_by=$${params.length}`,`approved_at=NOW()`,`updated_at=NOW()`);params.push(current.id);
  const updated=await one(`UPDATE value_definitions SET ${sets.join(',')} WHERE id=$${params.length} RETURNING *`,params);
  await audit('ValueDefinition',current.id,'edited',req.broker.id,changes);res.json(updated);
});

r.patch('/admin/value-sets/:id',async(req,res)=>{if(!settingsOnly(req,res))return;const current=await one('SELECT * FROM value_sets WHERE id=$1',[req.params.id]);if(!current)return res.status(404).json({error:'Value set not found'});const usage=Number((await one('SELECT COUNT(*)::int AS count FROM value_definition_usage u JOIN value_definitions d ON d.id=u.value_definition_id WHERE d.value_set_id=$1',[current.id])).count),b=req.body||{};if(b.status&&b.status!==current.status&&req.broker.role!=='admin')return res.status(403).json({error:'Administrator approval is required for value-set status changes'});if(b.stableCode!==undefined&&b.stableCode!==current.stableCode){const error=stableCodeError(b.stableCode);if(error)return res.status(400).json({error});if(current.status!=='draft'||usage)return res.status(409).json({error:'Set stable code is immutable after activation or use'});}if(b.status==='retired'&&!clean(b.reason))return res.status(400).json({error:'Retirement reason is required'});const row=await one('UPDATE value_sets SET stable_code=COALESCE($1,stable_code),name=COALESCE($2,name),description=$3,status=COALESCE($4,status),updated_at=NOW() WHERE id=$5 RETURNING *',[b.stableCode===undefined?null:clean(b.stableCode),b.name===undefined?null:clean(b.name),b.description===undefined?current.description:clean(b.description),b.status||null,current.id]);await audit('ValueSet',row.id,'edited',req.broker.id,{...b,usageCount:usage});res.json(row);});
r.delete('/admin/value-sets/:id',async(req,res)=>{if(!settingsOnly(req,res))return;const row=await one("DELETE FROM value_sets v WHERE v.id=$1 AND v.status='draft' AND NOT EXISTS(SELECT 1 FROM value_definitions d WHERE d.value_set_id=v.id) RETURNING id",[req.params.id]);if(!row)return res.status(409).json({error:'Only an unused empty draft set can be deleted'});await audit('ValueSet',row.id,'draft_deleted',req.broker.id);res.json({ok:true});});
r.delete('/admin/value-definitions/:id',async(req,res)=>{if(!settingsOnly(req,res))return;const row=await one("DELETE FROM value_definitions d WHERE d.id=$1 AND d.definition_status='draft' AND NOT EXISTS(SELECT 1 FROM value_definition_usage u WHERE u.value_definition_id=d.id) RETURNING id",[req.params.id]);if(!row)return res.status(409).json({error:'Only an unused draft definition can be deleted'});await audit('ValueDefinition',row.id,'draft_deleted',req.broker.id);res.json({ok:true});});
r.post('/admin/value-sets/:id/consumers',async(req,res)=>{if(!settingsOnly(req,res))return;const b=req.body||{},error=stableCodeError(b.consumerCode);if(error||!clean(b.businessLabel)||!clean(b.moduleName)||!clean(b.fieldName))return res.status(400).json({error:error||'Consumer label, module and field are required'});const row=await one('INSERT INTO controlled_value_consumers(id,value_set_id,consumer_code,business_label,module_name,field_name,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[uuid(),req.params.id,b.consumerCode,clean(b.businessLabel),clean(b.moduleName),clean(b.fieldName),req.broker.id]);await audit('ValueSet',req.params.id,'consumer_connected',req.broker.id,{consumerCode:b.consumerCode});res.status(201).json(row);});

export default r;
