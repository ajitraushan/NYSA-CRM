import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { assessContactCredibility,checkApolloProfessionalEvidence,contactEnrichmentConfiguration } from '../src/email-credibility-domain.js';

test('R3A-INTAKE-EMAIL-42: Apollo is optional and cannot reject an enquiry',async()=>{
  const result=await checkApolloProfessionalEvidence('client@example.com',{env:{},fetchImpl:()=>{throw new Error('must not call');}});
  assert.equal(result.status,'not_configured');
  assert.equal(result.advisoryOnly,true);
  assert.equal(contactEnrichmentConfiguration({}).locationAssessmentEnabled,false);
});

test('R3A-INTAKE-EMAIL-42: Apollo receives a hash and header secret, never the raw email or URL key',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{
    request={url:String(url),options};
    return {ok:true,status:200,json:async()=>({person:{title:'Director',seniority:'director',organization:{name:'Example LLC',website_url:'https://example.com'}}})};
  };
  const result=await checkApolloProfessionalEvidence(' Client@Example.com ',{env:{APOLLO_API_KEY:'secret-value',APOLLO_TIMEOUT_MS:'1000'},fetchImpl});
  const expectedHash=crypto.createHash('sha256').update('client@example.com').digest('hex');
  assert.equal(result.status,'matched');
  assert.equal(result.profile.company,'Example LLC');
  assert.match(request.url,new RegExp(`hashed_email=${expectedHash}`));
  assert.doesNotMatch(request.url,/client%40example\.com|secret-value/i);
  assert.equal(request.options.headers['x-api-key'],'secret-value');
  assert.equal(new URL(request.url).searchParams.get('reveal_personal_emails'),'false');
  assert.equal(new URL(request.url).searchParams.get('reveal_phone_number'),'false');
});

test('R3A-INTAKE-EMAIL-42: provider failure is transparent and non-blocking',async()=>{
  const result=await assessContactCredibility('client@example.com',{
    includePaidApollo:true,
    email:{resolveMx:async()=>[{exchange:'mail.example.com',priority:10}]},
    apollo:{env:{APOLLO_API_KEY:'secret-value'},fetchImpl:async()=>({ok:false,status:429,json:async()=>({})})}
  });
  assert.equal(result.status,'credible_domain');
  assert.equal(result.professionalEvidence.status,'check_unavailable');
  assert.equal(result.automaticRejection,false);
  assert.equal(result.overallDecision,'advisory_only');
});

test('R3A-INTAKE-EMAIL-42: CRM, website intake, migration and Customer 360 expose governed evidence',()=>{
  const crm=fs.readFileSync(new URL('../src/routes/crm.js',import.meta.url),'utf8');
  const intake=fs.readFileSync(new URL('../src/routes/website-intake.js',import.meta.url),'utf8');
  const ui=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const migration=fs.readFileSync(new URL('../src/migrations/068_release3a_contact_enrichment_evidence.sql',import.meta.url),'utf8');
  assert.match(crm,/\/crm\/customers\/:id\/contact-credibility/);
  assert.match(crm,/email_credibility_refreshed/);
  assert.match(crm,/apollo_professional_evidence_refreshed/);
  assert.match(crm,/automaticRejection:false/);
  assert.match(crm,/leads\.some\(lead=>canWriteLead\(req\.broker,lead\)\)/);
  assert.match(crm,/serving Lead broker/);
  assert.match(intake,/checkEmailCredibility/);
  assert.doesNotMatch(intake,/checkApolloProfessionalEvidence|assessContactCredibility|email_professional_evidence/);
  assert.match(ui,/KYC and contact verification/);
  assert.match(ui,/Pre-KYC email evidence/);
  assert.match(ui,/data-refresh-contact-credibility/);
  assert.match(ui,/data\.canRefreshContactCredibility/);
  assert.match(ui,/Advisory only; this does not verify identity/);
  assert.match(migration,/ADD COLUMN email_professional_evidence JSONB/);
  assert.doesNotMatch(migration,/INSERT INTO schema_migrations/i);
});
