import crypto from 'node:crypto';
import {Router} from '../lib/http-kit.js';
import {requireAuth} from '../auth.js';
import {one,many,execute,transaction,uuid,audit} from '../db.js';
import {canReadOpportunity,canWriteOpportunity,hasInternalCrmIdentity} from '../crm-policy.js';
import {renderApprovedDocumentPdf} from '../approved-document-renderer.js';
import {recordApprovedDocumentIssuance} from '../approved-document-issuance.js';
import {selectDocumentAgent} from '../document-agent-domain.js';
import {decodeAndValidateFile,savePrivate,removePrivate} from '../private-files.js';
import {approvedDocumentOpportunityLinks,validateA2aIssue,validateViewingConfirmationSelection} from '../approved-document-domain.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'Approved documents are restricted to NYSA staff'}));
const codes=new Set(['viewing_confirmation','a2a_buyer','a2a_seller']);
const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;
const date=value=>value?new Intl.DateTimeFormat('en-AE',{timeZone:'Asia/Dubai',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)):'';
const dateTime=value=>value?new Intl.DateTimeFormat('en-AE',{timeZone:'Asia/Dubai',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'';

const OPPORTUNITY=`SELECT o.*,c.full_name AS customer_name,c.nationality,c.phone AS customer_phone,c.email AS customer_email,
  c.id_document_type,c.id_document_last4,c.postal_address AS customer_address,l.title AS lead_title,
  COALESCE(li.id,pmli.id) AS resolved_listing_id,COALESCE(li.inventory_reference,pmli.inventory_reference,ep.external_reference) AS inventory_reference,
  COALESCE(li.inventory_headline,li.project,pmli.inventory_headline,pmli.project,ep.project_or_building) AS inventory_title,
  COALESCE(li.project,pmli.project,ep.project_or_building) AS project,COALESCE(li.community,pmli.community,ep.community_or_area) AS community,
  COALESCE(li.building,pmli.building,ep.project_or_building) AS building,COALESCE(li.unit_reference,pmli.unit_reference) AS unit_reference,
  COALESCE(li.area,pmli.area,ep.property_address) AS property_address,COALESCE(li.property_type,pmli.property_type,ep.property_type) AS property_type,
  COALESCE(li.price,pmli.price,ep.asking_price) AS listed_price,COALESCE(li.currency,pmli.currency,ep.currency,'AED') AS currency,
  COALESCE(li.developer,pmli.developer,ep.developer_name) AS developer,COALESCE(li.size_sqft,pmli.size_sqft) AS size_sqft,
  buyer_agent.name AS buyer_agent_name,buyer_agent.email AS buyer_agent_email,buyer_agent.phone AS buyer_agent_phone,
  buyer_agent.brn AS buyer_agent_brn,buyer_agent.brn_issued_on AS buyer_agent_brn_issued_on,
  seller_agent.name AS seller_agent_name,seller_agent.email AS seller_agent_email,seller_agent.phone AS seller_agent_phone,
  seller_agent.brn AS seller_agent_brn,seller_agent.brn_issued_on AS seller_agent_brn_issued_on,
  buyer_agency.display_name AS buyer_agency_name,buyer_agency.email AS buyer_agency_email,
  seller_agency.display_name AS seller_agency_name,seller_agency.email AS seller_agency_email,
  owner.name AS owner_name,owner.email AS owner_email,owner.phone AS owner_phone,owner.brn AS owner_brn,owner.brn_issued_on AS owner_brn_issued_on
  FROM opportunities o LEFT JOIN contacts c ON c.id=o.contact_id LEFT JOIN leads l ON l.id=o.lead_id
  LEFT JOIN listings li ON li.id=o.listing_id LEFT JOIN provisional_external_properties ep ON ep.id=o.external_property_id
  LEFT JOIN LATERAL (SELECT pm.listing_id FROM property_matches pm WHERE pm.opportunity_id=o.id AND pm.listing_id IS NOT NULL ORDER BY pm.shortlisted_at DESC NULLS LAST,pm.created_at DESC LIMIT 1) chosen ON TRUE
  LEFT JOIN listings pmli ON pmli.id=chosen.listing_id LEFT JOIN brokers buyer_agent ON buyer_agent.id=o.buyer_side_agent_id
  LEFT JOIN brokers seller_agent ON seller_agent.id=o.inventory_side_agent_id
  LEFT JOIN transaction_counterparties buyer_agency ON buyer_agency.id=o.buyer_agency_counterparty_id
  LEFT JOIN transaction_counterparties seller_agency ON seller_agency.id=o.seller_agency_counterparty_id
  JOIN brokers owner ON owner.id=o.owner_id WHERE o.id=$1`;

async function scoped(req,id,client){
  const opportunity=await one(OPPORTUNITY,[id],client);if(!opportunity)return{error:[404,'Opportunity not found']};
  opportunity.participantIds=(await many('SELECT broker_id FROM opportunity_participants WHERE opportunity_id=$1 AND active',[id],client)).map(x=>x.brokerId);
  if(!canReadOpportunity(req.broker,opportunity))return{error:[403,'Opportunity is outside your permitted scope']};
  return{opportunity};
}

async function activeOrganization(client){
  const organization=await one("SELECT * FROM organization_settings WHERE status='active' LIMIT 1",[],client);
  if(!organization)throw Object.assign(new Error('Activate the NYSA Company Profile before issuing an approved document'),{status:409});
  const fallback=organization.defaultDocumentAgentId?await one('SELECT * FROM brokers WHERE id=$1 AND status=\'active\'',[organization.defaultDocumentAgentId],client):null;
  return{organization,fallback};
}

async function createImmutableDocument({client,req,opportunity,documentCode,title,data,pdf,idempotencyKey}){
  const existing=await one('SELECT i.*,dv.file_name FROM approved_document_issuances i JOIN document_versions dv ON dv.id=i.document_version_id WHERE i.idempotency_key=$1',[idempotencyKey],client);
  if(existing)return{existing:true,issuance:existing,documentVersionId:existing.documentVersionId};
  const documentId=uuid(),documentVersionId=uuid(),documentReference=`NYSA-DOC-${new Date().toISOString().slice(0,7).replace('-','')}-${documentId.slice(0,8).toUpperCase()}`,
    fileName=`${documentReference}-${documentCode.replaceAll('_','-')}.pdf`,pdfHash=crypto.createHash('sha256').update(pdf).digest('hex'),storageKey=await savePrivate(pdf,'.pdf');
  try{
    await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,contact_id,lead_id,listing_id)
      VALUES($1,$2,$3,$4,'Outbound','private','active',$5,$5,$6,$7,$8)`,[documentId,documentReference,documentCode,title,req.broker.id,opportunity.contactId||null,opportunity.leadId||null,opportunity.resolvedListingId||null],client);
    await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by)
      VALUES($1,$2,1,$3,'application/pdf',$4,$5,$6,1,'generated','private','generated',$7,$7)`,[documentVersionId,documentId,fileName,pdf.length,storageKey,pdfHash,req.broker.id],client);
    for(const [entityType,entityId] of approvedDocumentOpportunityLinks(opportunity))await execute(
      'INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES($1,$2,$3,$4,$5)',
      [uuid(),documentId,entityType,entityId,req.broker.id],client);
    const evidence=await recordApprovedDocumentIssuance({execute,uuid,client,documentCode,data,pdf,documentVersionId,sourceEntityType:'Opportunity',sourceEntityId:opportunity.id,issuedBy:req.broker.id,idempotencyKey});
    await audit('DocumentVersion',documentVersionId,'approved_document_issued',req.broker.id,{documentCode,documentId,opportunityId:opportunity.id,templateVersion:evidence.templateVersion,templateHash:evidence.templateHash,dataHash:evidence.dataHash,pdfHash:evidence.pdfHash},client);
    return{documentId,documentVersionId,documentReference,fileName,fileHash:pdfHash};
  }catch(error){await removePrivate(storageKey).catch(()=>{});throw error;}
}

async function createImmutableListingDocument({client,req,listing,documentCode,title,data,pdf,idempotencyKey}){
  const existing=await one('SELECT i.*,dv.file_name FROM approved_document_issuances i JOIN document_versions dv ON dv.id=i.document_version_id WHERE i.idempotency_key=$1',[idempotencyKey],client);
  if(existing)return{existing:true,issuance:existing,documentVersionId:existing.documentVersionId};
  const documentId=uuid(),documentVersionId=uuid(),documentReference=`NYSA-DOC-${new Date().toISOString().slice(0,7).replace('-','')}-${documentId.slice(0,8).toUpperCase()}`,
    fileName=`${documentReference}-${documentCode.replaceAll('_','-')}.pdf`,pdfHash=crypto.createHash('sha256').update(pdf).digest('hex'),storageKey=await savePrivate(pdf,'.pdf');
  try{
    await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,contact_id,listing_id)
      VALUES($1,$2,$3,$4,'Outbound','private','active',$5,$5,$6,$7)`,[documentId,documentReference,documentCode,title,req.broker.id,listing.ownerContactId||null,listing.id],client);
    await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by)
      VALUES($1,$2,1,$3,'application/pdf',$4,$5,$6,1,'generated','private','generated',$7,$7)`,[documentVersionId,documentId,fileName,pdf.length,storageKey,pdfHash,req.broker.id],client);
    await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES($1,$2,'Listing',$3,$4)`,[uuid(),documentId,listing.id,req.broker.id],client);
    if(listing.ownerContactId)await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES($1,$2,'Contact',$3,$4)`,[uuid(),documentId,listing.ownerContactId,req.broker.id],client);
    const evidence=await recordApprovedDocumentIssuance({execute,uuid,client,documentCode,data,pdf,documentVersionId,sourceEntityType:'Listing',sourceEntityId:listing.id,issuedBy:req.broker.id,idempotencyKey});
    await audit('DocumentVersion',documentVersionId,'approved_document_issued',req.broker.id,{documentCode,documentId,listingId:listing.id,templateVersion:evidence.templateVersion,templateHash:evidence.templateHash,dataHash:evidence.dataHash,pdfHash:evidence.pdfHash},client);
    return{documentId,documentVersionId,documentReference,fileName,fileHash:pdfHash};
  }catch(error){await removePrivate(storageKey).catch(()=>{});throw error;}
}

const LISTING_NOC=`SELECT l.*,b.name AS agent_name,b.email AS agent_email,b.phone AS agent_phone,b.brn AS agent_brn,b.brn_issued_on AS agent_brn_issued_on,
  owner.id AS owner_party_id,owner.contact_id AS owner_contact_id,COALESCE(c.full_name,owner.display_name) AS owner_name,
  COALESCE(c.phone,owner.phone) AS owner_phone,COALESCE(c.email,owner.email) AS owner_email,c.id_document_type AS owner_id_type,
  c.id_document_last4 AS owner_id_last4,c.id_document_expiry AS owner_id_expiry,c.postal_address AS owner_address
  FROM listings l JOIN brokers b ON b.id=l.posted_by
  LEFT JOIN LATERAL (SELECT p.* FROM inventory_counterparties p WHERE p.listing_id=l.id AND p.party_role IN ('seller','landlord','lessor','authorized_representative')
    ORDER BY CASE p.party_role WHEN 'seller' THEN 1 WHEN 'landlord' THEN 2 WHEN 'lessor' THEN 3 ELSE 4 END,p.created_at LIMIT 1) owner ON TRUE
  LEFT JOIN contacts c ON c.id=owner.contact_id WHERE l.id=$1 AND l.deleted_at IS NULL`;

function canReadListingNoc(broker,listing){return listing.workflowStatus==='approved'||listing.postedBy===broker.id||['manager','director'].includes(broker.jobRole);}
function canWriteListingNoc(broker,listing){return listing.postedBy===broker.id;}

function listingNocData({listing,organization,agent,draft}){
  const type=String(draft.propertyType||listing.propertyType||'').toLowerCase(),representation=draft.representationType||'non_exclusive';
  return{lineValues:[
    {label:'Listing Consultant',value:agent.name},{label:'Property Ref. No.',value:listing.inventoryReference},{label:'Date',value:date(draft.issueDate||new Date())},
    {label:'Full Name',value:draft.ownerName||listing.ownerName,index:0},{label:'ID / Passport No.',value:draft.ownerIdentity||[listing.ownerIdType,listing.ownerIdLast4&&`ending ${listing.ownerIdLast4}`].filter(Boolean).join(' ')||'Not recorded',index:0},
    {label:'Expiry Date',value:date(draft.ownerIdentityExpiry||listing.ownerIdExpiry),index:0},{label:'Mobile',value:draft.ownerPhone||listing.ownerPhone,index:0},{label:'Email',value:draft.ownerEmail||listing.ownerEmail,index:0},
    {label:'Full Name',value:draft.secondOwnerName,index:1},{label:'ID / Passport No.',value:draft.secondOwnerIdentity,index:1},{label:'Expiry Date',value:date(draft.secondOwnerIdentityExpiry),index:1},{label:'Mobile',value:draft.secondOwnerPhone,index:1},{label:'Email',value:draft.secondOwnerEmail,index:1},
    {label:'Building Name',value:draft.building||listing.building},{label:'Unit No.',value:draft.unitReference||listing.unitReference},{label:'Street Name',value:draft.streetName},{label:'Community',value:draft.community||listing.community||listing.area},
    {label:'BUA (sq ft)',value:draft.sizeSqft||listing.sizeSqft},{label:'Plot (sq ft)',value:draft.plotSizeSqft},{label:'Bedrooms',value:draft.bedrooms||listing.bedrooms},{label:'Bathrooms',value:draft.bathrooms},{label:'Parking',value:draft.parkingSpaces??listing.parkingSpaces},
    {label:'Vacating Date',value:date(draft.vacatingDate)},{label:'Rental / Sale Amount (AED)',value:Number(draft.amount||listing.price||0).toLocaleString('en-US')},
    {label:'Name',value:draft.ownerName||listing.ownerName,index:0},{label:'Date',value:date(draft.ownerSignedOn),index:1},{label:'Name',value:draft.secondOwnerName,index:1},{label:'Date',value:date(draft.secondOwnerSignedOn),index:2},{label:'Name',value:agent.name,index:2},{label:'Date',value:date(draft.nysaSignedOn),index:3}
  ],checkboxes:[
    {label:type.includes('villa')?'Villa':type.includes('commercial')?'Commercial':'Apartment'},
    ...(draft.finish?[{label:draft.finish}]:[]),...(draft.occupancyStatus?[{label:draft.occupancyStatus}]:[]),
    {label:representation==='exclusive'?'Exclusive':'Non-Exclusive'}
  ],textValues:[],replacements:{'Sunita Sinha':agent.name,'NYSA Realty LLC':organization.legalName||'NYSA Realty LLC','ORN 56017':`ORN ${organization.orn||'Not maintained'}`},
  terms:{representationType:representation,appointmentPeriod:draft.appointmentPeriod,sellerCommissionPercent:draft.sellerCommissionPercent,buyerCommissionPercent:draft.buyerCommissionPercent},
  inventoryReference:listing.inventoryReference,inventoryTitle:listing.inventoryHeadline||listing.project,ownerContactId:listing.ownerContactId};
}

r.get('/crm/listings/:id/approved-listing-noc',async(req,res)=>{
  const listing=await one(LISTING_NOC,[req.params.id]);if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!canReadListingNoc(req.broker,listing))return res.status(403).json({error:'Inventory is outside your permitted scope'});
  const [drafts,issuances,evidence]=await Promise.all([
    many("SELECT * FROM approved_document_drafts WHERE document_code='listing_noc' AND source_entity_type='Listing' AND source_entity_id=$1 ORDER BY updated_at DESC",[listing.id]),
    many("SELECT i.*,dv.file_name FROM approved_document_issuances i JOIN document_versions dv ON dv.id=i.document_version_id WHERE i.document_code='listing_noc' AND i.source_entity_type='Listing' AND i.source_entity_id=$1 ORDER BY i.issued_at DESC",[listing.id]),
    many(`SELECT e.*,dv.file_name,dv.file_hash,u.name AS created_by_name,reviewer.name AS reviewed_by_name
      FROM listing_noc_evidence_versions e JOIN document_versions dv ON dv.id=e.document_version_id JOIN brokers u ON u.id=e.created_by
      LEFT JOIN brokers reviewer ON reviewer.id=e.reviewed_by WHERE e.listing_id=$1 ORDER BY e.created_at DESC`,[listing.id])
  ]);res.json({listing,drafts,issuances,evidence,canEdit:canWriteListingNoc(req.broker,listing),canReview:['manager','director'].includes(req.broker.jobRole)});
});

r.put('/crm/listings/:id/approved-listing-noc/draft',async(req,res)=>{
  const listing=await one(LISTING_NOC,[req.params.id]);if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!canWriteListingNoc(req.broker,listing))return res.status(403).json({error:'Only the Inventory maintainer can prepare its Listing NOC'});
  const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>32768)return res.status(400).json({error:'Draft data must be a valid object no larger than 32 KB'});
  const expected=Number(req.body?.expectedVersion||0),row=await transaction(async client=>{
    const current=await one("SELECT * FROM approved_document_drafts WHERE document_code='listing_noc' AND source_entity_type='Listing' AND source_entity_id=$1 AND status='draft' FOR UPDATE",[listing.id],client);
    if(current&&expected!==current.version)return{conflict:true};
    if(current)return one('UPDATE approved_document_drafts SET draft_data=$1::jsonb,version=version+1,updated_by=$2,updated_at=NOW() WHERE id=$3 RETURNING *',[JSON.stringify(data),req.broker.id,current.id],client);
    if(expected)return{conflict:true};
    return one("INSERT INTO approved_document_drafts(id,document_code,source_entity_type,source_entity_id,draft_data,created_by,updated_by) VALUES($1,'listing_noc','Listing',$2,$3::jsonb,$4,$4) RETURNING *",[uuid(),listing.id,JSON.stringify(data),req.broker.id],client);
  });
  if(row.conflict)return res.status(409).json({error:'This draft changed after it was opened; reload before saving'});
  await audit('Document',row.id,'approved_document_draft_saved',req.broker.id,{documentCode:'listing_noc',listingId:listing.id,version:row.version});res.json(row);
});

r.post('/crm/listings/:id/approved-listing-noc/issue',async(req,res)=>{
  const result=await transaction(async client=>{
    const listing=await one(LISTING_NOC,[req.params.id],client);if(!listing)return{code:404,error:'Inventory not found'};
    if(!canWriteListingNoc(req.broker,listing))return{code:403,error:'Only the Inventory maintainer can issue its Listing NOC'};
    if(!['verified','not_required'].includes(listing.verificationStatus))return{code:409,error:'Verify the Internal Inventory before issuing a Listing NOC'};
    if(!listing.ownerPartyId)return{code:409,error:'Maintain the owner, landlord or authorized representative before preparing a Listing NOC'};
    const draft=await one("SELECT * FROM approved_document_drafts WHERE document_code='listing_noc' AND source_entity_type='Listing' AND source_entity_id=$1 AND status='draft' FOR UPDATE",[listing.id],client);
    if(!draft)return{code:409,error:'Save an editable Listing NOC draft before issue'};
    if(Number(req.body?.expectedVersion)!==draft.version)return{code:409,error:'This draft changed after it was opened; reload before issuing'};
    const {organization,fallback}=await activeOrganization(client),agent=selectDocumentAgent({id:listing.postedBy,name:listing.agentName,email:listing.agentEmail,phone:listing.agentPhone,brn:listing.agentBrn,brnIssuedOn:listing.agentBrnIssuedOn},fallback);
    if(agent.error)return{code:409,error:`${agent.error}. Maintain the assigned Agent BRN or Company Profile Default Document Agent.`};
    const data=listingNocData({listing,organization,agent,draft:draft.draftData||{}}),pdf=await renderApprovedDocumentPdf('listing_noc',data),issued=await createImmutableListingDocument({client,req,listing,documentCode:'listing_noc',title:`Listing NOC · ${listing.inventoryReference} · ${listing.inventoryHeadline||listing.project}`,data,pdf,idempotencyKey:`${draft.id}:${draft.version}`});
    if(!issued.existing)await execute("UPDATE approved_document_drafts SET status='issued',issued_document_version_id=$1,updated_by=$2,updated_at=NOW() WHERE id=$3 AND status='draft'",[issued.documentVersionId,req.broker.id,draft.id],client);
    return{...issued,documentCode:'listing_noc'};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.status(result.existing?200:201).json(result);
});

r.post('/crm/listings/:id/listing-noc-evidence',async(req,res)=>{
  const listing=await one(LISTING_NOC,[req.params.id]);if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!canWriteListingNoc(req.broker,listing))return res.status(403).json({error:'Only the Inventory maintainer can upload the executed Listing NOC'});
  const file=decodeAndValidateFile({...req.body,maxBytes:Number(process.env.MAX_DOCUMENT_BYTES||10485760),allowedTypes:['application/pdf']});if(file.error)return res.status(400).json({error:file.error});
  const reference=clean(req.body?.nocReference),issuedAt=clean(req.body?.issuedAt),expiresAt=clean(req.body?.expiresAt),sourceVersionId=clean(req.body?.sourceIssuedDocumentVersionId);
  if(!reference||reference.length<3)return res.status(400).json({error:'Listing NOC reference is required'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(issuedAt||''))return res.status(400).json({error:'Issue date is required'});
  if(expiresAt&&!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt))return res.status(400).json({error:'Expiry must be a valid date'});
  if(expiresAt&&expiresAt<issuedAt)return res.status(400).json({error:'Listing NOC expiry cannot precede its issue date'});
  const storageKey=await savePrivate(file.buffer,'.pdf');
  try{
    const result=await transaction(async client=>{
      if(await one("SELECT id FROM listing_noc_evidence_versions WHERE listing_id=$1 AND status='pending_verification'",[listing.id],client))return{code:409,error:'A signed Listing NOC is already awaiting independent review'};
      if(sourceVersionId&&!await one(`SELECT i.document_version_id FROM approved_document_issuances i WHERE i.document_version_id=$1 AND i.document_code='listing_noc' AND i.source_entity_type='Listing' AND i.source_entity_id=$2`,[sourceVersionId,listing.id],client))return{code:400,error:'Selected issued Listing NOC does not belong to this Inventory'};
      const latest=await one('SELECT COALESCE(MAX(version_number),0)::int AS version_number FROM listing_noc_evidence_versions WHERE listing_id=$1',[listing.id],client),prior=await one("SELECT id FROM listing_noc_evidence_versions WHERE listing_id=$1 AND status='active'",[listing.id],client),documentId=uuid(),documentVersionId=uuid(),documentReference=`NYSA-DOC-${new Date().toISOString().slice(0,7).replace('-','')}-${documentId.slice(0,8).toUpperCase()}`;
      await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,contact_id,listing_id)
        VALUES($1,$2,'listing_noc_executed',$3,'Inbound','restricted','active',$4,$4,$5,$6)`,[documentId,documentReference,`Executed Listing NOC · ${listing.inventoryReference}`,req.broker.id,listing.ownerContactId||null,listing.id],client);
      await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by)
        VALUES($1,$2,1,$3,'application/pdf',$4,$5,$6,1,'uploaded','restricted','received',$7,$7)`,[documentVersionId,documentId,file.fileName,file.buffer.length,storageKey,file.fileHash,req.broker.id],client);
      await execute(`INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES($1,$2,'Listing',$3,$4)`,[uuid(),documentId,listing.id,req.broker.id],client);
      const id=uuid(),evidence=await one(`INSERT INTO listing_noc_evidence_versions(id,listing_id,version_number,noc_reference,issued_at,expires_at,document_version_id,source_issued_document_version_id,status,supersedes_version_id,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'pending_verification',$9,$10) RETURNING *`,[id,listing.id,Number(latest.versionNumber)+1,reference,issuedAt,expiresAt||null,documentVersionId,sourceVersionId||null,prior?.id||null,req.broker.id],client);
      await audit('PropertyListingNoc',id,'submitted',req.broker.id,{listingId:listing.id,inventoryReference:listing.inventoryReference,documentVersionId,fileHash:file.fileHash,sourceIssuedDocumentVersionId:sourceVersionId||null},client);return{evidence};
    });
    if(result.error){await removePrivate(storageKey).catch(()=>{});return res.status(result.code).json({error:result.error});}res.status(201).json(result);
  }catch(error){await removePrivate(storageKey).catch(()=>{});throw error;}
});

r.post('/crm/listing-noc-evidence/:id/review',async(req,res)=>{
  if(!['manager','director'].includes(req.broker.jobRole))return res.status(403).json({error:'Manager or Director access required'});
  const decision=clean(req.body?.decision),reason=clean(req.body?.reason);if(!['activate','reject'].includes(decision)||!reason||reason.length<10)return res.status(400).json({error:'Select a valid decision and record a meaningful reason'});
  const result=await transaction(async client=>{
    const row=await one('SELECT * FROM listing_noc_evidence_versions WHERE id=$1 FOR UPDATE',[req.params.id],client);if(!row)return{code:404,error:'Listing NOC evidence not found'};
    if(row.status!=='pending_verification')return{code:409,error:'Only pending Listing NOC evidence can be reviewed'};
    if(row.createdBy===req.broker.id)return{code:403,error:'The uploader cannot review their own Listing NOC evidence'};
    if(decision==='activate'&&row.expiresAt&&String(row.expiresAt).slice(0,10)<new Date().toISOString().slice(0,10))return{code:409,error:'Expired Listing NOC evidence cannot be activated'};
    if(decision==='activate')await execute("UPDATE listing_noc_evidence_versions SET status='superseded' WHERE listing_id=$1 AND status='active'",[row.listingId],client);
    const status=decision==='activate'?'active':'rejected',evidence=await one('UPDATE listing_noc_evidence_versions SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_reason=$3 WHERE id=$4 RETURNING *',[status,req.broker.id,reason,row.id],client);
    await audit('PropertyListingNoc',row.id,decision==='activate'?'activated':'rejected',req.broker.id,{listingId:row.listingId,reason});return{evidence};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

function a2aData({code,opportunity,organization,agent,draft}){
  const buyerNysa=code==='a2a_buyer',nysaAgent=agent,otherAgent=buyerNysa?{
    name:opportunity.sellerAgentName,email:opportunity.sellerAgentEmail,phone:opportunity.sellerAgentPhone,brn:opportunity.sellerAgentBrn,brnIssuedOn:opportunity.sellerAgentBrnIssuedOn,agency:opportunity.sellerAgencyName,agencyEmail:opportunity.sellerAgencyEmail
  }:{name:opportunity.buyerAgentName,email:opportunity.buyerAgentEmail,phone:opportunity.buyerAgentPhone,brn:opportunity.buyerAgentBrn,brnIssuedOn:opportunity.buyerAgentBrnIssuedOn,agency:opportunity.buyerAgencyName,agencyEmail:opportunity.buyerAgencyEmail};
  return{lineValues:[
    {label:'Date',value:date(new Date())},{label:'Ref. No.',value:opportunity.opportunityReference},
    {label:'Name of Establishment',value:buyerNysa?otherAgent.agency:organization.legalName,index:0},{label:'Address',value:buyerNysa?draft.otherAgencyAddress:organization.registeredAddress,index:0},{label:'Email',value:buyerNysa?otherAgent.agencyEmail:organization.primaryEmail,index:0},{label:'DED Licence',value:buyerNysa?draft.otherAgencyLicence:organization.tradeLicenseNumber,index:0},{label:buyerNysa?'P.O. Box':'ORN',value:buyerNysa?draft.otherAgencyPoBox:(organization.orn||draft.nysaOrn),index:0},
    {label:'Name',value:buyerNysa?otherAgent.name:nysaAgent.name,index:0},{label:'BRN',value:buyerNysa?otherAgent.brn:nysaAgent.brn,index:0},{label:'Date Issued',value:date(buyerNysa?otherAgent.brnIssuedOn:nysaAgent.brnIssuedOn),index:0},{label:'Mobile',value:buyerNysa?otherAgent.phone:nysaAgent.phone,index:0},{label:'Email',value:buyerNysa?otherAgent.email:nysaAgent.email,index:1},
    {label:'Name of Establishment',value:buyerNysa?organization.legalName:otherAgent.agency,index:1},{label:'Address',value:buyerNysa?organization.registeredAddress:draft.otherAgencyAddress,index:1},{label:'Email',value:buyerNysa?organization.primaryEmail:otherAgent.agencyEmail,index:2},{label:'DED Licence',value:buyerNysa?organization.tradeLicenseNumber:draft.otherAgencyLicence,index:1},{label:buyerNysa?'ORN':'P.O. Box',value:buyerNysa?(organization.orn||draft.nysaOrn):draft.otherAgencyPoBox,index:0},
    {label:'Name',value:buyerNysa?nysaAgent.name:otherAgent.name,index:1},{label:'BRN',value:buyerNysa?nysaAgent.brn:otherAgent.brn,index:1},{label:'Date Issued',value:date(buyerNysa?nysaAgent.brnIssuedOn:otherAgent.brnIssuedOn),index:1},{label:'Mobile',value:buyerNysa?nysaAgent.phone:otherAgent.phone,index:1},{label:'Email',value:buyerNysa?nysaAgent.email:otherAgent.email,index:3},
    {label:"Seller's Agent Form A STR #",value:draft.sellerFormAStr},{label:"Buyer's Agent Form B STR #",value:draft.buyerFormBStr},
    {label:'Property Address',value:opportunity.propertyAddress},{label:'Master Developer',value:opportunity.developer},{label:'Master Project Name',value:opportunity.project},{label:'Building Name',value:opportunity.building},{label:'Listed Price (AED)',value:Number(opportunity.listedPrice||0).toLocaleString('en-US')},{label:'Description',value:[opportunity.inventoryReference,opportunity.inventoryTitle,opportunity.propertyType].filter(Boolean).join(' · ')},{label:'Maintenance Fee P.A.',value:draft.maintenanceFee},{label:'PSF',value:draft.maintenancePsf},{label:"Seller's Agent",value:draft.sellerAgentPercent},{label:"Buyer's Agent",value:draft.buyerAgentPercent},{label:"Buyer's Name",value:opportunity.customerName}
  ]};
}

r.get('/crm/opportunities/:id/approved-documents',async(req,res)=>{
  const {opportunity,error}=await scoped(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  const [drafts,issuances,viewings]=await Promise.all([
    many("SELECT * FROM approved_document_drafts WHERE source_entity_type='Opportunity' AND source_entity_id=$1 ORDER BY updated_at DESC",[opportunity.id]),
    many("SELECT i.*,dv.file_name FROM approved_document_issuances i JOIN document_versions dv ON dv.id=i.document_version_id WHERE i.source_entity_type='Opportunity' AND i.source_entity_id=$1 ORDER BY i.issued_at DESC",[opportunity.id]),
    many(`SELECT v.id,v.starts_at,v.location,v.outcome,v.feedback,li.inventory_reference,COALESCE(li.inventory_headline,li.project) AS inventory_title,li.project,li.community,li.unit_reference
      FROM viewings v JOIN listings li ON li.id=v.listing_id WHERE v.opportunity_id=$1 AND v.status='completed' ORDER BY v.starts_at`,[opportunity.id])
  ]);
  const availableA2aCodes=['buyer','dual'].includes(opportunity.representationPath)?['a2a_buyer']:[];if(['inventory','dual'].includes(opportunity.representationPath))availableA2aCodes.push('a2a_seller');
  res.json({opportunity,drafts,issuances,completedViewings:viewings,availableA2aCodes,canEdit:canWriteOpportunity(req.broker,opportunity)});
});

r.put('/crm/opportunities/:id/approved-document-drafts/:code',async(req,res)=>{
  const code=req.params.code;if(!codes.has(code))return res.status(400).json({error:'Unsupported approved document'});
  const {opportunity,error}=await scoped(req,req.params.id);if(error)return res.status(error[0]).json({error:error[1]});
  if(!canWriteOpportunity(req.broker,opportunity))return res.status(403).json({error:'Opportunity is outside your writable scope'});
  const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>32768)return res.status(400).json({error:'Draft data must be a valid object no larger than 32 KB'});
  const expected=Number(req.body?.expectedVersion||0),row=await transaction(async client=>{
    const current=await one("SELECT * FROM approved_document_drafts WHERE document_code=$1 AND source_entity_type='Opportunity' AND source_entity_id=$2 AND status='draft' FOR UPDATE",[code,opportunity.id],client);
    if(current&&expected!==current.version)return{conflict:true};
    if(current)return one('UPDATE approved_document_drafts SET draft_data=$1::jsonb,version=version+1,updated_by=$2,updated_at=NOW() WHERE id=$3 RETURNING *',[JSON.stringify(data),req.broker.id,current.id],client);
    if(expected)return{conflict:true};
    return one("INSERT INTO approved_document_drafts(id,document_code,source_entity_type,source_entity_id,draft_data,created_by,updated_by) VALUES($1,$2,'Opportunity',$3,$4::jsonb,$5,$5) RETURNING *",[uuid(),code,opportunity.id,JSON.stringify(data),req.broker.id],client);
  });
  if(row.conflict)return res.status(409).json({error:'This draft changed after it was opened; reload before saving'});
  await audit('Document',row.id,'approved_document_draft_saved',req.broker.id,{documentCode:code,opportunityId:opportunity.id,version:row.version});res.json(row);
});

r.post('/crm/opportunities/:id/approved-document-drafts/:code/issue',async(req,res)=>{
  const code=req.params.code;if(!codes.has(code))return res.status(400).json({error:'Unsupported approved document'});
  const result=await transaction(async client=>{
    const {opportunity,error}=await scoped(req,req.params.id,client);if(error)return{code:error[0],error:error[1]};
    if(!canWriteOpportunity(req.broker,opportunity))return{code:403,error:'Opportunity is outside your writable scope'};
    const draft=await one("SELECT * FROM approved_document_drafts WHERE document_code=$1 AND source_entity_type='Opportunity' AND source_entity_id=$2 AND status='draft' FOR UPDATE",[code,opportunity.id],client);
    if(!draft)return{code:409,error:'Save an editable draft before issuing this document'};
    if(Number(req.body?.expectedVersion)!==draft.version)return{code:409,error:'This draft changed after it was opened; reload before issuing'};
    const {organization,fallback}=await activeOrganization(client),agent=selectDocumentAgent(req.broker.id===opportunity.ownerId?req.broker:{id:opportunity.ownerId,name:opportunity.ownerName,email:opportunity.ownerEmail,phone:opportunity.ownerPhone,brn:opportunity.ownerBrn,brnIssuedOn:opportunity.ownerBrnIssuedOn},fallback);
    if(agent.error)return{code:409,error:`${agent.error}. Maintain the assigned Agent BRN or Company Profile Default Document Agent.`};
    let data,title;
    if(code==='viewing_confirmation'){
      const ids=Array.isArray(draft.draftData?.viewingIds)?[...new Set(draft.draftData.viewingIds)]:[];
      const rows=await many(`SELECT v.*,li.inventory_reference,COALESCE(li.inventory_headline,li.project) AS inventory_title,li.project,li.community,li.unit_reference
        FROM viewings v JOIN listings li ON li.id=v.listing_id WHERE v.id=ANY($1::uuid[]) AND v.opportunity_id=$2 AND v.status='completed' ORDER BY v.starts_at`,[ids,opportunity.id],client);
      const selection=validateViewingConfirmationSelection(ids,rows);if(selection.error)return{code:selection.error.startsWith('Select')?400:409,error:selection.error};
      data={lineValues:[{label:'Date',value:date(new Date()),index:0},{label:'Ref. No.',value:opportunity.opportunityReference},{label:'Full Name',value:opportunity.customerName,index:0},{label:'Nationality',value:opportunity.nationality},{label:'Passport / EID No.',value:opportunity.idDocumentLast4?`${opportunity.idDocumentType||'ID'} ending ${opportunity.idDocumentLast4}`:'Not recorded'},{label:'Mobile',value:opportunity.customerPhone},{label:'Email',value:opportunity.customerEmail},{label:'Name',value:opportunity.customerName,index:0},{label:'Name',value:agent.name,index:1},{label:'BRN',value:agent.brn},{label:'Mobile',value:agent.phone,index:1}],table:{selector:'table',headerRows:1,rows:rows.map((v,index)=>[index+1,dateTime(v.startsAt),[v.project,v.community].filter(Boolean).join(' · '),v.unitReference||'-',v.inventoryReference,'Viewing',''])}};
      title=`Viewing Confirmation · ${opportunity.opportunityReference}`;
    }else{
      const priorIssue=await one("SELECT id FROM approved_document_issuances WHERE document_code=$1 AND source_entity_type='Opportunity' AND source_entity_id=$2 LIMIT 1",[code,opportunity.id],client);
      const downstream=await one('SELECT id FROM viewings WHERE opportunity_id=$1 UNION ALL SELECT id FROM offers WHERE opportunity_id=$1 LIMIT 1',[opportunity.id],client),d=draft.draftData||{},otherAgent=code==='a2a_buyer'
        ?{name:opportunity.sellerAgentName,brn:opportunity.sellerAgentBrn,brnIssuedOn:opportunity.sellerAgentBrnIssuedOn,agency:opportunity.sellerAgencyName}
        :{name:opportunity.buyerAgentName,brn:opportunity.buyerAgentBrn,brnIssuedOn:opportunity.buyerAgentBrnIssuedOn,agency:opportunity.buyerAgencyName},
        prerequisite=validateA2aIssue({code,representationPath:opportunity.representationPath,hasProperty:Boolean(opportunity.resolvedListingId||opportunity.externalPropertyId),otherAgent,organization,draft:d,hasPriorIssue:Boolean(priorIssue),hasDownstream:Boolean(downstream)});
      if(prerequisite.error)return{code:409,error:prerequisite.error};
      data=a2aData({code,opportunity,organization,agent,draft:d});title=`${code==='a2a_buyer'?'A2A Buyer':'A2A Seller'} · ${opportunity.opportunityReference}`;
    }
    const pdf=await renderApprovedDocumentPdf(code,data),issued=await createImmutableDocument({client,req,opportunity,documentCode:code,title,data,pdf,idempotencyKey:`${draft.id}:${draft.version}`});
    if(!issued.existing)await execute("UPDATE approved_document_drafts SET status='issued',issued_document_version_id=$1,updated_by=$2,updated_at=NOW() WHERE id=$3 AND status='draft'",[issued.documentVersionId,req.broker.id,draft.id],client);
    return{...issued,documentCode:code};
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.status(result.existing?200:201).json(result);
});

export default r;
