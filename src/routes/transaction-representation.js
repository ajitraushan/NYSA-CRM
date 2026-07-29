import { Router } from '../lib/http-kit.js';
import crypto from 'node:crypto';
import { one,many,execute,transaction,uuid,audit } from '../db.js';
import { requireAuth } from '../auth.js';
import { hasInternalCrmIdentity,isManager,canReadLead } from '../crm-policy.js';
import { validateCounterparty,validateExternalProperty,validateRepresentation } from '../transaction-representation-domain.js';

const r=Router();
r.use(requireAuth,(req,res,next)=>hasInternalCrmIdentity(req.broker)?next():res.status(403).json({error:'Transaction representation is restricted to NYSA staff'}));
const clean=value=>typeof value==='string'&&value.trim()?value.trim():null;

r.get('/crm/transaction-counterparties',async(req,res)=>{
  const counterparties=await many(`SELECT cp.*,c.lifecycle_status AS customer_lifecycle_status,co.name AS company_name
    FROM transaction_counterparties cp LEFT JOIN contacts c ON c.id=cp.contact_id
    LEFT JOIN companies co ON co.id=cp.company_id ORDER BY cp.display_name,cp.created_at`);
  res.json({counterparties});
});

r.post('/crm/transaction-counterparties',async(req,res)=>{
  const checked=validateCounterparty(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const v=checked.value,id=uuid(),row=await one(`INSERT INTO transaction_counterparties(
    id,display_name,party_type,role,contact_id,company_id,phone,email,represented_party,source,evidence_reference,created_by
  ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
  [id,v.displayName,v.partyType,v.role,v.contactId,v.companyId,v.phone,v.email,v.representedParty,v.source,v.evidenceReference,req.broker.id]);
  await audit('TransactionCounterparty',id,'created',req.broker.id,{partyType:v.partyType,role:v.role,source:v.source,customerCreated:false});
  res.status(201).json(row);
});

r.get('/crm/external-properties',async(req,res)=>{
  const properties=await many(`SELECT p.*,owner.display_name AS owner_name,agent.display_name AS seller_agent_name,
    agency.display_name AS seller_agency_name,creator.name AS created_by_name
    FROM provisional_external_properties p
    LEFT JOIN transaction_counterparties owner ON owner.id=p.owner_counterparty_id
    LEFT JOIN transaction_counterparties agent ON agent.id=p.seller_agent_counterparty_id
    LEFT JOIN transaction_counterparties agency ON agency.id=p.seller_agency_counterparty_id
    JOIN brokers creator ON creator.id=p.created_by ORDER BY p.created_at DESC`);
  res.json({properties});
});

r.post('/crm/external-properties',async(req,res)=>{
  const checked=validateExternalProperty(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const v=checked.value,period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code")).code;
  const sequence=(await one("SELECT COUNT(*)::int+1 AS value FROM provisional_external_properties WHERE external_reference LIKE $1",[`${`NYSA-EXT-${period}`}-%`])).value;
  const id=uuid(),reference=`NYSA-EXT-${period}-${String(sequence).padStart(6,'0')}`;
  const row=await one(`INSERT INTO provisional_external_properties(id,external_reference,project_or_building,property_address,
    asking_price,currency,property_type,permit_reference,source,source_evidence,owner_counterparty_id,
    seller_agent_counterparty_id,seller_agency_counterparty_id,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [id,reference,v.projectOrBuilding,v.propertyAddress,v.askingPrice,v.currency,v.propertyType,v.permitReference,v.source,v.sourceEvidence,v.ownerCounterpartyId,v.sellerAgentCounterpartyId,v.sellerAgencyCounterpartyId,req.broker.id]);
  await audit('ExternalProperty',id,'captured',req.broker.id,{reference,source:v.source,normalInventory:false,externalListing:false});
  res.status(201).json(row);
});

r.post('/crm/transaction-counterparties/:id/link-customer',async(req,res)=>{
  const customerId=clean(req.body?.customerId),reason=clean(req.body?.reason);
  if(!customerId||!reason)return res.status(400).json({error:'Select the existing Customer and record the reason for this explicit promotion'});
  const result=await transaction(async client=>{
    const counterparty=await one('SELECT * FROM transaction_counterparties WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!counterparty)return{code:404,error:'Transaction-only counterparty not found'};
    if(counterparty.promotedCustomerId)return{code:409,error:'This counterparty is already linked to a Customer'};
    const customer=await one("SELECT id,full_name FROM contacts WHERE id=$1 AND archived_at IS NULL",[customerId],client);
    if(!customer)return{code:400,error:'Selected Customer is unavailable'};
    const updated=await one(`UPDATE transaction_counterparties SET promoted_customer_id=$1,updated_at=NOW()
      WHERE id=$2 RETURNING *`,[customer.id,counterparty.id],client);
    await audit('TransactionCounterparty',counterparty.id,'linked_to_customer',req.broker.id,
      {customerId:customer.id,customerName:customer.fullName,reason,explicitPromotion:true},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/external-properties/:id/verification',async(req,res)=>{
  const action=req.body?.action,notes=clean(req.body?.notes);
  const row=await one('SELECT * FROM provisional_external_properties WHERE id=$1',[req.params.id]);if(!row)return res.status(404).json({error:'External property not found'});
  if(action==='submit'){
    if(row.status!=='captured'||!notes)return res.status(409).json({error:'A captured external property and verification evidence notes are required'});
    const updated=await one("UPDATE provisional_external_properties SET status='verification_pending',verification_notes=$1,updated_at=NOW() WHERE id=$2 RETURNING *",[notes,row.id]);
    await audit('ExternalProperty',row.id,'verification_submitted',req.broker.id,{notes});return res.json(updated);
  }
  if(!isManager(req.broker))return res.status(403).json({error:'Manager or Administrator decision required'});
  if(row.status!=='verification_pending'||!['approve','reject'].includes(action)||!notes)return res.status(409).json({error:'A pending external property, valid decision and reason are required'});
  const status=action==='approve'?'approved_for_opportunity':'rejected',updated=await one('UPDATE provisional_external_properties SET status=$1,verification_notes=$2,verified_by=$3,verified_at=NOW(),updated_at=NOW() WHERE id=$4 RETURNING *',[status,notes,req.broker.id,row.id]);
  await audit('ExternalProperty',row.id,action==='approve'?'approved_for_opportunity':'rejected',req.broker.id,{notes});res.json(updated);
});

r.post('/crm/external-properties/:id/link-inventory',async(req,res)=>{
  const listingId=clean(req.body?.listingId),reason=clean(req.body?.reason);
  if(!listingId||!reason)return res.status(400).json({error:'Select the Inventory record and record the reason for this explicit promotion'});
  const result=await transaction(async client=>{
    const external=await one('SELECT * FROM provisional_external_properties WHERE id=$1 FOR UPDATE',[req.params.id],client);
    if(!external)return{code:404,error:'External property not found'};
    if(external.promotedListingId)return{code:409,error:'This external property is already linked to Inventory'};
    const listing=await one('SELECT id,inventory_reference,project FROM listings WHERE id=$1 AND deleted_at IS NULL',[listingId],client);
    if(!listing)return{code:400,error:'Selected Inventory record is unavailable'};
    const updated=await one(`UPDATE provisional_external_properties SET promoted_listing_id=$1,updated_at=NOW()
      WHERE id=$2 RETURNING *`,[listing.id,external.id],client);
    await audit('ExternalProperty',external.id,'linked_to_inventory',req.broker.id,
      {listingId:listing.id,inventoryReference:listing.inventoryReference,project:listing.project,reason,explicitPromotion:true},client);
    return updated;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.json(result);
});

r.post('/crm/opportunity-origins',async(req,res)=>{
  return res.status(409).json({error:'Every Opportunity must be created by converting an assigned, qualified Lead. Open the Lead and select Create opportunity.'});
  /* Legacy standalone origin retained below temporarily for audit-compatible rollback only; it is unreachable. */
  const checked=validateRepresentation(req.body||{});if(checked.error)return res.status(400).json({error:checked.error});
  const v=checked.value,title=clean(req.body?.title),transactionType=req.body?.transactionType,nextAction=clean(req.body?.nextAction),due=new Date(req.body?.nextActionDueAt);
  if(!title||!['Sale','Rental','Off-plan','Commercial'].includes(transactionType)||!nextAction||Number.isNaN(due.valueOf()))return res.status(400).json({error:'Opportunity name, transaction, next action and due time are required'});
  const result=await transaction(async client=>{
    const lead=v.leadId?await one('SELECT * FROM leads WHERE id=$1 FOR UPDATE',[v.leadId],client):null;
    if(v.leadId&&(!lead||!canReadLead(req.broker,lead)))return {code:403,error:'Customer Lead is unavailable or outside scope'};
    if(lead&&!['Qualified','Viewing','Negotiation','Won'].includes(lead.stage))return {code:409,error:'Complete Lead qualification before creating this representation path'};
    const listing=v.listingId?await one("SELECT * FROM listings WHERE id=$1 AND deleted_at IS NULL AND workflow_status='approved'",[v.listingId],client):null;
    if(v.listingId&&!listing)return {code:409,error:'Select approved NYSA Inventory'};
    if(listing){
      const inventoryParty=await one(`SELECT * FROM inventory_counterparties WHERE listing_id=$1
        AND party_role = ANY($2::text[])
        ORDER BY CASE party_role WHEN 'seller' THEN 1 WHEN 'landlord' THEN 2 WHEN 'lessor' THEN 3 ELSE 4 END,created_at DESC LIMIT 1`,
        [listing.id,['Rental'].includes(transactionType)?['landlord','lessor']:['seller','landlord','lessor']],client);
      if(inventoryParty){
        const role=['landlord','lessor'].includes(inventoryParty.partyRole)?'landlord':'seller';
        const inherited=await one(`INSERT INTO transaction_counterparties
          (id,display_name,party_type,role,phone,email,represented_party,source,evidence_reference,created_by,inventory_counterparty_id)
          VALUES($1,$2,'inventory_owner',$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT(inventory_counterparty_id) DO UPDATE SET
            display_name=EXCLUDED.display_name,role=EXCLUDED.role,phone=EXCLUDED.phone,email=EXCLUDED.email,
            represented_party=EXCLUDED.represented_party,source=EXCLUDED.source,evidence_reference=EXCLUDED.evidence_reference,updated_at=NOW()
          RETURNING *`,[uuid(),inventoryParty.displayName,role,inventoryParty.phone,inventoryParty.email,inventoryParty.representedParty,
            inventoryParty.source,inventoryParty.authorityEvidence,req.broker.id,inventoryParty.id],client);
        v.sellerCounterpartyId=inherited.id;
      }
    }
    const external=v.externalPropertyId?await one("SELECT * FROM provisional_external_properties WHERE id=$1 AND status='approved_for_opportunity'",[v.externalPropertyId],client):null;
    if(v.externalPropertyId&&!external)return {code:409,error:'External/co-broker property must be verified and approved for this Opportunity'};
    const requirement=lead?await one('SELECT * FROM lead_requirements WHERE lead_id=$1 AND superseded_at IS NULL',[lead.id],client):null;
    const qualification=lead?await one('SELECT * FROM qualification_assessments WHERE lead_id=$1 ORDER BY assessed_at DESC LIMIT 1',[lead.id],client):null;
    const period=(await one("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Dubai','YYYYMM') AS code",[],client)).code;
    const counter=await one(`INSERT INTO opportunity_number_counters(period_code,last_value) VALUES($1,1)
      ON CONFLICT(period_code) DO UPDATE SET last_value=opportunity_number_counters.last_value+1,updated_at=NOW() RETURNING last_value`,[period],client);
    const reference=`NYSA-OP-${period}-${String(counter.lastValue).padStart(6,'0')}`,id=uuid(),ownerId=v.buyerSideAgentId||v.inventorySideAgentId||lead?.assignedTo||req.broker.id,teamId=lead?.assignedTeamId||req.broker.teamId||null;
    const opportunity=await one(`INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,qualification_assessment_id,
      listing_id,assigned_team_id,owner_id,title,transaction_type,priority,next_action,next_action_due_at,created_by,
      representation_path,property_source,buyer_source,external_property_id,buyer_side_agent_id,inventory_side_agent_id,
      buyer_counterparty_id,seller_counterparty_id,buyer_agency_counterparty_id,seller_agency_counterparty_id,
      buyer_side_commission,seller_side_commission,interagency_split,internal_agent_split,referral_fee,authority_evidence,
      disclosure_evidence,representation_locked_at,stage)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'normal',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,NOW(),$32) RETURNING *`,
      [id,reference,lead?.id||null,lead?.contactId||null,requirement?.id||null,qualification?.id||null,listing?.id||null,teamId,ownerId,title,transactionType,nextAction,due.toISOString(),req.broker.id,v.representationPath,v.propertySource,v.buyerSource,external?.id||null,v.buyerSideAgentId,v.inventorySideAgentId,v.buyerCounterpartyId,v.sellerCounterpartyId,v.buyerAgencyCounterpartyId,v.sellerAgencyCounterpartyId,v.buyerSideCommission,v.sellerSideCommission,v.interagencySplit,v.internalAgentSplit,v.referralFee,v.authorityEvidence,v.disclosureEvidence,listing?'Matching':'Requirements'],client);
    const snapshot={...v,leadId:lead?.id||null,listingId:listing?.id||null,externalPropertyId:external?.id||null};
    if(listing||external){
      const matchId=uuid();
      await execute(`INSERT INTO property_matches(id,opportunity_id,requirement_id,listing_id,external_property_id,
        match_source,fit_status,rationale,exceptions,created_by,updated_by)
        VALUES($1,$2,$3,$4,$5,'manual','strong_fit',$6,$7,$8,$8)`,
      [matchId,id,requirement?.id||null,listing?.id||null,external?.id||null,
        external?'Approved provisional external/co-broker property selected at Opportunity origin':'Approved NYSA Inventory selected at Opportunity origin',
        external?'Use is limited to this governed Opportunity; it is not NYSA Inventory or an external Listing':null,req.broker.id],client);
      await execute(`INSERT INTO property_match_history(id,property_match_id,to_status,reason,changed_by)
        VALUES($1,$2,'considering',$3,$4)`,[uuid(),matchId,'Property carried from the governed representation origin',req.broker.id],client);
    }
    await execute(`INSERT INTO opportunity_representation_history(id,opportunity_id,representation_path,property_source,buyer_source,snapshot,reason,changed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[uuid(),id,v.representationPath,v.propertySource,v.buyerSource,JSON.stringify(snapshot),'Opportunity representation selected at creation',req.broker.id],client);
    await execute(`INSERT INTO opportunity_stage_history(id,opportunity_id,to_stage,reason_code,reason,changed_by)
      VALUES($1,$2,$3,'representation_origin_created',$4,$5)`,[uuid(),id,listing?'Matching':'Requirements',`Created as ${v.representationPath} representation`,req.broker.id],client);
    await execute(`INSERT INTO opportunity_participants(id,opportunity_id,broker_id,participation_role,added_by) VALUES($1,$2,$3,'owner',$4)`,[uuid(),id,ownerId,req.broker.id],client);
    await execute(`INSERT INTO opportunity_attribution(id,opportunity_id,originating_lead_id,source,originating_listing_id,attribution_basis,provenance_snapshot,provenance_hash)
      VALUES($1,$2,$3,$4,$5,'representation_origin',$6,$7)`,[uuid(),id,lead?.id||null,lead?.source||v.propertySource,listing?.id||null,JSON.stringify(snapshot),cryptoHash(snapshot)],client);
    await audit('Opportunity',id,'representation_origin_created',req.broker.id,{reference,...snapshot},client);
    return opportunity;
  });
  if(result.error)return res.status(result.code).json({error:result.error});res.status(201).json(result);
});

function cryptoHash(value){
  const stable=JSON.stringify(value,Object.keys(value).sort());
  return crypto.createHash('sha256').update(stable).digest('hex');
}

export default r;
