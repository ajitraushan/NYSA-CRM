import { Router } from '../lib/http-kit.js';
import { one, many, execute, uuid, audit } from '../db.js';
import { requireAuth, requirePostRights } from '../auth.js';

const r = Router();
r.use(requireAuth);

const PROPERTY_TYPES = ['Apartment','Villa','Townhouse','Penthouse','Duplex','Plot','Bulk deal'];
const BEDROOMS = ['Studio','1','2','3','4','5+'];
const PAYMENT_PLANS = ['Cash','Mortgage','Developer plan','Post-handover'];
const STATUSES = ['Available','Reserved','Under offer','Closed'];
const TIERS = ['Exclusive to Nysa','Shared network','Off-market'];
const CLOSED_REASONS = ['Sold','Withdrawn','Expired'];
const EDITABLE = ['project','developer','area','propertyType','bedrooms','sizeSqft','price','referencePrice',
  'currency','paymentPlanType','downPaymentPercent','onHandoverPercent','postHandoverYears','paymentPlanNotes',
  'handoverDate','exclusivityTier','contact','notes'];
const COLUMN = {
  project:'project', developer:'developer', area:'area', propertyType:'property_type', bedrooms:'bedrooms',
  sizeSqft:'size_sqft', price:'price', referencePrice:'reference_price', currency:'currency',
  paymentPlanType:'payment_plan_type', downPaymentPercent:'down_payment_percent',
  onHandoverPercent:'on_handover_percent', postHandoverYears:'post_handover_years',
  paymentPlanNotes:'payment_plan_notes', handoverDate:'handover_date', exclusivityTier:'exclusivity_tier',
  contact:'contact', notes:'notes'
};

function withDiscount(listing) {
  const discountPercent = listing.referencePrice && Number(listing.referencePrice) > 0
    ? Math.round(((Number(listing.referencePrice) - Number(listing.price)) / Number(listing.referencePrice)) * 1000) / 10 : null;
  return { ...listing, discountPercent };
}

function canEdit(broker, listing) {
  return broker.role === 'admin' || listing.postedBy === broker.id;
}

function validateListingFields(body) {
  if (body.currency !== undefined && !/^[A-Z]{3}$/.test(String(body.currency))) return 'currency must be a 3-letter ISO code';
  for (const field of ['sizeSqft', 'referencePrice', 'downPaymentPercent', 'onHandoverPercent', 'postHandoverYears']) {
    if (body[field] !== undefined && body[field] !== null && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) return `${field} must be a non-negative number`;
  }
  for (const field of ['downPaymentPercent', 'onHandoverPercent']) {
    if (body[field] !== undefined && body[field] !== null && Number(body[field]) > 100) return `${field} cannot exceed 100`;
  }
  if (body.handoverDate !== undefined && body.handoverDate !== null && body.handoverDate !== 'Ready' && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.handoverDate))) return 'handoverDate must be Ready or YYYY-MM-DD';
  return null;
}

r.get('/listings', async (req, res) => {
  const q = req.query;
  const where = ['l.deleted_at IS NULL'];
  const params = [];
  const add = (clause, value) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };
  if (q.area) add('l.area ILIKE ?', `%${q.area}%`);
  if (q.propertyType && PROPERTY_TYPES.includes(q.propertyType)) add('l.property_type = ?', q.propertyType);
  if (q.bedrooms && BEDROOMS.includes(q.bedrooms)) add('l.bedrooms = ?', q.bedrooms);
  if (q.minPrice && Number.isFinite(+q.minPrice)) add('l.price >= ?', +q.minPrice);
  if (q.maxPrice && Number.isFinite(+q.maxPrice)) add('l.price <= ?', +q.maxPrice);
  if (q.paymentPlanType && PAYMENT_PLANS.includes(q.paymentPlanType)) add('l.payment_plan_type = ?', q.paymentPlanType);
  if (q.status && STATUSES.includes(q.status)) add('l.status = ?', q.status);
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
    (SELECT COUNT(*)::int FROM comments c WHERE c.listing_id = l.id AND c.deleted_at IS NULL) AS comment_count
    FROM listings l JOIN brokers b ON b.id = l.posted_by
    WHERE ${where.join(' AND ')} ORDER BY ${sorts[q.sort] || sorts.newest}`, params);
  res.json({ count: rows.length, listings: rows.map(withDiscount) });
});

r.get('/listings/:id', async (req, res) => {
  const listing = await one(`SELECT l.*, b.name AS posted_by_name, b.brokerage AS posted_by_brokerage
    FROM listings l JOIN brokers b ON b.id = l.posted_by WHERE l.id = $1 AND l.deleted_at IS NULL`, [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  res.json(withDiscount(listing));
});

r.post('/listings', requirePostRights, async (req, res) => {
  const b = req.body || {};
  for (const field of ['project','area','propertyType','price']) if (b[field] === undefined || b[field] === null || b[field] === '') return res.status(400).json({ error: `${field} is required` });
  if (!PROPERTY_TYPES.includes(b.propertyType)) return res.status(400).json({ error: 'Invalid propertyType' });
  if (b.bedrooms && !BEDROOMS.includes(b.bedrooms)) return res.status(400).json({ error: 'Invalid bedrooms' });
  if (b.paymentPlanType && !PAYMENT_PLANS.includes(b.paymentPlanType)) return res.status(400).json({ error: 'Invalid paymentPlanType' });
  if (b.exclusivityTier && !TIERS.includes(b.exclusivityTier)) return res.status(400).json({ error: 'Invalid exclusivityTier' });
  if (!Number.isFinite(+b.price) || +b.price <= 0) return res.status(400).json({ error: 'price must be a positive number' });
  const validationError = validateListingFields(b);
  if (validationError) return res.status(400).json({ error: validationError });
  const id = uuid();
  const listing = await one(`INSERT INTO listings (id,project,developer,area,property_type,bedrooms,size_sqft,price,
    reference_price,currency,payment_plan_type,down_payment_percent,on_handover_percent,post_handover_years,
    payment_plan_notes,handover_date,exclusivity_tier,posted_by,contact,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`,
    [id,b.project,b.developer||null,b.area,b.propertyType,b.bedrooms||null,b.sizeSqft??null,+b.price,
     b.referencePrice??null,b.currency||'AED',b.paymentPlanType||null,b.downPaymentPercent??null,
     b.onHandoverPercent??null,b.postHandoverYears??null,b.paymentPlanNotes||null,b.handoverDate||null,
     b.exclusivityTier||'Off-market',req.broker.id,b.contact||req.broker.phone||null,b.notes||null]);
  await audit('Listing', id, 'created', req.broker.id, { project:b.project, area:b.area, price:+b.price });
  res.status(201).json(withDiscount(listing));
});

r.patch('/listings/:id', async (req, res) => {
  const listing = await one('SELECT * FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!canEdit(req.broker, listing)) return res.status(403).json({ error: 'Only the posting broker or an admin can edit this listing' });
  const validationError = validateListingFields(req.body || {});
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
  params.push(listing.id);
  const updated = await one(`UPDATE listings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`, params);
  await audit('Listing', listing.id, 'edited', req.broker.id, changes);
  res.json(withDiscount(updated));
});

r.patch('/listings/:id/status', async (req, res) => {
  const listing = await one('SELECT * FROM listings WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!canEdit(req.broker, listing)) return res.status(403).json({ error: 'Only the posting broker or an admin can change status' });
  const { status, closedReason } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (status === 'Closed' && !CLOSED_REASONS.includes(closedReason)) return res.status(400).json({ error: 'Closing requires a reason: Sold, Withdrawn or Expired' });
  const updated = status === 'Closed'
    ? await one('UPDATE listings SET status=$1, closed_reason=$2, closed_at=NOW(), updated_at=NOW() WHERE id=$3 RETURNING *', [status,closedReason,listing.id])
    : await one('UPDATE listings SET status=$1, closed_reason=NULL, closed_at=NULL, updated_at=NOW() WHERE id=$2 RETURNING *', [status,listing.id]);
  await audit('Listing', listing.id, 'status_changed', req.broker.id, { from:listing.status, to:status, closedReason:closedReason||null });
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
