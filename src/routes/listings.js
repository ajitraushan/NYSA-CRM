import { Router } from '../lib/http-kit.js';
import { one, many, execute, uuid, audit } from '../db.js';
import { requireAuth, requirePostRights } from '../auth.js';
import { PAYMENT_PLANS,normalizeInventoryAmount,normalizeHandover,derivePublicationReadiness } from '../inventory-domain.js';
import { listingWorkflowQueue,validateListingWorkflowAction } from '../listing-workflow-domain.js';

const r = Router();
r.use(requireAuth);

const PROPERTY_TYPES = ['Apartment','Villa','Townhouse','Penthouse','Duplex','Plot','Bulk deal'];
const BEDROOMS = ['Studio','1','2','3','4','5+'];
const STATUSES = ['Available','Reserved','Under offer','Closed'];
const TIERS = ['Exclusive to Nysa','Shared network','Off-market'];
const CLOSED_REASONS = ['Sold','Withdrawn','Expired'];
const VERIFICATION_STATUSES = ['unverified','pending','verified','expired','not_required'];
const EDITABLE = ['project','developer','area','propertyType','bedrooms','sizeSqft','price','referencePrice',
  'currency','paymentPlanType','downPaymentPercent','onHandoverPercent','postHandoverYears','paymentPlanNotes',
  'handoverDate','handoverStatus','handoverExpectedDate','exclusivityTier','contact','notes','availabilityConfirmedAt','verificationStatus','verificationExpiresAt','permitNumber','permitExpiresAt'];
const COLUMN = {
  project:'project', developer:'developer', area:'area', propertyType:'property_type', bedrooms:'bedrooms',
  sizeSqft:'size_sqft', price:'price', referencePrice:'reference_price', currency:'currency',
  paymentPlanType:'payment_plan_type', downPaymentPercent:'down_payment_percent',
  onHandoverPercent:'on_handover_percent', postHandoverYears:'post_handover_years',
  paymentPlanNotes:'payment_plan_notes', handoverDate:'handover_date',handoverStatus:'handover_status',handoverExpectedDate:'handover_expected_date',exclusivityTier:'exclusivity_tier',
  contact:'contact', notes:'notes', availabilityConfirmedAt:'availability_confirmed_at',verificationStatus:'verification_status',
  verificationExpiresAt:'verification_expires_at',permitNumber:'permit_number',permitExpiresAt:'permit_expires_at'
};

function withDiscount(listing) {
  const discountPercent = listing.referencePrice && Number(listing.referencePrice) > 0
    ? Math.round(((Number(listing.referencePrice) - Number(listing.price)) / Number(listing.referencePrice)) * 1000) / 10 : null;
  const readiness=derivePublicationReadiness(listing,listing.approvedMediaCount||0);
  return { ...listing, discountPercent,publicationReadiness:readiness,portalStatus:listing.portalStatus==='published'?'published':readiness.status };
}

const isReviewer=broker=>broker.role==='admin'||broker.jobRole==='manager';
const canCreateListing=broker=>broker.role==='admin'||['listing_agent','admin_assistant','manager'].includes(broker.jobRole);
const ownsListing=(broker,listing)=>listing.postedBy===broker.id;
async function canReview(broker,listing){
  if(broker.role==='admin')return true;
  if(broker.jobRole!=='manager')return false;
  if((broker.managedTeamIds||[]).includes(String(listing.postedByTeamId||'')))return true;
  return Boolean(await one(`SELECT 1 AS allowed FROM brokers owner JOIN teams t ON t.id=owner.team_id
    WHERE owner.id=$1 AND (t.manager_id=$2 OR EXISTS(SELECT 1 FROM team_memberships tm WHERE tm.team_id=t.id AND tm.broker_id=$2 AND tm.membership_role='manager' AND tm.ends_at IS NULL))`,[listing.postedBy,broker.id]));
}

async function refreshReadiness(id){const listing=await one(`SELECT l.*,(SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count FROM listings l WHERE l.id=$1`,[id]);if(!listing)return null;const readiness=derivePublicationReadiness(listing,listing.approvedMediaCount);const portalStatus=listing.portalStatus==='published'?'published':readiness.status;const updated=await one('UPDATE listings SET portal_status=$1 WHERE id=$2 RETURNING *',[portalStatus,id]);return{...updated,approvedMediaCount:listing.approvedMediaCount};}

function canEdit(broker, listing) {
  return broker.role === 'admin' || broker.jobRole==='admin_assistant' || listing.postedBy === broker.id;
}

function validateListingFields(body) {
  if (body.currency !== undefined && !/^[A-Z]{3}$/.test(String(body.currency))) return 'currency must be a 3-letter ISO code';
  for (const field of ['sizeSqft', 'referencePrice', 'downPaymentPercent', 'onHandoverPercent', 'postHandoverYears']) {
    if (body[field] !== undefined && body[field] !== null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) return `${field} must be a non-negative number`;
  }
  for (const field of ['downPaymentPercent', 'onHandoverPercent']) {
    if (body[field] !== undefined && body[field] !== null && Number(body[field]) > 100) return `${field} cannot exceed 100`;
  }
  if(body.handoverStatus!==undefined||body.handoverExpectedDate!==undefined||body.handoverDate!==undefined){const handover=normalizeHandover(body);if(handover.error)return handover.error;}
  for(const field of ['availabilityConfirmedAt','verificationExpiresAt','permitExpiresAt'])if(body[field]!==undefined&&body[field]!==null&&body[field]!==''&&Number.isNaN(new Date(body[field]).valueOf()))return `${field} must be a valid date/time`;
  if(body.verificationStatus!==undefined&&!VERIFICATION_STATUSES.includes(body.verificationStatus))return 'Invalid verificationStatus';
  if(body.portalStatus!==undefined)return 'Portal readiness is calculated by the system and cannot be edited';
  return null;
}

r.get('/listings', async (req, res) => {
  const q = req.query;
  const where = ['l.deleted_at IS NULL'];
  const params = [];
  if(req.broker.jobRole==='listing_agent'){params.push(req.broker.id);where.push(`(l.workflow_status='approved' OR l.posted_by=$${params.length})`);}
  else if(req.broker.jobRole==='manager'){params.push(req.broker.managedTeamIds||[]);where.push(`(l.workflow_status='approved' OR b.team_id=ANY($${params.length}::uuid[]))`);}
  else if(req.broker.role!=='admin'&&req.broker.jobRole!=='admin_assistant')where.push("l.workflow_status='approved'");
  const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };
  if (q.area) add('l.area ILIKE ?', `%${q.area}%`);
  if (q.propertyType && PROPERTY_TYPES.includes(q.propertyType)) add('l.property_type = ?', q.propertyType);
  if (q.bedrooms && BEDROOMS.includes(q.bedrooms)) add('l.bedrooms = ?', q.bedrooms);
  if (q.minPrice && Number.isFinite(+q.minPrice)) add('l.price >= ?', +q.minPrice);
  if (q.maxPrice && Number.isFinite(+q.maxPrice)) add('l.price <= ?', +q.maxPrice);
  if (q.paymentPlanType && PAYMENT_PLANS.includes(q.paymentPlanType)) add('l.payment_plan_type = ?', q.paymentPlanType);
  if (q.status && STATUSES.includes(q.status)) add('l.status = ?', q.status);
  if(q.workflowStatus&&isReviewer(req.broker)&&['draft','in_review','approved','changes_requested','blocked'].includes(q.workflowStatus))add('l.workflow_status = ?',q.workflowStatus);
  if (q.exclusivityTier && TIERS.includes(q.exclusivityTier)) add('l.exclusivity_tier = ?', q.exclusivityTier);
  if (q.developer) add('l.developer ILIKE ?', `%${q.developer}%`);
  if (q.handoverBefore) add("(l.handover_date = 'Ready' OR l.handover_date <= ?)", q.handoverBefore);
  if (q.handoverAfter) add("(l.handover_date != 'Ready' AND l.handover_date >= ?)", q.handoverAfter);
  if (q.q) {
    const term = `%${q.q}%`;
    params.push(term, term, term);
    where.push(`(l.project ILIKE $${params.length - 2} OR l.developer ILIKE $${params.length - 1} OR l.area ILIKE $${params.length})`);
  }
  const sorts = {
    newest: 'l.created_at DESC', price_asc: 'l.price ASC', price_desc: 'l.price DESC',
    discount: '(CASE WHEN l.reference_price > 0 THEN (l.reference_price - l.price) / l.reference_price ELSE -1 END) DESC',
    handover: "(CASE WHEN l.handover_date = 'Ready' THEN '0000' ELSE COALESCE(l.handover_date,'9999') END) ASC"
  };
  const rows = await many(`SELECT l.*, b.name AS posted_by_name, b.brokerage AS posted_by_brokerage,
    b.team_id AS posted_by_team_id,
    (SELECT COUNT(*)::int FROM comments c WHERE c.listing_id = l.id AND c.deleted_at IS NULL) AS comment_count,
    (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
    FROM listings l JOIN brokers b ON b.id = l.posted_by
    WHERE ${where.join(' AND ')} ORDER BY ${sorts[q.sort] || sorts.newest}`, params);
  res.json({ count: rows.length, listings: rows.map(withDiscount) });
});

r.get('/listings-workspace',async(req,res)=>{
  if(req.broker.jobRole!=='listing_agent'&&req.broker.role!=='admin'&&req.broker.jobRole!=='admin_assistant')return res.status(403).json({error:'Listing Executive workspace is outside your role'});
  const params=[],scope=req.broker.jobRole==='listing_agent'?(params.push(req.broker.id),'l.posted_by=$1'):'TRUE';
  const rows=await many(`SELECT l.*,b.name AS posted_by_name,b.team_id AS posted_by_team_id,
    (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
    FROM listings l JOIN brokers b ON b.id=l.posted_by WHERE l.deleted_at IS NULL AND ${scope} ORDER BY l.updated_at DESC LIMIT 500`,params);
  const listings=rows.map(withDiscount).map(item=>({...item,queue:listingWorkflowQueue(withDiscount(item))}));
  const counts={active:0,drafts:0,awaitingReview:0,changesRequested:0,availabilityRefresh:0,pendingVerification:0,expiringPermits:0,incompleteMedia:0,readinessBlocks:0};
  for(const item of listings){
    if(item.workflowStatus==='approved'&&item.status!=='Closed')counts.active++;
    if(item.workflowStatus==='draft')counts.drafts++;
    if(item.workflowStatus==='in_review')counts.awaitingReview++;
    if(item.workflowStatus==='changes_requested')counts.changesRequested++;
    if(item.status==='Closed')continue;
    if(item.queue==='availability_refresh')counts.availabilityRefresh++;
    if(!['verified','not_required'].includes(item.verificationStatus))counts.pendingVerification++;
    if(item.permitExpiresAt&&new Date(item.permitExpiresAt)-new Date()<30*86400000)counts.expiringPermits++;
    if(!Number(item.approvedMediaCount||0))counts.incompleteMedia++;
    if(!item.publicationReadiness?.ready)counts.readinessBlocks++;
  }
  res.json({counts,listings});
});

r.get('/listings/:id', async (req, res) => {
  const listing = await one(`SELECT l.*, b.name AS posted_by_name, b.brokerage AS posted_by_brokerage,b.team_id AS posted_by_team_id,
    (SELECT COUNT(*)::int FROM property_media m WHERE m.listing_id=l.id AND m.approval_status='approved' AND m.media_type IN ('image/jpeg','image/png','image/webp')) AS approved_media_count
    FROM listings l JOIN brokers b ON b.id = l.posted_by WHERE l.id = $1 AND l.deleted_at IS NULL`, [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if(listing.workflowStatus!=='approved'&&!ownsListing(req.broker,listing)&&!canEdit(req.broker,listing)&&!await canReview(req.broker,listing))return res.status(403).json({error:'This draft is outside your inventory scope'});
  const workflowHistory=await many(`SELECT a.action,a.timestamp,a.details,b.name AS performed_by_name FROM audit_log a JOIN brokers b ON b.id=a.performed_by
    WHERE a.entity_type='Listing' AND a.entity_id=$1 AND (a.action LIKE 'workflow_%' OR a.action='draft_created') ORDER BY a.timestamp DESC`,[listing.id]);
  res.json({...withDiscount(listing),workflowHistory:workflowHistory.map(item=>({...item,details:typeof item.details==='string'?JSON.parse(item.details):item.details}))});
});

r.post('/listings', requirePostRights, async (req, res) => {
  if(!canCreateListing(req.broker))return res.status(403).json({error:'Manual listing drafts may be created by a Listing Executive, Manager or Administrator'});
  const b = {...(req.body || {})};
  for (const field of ['project','area','propertyType','price']) if (b[field] === undefined || b[field] === null || b[field] === '') return res.status(400).json({ error: `${field} is required` });
  if (!PROPERTY_TYPES.includes(b.propertyType)) return res.status(400).json({ error: 'Invalid propertyType' });
  if (b.bedrooms && !BEDROOMS.includes(b.bedrooms)) return res.status(400).json({ error: 'Invalid bedrooms' });
  if (b.paymentPlanType && !PAYMENT_PLANS.includes(b.paymentPlanType)) return res.status(400).json({ error: 'Invalid paymentPlanType' });
  if (b.exclusivityTier && !TIERS.includes(b.exclusivityTier)) return res.status(400).json({ error: 'Invalid exclusivityTier' });
  const price=normalizeInventoryAmount(b.price,{required:true,label:'Asking price'}),reference=normalizeInventoryAmount(b.referencePrice,{label:'Reference / market price'});if(price.error)return res.status(400).json({error:price.error});if(reference.error)return res.status(400).json({error:reference.error});b.price=price.value;b.referencePrice=reference.value;
  const handover=normalizeHandover(b);if(handover.error)return res.status(400).json({error:handover.error});b.handoverStatus=handover.status;b.handoverExpectedDate=handover.expectedDate;b.handoverDate=handover.legacyValue;
  const validationError = validateListingFields(b);
  if (validationError) return res.status(400).json({ error: validationError });
  const id = uuid();
  const listing = await one(`INSERT INTO listings (id,project,developer,area,property_type,bedrooms,size_sqft,price,
    reference_price,currency,payment_plan_type,down_payment_percent,on_handover_percent,post_handover_years,
    payment_plan_notes,handover_date,handover_status,handover_expected_date,exclusivity_tier,posted_by,contact,notes,availability_confirmed_at,verification_status,
    verification_expires_at,permit_number,permit_expires_at,portal_status,workflow_status,source_kind)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,'draft','manual') RETURNING *`,
    [id,b.project,b.developer||null,b.area,b.propertyType,b.bedrooms||null,b.sizeSqft??null,+b.price,
     b.referencePrice??null,b.currency||'AED',b.paymentPlanType||null,b.downPaymentPercent??null,
     b.onHandoverPercent??null,b.postHandoverYears??null,b.paymentPlanNotes||null,b.handoverDate||null,b.handoverStatus,b.handoverExpectedDate,
     b.exclusivityTier||'Off-market',req.broker.id,b.contact||req.broker.phone||null,b.notes||null,b.availabilityConfirmedAt||null,
     b.verificationStatus||'unverified',b.verificationExpiresAt||null,b.permitNumber||null,b.permitExpiresAt||null,'blocked']);
  await audit('Listing', id, 'draft_created', req.broker.id, { project:b.project, area:b.area, price:+b.price,sourceKind:'manual' });
  res.status(201).json(withDiscount(listing));
});

r.patch('/listings/:id/workflow',async(req,res)=>{
  const listing=await one(`SELECT l.*,b.team_id AS posted_by_team_id FROM listings l JOIN brokers b ON b.id=l.posted_by WHERE l.id=$1 AND l.deleted_at IS NULL`,[req.params.id]);
  if(!listing)return res.status(404).json({error:'Listing not found'});
  const action=String(req.body?.action||''),reason=String(req.body?.reason||'').trim(),reviewer=await canReview(req.broker,listing);
  const error=validateListingWorkflowAction({current:listing.workflowStatus,action,reason,isOwner:ownsListing(req.broker,listing),canReview:reviewer});
  if(error)return res.status(error.startsWith('Only')?403:400).json({error});
  if(['submit','approve'].includes(action)){
    const current=withDiscount(await refreshReadiness(listing.id));
    if(!current.publicationReadiness.ready)return res.status(409).json({error:`Resolve listing readiness before ${action==='submit'?'submission':'approval'}: ${current.publicationReadiness.blockers.map(item=>item.label).join(', ')}`});
  }
  const next={submit:'in_review',approve:'approved',request_changes:'changes_requested',block:'blocked',restore:'draft'}[action];
  const submitted=action==='submit',reviewed=['approve','request_changes','block','restore'].includes(action);
  const updated=await one(`UPDATE listings SET workflow_status=$1,
    submitted_at=CASE WHEN $2 THEN NOW() ELSE submitted_at END,submitted_by=CASE WHEN $2 THEN $4 ELSE submitted_by END,
    reviewed_at=CASE WHEN $3 THEN NOW() ELSE reviewed_at END,reviewed_by=CASE WHEN $3 THEN $4 ELSE reviewed_by END,
    review_comment=$5,updated_at=NOW() WHERE id=$6 RETURNING *`,[next,submitted,reviewed,req.broker.id,reason||null,listing.id]);
  await audit('Listing',listing.id,`workflow_${action}`,req.broker.id,{from:listing.workflowStatus,to:next,reason:reason||null});
  res.json(withDiscount(updated));
});

r.patch('/listings/:id', async (req, res) => {
  const listing = await one('SELECT * FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!canEdit(req.broker, listing)) return res.status(403).json({ error: 'Only the posting broker or an admin can edit this listing' });
  req.body={...(req.body||{})};
  for(const [field,label,required] of [['price','Asking price',true],['referencePrice','Reference / market price',false]])if(req.body[field]!==undefined){const amount=normalizeInventoryAmount(req.body[field],{required,label});if(amount.error)return res.status(400).json({error:amount.error});req.body[field]=amount.value;}
  if(req.body.handoverStatus!==undefined||req.body.handoverExpectedDate!==undefined||req.body.handoverDate!==undefined){const handover=normalizeHandover(req.body);if(handover.error)return res.status(400).json({error:handover.error});Object.assign(req.body,{handoverStatus:handover.status,handoverExpectedDate:handover.expectedDate,handoverDate:handover.legacyValue});}
  const validationError = validateListingFields(req.body);
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
  if (!sets.length) return res.json(withDiscount(listing));
  if(listing.workflowStatus==='approved'&&req.broker.jobRole==='listing_agent')sets.push("workflow_status='draft'","review_comment='Material changes require a new review'","reviewed_at=NULL","reviewed_by=NULL");
  params.push(listing.id);
  await one(`UPDATE listings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params);
  const updated=await refreshReadiness(listing.id);
  await audit('Listing', listing.id, 'edited', req.broker.id, changes);
  res.json(withDiscount(updated));
});

r.patch('/listings/:id/status', async (req, res) => {
  const listing = await one('SELECT * FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!canEdit(req.broker, listing)) return res.status(403).json({ error: 'Only the posting broker or an admin can change status' });
  if(listing.workflowStatus!=='approved')return res.status(409).json({error:'Submit and approve the listing before changing operational availability'});
  const { status, closedReason } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (status === 'Closed' && !CLOSED_REASONS.includes(closedReason)) return res.status(400).json({ error: 'Closing requires a reason: Sold, Withdrawn or Expired' });
  let updated = status === 'Closed'
    ? await one('UPDATE listings SET status=$1, closed_reason=$2, closed_at=NOW(), updated_at=NOW() WHERE id=$3 RETURNING *', [status,closedReason,listing.id])
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
