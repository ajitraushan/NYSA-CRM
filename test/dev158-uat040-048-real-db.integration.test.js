import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const enabled=process.env.NYSA_RUN_DB_INTEGRATION==='1';
const gate={skip:enabled?false:'Set NYSA_RUN_DB_INTEGRATION=1 inside the disposable PostgreSQL fixture',timeout:15000};
const id=()=>crypto.randomUUID();
const emit=(event,data)=>process.stdout.write(`${JSON.stringify({event,...data})}\n`);
let database,server,request,fixture;

before(async()=>{
  if(!enabled)return;
  assert.equal(process.env.NYSA_FIXTURE_SCHEMA,'1','Refusing to run outside the disposable fixture schema');
  assert.match(process.env.PGDATABASE||'',/test|fixture|ci/i);
  const [{createApp},{default:listingsRoutes},{default:partnerRoutes},{default:dldRoutes},dbModule]=await Promise.all([
    import('../src/lib/http-kit.js'),import('../src/routes/listings.js'),import('../src/routes/partner-organizations.js'),import('../src/routes/dld-market-intelligence.js'),import('../src/db.js')
  ]);
  database=dbModule;const {execute}=database,token=crypto.randomBytes(32).toString('hex'),sessionHash=crypto.createHash('sha256').update(token).digest('hex'),prefix=`dev158-${Date.now()}`;
  fixture={broker:id(),team:id(),company:id(),listing:id(),area:id(),community:id(),communityVersion:id(),prefix};
  await execute(`INSERT INTO brokers(id,name,email,role,status,password_hash,job_role) VALUES($1,$2,$3,'internal_broker','active','integration-only','manager')`,[fixture.broker,`${prefix} manager`,`${prefix}@example.invalid`]);
  await execute('INSERT INTO teams(id,name,manager_id,active) VALUES($1,$2,$3,1)',[fixture.team,`${prefix} team`,fixture.broker]);
  await execute('UPDATE brokers SET team_id=$1 WHERE id=$2',[fixture.team,fixture.broker]);
  await execute(`INSERT INTO companies(id,name,company_type,owner_id,created_by) VALUES($1,$2,'developer',$3,$3)`,[fixture.company,`${prefix} Developer PLC`,fixture.broker]);
  await execute(`INSERT INTO areas(id,stable_code,business_label,emirate,created_by) VALUES($1,$2,$3,'Dubai',$4)`,[fixture.area,`dev158_${Date.now()}`,`${prefix} Area`,fixture.broker]);
  await execute('INSERT INTO market_communities(id,stable_code,area_id,created_by) VALUES($1,$2,$3,$4)',[fixture.community,`dev158_community_${Date.now()}`,fixture.area,fixture.broker]);
  await execute(`INSERT INTO market_community_versions(id,community_id,area_id,version_number,business_label,normalized_label,status,created_by,approved_by,approved_at)
    VALUES($1,$2,$3,1,$4,$5,'active',$6,$6,NOW())`,[fixture.communityVersion,fixture.community,fixture.area,`${prefix} Community`,`${prefix} community`.toLowerCase(),fixture.broker]);
  await execute(`INSERT INTO listings(id,inventory_headline,project,area,property_type,size_sqft,price,currency,status,posted_by,responsible_agent_id,originating_agent_id,workflow_status,verification_status,transaction_types)
    VALUES($1,$2,$3,'Dubai','Apartment',800,1000000,'AED','Available',$4,$4,$4,'approved','verified',ARRAY['Sale'])`,[fixture.listing,`${prefix} Inventory`,`${prefix} Project`,fixture.broker]);
  await execute('UPDATE listings SET area_id=$1 WHERE id=$2',[fixture.area,fixture.listing]);
  await execute("INSERT INTO sessions(token,broker_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '1 hour')",[sessionHash,fixture.broker]);
  const app=createApp();app.mount('/api',listingsRoutes);app.mount('/api',partnerRoutes);app.mount('/api',dldRoutes);
  server=await new Promise((resolve,reject)=>{const listening=app.listen(0,()=>resolve(listening));listening.once('error',reject);});server.unref();
  request=async(path,{method='GET',body}={})=>{const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});let payload;try{payload=await response.json();}catch{payload={};}return{status:response.status,payload};};
});

after(async()=>{
  if(server){server.close();server.closeIdleConnections?.();server.closeAllConnections?.();}
  if(database)await database.closeDatabase();
});

test('UAT-040-DB authorized Manager creates and auto-activates a corporate Developer version',gate,async()=>{
  const beforeState=await database.one(`SELECT
    (SELECT COUNT(*)::int FROM partner_organization_versions WHERE company_id=$1) AS versions,
    (SELECT COUNT(*)::int FROM contacts) AS contacts`,[fixture.company]);
  const result=await request(`/api/admin/partner-organizations/${fixture.company}/versions`,{method:'POST',body:{classification:'developer',legalStructure:'listed_company',legalName:`${fixture.prefix} Developer PLC`,tradeName:`${fixture.prefix} Developer`,sourceEvidenceReference:`REGISTRY-${fixture.prefix}`}});
  const afterState=await database.one(`SELECT v.id,v.company_id,v.classification,v.status,v.legal_structure,v.source_evidence_sha256,
      v.created_by,v.verification_decision,v.verification_reason,v.verified_by,v.verified_at,
      c.company_type,c.owner_id,(SELECT COUNT(*)::int FROM contacts) AS contacts
    FROM partner_organization_versions v JOIN companies c ON c.id=v.company_id WHERE v.company_id=$1`,[fixture.company]);
  const companyRole=await database.one("SELECT role_code,status FROM external_company_roles WHERE company_id=$1 AND role_code='developer'",[fixture.company]);
  const audit=await database.one("SELECT entity_id,action,performed_by,details FROM audit_log WHERE entity_type='PartnerOrganization' AND action='verification_auto_activated' ORDER BY timestamp DESC LIMIT 1");
  const auditDetails=JSON.parse(audit.details);
  emit('uat040',{httpStatus:result.status,before:beforeState,after:{...afterState,sourceEvidenceSha256:'<64-hex-digest>'},companyRole,audit:{...audit,details:auditDetails}});
  assert.equal(result.status,201);
  assert.equal(afterState.companyId,fixture.company);assert.equal(afterState.companyType,'developer');assert.equal(afterState.classification,'developer');
  assert.equal(afterState.status,'active');assert.equal(afterState.legalStructure,'listed_company');assert.match(afterState.sourceEvidenceSha256,/^[a-f0-9]{64}$/);
  assert.equal(afterState.createdBy,fixture.broker);assert.equal(afterState.verifiedBy,fixture.broker);assert.equal(afterState.verificationDecision,'activated');assert.ok(afterState.verifiedAt);
  assert.equal(afterState.contacts,beforeState.contacts,'Developer governance must not create an individual Customer/Contact');
  assert.deepEqual(companyRole,{roleCode:'developer',status:'active'});
  assert.equal(audit.entityId,afterState.id);assert.equal(audit.action,'verification_auto_activated');assert.equal(audit.performedBy,fixture.broker);
  assert.equal(auditDetails.companyId,fixture.company);assert.equal(auditDetails.classification,'developer');assert.equal(auditDetails.legalStructure,'listed_company');assert.equal(auditDetails.status,'active');
});

test('UAT-041-DB owner/represented party persists without creating a Customer or Contact',gate,async()=>{
  const before=await database.one('SELECT (SELECT COUNT(*)::int FROM contacts) AS contacts,(SELECT COUNT(*)::int FROM inventory_counterparties WHERE listing_id=$1) AS parties',[fixture.listing]);
  const result=await request(`/api/listings/${fixture.listing}/counterparties`,{method:'POST',body:{partyRole:'seller',partyType:'company',displayName:`${fixture.prefix} Owner Company`,source:'Owner supplied property information directly',authorityEvidence:'Internal Inventory maintenance authority reference'}});
  const after=await database.one('SELECT (SELECT COUNT(*)::int FROM contacts) AS contacts,(SELECT COUNT(*)::int FROM inventory_counterparties WHERE listing_id=$1) AS parties',[fixture.listing]);
  const saved=await database.one('SELECT party_role,party_type,display_name,source,authority_evidence,contact_id FROM inventory_counterparties WHERE listing_id=$1',[fixture.listing]);
  emit('uat041',{httpStatus:result.status,before,after,saved:{...saved,displayName:'<fixture-owner>'}});
  assert.equal(result.status,201);assert.equal(after.parties,before.parties+1);assert.equal(after.contacts,before.contacts);assert.equal(saved.partyRole,'seller');assert.equal(saved.partyType,'company');assert.equal(saved.contactId,null);
});

test('UAT-042-DB Community and Developer linkage persist without mutating Inventory operations',gate,async()=>{
  const partner=await database.one("SELECT id FROM partner_organization_versions WHERE company_id=$1 AND status='active'",[fixture.company]);
  const before=await database.one('SELECT price,status,workflow_status,verification_status,availability_confirmed_at,availability_expires_at FROM listings WHERE id=$1',[fixture.listing]);
  const community=await request(`/api/crm/listings/${fixture.listing}/market-community`,{method:'PATCH',body:{communityId:fixture.community,reason:'Confirmed maintained Community for comparable evidence'}});
  const organization=await request(`/api/listings/${fixture.listing}/organization-relationships`,{method:'POST',body:{action:'linked',relationship:'developer',partnerVersionId:partner.id,reason:'Confirmed Developer responsible for this project'}});
  const after=await database.one('SELECT price,status,workflow_status,verification_status,availability_confirmed_at,availability_expires_at,community_id FROM listings WHERE id=$1',[fixture.listing]);
  const link=await database.one("SELECT relationship,action,partner_version_id FROM inventory_organization_link_events WHERE listing_id=$1 AND relationship='developer'",[fixture.listing]);
  emit('uat042',{communityHttpStatus:community.status,organizationHttpStatus:organization.status,before,after,link});
  assert.equal(community.status,200);assert.equal(organization.status,201);assert.equal(after.communityId,fixture.community);assert.equal(link.partnerVersionId,partner.id);
  for(const field of ['price','status','workflowStatus','verificationStatus','availabilityConfirmedAt','availabilityExpiresAt'])assert.deepEqual(after[field],before[field],field);
});

test('UAT-043-DB Manager queue returns the exact submitted Inventory ID used by navigation',gate,async()=>{
  await database.execute("UPDATE listings SET verification_status='unverified',workflow_status='draft' WHERE id=$1",[fixture.listing]);
  const submitted=await request(`/api/listings/${fixture.listing}/verification-requests`,{method:'POST',body:{requestType:'verification',reason:'Review owner authority before Inventory activation',evidenceReference:'OWNER-AUTHORITY-FIXTURE'}});
  const queue=await request('/api/inventory-verification-queue');
  const row=queue.payload.verificationRequests?.find(item=>item.listingId===fixture.listing);
  emit('uat043',{submitHttpStatus:submitted.status,queueHttpStatus:queue.status,listingId:row?.listingId,inventoryReference:row?.inventoryReference});
  assert.equal(submitted.status,201);assert.equal(queue.status,200);assert.ok(row);assert.equal(row.listingId,fixture.listing);
});

test('UAT-048-DB quick availability update persists exact effective/expiry values and audit evidence',gate,async()=>{
  const effective=new Date(Date.now()-60*60*1000).toISOString(),expires=new Date(Date.now()+7*24*60*60*1000).toISOString();
  const beforeState=await database.one('SELECT availability_confirmed_at,availability_expires_at FROM listings WHERE id=$1',[fixture.listing]);
  const result=await request(`/api/listings/${fixture.listing}/availability`,{method:'PATCH',body:{availabilityConfirmedAt:effective,availabilityExpiresAt:expires}});
  const afterState=await database.one('SELECT availability_confirmed_at,availability_expires_at FROM listings WHERE id=$1',[fixture.listing]);
  const audit=await database.one("SELECT action,details FROM audit_log WHERE entity_type='Listing' AND entity_id=$1 AND action='availability_reconfirmed' ORDER BY timestamp DESC LIMIT 1",[fixture.listing]);
  const auditDetails=typeof audit?.details==='string'?JSON.parse(audit.details):audit?.details;
  emit('uat048',{httpStatus:result.status,before:beforeState,after:afterState,auditAction:audit?.action});
  assert.equal(result.status,200);assert.equal(new Date(afterState.availabilityConfirmedAt).toISOString(),effective);assert.equal(new Date(afterState.availabilityExpiresAt).toISOString(),expires);assert.equal(audit.action,'availability_reconfirmed');assert.equal(auditDetails.to.expiresAt,expires);
});
