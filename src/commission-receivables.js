import {one,many,execute,transaction,uuid,audit} from './db.js';
import {mayRecordFinanceReceipt} from './commission-proof.js';
import {payoutFingerprint,calculateExpectedCommission} from './commission-payout-domain.js';
import {badRequest,dateOnly,dubaiToday,moneyCents,scheduleInput,invoiceState} from './receivables-domain.js';
import {postInvoicePayment,reverseInvoicePayment,lockOpportunityFinance} from './receivable-receipt-posting.js';
import {readFile} from 'node:fs/promises';
import crypto from 'node:crypto';
import {readPrivate,savePrivate,removePrivate} from './private-files.js';
import {commissionInvoiceApprovedDocument,makeCommissionInvoicePdf} from './commission-invoice-pdf.js';
import {recordApprovedDocumentIssuance} from './approved-document-issuance.js';

const clean=value=>String(value??'').trim();
const validId=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||'');
const requireId=value=>{if(!validId(value))throw badRequest('A valid record identifier is required');return value;};
const text=(value,label,min=3,max=200)=>{const s=clean(value);if(s.length<min||s.length>max)throw badRequest(`${label} must contain ${min}–${max} characters`);return s;};
const authority=req=>{if(!mayRecordFinanceReceipt(req.broker))throw badRequest('Accountant or Director finance authority required',403);};
const accountant=req=>{if(req.broker?.jobRole!=='accountant')throw badRequest('Only the Accountant may request an issued-invoice cancellation or amendment',403);};
const director=req=>{if(req.broker?.jobRole!=='director')throw badRequest('Only the MD/Director may approve or reject an invoice cancellation or amendment',403);};
const collectionSum=`COALESCE((SELECT SUM(c.amount_cents) FROM commission_receivable_collections c WHERE c.invoice_id=i.id AND NOT EXISTS(SELECT 1 FROM commission_receivable_reversals r WHERE r.collection_id=c.id)),0)`;
const invoiceSelect=`SELECT i.id,i.schedule_id,i.instalment_number,i.milestone,i.commission_cents,i.vat_rate,i.vat_cents,i.total_cents,
  i.invoice_reference,i.state,i.cancellation_reason,i.version,i.replaces_invoice_id,i.superseded_by_invoice_id,i.invoice_date::text AS invoice_date,i.due_date::text AS due_date,
  s.schedule_reference,s.opportunity_id,s.payer_type,s.payer_contact_id,s.payer_company_id,s.payer_name,s.currency,o.opportunity_reference,
  ${collectionSum} AS collected_cents
  FROM commission_receivable_invoices i JOIN commission_receivable_schedules s ON s.id=i.schedule_id
  JOIN opportunities o ON o.id=s.opportunity_id`;
async function invoice(id,client){
  const row=await one(`${invoiceSelect} WHERE i.id=$1`,[requireId(id)],client);
  if(!row)throw badRequest('Receivable invoice not found',404);
  return invoiceState(row);
}
async function mutate(req,res,action,work){
  authority(req);
  const body=req.body||{},key=text(body.idempotencyKey,'Stable idempotency key',8,200);
  const fingerprint=payoutFingerprint({action,params:req.params,body});
  try{
    const result=await transaction(async client=>{
      await execute('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`receivable:${req.broker.id}:${key}`],client);
      const old=await one('SELECT * FROM commission_receivable_requests WHERE actor_id=$1 AND idempotency_key=$2',[req.broker.id,key],client);
      if(old){if(old.fingerprint!==fingerprint)throw badRequest('This request key was already used for different details',409);return{...old.response,replayed:true};}
      const response=await work(client,body);
      await execute('INSERT INTO commission_receivable_requests(id,actor_id,idempotency_key,fingerprint,response) VALUES($1,$2,$3,$4,$5)',[uuid(),req.broker.id,key,fingerprint,JSON.stringify(response)],client);
      return response;
    });
    res.status(result.replayed?200:201).json(result);
  }catch(error){if(error.code==='23505')throw badRequest('Invoice or collection reference already exists. Refresh and review before retrying.',409);throw error;}
}
async function lockInvoice(req,client){
  const id=requireId(req.params.id);
  await one('SELECT id FROM commission_receivable_invoices WHERE id=$1 FOR UPDATE',[id],client);
  return invoice(id,client);
}
async function nextInvoiceIdentity(client){
  const invoiceDate=dubaiToday(),year=Number(invoiceDate.slice(0,4));
  const counter=await one(`INSERT INTO commission_invoice_number_counters(invoice_year,last_number) VALUES($1,1)
    ON CONFLICT(invoice_year) DO UPDATE SET last_number=commission_invoice_number_counters.last_number+1 RETURNING last_number`,[year],client);
  return{invoiceDate,invoiceReference:`NYSA-INV-${year}-${String(counter.lastNumber).padStart(6,'0')}`};
}
async function issueInvoice(item,actorId,client,action='invoice_recorded'){
  const identity=await nextInvoiceIdentity(client);
  await execute("UPDATE commission_receivable_invoices SET state='issued',invoice_date=$2,invoice_reference=$3,version=version+1 WHERE id=$1",[item.id,identity.invoiceDate,identity.invoiceReference],client);
  await audit('CommissionReceivable',item.id,action,actorId,identity,client);
  const issued=await invoice(item.id,client);await persistInvoiceDocument(issued,actorId,client);return issued;
}

async function persistInvoiceDocument(item,actorId,client){
  const existing=await one("SELECT i.document_version_id FROM approved_document_issuances i WHERE i.document_code='tax_invoice' AND i.source_entity_type='CommissionReceivable' AND i.source_entity_id=$1",[item.id],client);if(existing)return existing;
  const transaction=await one(`SELECT d.id AS deal_id,d.deal_reference,d.deal_type,d.agreed_value,d.currency,d.listing_id,l.project,l.developer,l.unit_reference,l.inventory_reference,
    b.created_at::date::text AS booked_date,(SELECT COALESCE(SUM(x.commission_cents),0) FROM commission_receivable_invoices x WHERE x.schedule_id=$2 AND x.state<>'cancelled') AS schedule_commission_cents
    FROM deals d LEFT JOIN bookings b ON b.id=d.booking_id LEFT JOIN listings l ON l.id=d.listing_id WHERE d.opportunity_id=$1 AND d.status='closed_won'
    ORDER BY d.closed_at DESC,d.id DESC LIMIT 1`,[item.opportunityId,item.scheduleId],client)||{scheduleCommissionCents:item.commissionCents,currency:'AED'};
  if(transaction.dealType==='off_plan'&&item.payerType!=='developer')throw badRequest('This off-plan invoice must be raised to the maintained Developer',409);
  const organization=await one("SELECT * FROM organization_settings WHERE status='active' ORDER BY version DESC LIMIT 1",[],client)||{displayName:'NYSA Realty'},required=[['legalName','legal company name'],['tradeLicenseNumber','trade licence number'],['vatRegistrationNumber','VAT registration number'],['registeredAddress','registered address'],['primaryPhone','contact number'],['bankAccountName','bank account name'],['bankName','bank name'],['bankAccountNumber','bank account number'],['bankIban','IBAN'],['bankSwiftCode','SWIFT code'],['bankCurrency','bank currency'],['bankBranch','bank branch']],missing=required.filter(([field])=>!clean(organization[field])).map(([,label])=>label);
  if(missing.length)throw badRequest(`Complete and activate Organisation Settings before issuing this tax invoice. Missing: ${missing.join(', ')}`,409);
  const payer=item.payerType==='customer'?await one('SELECT full_name AS name,postal_address AS address,NULL::text AS vat_registration_number,NULL::text AS trade_license_number FROM contacts WHERE id=$1',[item.payerContactId],client):await one('SELECT name,address,vat_registration_number,trade_license_number FROM companies WHERE id=$1',[item.payerCompanyId],client);
  if(!payer)throw badRequest('The maintained invoice payer is no longer available',409);if(item.payerType==='developer'&&(!clean(payer.address)||!clean(payer.vatRegistrationNumber)))throw badRequest('Complete the Developer registered address and VAT registration number in Company invoice details before issuing',409);
  const input={invoice:{...item,currency:transaction.currency||'AED'},organization,transaction,payer},data=commissionInvoiceApprovedDocument(input),pdf=await makeCommissionInvoicePdf(input),documentId=uuid(),documentVersionId=uuid(),fileName=`${item.invoiceReference}.pdf`,storageKey=await savePrivate(pdf,'.pdf'),fileHash=crypto.createHash('sha256').update(pdf).digest('hex');
  try{
    await execute(`INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,contact_id,listing_id) VALUES($1,$2,'tax_invoice',$3,'Outbound','restricted','active',$4,$4,$5,$6)`,[documentId,item.invoiceReference,`Tax Invoice · ${item.invoiceReference}`,actorId,item.payerContactId||null,transaction.listingId||null],client);
    await execute(`INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by) VALUES($1,$2,1,$3,'application/pdf',$4,$5,$6,1,'generated','restricted','generated',$7,$7)`,[documentVersionId,documentId,fileName,pdf.length,storageKey,fileHash,actorId],client);
    for(const[type,id]of[['Opportunity',item.opportunityId],['Deal',transaction.dealId],['Listing',transaction.listingId],['Contact',item.payerContactId]])if(id)await execute('INSERT INTO document_links(id,document_id,entity_type,entity_id,created_by) VALUES($1,$2,$3,$4,$5)',[uuid(),documentId,type,id,actorId],client);
    await recordApprovedDocumentIssuance({execute,uuid,client,documentCode:'tax_invoice',data,pdf,documentVersionId,sourceEntityType:'CommissionReceivable',sourceEntityId:item.id,issuedBy:actorId,idempotencyKey:`tax-invoice:${item.id}:version:${item.version}`});
    await audit('CommissionReceivable',item.id,'approved_invoice_document_issued',actorId,{invoiceReference:item.invoiceReference,documentVersionId,fileHash},client);return{documentVersionId};
  }catch(error){await removePrivate(storageKey).catch(()=>{});throw error;}
}

export function registerCommissionReceivableRoutes(r){
  r.get('/finance/receivables/opportunities/:id/context',async(req,res)=>{
    authority(req);
    const row=await one(`SELECT o.id,o.opportunity_reference,o.stage,o.transaction_type,
      c.id AS customer_id,c.full_name AS customer_name,
      o.buyer_commission_percent,o.buyer_commission_minimum,o.seller_commission_percent,o.seller_commission_minimum,o.referral_fee,
      o.originating_agent_split_percent,o.servicing_agent_split_percent,
      d.id AS deal_id,d.deal_reference,d.status AS deal_status,d.deal_type,d.agreed_value,d.currency,
      e.id AS expectation_id,e.expected_gross_amount,e.expected_company_receipt,e.referral_amount,e.referral_settlement_basis,
      COALESCE((SELECT SUM(i.commission_cents) FROM commission_receivable_schedules s
        JOIN commission_receivable_invoices i ON i.schedule_id=s.id
        WHERE s.opportunity_id=o.id AND i.state<>'cancelled'),0) AS scheduled_commission_cents
      FROM opportunities o LEFT JOIN leads l ON l.id=o.lead_id LEFT JOIN contacts c ON c.id=l.contact_id
      LEFT JOIN LATERAL (SELECT id,deal_reference,status,deal_type,agreed_value,currency FROM deals
        WHERE opportunity_id=o.id ORDER BY created_at DESC,id DESC LIMIT 1) d ON TRUE
      LEFT JOIN deal_commission_expectation_versions e ON e.deal_id=d.id AND e.status='frozen'
      WHERE o.id=$1`,[requireId(req.params.id)]);
    if(!row)throw badRequest('Opportunity not found',404);
    let agreedGrossCommission=null;
    if(row.dealId)try{agreedGrossCommission=calculateExpectedCommission({...row,referralSettlementBasis:row.referralSettlementBasis||'none'}).expectedGrossAmount;}catch{}
    res.json({context:{...row,agreedGrossCommission},readOnly:true});
  });
  r.get('/finance/receivables/opportunities',async(req,res)=>{
    authority(req);
    const typed=clean(req.query.q).slice(0,100),q=typed.match(/NYSA-OP-\d+-\d+/i)?.[0]||typed;
    // This is a receivable selector, not a general Opportunity lookup. Return only
    // Closed Won records with commission that remains available for invoicing.
    const rows=await many(`SELECT o.id,o.opportunity_reference,o.transaction_type,o.closed_at,d.deal_type,d.listing_id,d.id AS deal_id,
      o.buyer_commission_percent,o.buyer_commission_minimum,o.seller_commission_percent,o.seller_commission_minimum,o.referral_fee,
      d.agreed_value,d.currency,e.expected_company_receipt,e.referral_amount,e.referral_settlement_basis,
      c.full_name AS customer_name,last_schedule.payer_name,
      COALESCE((SELECT SUM(i.commission_cents) FROM commission_receivable_schedules s
        JOIN commission_receivable_invoices i ON i.schedule_id=s.id
        WHERE s.opportunity_id=o.id AND i.state<>'cancelled'),0) AS scheduled_commission_cents
      FROM opportunities o JOIN leads l ON l.id=o.lead_id JOIN contacts c ON c.id=l.contact_id
      JOIN LATERAL (SELECT id,agreed_value,currency,deal_type,listing_id FROM deals WHERE opportunity_id=o.id AND status='closed_won'
        ORDER BY closed_at DESC,id DESC LIMIT 1) d ON TRUE
      LEFT JOIN LATERAL (SELECT expected_company_receipt,referral_amount,referral_settlement_basis
        FROM deal_commission_expectation_versions WHERE deal_id=d.id AND status='frozen' ORDER BY version_number DESC,id DESC LIMIT 1) e ON TRUE
      LEFT JOIN LATERAL (SELECT payer_name FROM commission_receivable_schedules WHERE opportunity_id=o.id ORDER BY created_at DESC,id DESC LIMIT 1) last_schedule ON TRUE
      WHERE o.stage='Closed Won' AND ($1='' OR o.opportunity_reference ILIKE '%'||$1||'%' OR c.full_name ILIKE '%'||$1||'%' OR last_schedule.payer_name ILIKE '%'||$1||'%')
      ORDER BY o.closed_at DESC,o.id LIMIT 200`,[q]);
    const opportunities=rows.map(row=>{
      let expected=row.expectedCompanyReceipt;
      if(expected==null)try{expected=calculateExpectedCommission({...row,referralSettlementBasis:row.referralSettlementBasis||'none'}).expectedCompanyReceipt;}catch{return null;}
      const outstandingCommissionCents=Math.max(0,Math.round(Number(expected)*100)-Number(row.scheduledCommissionCents));
      if(!outstandingCommissionCents)return null;
      return{id:row.id,opportunityReference:row.opportunityReference,transactionType:row.transactionType,dealType:row.dealType,
        customerName:row.customerName,payerName:row.payerName||null,displayParty:row.payerName||row.customerName,
        outstandingCommissionCents,outstandingCommission:outstandingCommissionCents/100,currency:row.currency||'AED'};
    }).filter(Boolean).slice(0,50);
    res.json({opportunities,limit:50});
  });
  r.get('/finance/receivables/awaiting',async(req,res)=>{
    authority(req);
    const rows=await many(`SELECT o.id,o.opportunity_reference,o.transaction_type,o.stage,o.closed_at,
      o.buyer_commission_percent,o.buyer_commission_minimum,o.seller_commission_percent,o.seller_commission_minimum,o.referral_fee,
      o.originating_agent_split_percent,o.servicing_agent_split_percent,d.id AS deal_id,d.deal_reference,d.agreed_value,d.currency
      FROM opportunities o JOIN LATERAL (SELECT id,deal_reference,agreed_value,currency FROM deals
        WHERE opportunity_id=o.id AND status='closed_won' ORDER BY closed_at DESC,id DESC LIMIT 1) d ON TRUE
      WHERE o.stage='Closed Won' AND NOT EXISTS(
        SELECT 1 FROM commission_receivable_schedules s
        JOIN commission_receivable_invoices i ON i.schedule_id=s.id
        WHERE s.opportunity_id=o.id AND i.state<>'cancelled'
      )
      ORDER BY o.closed_at DESC,o.id LIMIT 100`);
    const opportunities=rows.map(row=>{let expectedCommission=null,commissionStatus='ready';try{expectedCommission=calculateExpectedCommission(row).expectedCompanyReceipt;}catch{commissionStatus='details_required';}return{...row,expectedCommission,commissionStatus,payerStatus:'details_required'};});
    res.json({opportunities,limit:100});
  });
  r.get('/finance/receivables/payers',async(req,res)=>{
    authority(req);
    const type=clean(req.query.type),q=clean(req.query.q).slice(0,100);
    if(!['customer','agency','developer'].includes(type))throw badRequest('Choose a payer type');
    const payers=type==='customer'?await many(`SELECT id,full_name AS name FROM contacts WHERE archived_at IS NULL AND ($1='' OR full_name ILIKE '%'||$1||'%') ORDER BY full_name,id LIMIT 50`,[q]):
      await many(`SELECT id,name FROM companies WHERE archived_at IS NULL AND company_type=$1 AND ($2='' OR name ILIKE '%'||$2||'%') ORDER BY name,id LIMIT 50`,[type,q]);
    res.json({payers,limit:50});
  });
  r.get('/finance/receivables',async(req,res)=>{
    authority(req);
    const q=clean(req.query.q).slice(0,100),status=clean(req.query.status),page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page)||1)),today=dubaiToday();
    if(!['','scheduled','unpaid','part_paid','paid','cancelled','superseded','overdue'].includes(status))throw badRequest('Unknown status filter');
    const cte=`WITH base AS (${invoiceSelect}), register AS (SELECT *,
      CASE WHEN state='cancelled' AND superseded_by_invoice_id IS NOT NULL THEN 'superseded' WHEN state='cancelled' THEN 'cancelled' WHEN state='planned' THEN 'scheduled' WHEN collected_cents=total_cents THEN 'paid' WHEN collected_cents>0 THEN 'part_paid' ELSE 'unpaid' END AS status,
      (state='issued' AND collected_cents<total_cents AND due_date::date<$3::date) AS overdue FROM base),
      filtered AS (SELECT * FROM register WHERE ($1='' OR opportunity_reference ILIKE '%'||$1||'%' OR payer_name ILIKE '%'||$1||'%' OR invoice_reference ILIKE '%'||$1||'%')
      AND ($2='' OR ($2='overdue' AND overdue) OR status=$2))`;
    const params=[q,status,today];
    const rows=await many(`${cte} SELECT * FROM filtered ORDER BY due_date,id LIMIT 50 OFFSET $4`,[...params,(page-1)*50]);
    const summary=await one(`${cte} SELECT COUNT(*)::int AS invoice_count,
      COALESCE(SUM(commission_cents) FILTER(WHERE state<>'cancelled'),0) AS commission_cents,
      COALESCE(SUM(vat_cents) FILTER(WHERE state<>'cancelled'),0) AS vat_cents,
      COALESCE(SUM(total_cents) FILTER(WHERE state<>'cancelled'),0) AS total_cents,
      COALESCE(SUM(collected_cents) FILTER(WHERE state<>'cancelled'),0) AS collected_cents,
      COALESCE(SUM(total_cents-collected_cents) FILTER(WHERE state='issued'),0) AS outstanding_cents,
      COALESCE(SUM(total_cents) FILTER(WHERE state='planned'),0) AS scheduled_cents,
      COALESCE(SUM(total_cents-collected_cents) FILTER(WHERE overdue),0) AS overdue_cents FROM filtered`,params);
    res.json({invoices:rows.map(row=>invoiceState(row,today)),summary,page,pageSize:50,asOf:today,currency:'AED'});
  });
  r.get('/finance/receivables/:id',async(req,res)=>{
    authority(req);
    const item=await invoice(req.params.id);
    const collections=await many(`SELECT c.*,c.received_date::text AS received_date,r.id AS reversal_id,r.reason AS reversal_reason
      FROM commission_receivable_collections c LEFT JOIN commission_receivable_reversals r ON r.collection_id=c.id WHERE c.invoice_id=$1 ORDER BY c.created_at,c.id`,[item.id]);
    const events=await many(`SELECT action,timestamp AS created_at,details FROM audit_log WHERE entity_type='CommissionReceivable' AND entity_id IN ($1,$2) ORDER BY timestamp`,[item.id,item.scheduleId]);
    const adjustments=await many(`SELECT a.*,requester.name AS requested_by_name,decider.name AS decided_by_name
      FROM commission_receivable_adjustment_requests a JOIN brokers requester ON requester.id=a.requested_by
      LEFT JOIN brokers decider ON decider.id=a.decided_by WHERE a.invoice_id=$1 ORDER BY a.requested_at DESC`,[item.id]);
    res.json({invoice:item,collections,events,adjustments});
  });
  r.get('/finance/receivables/:id/document',async(req,res)=>{
    authority(req);
    const item=await invoice(req.params.id);
    if(item.state!=='issued'||!item.invoiceReference)throw badRequest('Generate this invoice before opening its paper invoice',409);
    const persisted=await transaction(client=>persistInvoiceDocument(item,req.broker.id,client)),version=await one('SELECT * FROM document_versions WHERE id=$1',[persisted.documentVersionId]),stored=await readPrivate(version.storageKey);
    await audit('CommissionReceivable',item.id,'invoice_document_viewed',req.broker.id,{invoiceReference:item.invoiceReference,documentVersionId:version.id,immutable:true});
    res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`${req.query.download==='1'?'attachment':'inline'}; filename="${version.fileName.replace(/"/g,'')}"`);res.setHeader('Cache-Control','private, no-store');return res.end(stored);
    const transactionContext=await one(`SELECT d.deal_reference,d.deal_type,d.agreed_value,d.currency,l.project,l.developer,l.unit_reference,l.inventory_reference,
      b.created_at::date::text AS booked_date,
      (SELECT COALESCE(SUM(x.commission_cents),0) FROM commission_receivable_invoices x WHERE x.schedule_id=$2 AND x.state<>'cancelled') AS schedule_commission_cents
      FROM deals d LEFT JOIN bookings b ON b.id=d.booking_id LEFT JOIN listings l ON l.id=d.listing_id WHERE d.opportunity_id=$1 AND d.status='closed_won'
      ORDER BY d.closed_at DESC,d.id DESC LIMIT 1`,[item.opportunityId,item.scheduleId])||{scheduleCommissionCents:item.commissionCents,currency:'AED'};
    if(transactionContext.dealType==='off_plan'&&item.payerType!=='developer')throw badRequest('This off-plan invoice must be raised to the maintained Developer',409);
    const organization=await one("SELECT * FROM organization_settings WHERE status='active' ORDER BY version DESC LIMIT 1")||{displayName:'NYSA Realty'};
    const requiredOrganizationFields=[['legalName','legal company name'],['tradeLicenseNumber','trade licence number'],['vatRegistrationNumber','VAT registration number'],['registeredAddress','registered address'],['primaryPhone','contact number'],['bankAccountName','bank account name'],['bankName','bank name'],['bankAccountNumber','bank account number'],['bankIban','IBAN'],['bankSwiftCode','SWIFT code'],['bankCurrency','bank currency'],['bankBranch','bank branch']];
    const missingOrganization=requiredOrganizationFields.filter(([field])=>!clean(organization[field])).map(([,label])=>label);
    if(missingOrganization.length)throw badRequest(`Complete and activate Organisation Settings before printing this tax invoice. Missing: ${missingOrganization.join(', ')}`,409);
    const payer=item.payerType==='customer'?await one('SELECT full_name AS name,postal_address AS address,NULL::text AS vat_registration_number,NULL::text AS trade_license_number FROM contacts WHERE id=$1',[item.payerContactId]):
      await one('SELECT name,address,vat_registration_number,trade_license_number FROM companies WHERE id=$1',[item.payerCompanyId]);
    if(!payer)throw badRequest('The maintained invoice payer is no longer available',409);
    if(item.payerType==='developer'&&(!clean(payer.address)||!clean(payer.vatRegistrationNumber)))throw badRequest('Complete the Developer registered address and VAT registration number in Company invoice details before printing',409);
    let logo=null;
    try{logo=organization.logoStorageKey?{buffer:await readPrivate(organization.logoStorageKey),mediaType:organization.logoMediaType}:{buffer:await readFile(new URL('../public/brand/nysa/raster/nysa-horizontal-light@2x.png',import.meta.url)),mediaType:'image/png'};}catch{}
    const pdf=await makeCommissionInvoicePdf({invoice:{...item,currency:transactionContext.currency||'AED'},organization,transaction:transactionContext,payer,logo});
    await audit('CommissionReceivable',item.id,'invoice_document_viewed',req.broker.id,{invoiceReference:item.invoiceReference});
    res.setHeader('Content-Type','application/pdf');
    res.setHeader('Content-Disposition',`inline; filename="${item.invoiceReference}.pdf"`);
    res.setHeader('Cache-Control','private, no-store');
    res.end(pdf);
  });
  r.get('/finance/receivables-adjustments',async(req,res)=>{
    authority(req);
    const rows=await many(`SELECT a.*,i.invoice_reference,i.commission_cents,i.due_date::text AS invoice_due_date,
      s.payer_name,o.opportunity_reference,requester.name AS requested_by_name,decider.name AS decided_by_name
      FROM commission_receivable_adjustment_requests a JOIN commission_receivable_invoices i ON i.id=a.invoice_id
      JOIN commission_receivable_schedules s ON s.id=i.schedule_id JOIN opportunities o ON o.id=s.opportunity_id
      JOIN brokers requester ON requester.id=a.requested_by LEFT JOIN brokers decider ON decider.id=a.decided_by
      WHERE ($1::boolean OR a.requested_by=$2) ORDER BY (a.status='pending') DESC,a.requested_at DESC LIMIT 100`,[req.broker.jobRole==='director',req.broker.id]);
    res.json({requests:rows});
  });
  r.post('/finance/receivables/schedules',async(req,res)=>mutate(req,res,'create_schedule',async(client,body)=>{
    const input=scheduleInput(body);
    await lockOpportunityFinance(requireId(input.opportunityId),client);
    const opportunity=await one(`SELECT o.id,o.opportunity_reference,o.buyer_commission_percent,o.buyer_commission_minimum,
      o.seller_commission_percent,o.seller_commission_minimum,o.referral_fee,d.id AS deal_id,d.listing_id,d.deal_type,d.agreed_value,d.currency,
      e.expected_company_receipt,e.referral_amount,e.referral_settlement_basis,
      COALESCE((SELECT SUM(i.commission_cents) FROM commission_receivable_schedules s
        JOIN commission_receivable_invoices i ON i.schedule_id=s.id
        WHERE s.opportunity_id=o.id AND i.state<>'cancelled'),0) AS scheduled_commission_cents
      FROM opportunities o JOIN LATERAL (SELECT id,listing_id,deal_type,agreed_value,currency FROM deals
        WHERE opportunity_id=o.id AND status='closed_won' ORDER BY closed_at DESC,id DESC LIMIT 1) d ON TRUE
      LEFT JOIN LATERAL (SELECT expected_company_receipt,referral_amount,referral_settlement_basis
        FROM deal_commission_expectation_versions WHERE deal_id=d.id AND status='frozen' ORDER BY version_number DESC,id DESC LIMIT 1) e ON TRUE
      WHERE o.id=$1 AND o.stage='Closed Won'`,[input.opportunityId],client);
    if(!opportunity)throw badRequest('Select a commission receivable from a Closed Won Opportunity',409);
    let expected=opportunity.expectedCompanyReceipt;
    if(expected==null)try{expected=calculateExpectedCommission({...opportunity,referralSettlementBasis:opportunity.referralSettlementBasis||'none'}).expectedCompanyReceipt;}catch{throw badRequest('Commission terms must be complete before invoicing',409);}
    const outstandingCommissionCents=Math.max(0,Math.round(Number(expected)*100)-Number(opportunity.scheduledCommissionCents));
    if(!outstandingCommissionCents)throw badRequest('This Closed Opportunity has no commission remaining to invoice',409);
    if(input.commissionCents>outstandingCommissionCents)throw badRequest(`Commission available for invoicing is AED ${(outstandingCommissionCents/100).toFixed(2)}`,409);
    const payer=input.payerType==='customer'?await one('SELECT id,full_name AS name FROM contacts WHERE id=$1 AND archived_at IS NULL',[requireId(input.payerId)],client):
      await one('SELECT id,name FROM companies WHERE id=$1 AND company_type=$2 AND archived_at IS NULL',[requireId(input.payerId),input.payerType],client);
    if(!payer)throw badRequest('Select an active maintained payer of the chosen type');
    if(opportunity.dealType==='off_plan'){
      if(input.payerType!=='developer')throw badRequest('An off-plan commission invoice must be raised to the maintained Developer',409);
      const developer=await one(`SELECT company_id,name FROM (
        SELECT dp.company_id,c.name,1 AS priority FROM deal_parties dp JOIN companies c ON c.id=dp.company_id
          WHERE dp.deal_id=$1 AND dp.party_role='developer' AND dp.effective_to IS NULL AND c.archived_at IS NULL
        UNION ALL
        SELECT pov.company_id,c.name,2 AS priority FROM LATERAL (
          SELECT e.partner_version_id,e.action FROM inventory_organization_link_events e
          WHERE e.listing_id=$2 AND e.relationship='developer' ORDER BY e.performed_at DESC,e.id DESC LIMIT 1
        ) latest JOIN partner_organization_versions pov ON pov.id=latest.partner_version_id AND latest.action<>'unlinked'
          JOIN companies c ON c.id=pov.company_id AND c.archived_at IS NULL
      ) governed ORDER BY priority LIMIT 1`,[opportunity.dealId,opportunity.listingId],client);
      if(!developer)throw badRequest('Link the maintained Developer to this off-plan Deal or Inventory before invoicing',409);
      if(payer.id!==developer.companyId)throw badRequest(`This off-plan invoice must be raised to ${developer.name}`,409);
    }
    const id=uuid(),reference=`AR-${id}`;
    await execute(`INSERT INTO commission_receivable_schedules(id,schedule_reference,opportunity_id,payer_type,payer_contact_id,payer_company_id,payer_name,commission_cents,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,reference,opportunity.id,input.payerType,input.payerType==='customer'?payer.id:null,input.payerType==='customer'?null:payer.id,payer.name,input.commissionCents,req.broker.id],client);
    const invoices=[];
    for(const row of input.instalments){
      const invoiceId=uuid();
      await execute(`INSERT INTO commission_receivable_invoices(id,schedule_id,instalment_number,milestone,commission_cents,vat_cents,total_cents,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[invoiceId,id,row.number,row.milestone,row.commissionCents,row.vatCents,row.totalCents,row.dueDate],client);
      const planned=await invoice(invoiceId,client);
      invoices.push(body.issueInvoices===true?await issueInvoice(planned,req.broker.id,client,'invoice_generated_with_schedule'):planned);
    }
    if(body.issueInvoices===true)await execute("UPDATE deal_commission_receipt_confirmations SET status='superseded' WHERE id IN (SELECT id FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1 AND status='confirmed' AND expectation_basis='issued_invoices')",[opportunity.id],client);
    await audit('CommissionReceivable',id,'schedule_created',req.broker.id,{opportunityId:opportunity.id,payerType:input.payerType,payerId:payer.id,commissionCents:input.commissionCents,instalments:invoices.length,vatRate:5},client);
    return{scheduleId:id,scheduleReference:reference,invoices};
  }));
  r.post('/finance/receivables/:id/issue',async(req,res)=>mutate(req,res,'issue',async(client,body)=>{
    const item=await lockInvoice(req,client);
    await lockOpportunityFinance(item.opportunityId,client);
    if(item.state!=='planned')throw badRequest('Only a scheduled instalment can be invoiced',409);
    const issued=await issueInvoice(item,req.broker.id,client);
    await execute("UPDATE deal_commission_receipt_confirmations SET status='superseded' WHERE id IN (SELECT id FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1 AND status='confirmed' AND expectation_basis='issued_invoices')",[item.opportunityId],client);
    return{invoice:issued};
  }));
  r.post('/finance/receivables/:id/adjustment-requests',async(req,res)=>mutate(req,res,'request_adjustment',async(client,body)=>{
    accountant(req);const item=await lockInvoice(req,client);
    if(item.state!=='issued'||item.collectedCents>0)throw badRequest('Only an issued invoice with no recorded payment can be submitted for cancellation or amendment',409);
    if(await one("SELECT id FROM commission_receivable_adjustment_requests WHERE invoice_id=$1 AND status='pending'",[item.id],client))throw badRequest('This invoice already has a cancellation or amendment request awaiting MD approval',409);
    const type=clean(body.requestType);if(!['cancel','amend'].includes(type))throw badRequest('Select cancellation or amendment');
    const reason=text(body.reason,'Request reason',10,1000),evidence=text(body.evidenceReference,'Evidence reference',3,200);
    let commissionCents=null,dueDate=null;if(type==='amend'){
      commissionCents=moneyCents(body.commissionAmount,'Amended commission amount');dueDate=dateOnly(body.dueDate,'Amended due date');
      if(dueDate<dubaiToday())throw badRequest('The replacement invoice due date cannot be earlier than its generation date');
    }
    const id=uuid();await execute(`INSERT INTO commission_receivable_adjustment_requests(id,invoice_id,request_type,reason,evidence_reference,requested_commission_cents,requested_due_date,requested_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id,item.id,type,reason,evidence,commissionCents,dueDate,req.broker.id],client);
    await audit('CommissionInvoiceAdjustment',id,'requested',req.broker.id,{invoiceId:item.id,type,commissionCents,dueDate,evidenceReference:evidence},client);
    return{request:await one('SELECT * FROM commission_receivable_adjustment_requests WHERE id=$1',[id],client)};
  }));
  r.post('/finance/receivables-adjustments/:id/decision',async(req,res)=>mutate(req,res,'decide_adjustment',async(client,body)=>{
    director(req);const id=requireId(req.params.id),decision=clean(body.decision),decisionReason=text(body.decisionReason,'Decision reason',5,1000);
    if(!['approve','reject'].includes(decision))throw badRequest('Select approve or reject');
    const request=await one('SELECT * FROM commission_receivable_adjustment_requests WHERE id=$1 FOR UPDATE',[id],client);
    if(!request||request.status!=='pending')throw badRequest('Pending invoice adjustment request not found',409);
    const row=await one(`${invoiceSelect} WHERE i.id=$1 FOR UPDATE OF i`,[request.invoiceId],client);
    if(!row)throw badRequest('Invoice for this adjustment request was not found',404);
    const item=invoiceState(row);
    if(item.state!=='issued'||item.collectedCents>0)throw badRequest('Invoice changed after request; review payment history before deciding',409);
    let replacementInvoiceId=null;
    if(decision==='approve'){
      if(request.requestType==='amend'){
        replacementInvoiceId=uuid();const vat=Math.floor((Number(request.requestedCommissionCents)*5+50)/100),next=await one('SELECT COALESCE(MAX(instalment_number),0)+1 AS number FROM commission_receivable_invoices WHERE schedule_id=$1',[item.scheduleId],client);
        await execute(`INSERT INTO commission_receivable_invoices(id,schedule_id,instalment_number,milestone,commission_cents,vat_cents,total_cents,due_date,replaces_invoice_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[replacementInvoiceId,item.scheduleId,next.number,`Approved amendment of ${item.invoiceReference}`,request.requestedCommissionCents,vat,Number(request.requestedCommissionCents)+vat,request.requestedDueDate,item.id],client);
      }
      await execute("UPDATE commission_receivable_invoices SET state='cancelled',cancellation_reason=$2,superseded_by_invoice_id=$3,version=version+1 WHERE id=$1",[item.id,`${request.requestType==='cancel'?'Cancelled':'Superseded'} by approved request ${id}: ${request.reason}`,replacementInvoiceId],client);
    }
    const status=decision==='approve'?'approved':'rejected';await execute('UPDATE commission_receivable_adjustment_requests SET status=$2,decided_by=$3,decided_at=NOW(),decision_reason=$4,replacement_invoice_id=$5 WHERE id=$1',[id,status,req.broker.id,decisionReason,replacementInvoiceId],client);
    await audit('CommissionInvoiceAdjustment',id,status,req.broker.id,{invoiceId:item.id,replacementInvoiceId,decisionReason},client);
    return{request:await one('SELECT * FROM commission_receivable_adjustment_requests WHERE id=$1',[id],client),replacementInvoiceId};
  }));
  r.post('/finance/receivables/:id/collections',async(req,res)=>mutate(req,res,'collect',async(client,body)=>{
    const item=await lockInvoice(req,client);
    if(item.state!=='issued')throw badRequest('Record the invoice before recording collection',409);
    const cents=moneyCents(body.amount,'Amount collected (including VAT)'),receivedDate=dateOnly(body.receivedDate,'Receipt date');
    if(cents<=0||cents>item.balanceCents)throw badRequest('Collection must be positive and cannot exceed the outstanding invoice balance',409);
    const today=dubaiToday();
    if(receivedDate>today)throw badRequest(`Payment not recorded. Payment realization date cannot be in the future. Enter the date the cheque cleared or the cash/bank payment was received, on or before ${today}.`);
    if(receivedDate<item.invoiceDate)throw badRequest(`Payment not recorded. Payment realization date cannot be earlier than the invoice date (${item.invoiceDate}).`);
    const financeReference=text(body.financeReference,'Incoming payment reference');
    const evidenceReference=body.proofId?clean(body.evidenceReference):text(body.evidenceReference,'Payment evidence reference');
    const posting=await postInvoicePayment(item,body,req.broker,cents,receivedDate,financeReference,evidenceReference,client);
    await audit('CommissionReceivable',item.id,'collection_recorded',req.broker.id,{...posting,amountCents:cents,receivedDate,financeReference},client);
    return{...posting,invoice:await invoice(item.id,client)};
  }));
  r.post('/finance/receivables/:id/reverse',async(req,res)=>mutate(req,res,'reverse',async(client,body)=>{
    const item=await lockInvoice(req,client),collectionId=requireId(body.collectionId),reason=text(body.reason,'Correction reason',10,1000);
    const entry=await one('SELECT * FROM commission_receivable_collections WHERE id=$1 AND invoice_id=$2',[collectionId,item.id],client);
    if(!entry)throw badRequest('Collection does not belong to this invoice');
    if(await one('SELECT id FROM commission_receivable_reversals WHERE collection_id=$1',[collectionId],client))throw badRequest('Collection already reversed',409);
    const posting=await reverseInvoicePayment(entry,item,reason,req.broker,client);
    await audit('CommissionReceivable',item.id,'collection_reversed',req.broker.id,{collectionId,reason,...posting},client);
    return{...posting,invoice:await invoice(item.id,client)};
  }));
  r.post('/finance/receivables/:id/cancel',async(req,res)=>mutate(req,res,'cancel',async(client,body)=>{
    const item=await lockInvoice(req,client),reason=text(body.reason,'Cancellation reason',10,1000);
    await lockOpportunityFinance(item.opportunityId,client);
    if(item.state!=='planned')throw badRequest('Only an unissued invoice instalment can be cancelled directly. Issued invoices require an Accountant request and MD approval.',409);
    await execute("UPDATE commission_receivable_invoices SET state='cancelled',cancellation_reason=$2,version=version+1 WHERE id=$1",[item.id,reason],client);
    await execute("UPDATE deal_commission_receipt_confirmations SET status='superseded' WHERE id IN (SELECT id FROM opportunity_commission_confirmations WHERE finance_opportunity_id=$1 AND status='confirmed' AND expectation_basis='issued_invoices')",[item.opportunityId],client);
    await audit('CommissionReceivable',item.id,'invoice_cancelled',req.broker.id,{reason},client);
    return{invoice:await invoice(item.id,client)};
  }));
}
