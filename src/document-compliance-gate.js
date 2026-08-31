import {many,one} from './db.js';
import {complianceFingerprint,transactionFamily} from './document-compliance-domain.js';

export async function checkDocumentComplianceGate({dealId,gateCode,client}){
  const deal=await one(`SELECT d.id,d.version,d.deal_type,dc.id AS checklist_id FROM deals d JOIN deal_checklists dc ON dc.deal_id=d.id WHERE d.id=$1`,[dealId],client);
  if(!deal)return{canProceed:false,blocking:[{label:'Deal not found',state:'missing'}]};
  const family=transactionFamily(deal.dealType);if(!family)return{canProceed:false,blocking:[{label:'Unsupported Deal type',state:'context_mismatch'}]};
  const applicable=await many(`SELECT DISTINCT v.id,v.label,v.requirement_level,dp.id AS deal_party_id,dp.party_role,
      CASE WHEN dp.contact_id IS NOT NULL THEN 'individual' WHEN dp.company_id IS NOT NULL THEN 'organization' ELSE 'unpromoted' END AS party_kind
    FROM deal_parties dp JOIN document_compliance_requirement_versions v ON v.transaction_family=$2 AND v.party_role=dp.party_role
      AND v.gate_code=$3 AND v.status='active' AND v.effective_from<=NOW()
      AND (dp.transaction_counterparty_id IS NOT NULL OR v.party_kind=CASE WHEN dp.contact_id IS NOT NULL THEN 'individual' ELSE 'organization' END)
    WHERE dp.deal_id=$1 AND dp.effective_to IS NULL`,[deal.id,family,gateCode],client);
  const required=applicable.filter(x=>x.requirementLevel==='required');if(!required.length)return{canProceed:true,blocking:[]};
  const unsupported=required.filter(x=>x.partyKind==='unpromoted').map(x=>({label:`Governed ${x.partyRole} required`,state:'governed_party_required',partyRole:x.partyRole}));
  const snapshot=await one("SELECT * FROM deal_document_compliance_snapshots WHERE deal_checklist_id=$1 AND status='active'",[deal.checklistId],client);
  if(!snapshot)return{canProceed:false,blocking:[...unsupported,{label:'Resolve the current document compliance checklist',state:'missing'}]};
  const parties=await many(`SELECT id,party_role,contact_id,company_id,effective_from FROM deal_parties WHERE deal_id=$1 AND effective_to IS NULL AND party_role IN('buyer','seller','landlord','tenant') AND (contact_id IS NOT NULL OR company_id IS NOT NULL) ORDER BY id`,[deal.id],client),partyContextHash=complianceFingerprint({dealId:deal.id,dealType:deal.dealType,parties:parties.map(x=>({id:x.id,partyRole:x.partyRole,contactId:x.contactId||null,companyId:x.companyId||null,effectiveFrom:x.effectiveFrom?new Date(x.effectiveFrom).toISOString():null}))});
  if(snapshot.partyContextHash!==partyContextHash)return{canProceed:false,blocking:[...unsupported,{label:'Deal party context changed; resolve compliance again',state:'context_mismatch'}]};
  const rows=await many(`SELECT i.id,i.label,i.party_role,i.evidence_authority,rv.review_required,
      ge.id AS generic_evidence_id,ge.expires_at,gr.decision AS generic_decision,
      oe.id AS official_evidence_id,oe.expires_at AS official_expires_at,orr.decision AS official_decision
    FROM deal_document_requirement_instances i JOIN document_compliance_requirement_versions rv ON rv.id=i.requirement_version_id
    LEFT JOIN LATERAL(SELECT e.* FROM document_compliance_evidence_versions e WHERE e.requirement_instance_id=i.id ORDER BY e.uploaded_at DESC LIMIT 1) ge ON TRUE
    LEFT JOIN document_compliance_evidence_review_events gr ON gr.evidence_id=ge.id
    LEFT JOIN LATERAL(SELECT l.official_evidence_id FROM document_compliance_official_evidence_links l WHERE l.requirement_instance_id=i.id ORDER BY l.created_at DESC LIMIT 1) ol ON TRUE
    LEFT JOIN official_document_evidence_versions oe ON oe.id=ol.official_evidence_id
    LEFT JOIN official_document_evidence_review_events orr ON orr.evidence_id=oe.id
    WHERE i.snapshot_id=$1 AND i.gate_code=$2 AND i.requirement_level='required'`,[snapshot.id,gateCode],client);
  const blocking=[...unsupported];
  for(const row of rows){
    if(row.evidenceAuthority==='generic_document'){
      if(!row.genericEvidenceId)blocking.push({instanceId:row.id,label:row.label,state:'missing',partyRole:row.partyRole});
      else if(row.reviewRequired&&row.genericDecision!=='accepted')blocking.push({instanceId:row.id,label:row.label,state:row.genericDecision||'pending_review',partyRole:row.partyRole});
      else if(row.expiresAt&&Date.parse(row.expiresAt)<=Date.now())blocking.push({instanceId:row.id,label:row.label,state:'expired',partyRole:row.partyRole});
    }else if(!row.officialEvidenceId)blocking.push({instanceId:row.id,label:row.label,state:'missing',partyRole:row.partyRole});
    else if(row.officialDecision!=='verified')blocking.push({instanceId:row.id,label:row.label,state:row.officialDecision||'pending_review',partyRole:row.partyRole});
    else if(row.officialExpiresAt&&Date.parse(row.officialExpiresAt)<=Date.now())blocking.push({instanceId:row.id,label:row.label,state:'expired',partyRole:row.partyRole});
  }
  if(rows.length<required.filter(x=>x.partyKind!=='unpromoted').length)blocking.push({label:'Current requirement snapshot is incomplete',state:'context_mismatch'});
  return{canProceed:blocking.length===0,blocking};
}

export async function requireDocumentComplianceGates({dealId,gateCodes,client}){
  const blocking=[];for(const gateCode of gateCodes){const result=await checkDocumentComplianceGate({dealId,gateCode,client});blocking.push(...result.blocking.map(x=>({...x,gateCode})));}
  return{canProceed:blocking.length===0,blocking};
}
