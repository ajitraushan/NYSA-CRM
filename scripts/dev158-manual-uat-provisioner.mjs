#!/usr/bin/env node
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const APPROVED_ORIGIN = 'https://crm-test.nysarealty.com';
export const EXPECTED_VERSION = '2.1.0-dev.158';
export const APPLY_CONFIRMATION = 'CRM_TEST_DEV158_UAT_DATA_PROVISION_CONFIRMED';
export const DATA_TAG = 'UAT158-HUMAN';

const excludedWorkflowActions = Object.freeze([
  'user suspension, revocation or role reversal', 'disposable team/area/routing maintenance', 'duplicate resolution',
  'lead acceptance, rejection, rerouting or reversal', 'qualification and requirement confirmation',
  'Inventory verification, availability update or administrative closure',
  'Opportunity, viewing, offer, booking, deal or commission transitions',
  'external integration or Property Finder action'
]);

const customerRoles = ['buyer','buyer','buyer','buyer','buyer','buyer','tenant','tenant','investor','seller','landlord','buyer'];
const leadProfiles = [
  ['SALE-APT-01','Sale',900000,1200000], ['SALE-VILLA-01','Sale',2500000,3500000],
  ['RENT-APT-01','Rental',90000,130000], ['RENT-VILLA-01','Rental',220000,300000],
  ['OFFPLAN-01','Off-plan',1200000,1800000], ['COMMERCIAL-01','Commercial',800000,1500000],
  ['REROUTE-01','Sale',1300000,1900000], ['REJECT-01','Rental',110000,160000],
  ['REVERSAL-01','Sale',1800000,2600000], ['DUPLICATE-BASE-01','Sale',700000,950000],
  ['MATCH-520-01','Sale',650000,900000], ['NO-MATCH-01','Sale',400000,500000],
  ['BOOKING-EXPIRY-01','Sale',1400000,2100000], ['OFFER-REJECT-01','Sale',1900000,2800000],
  ['CLOSURE-01','Rental',80000,120000], ['DELINK-01','Sale',1000000,1600000]
];

const inventoryProfiles = [
  ['APT-500','Apartment','1',500,850000,'Sale'], ['APT-520','Apartment','1',520,875000,'Sale'],
  ['APT-900','Apartment','2',900,1450000,'Sale'], ['APT-RENT','Apartment','1',650,105000,'Rental'],
  ['VILLA-SALE','Villa','3',2400,2950000,'Sale'], ['VILLA-RENT','Villa','3',2200,260000,'Rental'],
  ['TOWNHOUSE','Townhouse','3',1900,2200000,'Sale'], ['PENTHOUSE','Penthouse','3',2600,4800000,'Sale'],
  ['OFFPLAN-A','Apartment','2',1050,1750000,'Off-plan'], ['OFFPLAN-B','Townhouse','4',2300,3100000,'Off-plan'],
  ['COMMERCIAL','Apartment',null,1100,1250000,'Commercial'], ['DUPLICATE-A','Apartment','2',880,1400000,'Sale'],
  ['DUPLICATE-B','Apartment','2',880,1400000,'Sale'], ['EXPIRY','Apartment','1',700,980000,'Sale'],
  ['CLOSURE','Villa','4',3200,4200000,'Sale'], ['DELINK','Apartment','2',950,1550000,'Sale']
];

export function approvedBaseUrl(raw = APPROVED_ORIGIN) {
  const url = new URL(raw);
  if (url.origin !== APPROVED_ORIGIN || url.username || url.password || url.search || url.hash || !['','/'].includes(url.pathname)) {
    throw new Error(`Refusing non-approved base URL. Exact CRM Test origin required: ${APPROVED_ORIGIN}`);
  }
  return APPROVED_ORIGIN;
}

export function buildPlan() {
  const areas = [
    ['AREA-DOWNTOWN','uat158_downtown','UAT158 Downtown',910],
    ['AREA-MARINA','uat158_marina','UAT158 Marina',920],
    ['AREA-BUSINESS-BAY','uat158_business_bay','UAT158 Business Bay',930],
    ['AREA-JVC','uat158_jvc','UAT158 JVC',940],
    ['AREA-RETIRE','uat158_retire_me','UAT158 Temporary Area',990]
  ].map(([code,stableCode,businessLabel,displayOrder])=>({code,stableCode,businessLabel,emirate:'Dubai',displayOrder}));
  const teams = [
    ['T-A','UAT158 Dubai Secondary Sales'], ['T-B','UAT158 Dubai Rentals'], ['T-C','UAT158 Dubai Off-plan'],
    ['T-X','UAT158 Temporary Governance Team']
  ].map(([code,name])=>({code,name,leadResponseHours:4}));
  const users = [
    ['U-DIR','UAT158 Director','director',null], ['U-MA','UAT158 Manager Alpha','manager','T-A'],
    ['U-A1','UAT158 Agent Alpha One','sales_agent','T-A'], ['U-A2','UAT158 Agent Alpha Two','sales_agent','T-A'],
    ['U-MB','UAT158 Manager Beta','manager','T-B'], ['U-B1','UAT158 Agent Beta One','sales_agent','T-B'],
    ['U-LX','UAT158 Listing Executive','listing_agent','T-C'], ['U-ACC','UAT158 Accountant','accountant',null]
  ].map(([code,name,jobRole,teamCode],index)=>({code,name,jobRole,teamCode,
    email:`uat158.user.${String(index+1).padStart(2,'0')}@example.invalid`,phone:`+999258${String(index+1).padStart(5,'0')}`}));
  const companies = [
    ['DEVELOPER-01','developer'], ['AGENCY-01','agency'], ['CORPORATE-01','corporate_client'],
    ['LANDLORD-01','landlord_company'], ['VENDOR-01','vendor']
  ].map(([code,companyType]) => ({ code, name:`${DATA_TAG} ${code}`, companyType }));
  const customers = customerRoles.map((contactType,index) => ({
    code:`CUSTOMER-${String(index + 1).padStart(2,'0')}`,
    fullName:`${DATA_TAG} Customer ${String(index + 1).padStart(2,'0')}`,
    contactType,
    preferredChannel:index % 3 === 0 ? 'WhatsApp' : index % 3 === 1 ? 'Email' : 'Phone',
    email:`uat158.customer.${String(index + 1).padStart(2,'0')}@example.invalid`,
    phone:`+999158${String(index + 1).padStart(5,'0')}`
  }));
  const leads = leadProfiles.map(([code,businessType,budgetMin,budgetMax],index) => ({
    code, title:`${DATA_TAG} ${code}`, businessType, budgetMin, budgetMax,
    source:['Website','WhatsApp','Referral','Walk-in','Phone','Other'][index % 6],
    customerCode:customers[index % customers.length].code
  }));
  const inventory = inventoryProfiles.map(([code,propertyType,bedrooms,sizeSqft,price,transactionType],index) => ({
    code, inventoryHeadline:`${DATA_TAG} ${code}`, project:`${DATA_TAG} Project ${String(index + 1).padStart(2,'0')}`,
    community:`${DATA_TAG} Community ${1 + (index % 4)}`, building:`${DATA_TAG} Building ${1 + (index % 6)}`,
    unitReference:`UAT158-${String(index + 1).padStart(3,'0')}`, propertyType, bedrooms, sizeSqft, price,
    transactionTypes:[transactionType], currency:'AED', handoverStatus:transactionType === 'Off-plan' ? 'expected' : 'ready',
    handoverExpectedDate:transactionType === 'Off-plan' ? '2028-12-31' : null, exclusivityTier:'Off-market'
  }));
  const counterparties = [
    ['EXT-BUYER-AGENT','external_broker','buyer_agent'], ['EXT-SELLER-AGENT','external_broker','seller_agent'],
    ['EXT-BUYER-AGENCY','external_agency','buyer_agency'], ['TRANSACTION-ONLY','transaction_only','other']
  ].map(([code,partyType,role]) => ({ code, displayName:`${DATA_TAG} ${code}`, partyType, role,
    source:'Synthetic manual UAT prerequisite', evidenceReference:`${DATA_TAG}-${code}-EVIDENCE` }));
  const additionalContacts=[1,2,3,4].map(index=>({code:`CONTACT-${String(index).padStart(2,'0')}`,fullName:`${DATA_TAG} Additional Contact ${String(index).padStart(2,'0')}`,
    contactType:['other','developer','seller','landlord'][index-1],preferredChannel:index%2?'Email':'Phone',email:`uat158.contact.${String(index).padStart(2,'0')}@example.invalid`,phone:`+999358${String(index).padStart(5,'0')}`}));
  const routingRules=[
    {code:'RR-10',name:'UAT158 Downtown Sale',priority:10,businessType:'Sale',areaCode:'AREA-DOWNTOWN',teamCode:'T-A'},
    {code:'RR-20',name:'UAT158 Marina Rental',priority:20,businessType:'Rental',areaCode:'AREA-MARINA',teamCode:'T-B'},
    {code:'RR-30',name:'UAT158 Off-plan',priority:30,businessType:'Off-plan',areaCode:'AREA-BUSINESS-BAY',teamCode:'T-C'},
    {code:'RR-50',name:'UAT158 Website Sale fallback',priority:50,source:'Website',businessType:'Sale',areaCode:null,teamCode:'T-A'},
    {code:'RR-9999',name:'UAT158 Company fallback',priority:9999,source:null,businessType:null,areaCode:null,teamCode:null}
  ];
  return { schemaVersion:1, dataTag:DATA_TAG, targetVersion:EXPECTED_VERSION,
    counts:{existingAdministrator:1,areas:areas.length,teams:teams.length,additionalUsers:users.length,companies:companies.length,customers:customers.length,additionalContacts:additionalContacts.length,duplicateDrafts:1,routingRules:routingRules.length,leads:leads.length,inventory:inventory.length,counterparties:counterparties.length},
    requiredExisting:{authorizedAdministrator:true},
    areas,teams,users,companies,customers,additionalContacts,routingRules,leads,inventory,counterparties,excludedWorkflowActions:[...excludedWorkflowActions] };
}

function safeError(value) {
  const message = typeof value === 'string' ? value : value?.error || value?.message || 'Request failed';
  return String(message)
    .replace(/(password|cookie|authorization|api[_ -]?key)\s*[:=]\s*\S+/ig,'$1=[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'[REDACTED-EMAIL]')
    .replace(/\+\d{8,15}/g,'[REDACTED-PHONE]').slice(0,400);
}

function env(name,{required=false}={}) {
  const value=String(process.env[name] || '').trim();
  if(required && !value) throw new Error(`${name} is required`);
  return value;
}

function publicPlan(plan) {
  return {
    schemaVersion:plan.schemaVersion, dataTag:plan.dataTag, targetVersion:plan.targetVersion,
    counts:plan.counts, requiredExisting:plan.requiredExisting,
    records:{areas:plan.areas.map(x=>x.code),teams:plan.teams.map(x=>x.code),users:plan.users.map(x=>x.code),companies:plan.companies.map(x=>x.code),customers:plan.customers.map(x=>x.code),additionalContacts:plan.additionalContacts.map(x=>x.code),routingRules:plan.routingRules.map(x=>x.code),leads:plan.leads.map(x=>x.code),inventory:plan.inventory.map(x=>x.code),counterparties:plan.counterparties.map(x=>x.code)},
    excludedWorkflowActions:plan.excludedWorkflowActions,
    privacy:'Synthetic contact channels are generated only in memory and are omitted from this output. Credentials and session data are never written.'
  };
}

function createClient(base) {
  let cookie='';
  return async function request(path,{method='GET',body,expected=200}={}) {
    const headers={accept:'application/json'};
    if(body !== undefined) headers['content-type']='application/json';
    if(cookie) headers.cookie=cookie;
    const response=await fetch(`${base}/api${path}`,{method,headers,body:body === undefined ? undefined : JSON.stringify(body),redirect:'error'});
    const setCookie=response.headers.get('set-cookie');
    if(setCookie && !cookie) cookie=setCookie.split(';',1)[0];
    const type=response.headers.get('content-type') || '';
    const data=type.includes('application/json') ? await response.json() : {error:'Unexpected non-JSON response'};
    const allowed=Array.isArray(expected) ? expected : [expected];
    if(!allowed.includes(response.status)) throw new Error(`${method} ${path} returned ${response.status}: ${safeError(data)}`);
    return data;
  };
}

async function preflight(request) {
  const health=await request('/health'), readiness=await request('/readiness');
  if(health.version !== EXPECTED_VERSION) throw new Error(`Version mismatch: expected ${EXPECTED_VERSION}; received ${health.version || 'missing'}`);
  if(readiness.database !== 'ready' && readiness.ready !== true) throw new Error('CRM Test database readiness was not ready');
  return {version:health.version,process:health.process,database:readiness.database || 'ready'};
}

const query=value=>encodeURIComponent(value);
async function findExact(request,path,collection,key,value) {
  const data=await request(`${path}${path.includes('?')?'&':'?'}q=${query(value)}&pageSize=100`);
  return (data[collection] || []).find(item=>String(item[key] || '').trim().toLowerCase() === value.trim().toLowerCase()) || null;
}

async function provision(request,plan) {
  const testUserPassword=env('NYSA_UAT158_TEST_USER_PASSWORD',{required:true});
  if(testUserPassword.length<12)throw new Error('NYSA_UAT158_TEST_USER_PASSWORD must contain at least 12 characters');
  const results={reused:[],created:[]},ids={areas:{},teams:{},users:{},companies:{},customers:{}};
  const remember=(kind,code,row,reused)=>{results[reused?'reused':'created'].push({kind,code,reference:row.leadReference || row.inventoryReference || null});return row;};

  const areaState=(await request('/admin/areas')).areas||[];
  for(const item of plan.areas){
    let row=areaState.find(x=>String(x.stableCode||'').toLowerCase()===item.stableCode),reused=Boolean(row);
    if(row&&!row.active)throw new Error(`Baseline Area ${item.code} exists but is inactive; maintenance decision required`);
    if(!row)row=await request('/admin/areas',{method:'POST',expected:201,body:item});
    ids.areas[item.code]=remember('area',item.code,row,reused).id;
  }
  const teamState=(await request('/crm/teams')).teams||[];
  for(const item of plan.teams){
    let row=teamState.find(x=>String(x.name||'').toLowerCase()===item.name.toLowerCase()),reused=Boolean(row);
    if(!row)row=await request('/crm/teams',{method:'POST',expected:201,body:{name:item.name,leadResponseHours:item.leadResponseHours}});
    ids.teams[item.code]=remember('team',item.code,row,reused).id;
  }
  const brokerState=(await request('/admin/brokers')).brokers||[];
  const invitations=(await request('/admin/invitations')).invitations||[];
  for(const item of plan.users){
    let row=brokerState.find(x=>String(x.email||'').toLowerCase()===item.email),reused=Boolean(row);
    if(row&&!['active','pending_activation'].includes(row.status))throw new Error(`Baseline user ${item.code} exists in ${row.status} state; access maintenance decision required`);
    let activationCode=null;
    if(!row){
      const created=await request('/admin/users',{method:'POST',expected:201,body:{name:item.name,email:item.email,phone:item.phone,userClassification:'internal_user',roleAssignments:[{jobRole:item.jobRole,teamId:item.teamCode?ids.teams[item.teamCode]:null,isPrimary:true,changeReason:`${DATA_TAG} baseline role`}]}});
      row=created.user;activationCode=created.activationCode;
    }else if(row.status==='pending_activation'){
      activationCode=invitations.find(x=>x.pendingBrokerId===row.id&&x.status==='active')?.code||null;
      if(!activationCode)throw new Error(`Pending baseline user ${item.code} has no active invitation; invitation maintenance required`);
    }
    if(row.status!=='active'){
      const registered=await request('/auth/register',{method:'POST',expected:201,body:{code:activationCode,name:item.name,email:item.email,phone:item.phone,brokerage:'NYSA CRM Test',password:testUserPassword}});
      row=registered.broker;
    }
    ids.users[item.code]=remember('user',item.code,row,reused).id;
  }
  for(const [teamCode,managerCode] of [['T-A','U-MA'],['T-B','U-MB'],['T-C','U-MA'],['T-X','U-MA']]){
    const team=teamState.find(x=>x.id===ids.teams[teamCode]);
    if(team?.managerId!==ids.users[managerCode])await request(`/crm/teams/${ids.teams[teamCode]}`,{method:'PATCH',body:{managerId:ids.users[managerCode]}});
  }
  const routingState=(await request('/admin/routing-rules')).rules||[];
  for(const item of plan.routingRules){
    let row=routingState.find(x=>String(x.name||'').toLowerCase()===item.name.toLowerCase()),reused=Boolean(row);
    if(!row){
      const expectedAreaId=item.areaCode?ids.areas[item.areaCode]:null,expectedTeamId=item.teamCode?ids.teams[item.teamCode]:null;
      row=routingState.find(x=>x.active&&String(x.source||'')===String(item.source||'')&&String(x.businessType||'')===String(item.businessType||'')&&String(x.areaId||'')===String(expectedAreaId||'')&&String(x.teamId||'')===String(expectedTeamId||''))||null;
      reused=Boolean(row);
    }
    if(row&&!row.active)throw new Error(`Baseline routing rule ${item.code} exists but is retired; routing maintenance decision required`);
    if(!row)row=await request('/admin/routing-rules',{method:'POST',expected:201,body:{name:item.name,priority:item.priority,source:item.source||null,businessType:item.businessType||null,areaId:item.areaCode?ids.areas[item.areaCode]:null,teamId:item.teamCode?ids.teams[item.teamCode]:null,assignmentMethod:'team_queue'}});
    remember('routing_rule',item.code,row,reused);
  }
  const areaId=ids.areas['AREA-DOWNTOWN'],inventoryAreaId=ids.areas['AREA-MARINA'],inventoryAgentId=ids.users['U-LX'],preferredArea='UAT158 Downtown';

  for(const item of plan.companies){
    let row=await findExact(request,'/crm/companies','companies','name',item.name),reused=Boolean(row);
    if(!row) row=await request('/crm/companies',{method:'POST',expected:201,body:{name:item.name,companyType:item.companyType,notes:`${DATA_TAG} synthetic prerequisite`} });
    ids.companies[item.code]=remember('company',item.code,row,reused).id;
  }
  for(const item of plan.customers){
    let row=await findExact(request,'/crm/contacts','contacts','fullName',item.fullName),reused=Boolean(row);
    if(!row) row=await request('/crm/contacts',{method:'POST',expected:201,body:{fullName:item.fullName,email:item.email,phone:item.phone,preferredChannel:item.preferredChannel,contactType:item.contactType,notes:`${DATA_TAG} synthetic prerequisite`} });
    ids.customers[item.code]=remember('customer',item.code,row,reused).id;
  }
  for(const item of plan.additionalContacts){
    let row=await findExact(request,'/crm/contacts','contacts','fullName',item.fullName),reused=Boolean(row);
    if(!row)row=await request('/crm/contacts',{method:'POST',expected:201,body:{...item,code:undefined,notes:`${DATA_TAG} additional Contact fixture; no Lead created`}});
    remember('additional_contact',item.code,row,reused);
  }
  const duplicateName=`${DATA_TAG} Customer 09 Duplicate`;
  let duplicate=await findExact(request,'/crm/contacts','contacts','fullName',duplicateName),duplicateReused=Boolean(duplicate);
  if(!duplicate)duplicate=await request('/crm/contacts',{method:'POST',expected:201,body:{fullName:duplicateName,email:plan.customers[8].email,phone:plan.customers[8].phone,preferredChannel:plan.customers[8].preferredChannel,contactType:'investor',duplicateReviewRequested:true,notes:`${DATA_TAG} deliberate duplicate-review fixture; do not resolve automatically`}});
  remember('duplicate_draft','DUPLICATE-C09',duplicate,duplicateReused);
  for(const item of plan.leads){
    let row=await findExact(request,'/crm/leads','leads','title',item.title),reused=Boolean(row);
    if(!row) row=await request('/crm/leads',{method:'POST',expected:201,body:{contactId:ids.customers[item.customerCode],title:item.title,source:item.source,businessType:item.businessType,budgetMin:item.budgetMin,budgetMax:item.budgetMax,preferredAreas:[preferredArea],primaryRoutingAreaId:areaId,propertyRequirements:`${DATA_TAG} human UAT baseline; complete structured requirements manually`} });
    remember('lead',item.code,row,reused);
  }
  for(const item of plan.inventory){
    let row=await findExact(request,'/listings','listings','inventoryHeadline',item.inventoryHeadline),reused=Boolean(row);
    if(!row) row=await request('/listings',{method:'POST',expected:201,body:{...item,code:undefined,areaId:inventoryAreaId,originatingAgentId:inventoryAgentId,contact:`${DATA_TAG}-${item.code}-SOURCE`,notes:`${DATA_TAG} synthetic draft; verify and govern manually`} });
    remember('inventory',item.code,row,reused);
  }
  const current=(await request('/crm/transaction-counterparties')).counterparties || [];
  for(const item of plan.counterparties){
    let row=current.find(x=>String(x.displayName||'').toLowerCase()===item.displayName.toLowerCase()),reused=Boolean(row);
    if(!row) row=await request('/crm/transaction-counterparties',{method:'POST',expected:201,body:item});
    remember('counterparty',item.code,row,reused);
  }
  return results;
}

function cleanRecord(record,fields){return Object.fromEntries(fields.map(field=>[field,record?.[field]??null]));}
async function dumpSanitized(request,plan){
  const [areasData,teamsData,usersData,routingData,companiesData,customersData,leadsData,inventoryData,counterpartiesData]=await Promise.all([
    request('/admin/areas'),request('/crm/teams'),request('/admin/brokers'),request('/admin/routing-rules'),request('/crm/companies?q=UAT158'),
    request('/crm/contacts?q=UAT158&pageSize=100'),request('/crm/leads?q=UAT158&pageSize=100'),
    request('/listings?q=UAT158&pageSize=100'),request('/crm/transaction-counterparties')
  ]);
  const codeByName=new Map(plan.users.map(x=>[x.name,x.code]));
  return {
    schemaVersion:1,dataTag:DATA_TAG,targetVersion:EXPECTED_VERSION,generatedAt:new Date().toISOString(),
    privacy:'Sanitized export: credentials, sessions, invitations, activation codes, emails, phone numbers, addresses and private authority/contact evidence are excluded.',
    areas:(areasData.areas||[]).filter(x=>String(x.stableCode||'').startsWith('uat158_')).map(x=>cleanRecord(x,['stableCode','businessLabel','emirate','displayOrder','active'])),
    teams:(teamsData.teams||[]).filter(x=>String(x.name||'').startsWith('UAT158 ')).map(x=>({...cleanRecord(x,['name','leadResponseHours','active','memberCount']),managerAssigned:Boolean(x.managerId)})),
    users:(usersData.brokers||[]).filter(x=>String(x.name||'').startsWith('UAT158 ')).map(x=>({code:codeByName.get(x.name)||null,...cleanRecord(x,['name','jobRole','role','status','userClassification'])})),
    routingRules:(routingData.rules||[]).filter(x=>String(x.name||'').startsWith('UAT158 ')||(x.active&&!x.source&&!x.businessType&&!x.areaId&&!x.teamId)).map(x=>({...cleanRecord(x,['name','priority','source','businessType','areaLabel','teamName','active']),companyFallback:Boolean(x.active&&!x.source&&!x.businessType&&!x.areaId&&!x.teamId)})),
    companies:(companiesData.companies||[]).filter(x=>String(x.name||'').startsWith(DATA_TAG)).map(x=>cleanRecord(x,['name','companyType','status','contactCount'])),
    customers:(customersData.contacts||[]).filter(x=>String(x.fullName||'').startsWith(DATA_TAG)).map(x=>cleanRecord(x,['fullName','contactType','preferredChannel','lifecycleStatus','duplicateReviewStatus','kycStatus','leadCount'])),
    leads:(leadsData.leads||[]).filter(x=>String(x.title||'').startsWith(DATA_TAG)).map(x=>cleanRecord(x,['leadReference','title','source','businessType','stage','temperature','assignmentStatus','routingReason'])),
    inventory:(inventoryData.listings||[]).filter(x=>String(x.inventoryHeadline||'').startsWith(DATA_TAG)).map(x=>cleanRecord(x,['inventoryReference','inventoryHeadline','project','area','community','building','unitReference','propertyType','bedrooms','sizeSqft','price','currency','transactionTypes','status','workflowStatus','verificationStatus','availabilityConfirmedAt','availabilityExpiresAt'])),
    counterparties:(counterpartiesData.counterparties||[]).filter(x=>String(x.displayName||'').startsWith(DATA_TAG)).map(x=>cleanRecord(x,['displayName','partyType','role','source']))
  };
}
function dumpMarkdown(dump){
  const sections=['areas','teams','users','routingRules','companies','customers','leads','inventory','counterparties'];
  const content=sections.map(section=>{const rows=dump[section],fields=[...new Set(rows.flatMap(Object.keys))];
    if(!rows.length)return `## ${section}\n\nNo matching records found.\n`;
    const header=`| ${fields.join(' | ')} |\n| ${fields.map(()=> '---').join(' | ')} |`;
    const body=rows.map(row=>`| ${fields.map(field=>String(row[field]??'').replaceAll('|','\\|').replace(/[\r\n]+/g,' ')).join(' | ')} |`).join('\n');
    return `## ${section}\n\n${header}\n${body}\n`;}).join('\n');
  return `# CRM Test dev.158 — sanitized UAT data dump\n\nGenerated: ${dump.generatedAt}\n\n${dump.privacy}\n\n${content}`;
}
async function writeDump(dump){
  const stamp=dump.generatedAt.replace(/[-:.TZ]/g,''),directory=resolve('outputs','dev158-uat-data-dump',stamp);
  await mkdir(directory,{recursive:true});
  await Promise.all([writeFile(resolve(directory,'uat158-data.json'),`${JSON.stringify(dump,null,2)}\n`,{flag:'wx'}),writeFile(resolve(directory,'uat158-data.md'),dumpMarkdown(dump),{flag:'wx'})]);
  return directory;
}

export async function main(argv=process.argv.slice(2)) {
  const plan=buildPlan(), apply=argv.includes('--apply'),dump=argv.includes('--dump'),preflightOnly=argv.includes('--preflight');
  if(!apply && !dump && !preflightOnly){process.stdout.write(`${JSON.stringify({mode:'plan',...publicPlan(plan)},null,2)}\n`);return;}
  const base=approvedBaseUrl(env('NYSA_UAT158_BASE_URL') || APPROVED_ORIGIN),request=createClient(base),readiness=await preflight(request);
  if(preflightOnly){process.stdout.write(`${JSON.stringify({mode:'read-only-preflight',baseUrl:base,readiness},null,2)}\n`);return;}
  if(apply&&env('NYSA_UAT158_CONFIRM') !== APPLY_CONFIRMATION) throw new Error(`Apply refused. Set NYSA_UAT158_CONFIRM exactly to ${APPLY_CONFIRMATION}.`);
  const email=env('NYSA_UAT158_EMAIL',{required:true}),password=env('NYSA_UAT158_PASSWORD',{required:true});
  const login=await request('/auth/login',{method:'POST',expected:200,body:{email,password}});
  if(login?.broker?.role !== 'admin') throw new Error('The bootstrap account must be an active full CRM Test Administrator');
  if(dump){const sanitized=await dumpSanitized(request,plan),directory=await writeDump(sanitized),counts=Object.fromEntries(['areas','teams','users','routingRules','companies','customers','leads','inventory','counterparties'].map(key=>[key,sanitized[key].length]));process.stdout.write(`${JSON.stringify({mode:'sanitized-read-only-dump',directory,counts,privacy:sanitized.privacy},null,2)}\n`);return;}
  const results=await provision(request,plan);
  process.stdout.write(`${JSON.stringify({mode:'crm-test-apply',baseUrl:base,version:readiness.version,dataTag:DATA_TAG,summary:{created:results.created.length,reused:results.reused.length},records:[...results.created,...results.reused],privacy:'Credentials, session data and synthetic contact channels omitted.'},null,2)}\n`);
}

const invoked=process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if(invoked) main().catch(error=>{process.stderr.write(`dev.158 UAT provisioning failed: ${safeError(error)}\n`);process.exitCode=1;});
