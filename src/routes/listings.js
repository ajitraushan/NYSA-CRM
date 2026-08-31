import { Router } from '../lib/http-kit.js';
import path from 'node:path';
import { one, many, execute, uuid, audit, transaction } from '../db.js';
import { requireAuth, requirePostRights } from '../auth.js';
import { PAYMENT_PLANS,PROPERTY_TYPES,BEDROOMS,normalizeInventoryAmount,normalizeHandover,normalizeBulkUnits,derivePublicationReadiness } from '../inventory-domain.js';
import { listingWorkflowNextStep,listingWorkflowQueue,validateListingWorkflowAction } from '../listing-workflow-domain.js';
import { validateVerificationSubmission,validateVerificationDecision,listingStatusForVerificationDecision } from '../inventory-verification-domain.js';
import { validateInventoryPartyInput } from '../inventory-party-domain.js';
import { inventoryAgentEligibilitySql,inventoryAgentScopeSql } from '../inventory-agent-governance.js';
import { inspectInventoryDuplicate,inventoryDuplicateError,normalizeInventoryIdentity } from '../inventory-duplicate-gate.js';
import { PARTNER_ORGANIZATION_POLICY_VERSION,partnerClassificationForRelationship,validateInventoryOrganizationLinkEvent } from '../partner-organization-domain.js';
import { companyScopeSql } from '../crm-policy.js';
import { PORTAL_FIELD_CATALOGUE,PROPERTY_FINDER_CONTENT_LIMITS,PROPERTY_FINDER_PROPERTY_TYPES,inventoryPortalSnapshot,normalizePortalPreparation,portalPayloadHash,portalReadiness,
  normalizePortalPermitEvidence,validatePortalFieldMapping,validatePortalMappingVersion } from '../portal-publication-domain.js';
import { decodeAndValidateFile,savePrivate,removePrivate,readPrivate } from '../private-files.js';

const r = Router();
r.use(requireAuth);

const STATUSES = ['Available','Assigned','Reserved','Sold','Rented','Closed'];
const TIERS = ['Exclusive to Nysa','Shared network','Off-market'];
const CLOSED_REASONS = ['Withdrawn','Expired','Duplicate','Invalid','No longer marketable'];
const VERIFICATION_STATUSES = ['unverified','pending','verified','expired','not_required'];
const TRANSACTION_TYPES = ['Sale','Rental','Off-plan','Commercial'];
const EDITABLE = ['project','developer','areaId','communityId','buildingId','community','building','unitReference','propertyType','bedrooms','parkingSpaces','sizeSqft','price','referencePrice',
  'transactionTypes',
  'currency','paymentPlanType','downPaymentPercent','onHandoverPercent','postHandoverYears','paymentPlanNotes',
  'inventoryHeadline','handoverDate','handoverStatus','handoverExpectedDate','exclusivityTier','notes','availabilityConfirmedAt','availabilityExpiresAt','verificationExpiresAt','permitNumber','permitExpiresAt'];
const COLUMN = {
  project:'project', developer:'developer', areaId:'area_id', communityId:'community_id',buildingId:'building_id',community:'community', building:'building', unitReference:'unit_reference', propertyType:'property_type', bedrooms:'bedrooms', parkingSpaces:'parking_spaces',
  sizeSqft:'size_sqft', price:'price', referencePrice:'reference_price', currency:'currency',
  transactionTypes:'transaction_types',
  paymentPlanType:'payment_plan_type', downPaymentPercent:'down_payment_percent',
  onHandoverPercent:'on_handover_percent', postHandoverYears:'post_handover_years',
  paymentPlanNotes:'payment_plan_notes', handoverDate:'handover_date',handoverStatus:'handover_status',handoverExpectedDate:'handover_expected_date',exclusivityTier:'exclusivity_tier',
  inventoryHeadline:'inventory_headline', notes:'notes', availabilityConfirmedAt:'availability_confirmed_at',availabilityExpiresAt:'availability_expires_at',verificationStatus:'verification_status',
  verificationExpiresAt:'verification_expires_at',permitNumber:'permit_number',permitExpiresAt:'permit_expires_at'
};

function withDiscount(listing) {
  const discountPercent = listing.referencePrice && Number(listing.referencePrice) > 0
    ? Math.round(((Number(listing.referencePrice) - Number(listing.price)) / Number(listing.referencePrice)) * 1000) / 10 : null;
  const readiness=derivePublicationReadiness(listing,listing.approvedMediaCount||0);
  return { ...listing, discountPercent,publicationReadiness:readiness,portalStatus:listing.portalStatus==='published'?'published':readiness.status };
}

async function governedArea(areaId,client){
  if(!areaId)return null;
  return one('SELECT id,business_label,emirate FROM areas WHERE id=$1 AND active=1',[areaId],client);
}

async function replaceBulkUnits(listingId,units,client){
  await execute('DELETE FROM listing_units WHERE listing_id=$1',[listingId],client);
  for(let index=0;index<units.length;index++){
    const unit=units[index];
    await one(`INSERT INTO listing_units(id,listing_id,unit_reference,property_type,bedrooms,size_sqft,price,display_order)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[uuid(),listingId,unit.unitReference,unit.propertyType,unit.bedrooms,unit.sizeSqft,unit.price,index],client);
  }
}

const isReviewer=broker=>broker.role==='admin'||broker.jobRole==='manager';
const canCreateListing=broker=>broker.role==='admin'||['listing_agent','admin_assistant','manager'].includes(broker.jobRole);
const ownsListing=(broker,listing)=>listing.postedBy===broker.id;
async function listingApprovalPolicy(){return (await one('SELECT manager_approval_required FROM listing_approval_policy LIMIT 1'))||{managerApprovalRequired:true};}
async function canReview(broker,listing,client){
  if(broker.role==='admin')return true;
  if(broker.jobRole!=='manager')return false;
  if((broker.managedTeamIds||[]).includes(String(listing.postedByTeamId||'')))return true;
  return Boolean(await one(`SELECT 1 AS allowed FROM brokers owner JOIN teams t ON t.id=owner.team_id
    WHERE owner.id=$1 AND (t.manager_id=$2
      OR EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.team_id=t.id AND tm.broker_id=$2 AND tm.membership_role='manager' AND tm.ends_at IS NULL)
      OR EXISTS(SELECT 1 FROM user_role_assignments ur WHERE ur.team_id=t.id AND ur.broker_id=$2 AND ur.job_role='manager' AND ur.status='active' AND ur.ends_at IS NULL))`,[listing.postedBy,broker.id],client));
}
async function canAdministrativelyClose(broker,listing,client){
  return broker.jobRole==='manager'&&await canReview(broker,listing,client);
}

async function refreshReadiness(id,client){const listing=await one(`SELECT l.*,nysa_inventory_effective_status(l.id) AS effective_status,
  (SELECT COUNT(*)::int FROM listing_units u WHERE u.listing_id=l.id) AS bulk_unit_count,
  0::int AS incomplete_bulk_unit_count,
  (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
  FROM listings l WHERE l.id=$1`,[id],client);if(!listing)return null;const readiness=derivePublicationReadiness(listing,listing.approvedMediaCount);const portalStatus=listing.portalStatus==='published'?'published':readiness.status;const updated=await one('UPDATE listings SET portal_status=$1 WHERE id=$2 RETURNING *',[portalStatus,id],client);return{...updated,effectiveStatus:listing.effectiveStatus,approvedMediaCount:listing.approvedMediaCount,bulkUnitCount:listing.bulkUnitCount,incompleteBulkUnitCount:0};}

function canEdit(broker, listing) {
  return broker.role === 'admin' || broker.jobRole==='admin_assistant' || listing.postedBy === broker.id;
}

async function developerExternalListingAuthority(listingId,client){
  const developer=await one(`SELECT p.id AS partner_version_id,p.company_id,p.legal_name
    FROM inventory_organization_link_events e JOIN partner_organization_versions p ON p.id=e.partner_version_id
    WHERE e.id=(SELECT id FROM inventory_organization_link_events WHERE listing_id=$1 AND relationship='developer' ORDER BY performed_at DESC,id DESC LIMIT 1)
      AND e.action<>'unlinked' AND p.classification='developer' AND p.status='active'`,[listingId],client);
  if(!developer)return{required:false,ready:true};
  const arrangement=await one(`SELECT id,arrangement_reference,effective_from,effective_to FROM developer_brokerage_arrangement_versions
    WHERE partner_version_id=$1 AND status='active' AND effective_from<=CURRENT_DATE AND (effective_to IS NULL OR effective_to>=CURRENT_DATE)`,[developer.partnerVersionId],client);
  const noc=await one(`SELECT id,noc_reference,issued_at,expires_at FROM property_listing_noc_versions
    WHERE listing_id=$1 AND partner_version_id=$2 AND status='active' AND issued_at<=CURRENT_DATE AND (expires_at IS NULL OR expires_at>=CURRENT_DATE)`,[listingId,developer.partnerVersionId],client);
  return{required:true,ready:Boolean(arrangement&&noc),developer,arrangement,noc,
    error:!arrangement?'An active Developer Brokerage Arrangement is required before preparing this Developer Inventory for external listing':!noc?'A current property-specific Developer Listing NOC is required before preparing this Inventory for external listing':null};
}

function validateListingFields(body) {
  if(body.transactionTypes!==undefined&&(!Array.isArray(body.transactionTypes)||!body.transactionTypes.length||new Set(body.transactionTypes).size!==body.transactionTypes.length||body.transactionTypes.some(value=>!TRANSACTION_TYPES.includes(value))))return 'Select one or more valid Inventory transaction types';
  if (body.currency !== undefined && !/^[A-Z]{3}$/.test(String(body.currency))) return 'currency must be a 3-letter ISO code';
  for (const field of ['sizeSqft', 'referencePrice', 'downPaymentPercent', 'onHandoverPercent', 'postHandoverYears']) {
    if (body[field] !== undefined && body[field] !== null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) return `${field} must be a non-negative number`;
  }
  for (const field of ['downPaymentPercent', 'onHandoverPercent']) {
    if (body[field] !== undefined && body[field] !== null && Number(body[field]) > 100) return `${field} cannot exceed 100`;
  }
  if(body.handoverStatus!==undefined||body.handoverExpectedDate!==undefined||body.handoverDate!==undefined){const handover=normalizeHandover(body);if(handover.error)return handover.error;}
  for(const field of ['availabilityConfirmedAt','availabilityExpiresAt','verificationExpiresAt','permitExpiresAt'])if(body[field]!==undefined&&body[field]!==null&&body[field]!==''&&Number.isNaN(new Date(body[field]).valueOf()))return `${field} must be a valid date/time`;
  if(body.availabilityConfirmedAt&&body.availabilityExpiresAt&&new Date(body.availabilityExpiresAt)<=new Date(body.availabilityConfirmedAt))return 'availabilityExpiresAt must be later than availabilityConfirmedAt';
  if(body.verificationStatus!==undefined&&!VERIFICATION_STATUSES.includes(body.verificationStatus))return 'Invalid verificationStatus';
  if(body.portalStatus!==undefined)return 'Portal readiness is calculated by the system and cannot be edited';
  return null;
}

r.get('/inventory-location-options',async(req,res)=>{const params=[],areaId=String(req.query.areaId||'').trim();let areaClause='';if(areaId){params.push(areaId);areaClause=`AND c.area_id=$${params.length}`;}const communities=await many(`SELECT c.id,c.stable_code,c.area_id,v.business_label,v.version_number FROM market_communities c JOIN market_community_versions v ON v.community_id=c.id AND v.status='active' WHERE 1=1 ${areaClause} ORDER BY v.business_label`,params),communityIds=communities.map(item=>item.id),buildings=communityIds.length?await many(`SELECT id,stable_code,community_id,business_label,external_mapping_status FROM inventory_buildings WHERE active=TRUE AND community_id=ANY($1::uuid[]) ORDER BY business_label`,[communityIds]):[];res.json({communities,buildings});});

r.get('/listings', async (req, res) => {
  const q = req.query;
  const where = ['l.deleted_at IS NULL'];
  const params = [];
  if(req.broker.jobRole==='listing_agent'){
    if(q.workspaceScope==='approved')where.push("l.workflow_status='approved'");
    else{
      params.push(req.broker.id);
      if(q.workspaceScope==='mine')where.push(`l.posted_by=$${params.length}`);
      else where.push(`(l.workflow_status='approved' OR l.posted_by=$${params.length})`);
    }
  }
  if(body.parkingSpaces!==undefined&&body.parkingSpaces!==null&&body.parkingSpaces!==''&&(!Number.isInteger(Number(body.parkingSpaces))||Number(body.parkingSpaces)<0))return 'parkingSpaces must be a non-negative whole number';
  else if(req.broker.jobRole==='manager'){params.push(req.broker.managedTeamIds||[]);where.push(`(l.workflow_status='approved' OR b.team_id=ANY($${params.length}::uuid[]))`);}
  else if(req.broker.role!=='admin'&&req.broker.jobRole!=='admin_assistant')where.push("l.workflow_status='approved'");
  const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };
  if (q.area) add('l.area ILIKE ?', `%${q.area}%`);
  if (q.areaId) add('l.area_id = ?', q.areaId);
  if (q.community) add('l.community ILIKE ?', `%${q.community}%`);
  if (q.propertyType && PROPERTY_TYPES.includes(q.propertyType)) add('l.property_type = ?', q.propertyType);
  if (q.bedrooms && BEDROOMS.includes(q.bedrooms)) add('l.bedrooms = ?', q.bedrooms);
  if (q.minPrice && Number.isFinite(+q.minPrice)) add('l.price >= ?', +q.minPrice);
  if (q.maxPrice && Number.isFinite(+q.maxPrice)) add('l.price <= ?', +q.maxPrice);
  if (q.paymentPlanType && PAYMENT_PLANS.includes(q.paymentPlanType)) add('l.payment_plan_type = ?', q.paymentPlanType);
  if (q.status && STATUSES.includes(q.status)) add('nysa_inventory_effective_status(l.id) = ?', q.status);
  if(q.workflowStatus&&(isReviewer(req.broker)||req.broker.jobRole==='listing_agent')&&['draft','in_review','approved','changes_requested','blocked'].includes(q.workflowStatus))add('l.workflow_status = ?',q.workflowStatus);
  if (q.exclusivityTier && TIERS.includes(q.exclusivityTier)) add('l.exclusivity_tier = ?', q.exclusivityTier);
  if (q.developer) add('l.developer ILIKE ?', `%${q.developer}%`);
  if (q.handoverBefore) add("(l.handover_date = 'Ready' OR l.handover_date <= ?)", q.handoverBefore);
  if (q.handoverAfter) add("(l.handover_date != 'Ready' AND l.handover_date >= ?)", q.handoverAfter);
  if (q.q) {
    const term = `%${String(q.q).replaceAll('*','%')}%`;
    params.push(term);
    where.push(`(l.inventory_reference ILIKE $${params.length} OR l.inventory_headline ILIKE $${params.length} OR l.project ILIKE $${params.length} OR l.developer ILIKE $${params.length} OR l.area ILIKE $${params.length} OR l.community ILIKE $${params.length})`);
  }
  const sorts = {
    newest: 'l.created_at DESC', price_asc: 'l.price ASC', price_desc: 'l.price DESC',
    discount: '(CASE WHEN l.reference_price > 0 THEN (l.reference_price - l.price) / l.reference_price ELSE -1 END) DESC',
    handover: "(CASE WHEN l.handover_date = 'Ready' THEN '0000' ELSE COALESCE(l.handover_date,'9999') END) ASC"
  };
  const page=Math.max(1,Number.parseInt(q.page,10)||1),pageSize=Math.min(100,Math.max(1,Number.parseInt(q.pageSize,10)||25)),offset=(page-1)*pageSize;
  const total=Number((await one(`SELECT COUNT(*)::int AS count FROM listings l JOIN brokers b ON b.id=l.posted_by WHERE ${where.join(' AND ')}`,params)).count||0);
  const rows = await many(`SELECT l.*, nysa_inventory_effective_status(l.id) AS effective_status,
    b.name AS posted_by_name, b.brokerage AS posted_by_brokerage,
    b.team_id AS posted_by_team_id,
    reservation.booking_reference AS active_booking_reference,reservation.opportunity_id AS active_booking_opportunity_id,
    reservation.opportunity_reference AS active_booking_opportunity_reference,reservation.expires_at AS active_booking_expires_at,
    (SELECT COUNT(*)::int FROM listing_units u WHERE u.listing_id=l.id) AS bulk_unit_count,
    0::int AS incomplete_bulk_unit_count,
    (SELECT COUNT(*)::int FROM comments c WHERE c.listing_id = l.id AND c.deleted_at IS NULL) AS comment_count,
    (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
    FROM listings l JOIN brokers b ON b.id = l.posted_by
    LEFT JOIN LATERAL (SELECT bk.booking_reference,o.id AS opportunity_id,o.opportunity_reference,bk.expires_at
      FROM bookings bk JOIN opportunities o ON o.id=bk.opportunity_id
      WHERE bk.listing_id=l.id AND bk.status='reserved' ORDER BY bk.created_at DESC LIMIT 1) reservation ON TRUE
    WHERE ${where.join(' AND ')} ORDER BY ${sorts[q.sort] || sorts.newest} LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params,pageSize,offset]);
  res.json({ count: total, page, pageSize, listings: rows.map(row=>withDiscount({...row,storedStatus:row.status,status:row.effectiveStatus})) });
});

r.get('/inventory-agents',async(req,res)=>{
  const params=[],scope=inventoryAgentScopeSql(req.broker,'b',params),inventoryAgents=await many(`SELECT b.id,b.name,b.email,b.phone,b.job_title,b.job_role
    FROM brokers b
    WHERE b.status='active' AND b.role IN ('admin','internal_broker')
      AND ${inventoryAgentEligibilitySql('b')} AND ${scope}
    ORDER BY b.name,b.id`,params);
  res.json({inventoryAgents});
});

r.get('/inventory-developers',async(_req,res)=>{
  const inventoryDevelopers=await many(`SELECT v.id AS partner_version_id,v.version_number,v.legal_name,v.trade_name,c.id AS company_id,c.name AS company_name
    FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id
    WHERE v.status='active' AND v.classification='developer' AND c.archived_at IS NULL AND c.status='active'
    ORDER BY LOWER(COALESCE(v.trade_name,v.legal_name)),v.version_number DESC,v.id`);
  res.json({inventoryDevelopers});
});

r.get('/inventory-owner-customers',async(req,res)=>{
  const q=String(req.query.q||'').trim(),params=[],where=["c.archived_at IS NULL","c.lifecycle_status<>'merged'"];
  if(q){params.push(`%${q}%`);where.push(`(c.full_name ILIKE $1 OR COALESCE(c.email,'') ILIKE $1 OR COALESCE(c.phone,'') ILIKE $1 OR COALESCE(c.postal_address,'') ILIKE $1)`);}
  const customers=await many(`SELECT c.id,c.full_name,c.email,c.phone,c.postal_address,c.kyc_status,
    c.lifecycle_status,c.duplicate_review_status FROM contacts c WHERE ${where.join(' AND ')}
    ORDER BY LOWER(c.full_name),c.id LIMIT 50`,params);
  res.json({customers});
});

r.get('/listings-workspace',async(req,res)=>{
  if(req.broker.jobRole!=='listing_agent'&&req.broker.role!=='admin'&&req.broker.jobRole!=='admin_assistant')return res.status(403).json({error:'Listing Executive workspace is outside your role'});
  const params=[],scope=req.broker.jobRole==='listing_agent'?(params.push(req.broker.id),'l.posted_by=$1'):'TRUE';
  const rows=await many(`SELECT l.*,nysa_inventory_effective_status(l.id) AS effective_status,b.name AS posted_by_name,b.team_id AS posted_by_team_id,
    (SELECT COUNT(*)::int FROM listing_units u WHERE u.listing_id=l.id) AS bulk_unit_count,
    0::int AS incomplete_bulk_unit_count,
    (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count,
    (SELECT m.id FROM property_media m WHERE m.listing_id=l.id AND m.is_cover=TRUE AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp') ORDER BY m.display_order,m.created_at,m.id LIMIT 1) AS cover_media_id
    FROM listings l JOIN brokers b ON b.id=l.posted_by WHERE l.deleted_at IS NULL AND ${scope} ORDER BY l.updated_at DESC LIMIT 500`,params);
  const listings=rows.map(row=>withDiscount({...row,storedStatus:row.status,status:row.effectiveStatus})).map(item=>{const queue=listingWorkflowQueue(item);return {...item,queue,nextStep:listingWorkflowNextStep(queue)};});
  const counts={active:0,drafts:0,awaitingReview:0,changesRequested:0,availabilityRefresh:0,pendingVerification:0,expiringPermits:0,incompleteMedia:0,readinessBlocks:0};
  for(const item of listings){
    if(item.workflowStatus==='approved'&&!['Closed','Sold','Rented'].includes(item.status))counts.active++;
    if(item.workflowStatus==='draft')counts.drafts++;
    if(item.workflowStatus==='in_review')counts.awaitingReview++;
    if(item.workflowStatus==='changes_requested')counts.changesRequested++;
    if(['Closed','Sold','Rented'].includes(item.status))continue;
    if(item.queue==='availability_refresh')counts.availabilityRefresh++;
    if(!['verified','not_required'].includes(item.verificationStatus))counts.pendingVerification++;
    if(item.permitExpiresAt&&new Date(item.permitExpiresAt)-new Date()<30*86400000)counts.expiringPermits++;
    if(!Number(item.approvedMediaCount||0))counts.incompleteMedia++;
    if(!item.publicationReadiness?.ready)counts.readinessBlocks++;
  }
  counts.intakeAttention=Number((await one("SELECT COUNT(*)::int AS count FROM listing_intake_events WHERE assigned_to=$1 AND status IN ('failed','unmapped','duplicate_review')",[req.broker.id])).count||0);
  res.json({counts,listings});
});

r.get('/listings-approval-queue',async(req,res)=>{
  return res.status(410).json({error:'Inventory approval was consolidated into mandatory Inventory verification. Use the Inventory verification queue.'});
  /*
  if(req.broker.jobRole!=='manager')return res.status(403).json({error:'Listing approval queue requires the responsible Team Manager'});
  const q=String(req.query.q||'').trim().toLowerCase(),page=Math.max(1,Number(req.query.page)||1),pageSize=Math.min(100,Math.max(1,Number(req.query.pageSize)||20)),params=[req.broker.id],search=[];
  if(q){params.push(`%${q}%`);search.push(`(LOWER(l.project) LIKE $${params.length} OR LOWER(COALESCE(l.inventory_reference,'')) LIKE $${params.length} OR LOWER(COALESCE(l.area,'')) LIKE $${params.length} OR LOWER(COALESCE(l.community,'')) LIKE $${params.length} OR LOWER(COALESCE(l.property_type,'')) LIKE $${params.length} OR LOWER(COALESCE(owner.name,'')) LIKE $${params.length} OR LOWER(t.name) LIKE $${params.length})`);}
  const where=`l.deleted_at IS NULL AND l.workflow_status='in_review' AND t.active=1 AND (t.manager_id=$1 OR EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.team_id=t.id AND tm.broker_id=$1 AND tm.membership_role='manager' AND tm.ends_at IS NULL))${search.length?' AND '+search.join(' AND '):''}`;
  const count=Number((await one(`SELECT COUNT(*)::int AS count FROM listings l JOIN brokers owner ON owner.id=l.posted_by JOIN teams t ON t.id=owner.team_id WHERE ${where}`,params)).count||0);
  params.push(pageSize,(page-1)*pageSize);
  const listings=await many(`SELECT l.id,l.inventory_reference,l.project,l.area,l.community,l.property_type,l.price,l.currency,l.submitted_at,l.updated_at,
    owner.name AS submitted_by,t.id AS team_id,t.name AS team_name,
    (SELECT m.id FROM property_media m WHERE m.listing_id=l.id AND m.is_cover=TRUE AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp') ORDER BY m.display_order,m.created_at,m.id LIMIT 1) AS cover_media_id
    FROM listings l JOIN brokers owner ON owner.id=l.posted_by JOIN teams t ON t.id=owner.team_id
    WHERE ${where} ORDER BY COALESCE(l.submitted_at,l.updated_at) DESC,l.id DESC LIMIT $${params.length-1} OFFSET $${params.length}`,params);
  res.json({listingApprovals:listings,count,page,pageSize});
  */
});

r.get('/inventory-verification-queue',async(req,res)=>{
  if(!isReviewer(req.broker))return res.status(403).json({error:'Inventory verification queue requires Manager or Administrator access'});
  const params=[],where=["vr.status='pending'","l.deleted_at IS NULL"];
  if(req.broker.role!=='admin'){
    params.push(req.broker.id);
    where.push(`(t.manager_id=$${params.length} OR EXISTS(
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id=t.id AND tm.broker_id=$${params.length}
        AND tm.membership_role='manager' AND tm.ends_at IS NULL
    ) OR EXISTS(
      SELECT 1 FROM user_role_assignments ur
      WHERE ur.team_id=t.id AND ur.broker_id=$${params.length}
        AND ur.job_role='manager' AND ur.status='active' AND ur.ends_at IS NULL
    ))`);
  }
  const requests=await many(`SELECT vr.*,l.inventory_reference,l.project,l.area,l.verification_status,
      submitter.name AS submitted_by_name,maintainer.name AS inventory_owner_name,t.name AS team_name
    FROM inventory_verification_requests vr
    JOIN listings l ON l.id=vr.listing_id
    JOIN brokers submitter ON submitter.id=vr.submitted_by
    JOIN brokers maintainer ON maintainer.id=l.posted_by
    LEFT JOIN teams t ON t.id=maintainer.team_id
    WHERE ${where.join(' AND ')}
    ORDER BY vr.submitted_at`,params);
  res.json({verificationRequests:requests,count:requests.length});
});

r.post('/listings/:id/verification-requests',async(req,res)=>{
  const result=await transaction(async client=>{
    const listing=await one(`SELECT l.*,b.team_id AS posted_by_team_id
      FROM listings l JOIN brokers b ON b.id=l.posted_by
      WHERE l.id=$1 AND l.deleted_at IS NULL FOR UPDATE`,[req.params.id],client);
    if(!listing)return {code:404,error:'Inventory not found'};
    if(!canEdit(req.broker,listing))return {code:403,error:'Only the Listing Executive who created this Inventory or an authorized Administrator can submit it for verification'};
    if(await one("SELECT id FROM inventory_verification_requests WHERE listing_id=$1 AND status='pending'",[listing.id],client))return {code:409,error:'A verification request is already pending'};
    if(!await one(`SELECT id FROM inventory_counterparties WHERE listing_id=$1
      AND party_role IN ('seller','landlord','lessor','developer','authorized_representative') LIMIT 1`,[listing.id],client))
      return {code:409,error:'Add and save the Inventory owner or represented party before submitting for verification'};
    const checked=validateVerificationSubmission({currentStatus:listing.verificationStatus,...req.body});
    if(checked.error)return {code:400,error:checked.error};
    const prior=await one('SELECT id FROM inventory_verification_requests WHERE listing_id=$1 ORDER BY submitted_at DESC LIMIT 1',[listing.id],client);
    const v=checked.value,id=uuid(),request=await one(`INSERT INTO inventory_verification_requests(
        id,listing_id,request_type,status,evidence_reference,request_reason,submitted_by,prior_request_id
      ) VALUES($1,$2,$3,'pending',$4,$5,$6,$7) RETURNING *`,
      [id,listing.id,v.requestType,v.evidenceReference,v.reason,req.broker.id,prior?.id||null],client);
    await execute(`UPDATE listings SET verification_status='pending',current_verification_request_id=$1,
      verification_decided_by=NULL,verification_decided_at=NULL,verification_reason=$2,updated_at=NOW()
      WHERE id=$3`,[id,v.reason,listing.id],client);
    await audit('InventoryVerification',id,v.requestType==='exemption'?'exemption_requested':'submitted',req.broker.id,
      {listingId:listing.id,from:listing.verificationStatus,to:'pending',reason:v.reason,evidenceReference:v.evidenceReference},client);
    return {request};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.status(201).json(result.request);
});

r.post('/inventory-verification-requests/:id/decision',async(req,res)=>{
  const result=await transaction(async client=>{
    const request=await one(`SELECT vr.*,l.posted_by,
        maintainer.team_id AS posted_by_team_id
      FROM inventory_verification_requests vr
      JOIN listings l ON l.id=vr.listing_id
      JOIN brokers maintainer ON maintainer.id=l.posted_by
      WHERE vr.id=$1 FOR UPDATE`,[req.params.id],client);
    if(!request)return {code:404,error:'Verification request not found'};
    if(!await canReview(req.broker,{postedBy:request.postedBy,postedByTeamId:request.postedByTeamId},client))return {code:403,error:'This verification request is outside your review scope'};
    if(request.submittedBy===req.broker.id)return {code:409,error:'The person who submitted this Inventory cannot decide the same verification request'};
    const checked=validateVerificationDecision({requestStatus:request.status,requestType:request.requestType,...req.body});
    if(checked.error)return {code:400,error:checked.error};
    const v=checked.value,inventoryStatus=listingStatusForVerificationDecision(request.requestType,v.decision);
    const updated=await one(`UPDATE inventory_verification_requests SET status=$1,decided_by=$2,
      decided_at=NOW(),decision_reason=$3,version=version+1 WHERE id=$4 RETURNING *`,
      [v.decision,req.broker.id,v.reason,request.id],client);
    const activated=['verified','exempted'].includes(v.decision),workflowStatus=activated?'approved':v.decision==='returned'?'draft':'blocked';
    await execute(`UPDATE listings SET verification_status=$1,verification_decided_by=$2,
      verification_decided_at=NOW(),verification_reason=$3,workflow_status=$4,reviewed_by=$2,
      reviewed_at=NOW(),review_comment=$3,updated_at=NOW() WHERE id=$5`,
      [inventoryStatus,req.broker.id,v.reason,workflowStatus,request.listingId],client);
    await refreshReadiness(request.listingId,client);
    await audit('InventoryVerification',request.id,`decision_${v.decision}`,req.broker.id,
      {listingId:request.listingId,from:'pending',to:inventoryStatus,workflowStatus,activated,reason:v.reason},client);
    return {request:updated,verificationStatus:inventoryStatus,workflowStatus,activated};
  });
  if(result.error)return res.status(result.code).json({error:result.error});
  res.json(result);
});

r.get('/external-publications',async(req,res)=>{
  const params=[],scope=req.broker.role==='admin'?'TRUE':req.broker.jobRole==='manager'?(params.push(req.broker.id),`(t.manager_id=$1 OR EXISTS (
    SELECT 1 FROM team_memberships tm WHERE tm.team_id=t.id AND tm.broker_id=$1 AND tm.membership_role='manager' AND tm.ends_at IS NULL
  ))`):(params.push(req.broker.id),`(l.posted_by=$1 OR l.originating_agent_id=$1)`);
  const [inventoryRows,publications,mappingVersions,fieldMappings,permitEvidenceVersions,propertyFinderPreflightMedia]=await Promise.all([
    many(`SELECT l.id,l.inventory_reference,l.inventory_headline,l.project,l.area,l.community,
      nysa_inventory_effective_status(l.id) AS status,l.workflow_status,l.verification_status,
      l.property_type,l.bedrooms,l.parking_spaces,l.size_sqft,l.price,l.currency,l.handover_status,l.source_provider,l.external_record_id,
      l.availability_confirmed_at,l.permit_number,l.permit_expires_at,l.updated_at,l.posted_by,l.responsible_agent_id,
      owner.team_id AS posted_by_team_id,
      (SELECT COUNT(*)::int FROM inventory_agreements a WHERE a.listing_id=l.id AND a.status='active' AND a.marketing_authorized=1
        AND (a.effective_from IS NULL OR a.effective_from<=CURRENT_DATE) AND (a.effective_to IS NULL OR a.effective_to>=CURRENT_DATE)) AS marketing_agreement_count,
      (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE
        AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
      FROM listings l JOIN brokers owner ON owner.id=l.posted_by LEFT JOIN teams t ON t.id=owner.team_id
      WHERE l.deleted_at IS NULL AND ${scope} ORDER BY l.updated_at DESC`,params),
    many(`SELECT p.*,l.inventory_reference,l.inventory_headline,l.project,l.area,l.verification_status,
      nysa_inventory_effective_status(l.id) AS inventory_status,
      creator.name AS created_by_name,approver.name AS approved_by_name,prep.revision_number AS preparation_revision,
      prep.portal_fields,prep.readiness_snapshot,prep.payload_hash,prep.created_at AS prepared_at,
      mapping.version_code AS mapping_version_code,mapping.status AS mapping_status
      FROM external_listing_publications p JOIN listings l ON l.id=p.listing_id JOIN brokers owner ON owner.id=l.posted_by
      LEFT JOIN teams t ON t.id=owner.team_id JOIN brokers creator ON creator.id=p.created_by LEFT JOIN brokers approver ON approver.id=p.approved_by
      LEFT JOIN external_listing_preparation_versions prep ON prep.id=p.current_preparation_version_id
      LEFT JOIN external_portal_mapping_versions mapping ON mapping.id=prep.mapping_version_id
      WHERE l.deleted_at IS NULL AND ${scope} ORDER BY p.updated_at DESC`,params),
    many(`SELECT v.*,creator.name AS created_by_name,tester.name AS tested_by_name,approver.name AS approved_by_name
      FROM external_portal_mapping_versions v JOIN brokers creator ON creator.id=v.created_by
      LEFT JOIN brokers tester ON tester.id=v.tested_by LEFT JOIN brokers approver ON approver.id=v.approved_by
      ORDER BY v.portal_code,v.created_at DESC`),
    many(`SELECT * FROM external_portal_field_mappings ORDER BY mapping_version_id,source_field`),
    many(`SELECT evidence.id,evidence.listing_id,evidence.portal_code,evidence.compliance_type,evidence.permit_number,
      evidence.issuing_company_license_number,evidence.property_reference,evidence.advertising_purpose,evidence.permitted_property_type,
      evidence.permitted_location,evidence.permitted_price,evidence.currency,evidence.advertising_copy,evidence.permit_expires_at,
      evidence.file_name,evidence.media_type,evidence.file_size_bytes,evidence.file_hash,evidence.created_at,creator.name AS created_by_name
      FROM external_portal_permit_evidence_versions evidence JOIN listings l ON l.id=evidence.listing_id AND l.deleted_at IS NULL
      JOIN brokers owner ON owner.id=l.posted_by LEFT JOIN teams t ON t.id=owner.team_id JOIN brokers creator ON creator.id=evidence.created_by
      WHERE ${scope} ORDER BY evidence.created_at DESC`,params),
    many(`SELECT media.id,media.listing_id,media.title,media.file_name,media.media_type,media.file_size_bytes,media.rights_expires_at
      FROM property_media media JOIN listings l ON l.id=media.listing_id AND l.deleted_at IS NULL
      JOIN brokers owner ON owner.id=l.posted_by LEFT JOIN teams t ON t.id=owner.team_id
      WHERE ${scope} AND media.approval_status='approved' AND media.usage_rights_confirmed=TRUE
        AND (media.rights_expires_at IS NULL OR media.rights_expires_at>NOW()+INTERVAL '7 days')
        AND media.media_type IN ('image/jpeg','image/png','image/webp')
      ORDER BY media.listing_id,media.display_order,media.created_at`,params)
  ]);
  const inventories=await Promise.all(inventoryRows.map(async listing=>({
    ...listing,
    canMaintainPortalEvidence:canEdit(req.broker,listing),
    canCreateExternalPublication:canEdit(req.broker,listing)||await canReview(req.broker,listing)
  })));
  res.json({inventories,publications,mappingVersions,fieldMappings,permitEvidenceVersions,fieldCatalogue:PORTAL_FIELD_CATALOGUE,
    propertyFinderPropertyTypes:PROPERTY_FINDER_PROPERTY_TYPES,propertyFinderContentLimits:PROPERTY_FINDER_CONTENT_LIMITS,
    propertyFinderPreflightMedia,connectorStatus:'not_configured',noAutomaticPublication:true});
});

r.post('/listings/:id/external-permit-evidence',async(req,res)=>{
  const facts=normalizePortalPermitEvidence(req.body);if(facts.error)return res.status(400).json({error:facts.error});
  const file=decodeAndValidateFile({base64:req.body?.base64,mediaType:req.body?.mediaType,fileName:req.body?.fileName,
    maxBytes:Number(process.env.MAX_PORTAL_PERMIT_BYTES||10485760),allowedTypes:['application/pdf','image/jpeg','image/png']});
  if(file.error)return res.status(400).json({error:file.error});
  const listing=await one(`SELECT l.*,b.team_id AS posted_by_team_id FROM listings l JOIN brokers b ON b.id=l.posted_by
    WHERE l.id=$1 AND l.deleted_at IS NULL`,[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!ownsListing(req.broker,listing)&&!canEdit(req.broker,listing)&&!await canReview(req.broker,listing))return res.status(403).json({error:'This Inventory is outside your portal-evidence scope'});
  const storageKey=await savePrivate(file.buffer,path.extname(file.fileName));
  try{
    const row=await transaction(async client=>{
      const id=uuid(),snapshot={...facts,fileName:file.fileName,mediaType:req.body.mediaType,fileSizeBytes:file.buffer.length,fileHash:file.fileHash};
      const created=await one(`INSERT INTO external_portal_permit_evidence_versions(
        id,listing_id,portal_code,compliance_type,permit_number,issuing_company_license_number,property_reference,advertising_purpose,
        permitted_property_type,permitted_location,permitted_price,currency,advertising_copy,permit_expires_at,file_name,media_type,
        file_size_bytes,storage_key,file_hash,facts_snapshot,created_by
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21) RETURNING *`,
      [id,listing.id,facts.portalCode,facts.complianceType,facts.permitNumber,facts.issuingCompanyLicenseNumber,facts.propertyReference,
        facts.advertisingPurpose,facts.permittedPropertyType,facts.permittedLocation,facts.permittedPrice,facts.currency,facts.advertisingCopy,
        facts.permitExpiresAt,file.fileName,req.body.mediaType,file.buffer.length,storageKey,file.fileHash,JSON.stringify(snapshot),req.broker.id],client);
      await audit('ExternalListingPublication',id,'permit_evidence_uploaded',req.broker.id,{listingId:listing.id,portalCode:facts.portalCode,
        permitNumber:facts.permitNumber,fileHash:file.fileHash,noConnectorTransmission:true},client);
      return created;
    });
    res.status(201).json(row);
  }catch(error){await removePrivate(storageKey);if(error.code==='23505')return res.status(409).json({error:'This exact permit evidence file is already recorded for this Inventory and portal'});throw error;}
});

r.get('/external-permit-evidence/:id/download',async(req,res)=>{
  const evidence=await one(`SELECT evidence.*,l.posted_by,b.team_id AS posted_by_team_id FROM external_portal_permit_evidence_versions evidence
    JOIN listings l ON l.id=evidence.listing_id JOIN brokers b ON b.id=l.posted_by WHERE evidence.id=$1 AND l.deleted_at IS NULL`,[req.params.id]);
  if(!evidence)return res.status(404).json({error:'Permit evidence not found'});
  if(!ownsListing(req.broker,evidence)&&!canEdit(req.broker,evidence)&&!await canReview(req.broker,evidence))return res.status(403).json({error:'Permit evidence is outside your scope'});
  const data=await readPrivate(evidence.storageKey);await audit('ExternalListingPublication',evidence.id,'permit_evidence_downloaded',req.broker.id,{listingId:evidence.listingId});
  res.setHeader('Content-Type',evidence.mediaType);res.setHeader('Content-Disposition',`attachment; filename="${evidence.fileName.replace(/"/g,'')}"`);res.end(data);
});

r.post('/listings/:id/external-publications',async(req,res)=>{
  const normalized=normalizePortalPreparation(req.body);if(normalized.error)return res.status(400).json({error:normalized.error});
  const {portalCode,fields}=normalized;
  const listing=await one(`SELECT l.*,nysa_inventory_effective_status(l.id) AS effective_status,b.team_id AS posted_by_team_id,
    (SELECT COUNT(*)::int FROM inventory_agreements a WHERE a.listing_id=l.id AND a.status='active' AND a.marketing_authorized=1
      AND (a.effective_from IS NULL OR a.effective_from<=CURRENT_DATE) AND (a.effective_to IS NULL OR a.effective_to>=CURRENT_DATE)) AS marketing_agreement_count,
    (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE
      AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
    FROM listings l JOIN brokers b ON b.id=l.posted_by
    WHERE l.id=$1 AND l.deleted_at IS NULL`,[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!ownsListing(req.broker,listing)&&!canEdit(req.broker,listing)&&!await canReview(req.broker,listing))return res.status(403).json({error:'This Inventory is outside your publication scope'});
  if(listing.workflowStatus!=='approved')return res.status(409).json({error:'Verify and activate the Internal Inventory record before creating an external listing publication'});
  if(!['verified','not_required'].includes(listing.verificationStatus))return res.status(409).json({error:'Internal Inventory must be verified before portal preparation'});
  const developerAuthority=await developerExternalListingAuthority(listing.id);if(!developerAuthority.ready)return res.status(409).json({error:developerAuthority.error,developerAuthority});
  const result=await transaction(async client=>{
    const mapping=await one(`SELECT id,version_code FROM external_portal_mapping_versions WHERE portal_code=$1 AND status='active'`,[portalCode],client),
      permitEvidence=await one(`SELECT * FROM external_portal_permit_evidence_versions WHERE listing_id=$1 AND portal_code=$2 ORDER BY created_at DESC LIMIT 1`,[listing.id,portalCode],client),
      id=uuid(),snapshot=inventoryPortalSnapshot(listing),readiness=portalReadiness({listing,fields,marketingAgreementCount:listing.marketingAgreementCount,approvedMediaCount:listing.approvedMediaCount,permitEvidence}),
      payloadHash=portalPayloadHash({portalCode,inventory:snapshot,fields,mappingVersionId:mapping?.id||null}),preparationId=uuid(),
      evidenceReference=`portal-preparation:${preparationId}`,reason=fields.internalAuditPurpose;
    const publication=await one(`INSERT INTO external_listing_publications(
      id,listing_id,channel,status,evidence_reference,reason,created_by
    ) VALUES($1,$2,$3,'draft',$4,$5,$6) RETURNING *`,[id,listing.id,portalCode,evidenceReference,reason,req.broker.id],client);
    const preparation=await one(`INSERT INTO external_listing_preparation_versions(
      id,publication_id,revision_number,mapping_version_id,source_inventory_snapshot,portal_fields,readiness_snapshot,payload_hash,created_by
    ) VALUES($1,$2,1,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8) RETURNING *`,
    [preparationId,id,mapping?.id||null,JSON.stringify(snapshot),JSON.stringify(fields),JSON.stringify(readiness),payloadHash,req.broker.id],client);
    await execute('UPDATE external_listing_publications SET current_preparation_version_id=$1 WHERE id=$2',[preparation.id,id],client);
    await audit('ExternalListingPublication',id,'draft_prepared',req.broker.id,
      {listingId:listing.id,portalCode,preparationVersionId:preparation.id,payloadHash,noConnectorTransmission:true},client);
    return{...publication,currentPreparationVersionId:preparation.id,preparation};
  });
  res.status(201).json(result);
});

r.post('/external-publications/:id/preparations',async(req,res)=>{
  const normalized=normalizePortalPreparation(req.body);if(normalized.error)return res.status(400).json({error:normalized.error});
  const result=await transaction(async client=>{
    const publication=await one(`SELECT p.*,l.*,nysa_inventory_effective_status(l.id) AS effective_status,p.id AS publication_id,p.status AS publication_status,b.team_id AS posted_by_team_id,
      (SELECT COUNT(*)::int FROM inventory_agreements a WHERE a.listing_id=l.id AND a.status='active' AND a.marketing_authorized=1
        AND (a.effective_from IS NULL OR a.effective_from<=CURRENT_DATE) AND (a.effective_to IS NULL OR a.effective_to>=CURRENT_DATE)) AS marketing_agreement_count,
      (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE
        AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
      FROM external_listing_publications p JOIN listings l ON l.id=p.listing_id JOIN brokers b ON b.id=l.posted_by
      WHERE p.id=$1 FOR UPDATE OF p`,[req.params.id],client);
    if(!publication)return{code:404,error:'External publication not found'};
    if(!['draft','rejected'].includes(publication.publicationStatus))return{code:409,error:'Only Draft or Rejected portal preparations can receive a new immutable revision'};
    if(normalized.portalCode!==publication.channel)return{code:409,error:'A portal cannot be changed after the publication draft is created'};
    if(!ownsListing(req.broker,publication)&&!canEdit(req.broker,publication)&&!await canReview(req.broker,publication,client))return{code:403,error:'This portal preparation is outside your scope'};
    const developerAuthority=await developerExternalListingAuthority(publication.listingId,client);if(!developerAuthority.ready)return{code:409,error:developerAuthority.error,developerAuthority};
    const last=await one('SELECT COALESCE(MAX(revision_number),0)::int AS revision_number FROM external_listing_preparation_versions WHERE publication_id=$1',[publication.publicationId],client),
      mapping=await one(`SELECT id FROM external_portal_mapping_versions WHERE portal_code=$1 AND status='active'`,[publication.channel],client),
      permitEvidence=await one(`SELECT * FROM external_portal_permit_evidence_versions WHERE listing_id=$1 AND portal_code=$2 ORDER BY created_at DESC LIMIT 1`,[publication.listingId,publication.channel],client),
      snapshot=inventoryPortalSnapshot(publication),fields=normalized.fields,
      readiness=portalReadiness({listing:publication,fields,marketingAgreementCount:publication.marketingAgreementCount,approvedMediaCount:publication.approvedMediaCount,permitEvidence}),
      payloadHash=portalPayloadHash({portalCode:publication.channel,inventory:snapshot,fields,mappingVersionId:mapping?.id||null}),id=uuid();
    const preparation=await one(`INSERT INTO external_listing_preparation_versions(
      id,publication_id,revision_number,mapping_version_id,source_inventory_snapshot,portal_fields,readiness_snapshot,payload_hash,created_by
    ) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9) RETURNING *`,
    [id,publication.publicationId,Number(last.revisionNumber)+1,mapping?.id||null,JSON.stringify(snapshot),JSON.stringify(fields),JSON.stringify(readiness),payloadHash,req.broker.id],client);
    await execute(`UPDATE external_listing_publications SET current_preparation_version_id=$1,evidence_reference=$2,reason=$3,updated_at=NOW() WHERE id=$4`,
      [id,`portal-preparation:${id}`,fields.internalAuditPurpose,publication.publicationId],client);
    await audit('ExternalListingPublication',publication.publicationId,'preparation_revised',req.broker.id,{preparationVersionId:id,payloadHash,noConnectorTransmission:true},client);
    return preparation;
  });
  if(result.error)return res.status(result.code).json({error:result.error,developerAuthority:result.developerAuthority});res.status(201).json(result);
});

r.post('/external-publication-mappings',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator authority is required to create connector mappings'});
  const value=validatePortalMappingVersion(req.body);if(value.error)return res.status(400).json({error:value.error});
  const created=await one(`INSERT INTO external_portal_mapping_versions(
    id,portal_code,version_code,specification_reference,notes,created_by
  ) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[uuid(),value.portalCode,value.versionCode,value.specificationReference,value.notes,req.broker.id]);
  await audit('ExternalListingPublication',created.id,'mapping_version_created',req.broker.id,
    {portalCode:value.portalCode,versionCode:value.versionCode,specificationReference:value.specificationReference});
  res.status(201).json(created);
});

r.post('/external-publication-mappings/:id/fields',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator authority is required to maintain connector mappings'});
  const value=validatePortalFieldMapping(req.body);if(value.error)return res.status(400).json({error:value.error});
  const version=await one('SELECT * FROM external_portal_mapping_versions WHERE id=$1',[req.params.id]);
  if(!version)return res.status(404).json({error:'Connector mapping version not found'});
  if(version.status!=='draft')return res.status(409).json({error:'Only Draft connector mapping versions can be edited'});
  const created=await one(`INSERT INTO external_portal_field_mappings(
    id,mapping_version_id,source_field,target_field,requirement_level,transform_rule,condition_expression,created_by
  ) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
  [uuid(),version.id,value.sourceField,value.targetField,value.requirementLevel,value.transformRule,value.conditionExpression,req.broker.id]);
  await audit('ExternalListingPublication',version.id,'mapping_field_added',req.broker.id,
    {sourceField:value.sourceField,targetField:value.targetField,requirementLevel:value.requirementLevel});
  res.status(201).json(created);
});

r.patch('/external-publication-mappings/:id/status',async(req,res)=>{
  if(req.broker.role!=='admin')return res.status(403).json({error:'Administrator authority is required to govern connector mappings'});
  const target=String(req.body?.status||'').trim(),evidence=String(req.body?.lifecycleEvidence||'').trim();
  if(!evidence)return res.status(400).json({error:'Lifecycle evidence is required'});
  const result=await transaction(async client=>{
    const version=await one('SELECT * FROM external_portal_mapping_versions WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!version)return{code:404,error:'Connector mapping version not found'};
    const allowed={draft:['tested'],tested:['approved'],approved:['active'],active:['retired'],retired:[]};
    if(!(allowed[version.status]||[]).includes(target))return{code:409,error:`Connector mapping cannot move from ${version.status} to ${target}`};
    const fieldCount=await one('SELECT COUNT(*)::int AS count FROM external_portal_field_mappings WHERE mapping_version_id=$1',[version.id],client);
    if(target!=='retired'&&Number(fieldCount.count)===0)return{code:409,error:'Add field mappings before lifecycle review'};
    if(target==='active')await execute(`UPDATE external_portal_mapping_versions SET status='retired',retired_by=$1,retired_at=NOW(),lifecycle_evidence=$2
      WHERE portal_code=$3 AND status='active' AND id<>$4`,[req.broker.id,`Superseded by ${version.versionCode}: ${evidence}`,version.portalCode,version.id],client);
    const actorColumn={tested:'tested_by',approved:'approved_by',active:'activated_by',retired:'retired_by'}[target],
      timeColumn={tested:'tested_at',approved:'approved_at',active:'activated_at',retired:'retired_at'}[target];
    const updated=await one(`UPDATE external_portal_mapping_versions SET status=$1,lifecycle_evidence=$2,${actorColumn}=$3,${timeColumn}=NOW() WHERE id=$4 RETURNING *`,
      [target,evidence,req.broker.id,version.id],client);
    await audit('ExternalListingPublication',version.id,`mapping_${target}`,req.broker.id,{portalCode:version.portalCode,versionCode:version.versionCode,evidence},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.patch('/external-publications/:id/status',async(req,res)=>{
  const status=String(req.body?.status||''),reason=String(req.body?.reason||'').trim(),
    evidenceReference=String(req.body?.evidenceReference||'').trim();
  const statuses=['submitted','approved','published','paused','withdrawn','rejected'];
  if(!statuses.includes(status)||!reason||!evidenceReference)return res.status(400).json({error:'Select a valid publication status and record evidence and reason'});
  const result=await transaction(async client=>{
    const publication=await one(`SELECT p.*,l.posted_by,b.team_id AS posted_by_team_id,l.verification_status,l.workflow_status,
      nysa_inventory_effective_status(l.id) AS inventory_status,l.permit_number,l.permit_expires_at,prep.portal_fields,
      (SELECT COUNT(*)::int FROM inventory_agreements a WHERE a.listing_id=l.id AND a.status='active' AND a.marketing_authorized=1
        AND (a.effective_from IS NULL OR a.effective_from<=CURRENT_DATE) AND (a.effective_to IS NULL OR a.effective_to>=CURRENT_DATE)) AS marketing_agreement_count,
      (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE
        AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
      FROM external_listing_publications p JOIN listings l ON l.id=p.listing_id
      JOIN brokers b ON b.id=l.posted_by LEFT JOIN external_listing_preparation_versions prep ON prep.id=p.current_preparation_version_id
      WHERE p.id=$1 FOR UPDATE OF p`,[req.params.id],client);
    if(!publication)return{code:404,error:'External publication not found'};
    const listing={postedBy:publication.postedBy,postedByTeamId:publication.postedByTeamId};
    const reviewer=await canReview(req.broker,listing,client);
    if(['approved','rejected'].includes(status)&&!reviewer)return{code:403,error:'Manager or Administrator approval is required'};
    if(!reviewer&&!ownsListing(req.broker,listing)&&!canEdit(req.broker,listing))return{code:403,error:'This publication is outside your editable scope'};
    const allowed={draft:['submitted','withdrawn'],submitted:['approved','rejected','withdrawn'],approved:['published','withdrawn'],
      published:['paused','withdrawn'],paused:['published','withdrawn'],rejected:['submitted'],withdrawn:[]};
    if(!(allowed[publication.status]||[]).includes(status))return{code:409,error:`External publication cannot move from ${publication.status} to ${status}`};
    if(['submitted','approved','published'].includes(status)&&!['verified','not_required'].includes(publication.verificationStatus))
      return{code:409,error:'External publication requires system-controlled Inventory verification or approved exemption'};
    if(['submitted','approved','published'].includes(status)){
      const developerAuthority=await developerExternalListingAuthority(publication.listingId,client);
      if(!developerAuthority.ready)return{code:409,error:developerAuthority.error,developerAuthority};
      if(!publication.currentPreparationVersionId)return{code:409,error:'Complete the portal preparation fields before submission'};
      const permitEvidence=await one(`SELECT * FROM external_portal_permit_evidence_versions WHERE listing_id=$1 AND portal_code=$2 ORDER BY created_at DESC LIMIT 1`,[publication.listingId,publication.channel],client);
      const readiness=portalReadiness({listing:{...publication,effectiveStatus:publication.inventoryStatus},fields:publication.portalFields||{},
        marketingAgreementCount:publication.marketingAgreementCount,approvedMediaCount:publication.approvedMediaCount,permitEvidence});
      if(!readiness.ready)return{code:409,error:`Portal preparation is not ready: ${readiness.checks.filter(check=>!check.passed).map(check=>check.label).join('; ')}`};
    }
    const updated=await one(`UPDATE external_listing_publications SET status=$1,evidence_reference=$2,reason=$3,
      submitted_by=CASE WHEN $1='submitted' THEN $4 ELSE submitted_by END,
      submitted_at=CASE WHEN $1='submitted' THEN NOW() ELSE submitted_at END,
      approved_by=CASE WHEN $1='approved' THEN $4 ELSE approved_by END,
      approved_at=CASE WHEN $1='approved' THEN NOW() ELSE approved_at END,
      published_at=CASE WHEN $1='published' THEN NOW() ELSE published_at END,
      ended_at=CASE WHEN $1 IN ('withdrawn','rejected') THEN NOW() ELSE ended_at END,updated_at=NOW()
      WHERE id=$5 RETURNING *`,[status,evidenceReference,reason,req.broker.id,publication.id],client);
    await audit('ExternalListingPublication',publication.id,`status_${status}`,req.broker.id,
      {listingId:publication.listingId,from:publication.status,to:status,evidenceReference,reason},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error,developerAuthority:result.developerAuthority});res.json(result);
});

r.get('/listings/:id', async (req, res) => {
  const listing = await one(`SELECT l.*, b.name AS posted_by_name, b.brokerage AS posted_by_brokerage,b.team_id AS posted_by_team_id,
    reservation.booking_reference AS active_booking_reference,reservation.opportunity_id AS active_booking_opportunity_id,
    reservation.opportunity_reference AS active_booking_opportunity_reference,reservation.expires_at AS active_booking_expires_at,
    (SELECT COUNT(*)::int FROM listing_units u WHERE u.listing_id=l.id) AS bulk_unit_count,
    0::int AS incomplete_bulk_unit_count,
    (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.usage_rights_confirmed=TRUE AND (m.rights_expires_at IS NULL OR m.rights_expires_at>NOW()) AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
    FROM listings l JOIN brokers b ON b.id = l.posted_by
    LEFT JOIN LATERAL (SELECT bk.booking_reference,o.id AS opportunity_id,o.opportunity_reference,bk.expires_at
      FROM bookings bk JOIN opportunities o ON o.id=bk.opportunity_id
      WHERE bk.listing_id=l.id AND bk.status='reserved' ORDER BY bk.created_at DESC LIMIT 1) reservation ON TRUE
    WHERE l.id = $1 AND l.deleted_at IS NULL`, [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if(listing.workflowStatus!=='approved'&&!ownsListing(req.broker,listing)&&!canEdit(req.broker,listing)&&!await canReview(req.broker,listing))return res.status(403).json({error:'This draft is outside your inventory scope'});
  const workflowHistory=await many(`SELECT a.action,a.timestamp,a.details,b.name AS performed_by_name FROM audit_log a JOIN brokers b ON b.id=a.performed_by
    WHERE a.entity_type='Listing' AND a.entity_id=$1 AND (a.action LIKE 'workflow_%' OR a.action='draft_created') ORDER BY a.timestamp DESC`,[listing.id]);
  const bulkUnits=listing.propertyType==='Bulk deal'?await many(`SELECT id,unit_reference,property_type,bedrooms,size_sqft,price,display_order
    FROM listing_units WHERE listing_id=$1 ORDER BY display_order,created_at`,[listing.id]):[];
  const partnerCompanyParams=[],partnerCompanyScope=companyScopeSql('c',req.broker,partnerCompanyParams);
  const [verificationRequests,externalPublications,inventoryCounterparties,inventoryAgreements,agentAssignmentHistory,reopenRequests,inventoryOrganizationLinkEvents,eligiblePartnerOrganizations,opportunityAssignments]=await Promise.all([
    many(`SELECT vr.*,submitter.name AS submitted_by_name,decider.name AS decided_by_name
      FROM inventory_verification_requests vr
      JOIN brokers submitter ON submitter.id=vr.submitted_by
      LEFT JOIN brokers decider ON decider.id=vr.decided_by
      WHERE vr.listing_id=$1 ORDER BY vr.submitted_at DESC`,[listing.id]),
    many(`SELECT p.*,creator.name AS created_by_name,approver.name AS approved_by_name
      FROM external_listing_publications p
      JOIN brokers creator ON creator.id=p.created_by
      LEFT JOIN brokers approver ON approver.id=p.approved_by
      WHERE p.listing_id=$1 ORDER BY p.created_at DESC`,[listing.id]),
    many(`SELECT p.*,
      COALESCE(c.full_name,p.display_name) AS display_name,
      COALESCE(c.phone,p.phone) AS phone,
      COALESCE(c.email,p.email) AS email,
      c.postal_address AS customer_address,c.kyc_status AS customer_kyc_status
      FROM inventory_counterparties p LEFT JOIN contacts c ON c.id=p.contact_id
      WHERE p.listing_id=$1 ORDER BY p.created_at`,[listing.id]),
    many(`SELECT a.*,c.display_name AS counterparty_name FROM inventory_agreements a
      LEFT JOIN inventory_counterparties c ON c.id=a.counterparty_id
      WHERE a.listing_id=$1 ORDER BY a.created_at DESC`,[listing.id]),
    many(`SELECT h.*,originator.name AS originating_agent_name,prior.name AS from_responsible_agent_name,current.name AS to_responsible_agent_name,
      changer.name AS changed_by_name FROM inventory_agent_assignment_history h
      JOIN brokers originator ON originator.id=h.originating_agent_id
      LEFT JOIN brokers prior ON prior.id=h.from_responsible_agent_id
      JOIN brokers current ON current.id=h.to_responsible_agent_id JOIN brokers changer ON changer.id=h.changed_by
      WHERE h.listing_id=$1 ORDER BY h.changed_at DESC`,[listing.id]),
    many(`SELECT r.*,requester.name AS requested_by_name,decider.name AS decided_by_name
      FROM inventory_reopen_requests r JOIN brokers requester ON requester.id=r.requested_by
      LEFT JOIN brokers decider ON decider.id=r.decided_by
      WHERE r.listing_id=$1 ORDER BY r.requested_at DESC`,[listing.id]),
    many(`SELECT e.id,e.relationship,e.action,e.reason,e.performed_at,e.partner_version_id,e.supersedes_event_id,
        v.version_number,v.classification,v.status AS partner_version_status,v.legal_name,c.name AS company_name
      FROM inventory_organization_link_events e
      LEFT JOIN partner_organization_versions v ON v.id=e.partner_version_id
      LEFT JOIN companies c ON c.id=v.company_id
      WHERE e.listing_id=$1 ORDER BY e.performed_at DESC,e.id DESC`,[listing.id]),
    many(`SELECT v.id AS partner_version_id,v.version_number,v.classification,v.legal_name,c.id AS company_id,c.name AS company_name
      FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id
      WHERE v.status='active' AND c.archived_at IS NULL AND c.status='active' AND ${partnerCompanyScope.clause}
      ORDER BY LOWER(v.legal_name),v.version_number DESC`,partnerCompanyScope.params),
    many(`SELECT a.*,o.opportunity_reference,o.title AS opportunity_title,o.stage AS opportunity_stage,
      owner.name AS opportunity_owner_name,creator.name AS assignment_created_by_name,
      CASE WHEN a.state='active' AND reservation.opportunity_id=a.opportunity_id THEN 'reserved_winner'
        WHEN a.state='active' AND a.expires_at<=NOW() THEN 'expired'
        WHEN a.state='active' AND reservation.opportunity_id IS NOT NULL THEN 'blocked_by_reservation'
        ELSE a.state END AS effective_state,
      latest_offer.offer_reference,latest_offer.status AS offer_status,latest_offer.created_by_name AS offer_created_by_name,
      reservation.booking_reference,reservation.expires_at AS reservation_expires_at,
      COALESCE((SELECT json_agg(json_build_object('eventType',event.event_type,'reason',event.reason,
        'actorName',event_actor.name,'eventData',event.event_data,'occurredAt',event.occurred_at)
        ORDER BY event.occurred_at DESC,event.id DESC) FROM inventory_assignment_events event
        LEFT JOIN brokers event_actor ON event_actor.id=event.actor_id WHERE event.assignment_id=a.id),'[]'::json) AS events
      FROM inventory_assignments a JOIN opportunities o ON o.id=a.opportunity_id
      JOIN brokers owner ON owner.id=o.owner_id JOIN brokers creator ON creator.id=a.created_by
      LEFT JOIN LATERAL (SELECT b.opportunity_id,b.booking_reference,b.expires_at FROM bookings b
        WHERE b.listing_id=a.listing_id AND b.status='reserved' AND b.expires_at>NOW() ORDER BY b.created_at LIMIT 1) reservation ON TRUE
      LEFT JOIN LATERAL (SELECT f.offer_reference,f.status,offer_creator.name AS created_by_name FROM offers f
        JOIN brokers offer_creator ON offer_creator.id=f.created_by WHERE f.opportunity_id=a.opportunity_id
        AND f.listing_id=a.listing_id ORDER BY f.created_at DESC LIMIT 1) latest_offer ON TRUE
      WHERE a.listing_id=$1 ORDER BY CASE WHEN a.state='active' AND a.expires_at>NOW() THEN 0 ELSE 1 END,a.created_at DESC`,[listing.id])
  ]);
  const currentInventoryOrganizationRelationships=[],seenInventoryOrganizationRelationships=new Set();
  for(const event of inventoryOrganizationLinkEvents){if(seenInventoryOrganizationRelationships.has(event.relationship))continue;seenInventoryOrganizationRelationships.add(event.relationship);if(event.action!=='unlinked')currentInventoryOrganizationRelationships.push(event);}
  const effectiveStatus=(await one('SELECT nysa_inventory_effective_status($1) AS status',[listing.id])).status;
  res.json({...withDiscount({...listing,effectiveStatus}),storedStatus:listing.status,status:effectiveStatus,bulkUnits,verificationRequests,externalPublications,inventoryCounterparties,inventoryAgreements,agentAssignmentHistory,reopenRequests,
    inventoryOrganizationLinkEvents,currentInventoryOrganizationRelationships,eligiblePartnerOrganizations,opportunityAssignments,
    effectiveStatus,
    workflowHistory:workflowHistory.map(item=>({...item,details:typeof item.details==='string'?JSON.parse(item.details):item.details}))});
});

r.get('/listings/:id/organization-relationships',async(req,res)=>{
  const listing=await one('SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL',[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(listing.workflowStatus!=='approved'&&!ownsListing(req.broker,listing)&&!canEdit(req.broker,listing)&&!await canReview(req.broker,listing))return res.status(403).json({error:'This Inventory is outside your scope'});
  const events=await many(`SELECT e.id,e.relationship,e.action,e.reason,e.performed_at,e.partner_version_id,e.supersedes_event_id,
      v.version_number,v.classification,v.status AS partner_version_status,v.legal_name,c.name AS company_name
    FROM inventory_organization_link_events e LEFT JOIN partner_organization_versions v ON v.id=e.partner_version_id
    LEFT JOIN companies c ON c.id=v.company_id WHERE e.listing_id=$1 ORDER BY e.performed_at DESC,e.id DESC`,[listing.id]);
  const current=[],seen=new Set();for(const event of events){if(seen.has(event.relationship))continue;seen.add(event.relationship);if(event.action!=='unlinked')current.push(event);}
  const params=[],scope=companyScopeSql('c',req.broker,params),eligiblePartnerOrganizations=await many(`SELECT v.id AS partner_version_id,v.version_number,v.classification,v.legal_name,c.name AS company_name
    FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id
    WHERE v.status='active' AND c.archived_at IS NULL AND c.status='active' AND ${scope.clause} ORDER BY LOWER(v.legal_name),v.version_number DESC`,scope.params);
  res.json({current,events,eligiblePartnerOrganizations});
});

r.post('/listings/:id/organization-relationships',async(req,res)=>{
  const result=await transaction(async client=>{
    const listing=await one('SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[req.params.id],client);
    if(!listing)return{code:404,error:'Inventory not found'};
    if(!canEdit(req.broker,listing))return{code:403,error:'Only an authorized Inventory maintainer can change organization provenance'};
    const relationship=String(req.body?.relationship||'').trim();
    const current=await one(`SELECT * FROM inventory_organization_link_events WHERE listing_id=$1 AND relationship=$2
      ORDER BY performed_at DESC,id DESC LIMIT 1`,[listing.id,relationship],client);
    const effectiveCurrent=current?.action==='unlinked'?null:current;
    const checked=validateInventoryOrganizationLinkEvent(req.body||{},effectiveCurrent);
    if(!checked.valid)return{code:400,error:checked.errors[0],errors:checked.errors};
    let partner=null;
    if(checked.value.partnerVersionId){
      const partnerParams=[checked.value.partnerVersionId],partnerScope=companyScopeSql('c',req.broker,partnerParams);
      partner=await one(`SELECT v.id,v.version_number,v.classification,v.legal_name,v.status,c.name AS company_name
        FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id
        WHERE v.id=$1 AND v.status='active' AND c.archived_at IS NULL AND c.status='active' AND ${partnerScope.clause}`,partnerScope.params,client);
      if(!partner)return{code:409,error:'Selected organization version is no longer active'};
      if(partner.classification!==partnerClassificationForRelationship(checked.value.relationship))return{code:400,error:'Selected organization classification is incompatible with this relationship'};
    }
    const id=uuid(),event=await one(`INSERT INTO inventory_organization_link_events(
      id,listing_id,relationship,action,partner_version_id,supersedes_event_id,reason,performed_by,policy_version)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,listing.id,checked.value.relationship,checked.value.action,
      checked.value.partnerVersionId,checked.value.supersedesEventId,checked.value.reason,req.broker.id,checked.value.policyVersion],client);
    await audit('InventoryOrganizationLink',event.id,`inventory_organization_${checked.value.action}`,req.broker.id,{
      listingId:listing.id,inventoryReference:listing.inventoryReference,relationship:checked.value.relationship,action:checked.value.action,
      partnerVersionId:checked.value.partnerVersionId,partnerVersionNumber:partner?.versionNumber||null,companyName:partner?.companyName||null,
      supersedesEventId:checked.value.supersedesEventId,reason:checked.value.reason},client);
    return{event};
  });
  if(result.error)return res.status(result.code).json({error:result.error,errors:result.errors});res.status(201).json(result);
});

r.patch('/listings/:id/responsible-agent',async(req,res)=>{
  return res.status(410).json({error:'Inventory has no transferable custodian. The Listing Executive maintains and submits the Inventory; a Sales Agent assigns available Inventory inside an Opportunity'});
});

r.post('/listings/:id/counterparties',requirePostRights,async(req,res)=>{
  const listing=await one('SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL',[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!canEdit(req.broker,listing))return res.status(403).json({error:'Only the Inventory owner or Administrator can maintain its seller or lessor parties'});
  const b=req.body||{},validationError=validateInventoryPartyInput(b);
  if(validationError)return res.status(400).json({error:validationError});
  const id=uuid(),row=await one(`INSERT INTO inventory_counterparties
    (id,listing_id,party_role,party_type,display_name,phone,email,represented_party,source,authority_evidence,contact_restrictions,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [id,listing.id,b.partyRole,b.partyType,String(b.displayName).trim(),String(b.phone||'').trim()||null,String(b.email||'').trim()||null,
      String(b.representedParty||'').trim()||null,String(b.source).trim(),String(b.authorityEvidence).trim(),String(b.contactRestrictions||'').trim()||null,req.broker.id]);
  await audit('InventoryCounterparty',id,'created',req.broker.id,{listingId:listing.id,partyRole:row.partyRole,partyType:row.partyType});
  res.status(201).json(row);
});

r.post('/listings/:id/agreements',requirePostRights,async(req,res)=>{
  const listing=await one('SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL',[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!canEdit(req.broker,listing))return res.status(403).json({error:'Only the Inventory owner or Administrator can maintain its agreements'});
  const b=req.body||{},types=['listing_mandate','leasing_mandate','seller_representation','landlord_representation','co_broker','commission_sharing','ownership_authority','marketing_publication','viewing_access','developer_authorization','amendment','renewal'],
    representations=['exclusive','non_exclusive','referral','co_broker','not_applicable'];
  if(!types.includes(b.agreementType)||!representations.includes(b.representationType))return res.status(400).json({error:'Select a valid agreement and representation type'});
  if(!String(b.evidenceReference||'').trim())return res.status(400).json({error:'Agreement evidence reference is required'});
  if(b.counterpartyId&&!(await one('SELECT id FROM inventory_counterparties WHERE id=$1 AND listing_id=$2',[b.counterpartyId,listing.id])))return res.status(400).json({error:'Select a party maintained on this Inventory'});
  const id=uuid(),row=await one(`INSERT INTO inventory_agreements
    (id,listing_id,counterparty_id,agreement_type,representation_type,evidence_reference,effective_from,effective_to,
     commission_terms,marketing_authorized,viewing_authorized,status,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [id,listing.id,b.counterpartyId||null,b.agreementType,b.representationType,String(b.evidenceReference).trim(),
      b.effectiveFrom||null,b.effectiveTo||null,String(b.commissionTerms||'').trim()||null,b.marketingAuthorized?1:0,b.viewingAuthorized?1:0,b.status||'active',req.broker.id]);
  await audit('InventoryAgreement',id,'created',req.broker.id,{listingId:listing.id,agreementType:row.agreementType,representationType:row.representationType});
  res.status(201).json(row);
});

r.post('/listings', requirePostRights, async (req, res) => {
  if(!canCreateListing(req.broker))return res.status(403).json({error:'Manual listing drafts may be created by a Listing Executive, Manager or Administrator'});
  const b = {...(req.body || {})};
  for (const field of ['inventoryHeadline','project','areaId','propertyType']) if (b[field] === undefined || b[field] === null || b[field] === '') return res.status(400).json({ error: `${field} is required` });
  if(!Array.isArray(b.transactionTypes)||!b.transactionTypes.length)return res.status(400).json({error:'Select at least one Inventory transaction type'});
  const area=await governedArea(b.areaId);if(!area)return res.status(400).json({error:'Select an active Area from Area Maintenance'});b.area=area.businessLabel;b.unitReference=String(b.unitReference||'').trim()||null;
  if(b.propertyType!=='Bulk deal'){const location=await one(`SELECT c.id AS community_id,v.business_label AS community_label,building.id AS building_id,building.business_label AS building_label FROM market_communities c JOIN market_community_versions v ON v.community_id=c.id AND v.status='active' JOIN inventory_buildings building ON building.community_id=c.id AND building.active=TRUE WHERE c.id=$1 AND c.area_id=$2 AND building.id=$3`,[b.communityId,b.areaId,b.buildingId]);if(!location)return res.status(409).json({error:'Select an active governed Community and Building maintained under the chosen Area'});b.communityId=location.communityId;b.buildingId=location.buildingId;b.community=location.communityLabel;b.building=location.buildingLabel;}else{b.communityId=null;b.buildingId=null;b.community=null;b.building=null;}
  if (!PROPERTY_TYPES.includes(b.propertyType)) return res.status(400).json({ error: 'Invalid propertyType' });
  if (b.bedrooms && !BEDROOMS.includes(b.bedrooms)) return res.status(400).json({ error: 'Invalid bedrooms' });
  const bulk=normalizeBulkUnits(b.propertyType,b.bulkUnits);if(bulk.error)return res.status(400).json({error:bulk.error});
  b.parkingSpaces=b.parkingSpaces===undefined||b.parkingSpaces===null||b.parkingSpaces===''?null:Number(b.parkingSpaces);
  if(b.propertyType==='Bulk deal'){b.bedrooms=null;b.parkingSpaces=null;b.sizeSqft=bulk.units.reduce((sum,item)=>sum+item.sizeSqft,0);b.price=bulk.units.reduce((sum,item)=>sum+item.price,0);b.referencePrice=null;}else if(Array.isArray(b.bulkUnits)&&b.bulkUnits.length)return res.status(400).json({error:'Property rows are available only when Property type is Bulk deal'});
  if (b.paymentPlanType && !PAYMENT_PLANS.includes(b.paymentPlanType)) return res.status(400).json({ error: 'Invalid paymentPlanType' });
  if (b.exclusivityTier && !TIERS.includes(b.exclusivityTier)) return res.status(400).json({ error: 'Invalid exclusivityTier' });
  const price=normalizeInventoryAmount(b.price,{required:true,label:'Asking price'}),reference=normalizeInventoryAmount(b.referencePrice,{label:'Reference / market price'});if(price.error)return res.status(400).json({error:price.error});if(reference.error)return res.status(400).json({error:reference.error});b.price=price.value;b.referencePrice=reference.value;
  const handover=normalizeHandover(b);if(handover.error)return res.status(400).json({error:handover.error});b.handoverStatus=handover.status;b.handoverExpectedDate=handover.expectedDate;b.handoverDate=handover.legacyValue;
  const validationError = validateListingFields(b);
  if (validationError) return res.status(400).json({ error: validationError });
  b.responsibleAgentId=b.originatingAgentId;
  for(const field of ['originatingAgentId','contact'])
    if(!String(b[field]||'').trim())return res.status(400).json({error:`${field} is required`});
  const eligibleAgents=await many(`SELECT b.id FROM brokers b WHERE b.id=ANY($1::uuid[]) AND b.status='active'
    AND b.role IN ('admin','internal_broker') AND ${inventoryAgentEligibilitySql('b')}`,
    [[b.originatingAgentId,b.responsibleAgentId]]);
  if(new Set(eligibleAgents.map(x=>x.id)).size!==new Set([b.originatingAgentId,b.responsibleAgentId]).size)
    return res.status(400).json({error:'Select active eligible NYSA originating and responsible Inventory agents'});
  const id = uuid();
  const listing = await transaction(async client=>{
    let developerVersion=null;
    if(b.developerOrganizationVersionId!==undefined){
      const developerVersionId=String(b.developerOrganizationVersionId||'').trim();
      if(developerVersionId){developerVersion=await one(`SELECT v.id,v.version_number,v.legal_name,c.name AS company_name
        FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id
        WHERE v.id=$1 AND v.status='active' AND v.classification='developer' AND c.archived_at IS NULL AND c.status='active'`,[developerVersionId],client);
        if(!developerVersion){const error=new Error('Select an active Developer from Developer Master');error.statusCode=409;throw error;}
        b.developer=developerVersion.legalName;
      }else b.developer=null;
    }
    if(b.propertyType!=='Bulk deal'){
      const duplicate=await inspectInventoryDuplicate(b,{client});
      const blocked=inventoryDuplicateError(duplicate);if(blocked){const error=new Error(blocked.error);Object.assign(error,{statusCode:blocked.status,responseBody:blocked});throw error;}
    }
    const created=await one(`INSERT INTO listings (id,inventory_headline,project,developer,area,area_id,community_id,building_id,community,building,unit_reference,property_type,bedrooms,parking_spaces,size_sqft,price,
    reference_price,currency,payment_plan_type,down_payment_percent,on_handover_percent,post_handover_years,
    payment_plan_notes,handover_date,handover_status,handover_expected_date,exclusivity_tier,posted_by,contact,notes,availability_confirmed_at,availability_expires_at,verification_status,
    verification_expires_at,permit_number,permit_expires_at,portal_status,workflow_status,source_kind,transaction_types,responsible_agent_id,originating_agent_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,'blocked','draft','manual',$37,$38,$39) RETURNING *`,
    [id,String(b.inventoryHeadline).trim(),b.project,b.developer||null,b.area,area.id,b.communityId,b.buildingId,b.community,b.building,b.unitReference,b.propertyType,b.bedrooms||null,b.parkingSpaces,b.sizeSqft??null,+b.price,
     b.referencePrice??null,b.currency||'AED',b.paymentPlanType||null,b.downPaymentPercent??null,b.onHandoverPercent??null,b.postHandoverYears??null,b.paymentPlanNotes||null,b.handoverDate||null,b.handoverStatus,b.handoverExpectedDate,b.exclusivityTier||'Off-market',req.broker.id,String(b.contact).trim(),b.notes||null,b.availabilityConfirmedAt||null,b.availabilityExpiresAt||null,'unverified',b.verificationExpiresAt||null,b.permitNumber||null,b.permitExpiresAt||null,b.transactionTypes,b.responsibleAgentId,b.originatingAgentId],client);
    await execute(`INSERT INTO inventory_agent_assignment_history(id,listing_id,originating_agent_id,to_responsible_agent_id,source_kind,source_reference,reason,changed_by)
      VALUES($1,$2,$3,$4,'manual',$5,$6,$7)`,[uuid(),created.id,created.originatingAgentId,created.responsibleAgentId,String(b.contact).trim(),
      'Initial Inventory attribution selected during Draft creation',req.broker.id],client);
    if(b.propertyType==='Bulk deal')await replaceBulkUnits(id,bulk.units,client);
    if(developerVersion){const linkId=uuid();await execute(`INSERT INTO inventory_organization_link_events(
      id,listing_id,relationship,action,partner_version_id,supersedes_event_id,reason,performed_by,policy_version)
      VALUES($1,$2,'developer','linked',$3,NULL,$4,$5,$6)`,[linkId,id,developerVersion.id,'Selected from Developer Master during Inventory draft creation',req.broker.id,PARTNER_ORGANIZATION_POLICY_VERSION],client);
      await audit('InventoryOrganizationLink',linkId,'inventory_organization_linked',req.broker.id,{listingId:id,relationship:'developer',partnerVersionId:developerVersion.id,partnerVersionNumber:developerVersion.versionNumber,companyName:developerVersion.companyName,reason:'Selected from Developer Master during Inventory draft creation'},client);}
    await audit('Listing', id, 'draft_created', req.broker.id, {inventoryHeadline:b.inventoryHeadline,project:b.project,areaId:area.id,area:b.area,community:b.community,building:b.building,unitReference:b.unitReference,parkingSpaces:b.parkingSpaces,sizeSqft:b.sizeSqft,price:+b.price,sourceKind:'manual',sourceReference:String(b.contact).trim(),bulkUnitCount:bulk.units.length,originatingAgentId:b.originatingAgentId,responsibleAgentId:b.responsibleAgentId,noOwnerCreated:true,noAgreementCreated:true },client);
    return created;
  });
  const refreshed=await refreshReadiness(listing.id);
  res.status(201).json(withDiscount({...refreshed,bulkUnitCount:bulk.units.length,incompleteBulkUnitCount:0}));
});

r.patch('/listings/:id/workflow',async(req,res)=>{
  return res.status(410).json({error:'Inventory approval was consolidated into mandatory Inventory verification'});
  /*
  const listing=await one(`SELECT l.*,b.team_id AS posted_by_team_id FROM listings l JOIN brokers b ON b.id=l.posted_by WHERE l.id=$1 AND l.deleted_at IS NULL`,[req.params.id]);
  if(!listing)return res.status(404).json({error:'Listing not found'});
  const action=String(req.body?.action||''),reason=String(req.body?.reason||'').trim(),reviewer=await canReview(req.broker,listing);
  const error=validateListingWorkflowAction({current:listing.workflowStatus,action,reason,isOwner:ownsListing(req.broker,listing),canReview:reviewer});
  if(error)return res.status(error.startsWith('Only')?403:400).json({error});
  // Inventory governance is independent of external-portal publication readiness.
  // Verification and media can block publication without blocking approval of the Inventory record.
  const policy=action==='submit'?await listingApprovalPolicy():null,autoApproved=action==='submit'&&!policy.managerApprovalRequired;
  const next=autoApproved?'approved':{submit:'in_review',approve:'approved',request_changes:'changes_requested',block:'blocked',restore:'draft'}[action];
  const submitted=action==='submit',reviewed=autoApproved||['approve','request_changes','block','restore'].includes(action);
  const reviewReason=autoApproved?'Automatically approved under the active listing-approval policy':reason||null;
  const updated=await one(`UPDATE listings SET workflow_status=$1,
    submitted_at=CASE WHEN $2 THEN NOW() ELSE submitted_at END,submitted_by=CASE WHEN $2 THEN $4 ELSE submitted_by END,
    reviewed_at=CASE WHEN $3 THEN NOW() ELSE reviewed_at END,reviewed_by=CASE WHEN $3 THEN $4 ELSE reviewed_by END,
    review_comment=$5,updated_at=NOW() WHERE id=$6 RETURNING *`,[next,submitted,reviewed,req.broker.id,reviewReason,listing.id]);
  await audit('Listing',listing.id,autoApproved?'workflow_auto_approved_by_policy':`workflow_${action}`,req.broker.id,{from:listing.workflowStatus,to:next,reason:reviewReason,managerApprovalRequired:policy?.managerApprovalRequired??null});
  res.json(withDiscount(updated));
  */
});

r.patch('/listings/:id/availability', async (req,res)=>{
  const listing=await one('SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL',[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!canEdit(req.broker,listing))return res.status(403).json({error:'This Inventory is outside your maintenance scope'});
  const confirmedAt=new Date(req.body?.availabilityConfirmedAt),expiresAt=new Date(req.body?.availabilityExpiresAt);
  if(Number.isNaN(confirmedAt.valueOf()))return res.status(400).json({error:'Choose the date and time when availability was confirmed'});
  if(Number.isNaN(expiresAt.valueOf()))return res.status(400).json({error:'Choose the date and time when this availability confirmation expires'});
  if(confirmedAt.valueOf()>Date.now()+5*60*1000)return res.status(400).json({error:'Availability confirmation cannot be recorded in the future'});
  if(expiresAt.valueOf()<=confirmedAt.valueOf())return res.status(400).json({error:'Availability expiry must be later than the effective confirmation time'});
  if(expiresAt.valueOf()<=Date.now())return res.status(400).json({error:'Availability expiry must be in the future'});
  const updated=await transaction(async client=>{
    const locked=await one('SELECT availability_confirmed_at,availability_expires_at FROM listings WHERE id=$1 FOR UPDATE',[listing.id],client);
    const row=await one(`UPDATE listings SET availability_confirmed_at=$1,availability_expires_at=$2,updated_at=NOW() WHERE id=$3 RETURNING *`,
      [confirmedAt.toISOString(),expiresAt.toISOString(),listing.id],client);
    await audit('Listing',listing.id,'availability_reconfirmed',req.broker.id,{
      from:{effectiveAt:locked.availabilityConfirmedAt||null,expiresAt:locked.availabilityExpiresAt||null},
      to:{effectiveAt:confirmedAt.toISOString(),expiresAt:expiresAt.toISOString()},source:'inventory_workspace_quick_action'
    },client);
    return row;
  });
  res.json(withDiscount(updated));
});

r.patch('/listings/:id', async (req, res) => {
  const listing = await one('SELECT * FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!canEdit(req.broker, listing)) return res.status(403).json({ error: 'Only the posting broker or an admin can edit this listing' });
  req.body={...(req.body||{})};
  const developerSelectionProvided=req.body.developerOrganizationVersionId!==undefined;
  let selectedDeveloperVersion=null;
  if(developerSelectionProvided){const developerVersionId=String(req.body.developerOrganizationVersionId||'').trim();
    if(developerVersionId){selectedDeveloperVersion=await one(`SELECT v.id,v.version_number,v.legal_name,c.name AS company_name
      FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id
      WHERE v.id=$1 AND v.status='active' AND v.classification='developer' AND c.archived_at IS NULL AND c.status='active'`,[developerVersionId]);
      if(!selectedDeveloperVersion)return res.status(409).json({error:'Select an active Developer from Developer Master'});
      req.body.developer=selectedDeveloperVersion.legalName;
    }else req.body.developer=null;
  }
  if(req.body.transactionTypes!==undefined)req.body.transactionTypes=Array.isArray(req.body.transactionTypes)?[...new Set(req.body.transactionTypes.map(String))]:[];
  let area=null;
  if(req.body.areaId!==undefined){area=await governedArea(req.body.areaId);if(!area)return res.status(400).json({error:'Select an active Area from Area Maintenance'});req.body.areaId=area.id;}
  if(req.body.community!==undefined)req.body.community=String(req.body.community||'').trim()||null;
  for(const field of ['building','unitReference'])if(req.body[field]!==undefined)req.body[field]=String(req.body[field]||'').trim()||null;
  const targetPropertyType=req.body.propertyType??listing.propertyType;
  if(targetPropertyType!=='Bulk deal'&&(req.body.areaId!==undefined||req.body.communityId!==undefined||req.body.buildingId!==undefined)){const areaId=req.body.areaId??listing.areaId,communityId=req.body.communityId??listing.communityId,buildingId=req.body.buildingId??listing.buildingId,location=await one(`SELECT c.id AS community_id,v.business_label AS community_label,building.id AS building_id,building.business_label AS building_label FROM market_communities c JOIN market_community_versions v ON v.community_id=c.id AND v.status='active' JOIN inventory_buildings building ON building.community_id=c.id AND building.active=TRUE WHERE c.id=$1 AND c.area_id=$2 AND building.id=$3`,[communityId,areaId,buildingId]);if(!location)return res.status(409).json({error:'Select an active governed Community and Building maintained under the chosen Area'});Object.assign(req.body,{communityId:location.communityId,buildingId:location.buildingId,community:location.communityLabel,building:location.buildingLabel});}
  let bulk=null;
  if(req.body.parkingSpaces!==undefined)req.body.parkingSpaces=req.body.parkingSpaces===null||req.body.parkingSpaces===''?null:Number(req.body.parkingSpaces);
  if(req.body.bulkUnits!==undefined||req.body.propertyType!==undefined){bulk=normalizeBulkUnits(targetPropertyType,req.body.bulkUnits??[]);if(bulk.error)return res.status(400).json({error:bulk.error});if(targetPropertyType==='Bulk deal'){req.body.bedrooms=null;req.body.parkingSpaces=null;req.body.sizeSqft=bulk.units.reduce((sum,item)=>sum+item.sizeSqft,0);req.body.price=bulk.units.reduce((sum,item)=>sum+item.price,0);req.body.referencePrice=null;}}
  for(const [field,label,required] of [['price','Asking price',true],['referencePrice','Reference / market price',false]])if(req.body[field]!==undefined){const amount=normalizeInventoryAmount(req.body[field],{required,label});if(amount.error)return res.status(400).json({error:amount.error});req.body[field]=amount.value;}
  if(req.body.handoverStatus!==undefined||req.body.handoverExpectedDate!==undefined||req.body.handoverDate!==undefined){const handover=normalizeHandover(req.body);if(handover.error)return res.status(400).json({error:handover.error});Object.assign(req.body,{handoverStatus:handover.status,handoverExpectedDate:handover.expectedDate,handoverDate:handover.legacyValue});}
  const validationError = validateListingFields({...listing,...req.body});
  if (validationError) return res.status(400).json({ error: validationError });
  const changes = {}, sets = [], params = [];
  for (const field of EDITABLE) {
    if (req.body[field] === undefined || req.body[field] === listing[field]) continue;
    if (field === 'propertyType' && !PROPERTY_TYPES.includes(req.body[field])) return res.status(400).json({ error: 'Invalid propertyType' });
    if (field === 'bedrooms' && req.body[field] && !BEDROOMS.includes(req.body[field])) return res.status(400).json({ error: 'Invalid bedrooms' });
    if (field === 'paymentPlanType' && req.body[field] && !PAYMENT_PLANS.includes(req.body[field])) return res.status(400).json({ error: 'Invalid paymentPlanType' });
    if (field === 'exclusivityTier' && !TIERS.includes(req.body[field])) return res.status(400).json({ error: 'Invalid exclusivityTier' });
    if (field === 'price' && (!Number.isFinite(+req.body[field]) || +req.body[field] <= 0)) return res.status(400).json({ error: 'price must be a positive number' });
    changes[field] = { from: listing[field], to: req.body[field] };
    params.push(req.body[field]); sets.push(`${COLUMN[field]} = $${params.length}`);
  }
  if(area){changes.area={from:listing.area,to:area.businessLabel};params.push(area.businessLabel);sets.push(`area = $${params.length}`);}
  const replaceUnits=bulk!==null;
  // Inventory activation is governed only by verification or an authorized exemption.
  // Maintaining property, availability, permit, or verification-evidence fields must not silently deactivate a verified Inventory.
  if(listing.workflowStatus==='draft'&&['verified','not_required'].includes(listing.verificationStatus)){
    sets.push("workflow_status='approved'","review_comment=NULL","reviewed_at=COALESCE(reviewed_at,NOW())");
    changes.workflowStatus={from:'draft',to:'approved',reason:'restored because system-controlled verification remains valid'};
  }
  if (!sets.length&&!replaceUnits&&!developerSelectionProvided) return res.json(withDiscount(await refreshReadiness(listing.id)));
  params.push(listing.id);
  await transaction(async client=>{
    const identityChanged=['areaId','community','building','unitReference','sizeSqft'].some(field=>req.body[field]!==undefined&&req.body[field]!==listing[field]);
    if(identityChanged&&targetPropertyType!=='Bulk deal'){
      const target={areaId:req.body.areaId??listing.areaId,community:req.body.community??listing.community,building:req.body.building??listing.building,
        unitReference:req.body.unitReference??listing.unitReference,sizeSqft:req.body.sizeSqft??listing.sizeSqft};
      const duplicate=await inspectInventoryDuplicate(target,{client,excludeListingId:listing.id});
      const blocked=inventoryDuplicateError(duplicate);if(blocked){const error=new Error(blocked.error);Object.assign(error,{statusCode:blocked.status,responseBody:blocked});throw error;}
    }
    if(sets.length)await one(`UPDATE listings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params,client);
    if(replaceUnits)await replaceBulkUnits(listing.id,bulk.units,client);
    if(developerSelectionProvided){const latest=await one(`SELECT * FROM inventory_organization_link_events WHERE listing_id=$1 AND relationship='developer'
      ORDER BY performed_at DESC,id DESC LIMIT 1`,[listing.id],client),current=latest?.action==='unlinked'?null:latest,selectedId=selectedDeveloperVersion?.id||null;
      if(String(current?.partnerVersionId||'')!==String(selectedId||'')){
        const action=current?(selectedId?'replaced':'unlinked'):'linked';
        if(selectedId||current){const linkId=uuid(),reason=selectedId?'Developer selected from Developer Master during Inventory maintenance':'Developer selection cleared during Inventory maintenance';
          await execute(`INSERT INTO inventory_organization_link_events(id,listing_id,relationship,action,partner_version_id,supersedes_event_id,reason,performed_by,policy_version)
            VALUES($1,$2,'developer',$3,$4,$5,$6,$7,$8)`,[linkId,listing.id,action,selectedId,current?.id||null,reason,req.broker.id,PARTNER_ORGANIZATION_POLICY_VERSION],client);
          await audit('InventoryOrganizationLink',linkId,`inventory_organization_${action}`,req.broker.id,{listingId:listing.id,relationship:'developer',partnerVersionId:selectedId,partnerVersionNumber:selectedDeveloperVersion?.versionNumber||null,companyName:selectedDeveloperVersion?.companyName||null,supersedesEventId:current?.id||null,reason},client);
        }
      }
    }
    await audit('Listing', listing.id, 'edited', req.broker.id, {...changes,bulkUnits:replaceUnits?{count:bulk.units.length}:undefined},client);
  });
  const updated=await refreshReadiness(listing.id);
  res.json(withDiscount(updated));
});

r.post('/listings/:id/reopen-requests',async(req,res)=>{
  const listing=await one('SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL',[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!canEdit(req.broker,listing))return res.status(403).json({error:'This Inventory is outside your maintenance scope'});
  if(listing.status!=='Closed')return res.status(409).json({error:'Only a closed Inventory can be submitted for reopening'});
  const reason=String(req.body?.reason||'').trim();if(reason.length<10)return res.status(400).json({error:'Provide a clear reopening reason of at least 10 characters'});
  try{
    const row=await one(`INSERT INTO inventory_reopen_requests(id,listing_id,requested_by,request_reason)
      VALUES($1,$2,$3,$4) RETURNING *`,[uuid(),listing.id,req.broker.id,reason]);
    await audit('Listing',listing.id,'reopen_requested',req.broker.id,{requestId:row.id,reason});
    res.status(201).json(row);
  }catch(error){if(error.code==='23505')return res.status(409).json({error:'A manager reopening decision is already pending for this Inventory'});throw error;}
});

r.post('/listings/:id/reopen-requests/:requestId/decision',async(req,res)=>{
  const listing=await one(`SELECT l.*,b.team_id AS posted_by_team_id FROM listings l JOIN brokers b ON b.id=l.posted_by
    WHERE l.id=$1 AND l.deleted_at IS NULL`,[req.params.id]);
  if(!listing)return res.status(404).json({error:'Inventory not found'});
  if(!(await canReview(req.broker,listing)))return res.status(403).json({error:'Only an authorized Manager or Administrator can decide this reopening request'});
  const decision=String(req.body?.decision||''),reason=String(req.body?.reason||'').trim();
  if(!['approved','rejected'].includes(decision))return res.status(400).json({error:'Decision must be approved or rejected'});
  if(reason.length<10)return res.status(400).json({error:'Provide a decision reason of at least 10 characters'});
  try{
    const result=await transaction(async client=>{
      const request=await one(`SELECT * FROM inventory_reopen_requests WHERE id=$1 AND listing_id=$2 FOR UPDATE`,[req.params.requestId,listing.id],client);
      if(!request){const error=new Error('Reopening request not found');error.statusCode=404;throw error;}
      if(request.status!=='pending'){const error=new Error('This reopening request already has a decision');error.statusCode=409;throw error;}
      if(decision==='approved'){
        if(listing.status!=='Closed'){const error=new Error('Inventory is no longer closed');error.statusCode=409;throw error;}
        const duplicate=await inspectInventoryDuplicate(listing,{client,excludeListingId:listing.id});
        if(duplicate.outcome==='block_active_duplicate'){const error=new Error('Another active Inventory now has this exact identity; reopening is blocked');error.statusCode=409;throw error;}
        await one("UPDATE listings SET status='Available',closed_reason=NULL,closed_at=NULL,updated_at=NOW() WHERE id=$1 RETURNING id",[listing.id],client);
      }
      const updated=await one(`UPDATE inventory_reopen_requests SET status=$1,decided_by=$2,decision_reason=$3,decided_at=NOW()
        WHERE id=$4 RETURNING *`,[decision,req.broker.id,reason,request.id],client);
      await audit('Listing',listing.id,decision==='approved'?'reopen_approved':'reopen_rejected',req.broker.id,{requestId:request.id,reason,fromStatus:listing.status,toStatus:decision==='approved'?'Available':'Closed'},client);
      return updated;
    });
    res.json(result);
  }catch(error){if(error.statusCode)return res.status(error.statusCode).json({error:error.message});throw error;}
});

r.patch('/listings/:id/status', async (req, res) => {
  const listing = await one(`SELECT l.*,poster.team_id AS posted_by_team_id FROM listings l JOIN brokers poster ON poster.id=l.posted_by
    WHERE l.id = $1 AND l.deleted_at IS NULL`, [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!(await canAdministrativelyClose(req.broker, listing))) return res.status(403).json({ error: 'Only the responsible team Manager may administratively close or reopen Inventory' });
  if(listing.workflowStatus!=='approved')return res.status(409).json({error:'Verify and activate the Inventory before changing operational availability'});
  const { status, closedReason } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if(['Assigned','Reserved','Sold','Rented'].includes(status))return res.status(409).json({error:`${status} is system-controlled by Inventory assignments, Booking or Deal closure`});
  if(['Assigned','Reserved','Sold','Rented','Closed'].includes(listing.status)&&status!=='Closed')return res.status(409).json({error:'System-controlled or closed Inventory cannot be cleared manually; use its governed assignment, Booking, Deal or reopening action'});
  if (status === 'Closed' && !CLOSED_REASONS.includes(closedReason)) return res.status(400).json({ error: `Administrative closure requires one of: ${CLOSED_REASONS.join(', ')}` });
  if(status==='Closed'&&await one("SELECT id FROM bookings WHERE listing_id=$1 AND status='reserved' AND expires_at>NOW()",[listing.id]))return res.status(409).json({error:'Release or expire the active reservation before administratively closing Inventory'});
  if(status==='Closed'&&await one("SELECT id FROM inventory_assignments WHERE listing_id=$1 AND state='active' AND expires_at>NOW()",[listing.id]))return res.status(409).json({error:'End or expire every active Inventory assignment before administrative closure'});
  let updated = status === 'Closed'
    ? await one('UPDATE listings SET status=$1, closed_reason=$2, closed_at=NOW(), updated_at=NOW() WHERE id=$3 RETURNING *',[status,closedReason,listing.id])
    : await one('UPDATE listings SET status=$1, closed_reason=NULL, closed_at=NULL, updated_at=NOW() WHERE id=$2 RETURNING *', [status,listing.id]);
  updated=await refreshReadiness(listing.id);await audit('Listing', listing.id, 'status_changed', req.broker.id, { from:listing.status, to:status, closedReason:closedReason||null });
  res.json(withDiscount(updated));
});

r.delete('/listings/:id', async (req, res) => {
  if (req.broker.role !== 'admin') return res.status(403).json({ error: 'Only admins can archive listings' });
  const listing = await one('SELECT * FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  await execute('UPDATE listings SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [listing.id]);
  await audit('Listing', listing.id, 'deleted', req.broker.id, { project:listing.project });
  res.json({ ok:true, archived:listing.id });
});

export default r;
