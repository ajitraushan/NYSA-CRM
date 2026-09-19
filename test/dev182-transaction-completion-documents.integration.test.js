import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DEV182_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Requires the restricted local synthetic PostgreSQL fixture'};
const id=()=>crypto.randomUUID();

test('transaction completion document blocks Close Won until uploaded without any seller master record',gate,async()=>{
  assert.ok(['localhost','127.0.0.1','::1'].includes(process.env.PGHOST));
  const guard=await import('../tools/local-postgres-fixture/fixture-guard.mjs'),pool=guard.createFixturePool();
  await guard.assertDedicatedFixture(pool);
  const client=await pool.connect(),prefix=`DEV182-${Date.now()}`;
  try{
    await client.query('BEGIN');
    const broker=id(),contact=id(),lead=id(),leadRequirement=id(),opportunity=id(),deal=id(),checklist=id(),requirement=id(),version=id(),snapshot=id(),instance=id(),document=id(),documentVersion=id(),evidence=id();
    await client.query("INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,$2,$3,'admin','active','synthetic-only','admin')",[broker,prefix,`${prefix}@example.invalid`]);
    await client.query("INSERT INTO contacts(id,full_name,email,contact_type,owner_id,created_by) VALUES($1,$2,$3,'buyer',$4,$4)",[contact,prefix,`${prefix}@example.invalid`,broker]);
    await client.query("INSERT INTO leads(id,contact_id,title,source,business_type,stage,temperature,assigned_to,created_by) VALUES($1,$2,$3,'Website','Sale','Qualified','Warm',$4,$4)",[lead,contact,prefix,broker]);
    await client.query("INSERT INTO lead_requirements(id,lead_id,version_no,business_line,purpose,funding_method,timeline_code,created_by) VALUES($1,$2,1,'Sale','own_use','cash','0_3_months',$3)",[leadRequirement,lead,broker]);
    await client.query("INSERT INTO opportunities(id,opportunity_reference,lead_id,contact_id,requirement_id,owner_id,title,transaction_type,stage,next_action,next_action_due_at,next_action_code,created_by) VALUES($1,$2,$3,$4,$5,$6,$2,'Sale','Deal','Synthetic completion test',NOW(),'send_property_details',$6)",[opportunity,prefix,lead,contact,leadRequirement,broker]);
    await client.query("INSERT INTO deals(id,deal_reference,opportunity_id,deal_type,agreed_value,currency,target_completion_at,owner_id,created_by) VALUES($1,$2,$3,'sale',1000000,'AED',NOW(),$4,$4)",[deal,`${prefix}-DEAL`,opportunity,broker]);
    await client.query("INSERT INTO deal_checklists(id,deal_id,template_id,template_version_no) SELECT $1,$2,id,version_no FROM checklist_templates WHERE deal_type='sale' AND status='approved' ORDER BY version_no DESC LIMIT 1",[checklist,deal]);
    await client.query('INSERT INTO document_compliance_requirements(id,requirement_code,created_by) VALUES($1,$2,$3)',[requirement,`sale_deed_${String(Date.now())}`,broker]);
    await client.query(`INSERT INTO document_compliance_requirement_versions(id,requirement_id,version_number,label,business_reason,transaction_family,party_role,party_kind,gate_code,requirement_level,evidence_authority,document_type,review_required,expiry_mode,reminder_offsets_days,status,effective_from,created_by,activated_by,activated_at)
      VALUES($1,$2,1,'Sale Deed','Required government transaction completion record','sale','transaction','transaction','before_close_won','required','generic_document','transaction_completion_document',FALSE,'not_tracked',ARRAY[0,7],'active',NOW()-INTERVAL '1 minute',$3,$3,NOW())`,[version,requirement,broker]);

    const {checkDocumentComplianceGate}=await import('../src/document-compliance-gate.js');
    let result=await checkDocumentComplianceGate({dealId:deal,gateCode:'before_close_won',client});
    assert.equal(result.canProceed,false);assert.match(result.blocking.map(x=>x.label).join(' '),/Resolve the current document compliance checklist/);

    const {complianceFingerprint,DOCUMENT_COMPLIANCE_RESOLVER_VERSION}=await import('../src/document-compliance-domain.js');
    const partyContextHash=complianceFingerprint({dealId:deal,dealType:'sale',parties:[]}),requestFingerprint=complianceFingerprint({dealChecklistId:checklist,partyContextHash,resolverVersion:DOCUMENT_COMPLIANCE_RESOLVER_VERSION,requirementVersions:[version]});
    await client.query("INSERT INTO deal_document_compliance_snapshots(id,deal_checklist_id,deal_id,deal_version,deal_type,transaction_family,party_context_hash,resolver_version,status,created_by,request_fingerprint) VALUES($1,$2,$3,1,'sale','sale',$4,$5,'active',$6,$7)",[snapshot,checklist,deal,partyContextHash,DOCUMENT_COMPLIANCE_RESOLVER_VERSION,broker,requestFingerprint]);
    const instanceFingerprint=complianceFingerprint({dealId:deal,dealChecklistId:checklist,dealPartyId:null,requirementId:requirement,requirementVersionId:version,partyRole:'transaction',partyKind:'transaction',gateCode:'before_close_won',requirementLevel:'required',evidenceAuthority:'generic_document',label:'Sale Deed',responsibleAgentId:broker});
    await client.query("INSERT INTO deal_document_requirement_instances(id,snapshot_id,deal_checklist_id,deal_id,deal_party_id,requirement_id,requirement_version_id,party_role,party_kind,gate_code,requirement_level,evidence_authority,label,responsible_agent_id,instance_fingerprint,created_by) VALUES($1,$2,$3,$4,NULL,$5,$6,'transaction','transaction','before_close_won','required','generic_document','Sale Deed',$7,$8,$7)",[instance,snapshot,checklist,deal,requirement,version,broker,instanceFingerprint]);
    result=await checkDocumentComplianceGate({dealId:deal,gateCode:'before_close_won',client});
    assert.equal(result.canProceed,false);assert.deepEqual(result.blocking.map(x=>x.label),['Sale Deed']);

    await client.query("INSERT INTO documents(id,document_reference,document_type,title,direction,access_classification,status,owner_id,created_by,contact_id,lead_id) VALUES($1,$2,'transaction_completion_document','Sale Deed','Inbound','restricted','active',$3,$3,NULL,$4)",[document,`${prefix}-DOC`,broker,lead]);
    await client.query("INSERT INTO document_versions(id,document_id,version_number,file_name,media_type,file_size_bytes,storage_key,file_hash,immutable,source,classification,status,owner_id,created_by,received_at) VALUES($1,$2,1,'sale-deed.pdf','application/pdf',4,$3,$4,1,'upload','restricted','received',$5,$5,NOW())",[documentVersion,document,`${prefix}-private`,crypto.createHash('sha256').update('test').digest('hex'),broker]);
    await client.query("INSERT INTO document_compliance_evidence_versions(id,evidence_reference,requirement_instance_id,document_version_id,issued_at,uploaded_by,idempotency_key,request_fingerprint) VALUES($1,$2,$3,$4,NOW(),$5,$6,$7)",[evidence,`${prefix}-EVIDENCE`,instance,documentVersion,broker,`${prefix}-request`,crypto.createHash('sha256').update(prefix).digest('hex')]);
    result=await checkDocumentComplianceGate({dealId:deal,gateCode:'before_close_won',client});
    assert.equal(result.canProceed,true,JSON.stringify(result));
  }finally{
    await client.query('ROLLBACK');client.release();await pool.end();
  }
});
