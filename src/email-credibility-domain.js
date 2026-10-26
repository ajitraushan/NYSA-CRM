import dns from 'node:dns/promises';
import crypto from 'node:crypto';

const DISPOSABLE_DOMAINS=new Set(['10minutemail.com','guerrillamail.com','mailinator.com','tempmail.com','yopmail.com']);
const ROLE_LOCALS=new Set(['admin','contact','hello','info','office','sales','support','test']);
const PLACEHOLDER_LOCALS=new Set(['abc','asdf','example','fake','none','noemail','test','unknown']);

const timeout=(promise,ms)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('timeout')),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});

export function classifyEmailEvidence(email,{mxRecords=null,lookupStatus='available'}={}){
  const normalized=String(email||'').trim().toLowerCase(),parts=normalized.split('@');
  const check=(code,label,status,detail)=>({code,label,status,detail});
  if(parts.length!==2||!parts[0]||!parts[1]||!parts[1].includes('.'))return {status:'invalid_format',label:'Invalid format',reason:'The email cannot be used because its format is invalid.',domain:null,checks:[
    check('format','Format validity','failed','The address does not have a usable mailbox and domain format.'),
    check('disposable_domain','Disposable-domain check','not_checked','Not checked because the format is invalid.'),
    check('placeholder_mailbox','Placeholder/test mailbox check','not_checked','Not checked because the format is invalid.'),
    check('role_mailbox','Shared/role mailbox check','not_checked','Not checked because the format is invalid.'),
    check('mx_domain','MX/mail-server check','not_checked','Not checked because the format is invalid.')
  ]};
  const [local,domain]=parts;
  const disposable=DISPOSABLE_DOMAINS.has(domain),placeholder=PLACEHOLDER_LOCALS.has(local)||/^(test|fake|example)[._+-]?\d*$/.test(local),role=ROLE_LOCALS.has(local),
    mxStatus=lookupStatus==='unavailable'?'unavailable':Array.isArray(mxRecords)?(mxRecords.length?'passed':'failed'):'not_checked',
    checks=[check('format','Format validity','passed','Mailbox and domain format are usable.'),
      check('disposable_domain','Disposable-domain check',disposable?'flagged':'passed',disposable?'Domain is on the controlled temporary-email risk list.':'Domain is not on the controlled temporary-email risk list.'),
      check('placeholder_mailbox','Placeholder/test mailbox check',placeholder?'flagged':'passed',placeholder?'Mailbox name resembles placeholder or test data.':'Mailbox name does not resemble controlled placeholder/test patterns.'),
      check('role_mailbox','Shared/role mailbox check',role?'flagged':'passed',role?'Mailbox is commonly shared by a role or team.':'Mailbox is not on the controlled shared-role list.'),
      check('mx_domain','MX/mail-server check',mxStatus,mxStatus==='passed'?'Domain published a mail-exchange record.':mxStatus==='failed'?'Domain did not publish a mail-exchange record.':mxStatus==='unavailable'?'Mail-server lookup timed out or was unavailable.':'Mail-server lookup has not yet run.')];
  if(disposable)return {status:'review_advised',label:'Review advised',reason:'The domain is on the controlled temporary-email risk list.',domain,checks};
  if(placeholder)return {status:'review_advised',label:'Review advised',reason:'The mailbox name looks like placeholder or test data.',domain,checks};
  if(role)return {status:'review_advised',label:'Review advised',reason:'This is a shared or role mailbox; confirm the individual customer contact.',domain,checks};
  if(lookupStatus==='unavailable')return {status:'check_unavailable',label:'Check unavailable',reason:'The domain mail check timed out or was unavailable; the enquiry remains accepted.',domain,checks};
  if(Array.isArray(mxRecords)&&mxRecords.length===0)return {status:'review_advised',label:'Review advised',reason:'The domain did not publish a mail-exchange record when checked.',domain,checks};
  return {status:'credible_domain',label:'Credible domain',reason:'The email format and domain mail check passed; this does not verify the person.',domain,checks};
}

export async function checkEmailCredibility(email,{resolveMx=dns.resolveMx,timeoutMs=1500}={}){
  const early=classifyEmailEvidence(email,{mxRecords:null});
  if(['invalid_format','review_advised'].includes(early.status))return {...early,checkedAt:new Date().toISOString()};
  try{const records=await timeout(resolveMx(early.domain),timeoutMs);return {...classifyEmailEvidence(email,{mxRecords:records}),checkedAt:new Date().toISOString()};}
  catch{return {...classifyEmailEvidence(email,{lookupStatus:'unavailable'}),checkedAt:new Date().toISOString()};}
}

export const EMAIL_CREDIBILITY_POLICY={disposableDomainCount:DISPOSABLE_DOMAINS.size,timeoutIsNonBlocking:true,personVerificationClaimed:false};

const APOLLO_MATCH_URL='https://api.apollo.io/api/v1/people/match';
const safeText=(value,max=160)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):null;

export function contactEnrichmentConfiguration(env=process.env){return{
  apolloConfigured:Boolean(env.APOLLO_API_KEY),
  apolloEndpoint:env.APOLLO_PEOPLE_MATCH_URL||APOLLO_MATCH_URL,
  apolloTimeoutMs:Number(env.APOLLO_TIMEOUT_MS||5000),
  ipRiskConfigured:false,
  locationAssessmentEnabled:false,
  advisoryOnly:true
};}

export async function checkApolloProfessionalEvidence(email,{fetchImpl=globalThis.fetch,env=process.env}={}){
  const config=contactEnrichmentConfiguration(env),checkedAt=new Date().toISOString();
  if(!config.apolloConfigured)return {status:'not_configured',label:'Professional match not configured',reason:'Apollo enrichment is not configured; email credibility is unaffected.',provider:'apollo',checkedAt,advisoryOnly:true};
  if(typeof fetchImpl!=='function')return {status:'check_unavailable',label:'Professional match unavailable',reason:'Apollo transport is unavailable; the enquiry remains accepted.',provider:'apollo',checkedAt,advisoryOnly:true};
  const normalized=String(email||'').trim().toLowerCase();
  if(!classifyEmailEvidence(normalized).domain)return {status:'not_checked',label:'Professional match not checked',reason:'A usable email is required before optional professional enrichment.',provider:'apollo',checkedAt,advisoryOnly:true};
  const hashedEmail=crypto.createHash('sha256').update(normalized).digest('hex'),url=new URL(config.apolloEndpoint);
  url.searchParams.set('hashed_email',hashedEmail);
  url.searchParams.set('reveal_personal_emails','false');
  url.searchParams.set('reveal_phone_number','false');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),config.apolloTimeoutMs);
  try{
    const response=await fetchImpl(url,{method:'POST',headers:{accept:'application/json','content-type':'application/json','x-api-key':env.APOLLO_API_KEY},body:'{}',signal:controller.signal});
    if(!response.ok)return {status:'check_unavailable',label:'Professional match unavailable',reason:`Apollo returned a safe provider error (${response.status}); the enquiry remains accepted.`,provider:'apollo',checkedAt,advisoryOnly:true};
    const data=await response.json().catch(()=>({})),person=data?.person;
    if(!person)return {status:'no_match',label:'No professional match',reason:'Apollo did not return a professional profile. This is neutral and does not reduce email credibility.',provider:'apollo',checkedAt,advisoryOnly:true};
    return {status:'matched',label:'Professional profile found',reason:'Apollo returned advisory employment evidence; the customer has not been identity-verified.',provider:'apollo',checkedAt,advisoryOnly:true,
      profile:{title:safeText(person.title),seniority:safeText(person.seniority),company:safeText(person.organization?.name),companyDomain:safeText(person.organization?.website_url)}};
  }catch{
    return {status:'check_unavailable',label:'Professional match unavailable',reason:'Apollo timed out or could not be reached; the enquiry remains accepted.',provider:'apollo',checkedAt,advisoryOnly:true};
  }finally{clearTimeout(timer);}
}

export async function assessContactCredibility(email,options={}){
  const emailEvidence=await checkEmailCredibility(email,options.email||{});
  if(options.includePaidApollo!==true)return {...emailEvidence,professionalEvidence:{status:'not_requested',label:'Apollo check not requested',
    reason:'Apollo is a paid provider and runs only after an explicit broker action.',provider:'apollo',checkedAt:null,advisoryOnly:true},apolloCalled:false,overallDecision:'advisory_only',automaticRejection:false};
  const professionalEvidence=await checkApolloProfessionalEvidence(email,options.apollo||{});
  return {...emailEvidence,professionalEvidence,apolloCalled:true,overallDecision:'advisory_only',automaticRejection:false};
}
