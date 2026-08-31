import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARTNER_COMPANY_ROLE,findPartnerOrganizationDuplicates,normalizePartnerOrganizationName,
  partnerClassificationForRelationship,validateInventoryOrganizationLinkEvent,
  validatePartnerDuplicateDecision,validatePartnerOrganizationVersionInput,validatePartnerVerificationDecision
} from '../src/partner-organization-domain.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const hash='a'.repeat(64);
const base={classification:'developer',legalStructure:'private_company',legalName:'Synthetic Developments L.L.C.',tradeName:'Synthetic Developments',licenceReference:'LIC SYN 001',licenceIssuer:'Synthetic Authority',licenceExpiresAt:'2027-08-12',sourceEvidenceReference:'EVIDENCE-SYN-001'};

test('governance input reuses a Company identity and accepts optional licence facts',()=>{
  const valid=validatePartnerOrganizationVersionInput(base);assert.equal(valid.valid,true);assert.equal(valid.value.licenceEvidenceStatus,'provided');
  const optional=validatePartnerOrganizationVersionInput({...base,licenceReference:'',licenceIssuer:'',licenceExpiresAt:null});assert.equal(optional.valid,true);assert.equal(optional.value.licenceEvidenceStatus,'not_provided');
  assert.equal('email' in optional.value,false);assert.equal('phone' in optional.value,false);assert.equal('owner' in optional.value,false);
});

test('governance input fails closed for unsupported types, missing references and inconsistent licence facts',()=>{
  assert.equal(validatePartnerOrganizationVersionInput({...base,classification:'owner'}).valid,false);
  assert.equal(validatePartnerOrganizationVersionInput({...base,legalStructure:'individual'}).valid,false);
  assert.equal(validatePartnerOrganizationVersionInput({...base,sourceEvidenceReference:''}).valid,false);
  assert.equal(validatePartnerOrganizationVersionInput({...base,licenceReference:'',licenceIssuer:'Synthetic Authority'}).valid,false);
});

test('legal-name normalization collapses punctuation case and repeated spaces deterministically',()=>{
  assert.equal(normalizePartnerOrganizationName('  Synthetic Developments L.L.C.  '),'synthetic developments l l c');
  assert.equal(normalizePartnerOrganizationName('SYNTHETIC   DEVELOPMENTS L L C'),'synthetic developments l l c');
});

test('duplicate comparison reports exact licence and normalized legal name without private facts',()=>{
  const candidate=validatePartnerOrganizationVersionInput(base).value;
  const duplicates=findPartnerOrganizationDuplicates(candidate,[{companyId:'company-2',name:'Synthetic Developments L L C',licenceReference:'lic syn 001',status:'active',email:'private@example.invalid'}]);
  assert.deepEqual(duplicates.map(item=>item.matchBasis),['exact_licence','normalized_legal_name']);
  assert.equal(duplicates.some(item=>'email' in item),false);
});

test('duplicate decision requires use-existing or continue-distinct with a meaningful reason',()=>{
  assert.equal(validatePartnerDuplicateDecision({decision:'use_existing',reason:'Use the governed existing Company',existingCompanyId:'company-2'}).valid,true);
  assert.equal(validatePartnerDuplicateDecision({decision:'continue_distinct',reason:'Independent legal entities'}).valid,true);
  assert.equal(validatePartnerDuplicateDecision({decision:'use_existing',reason:'short'}).valid,false);
});

test('verification rejects expired licences and requires an evidence-based reason',()=>{
  assert.equal(validatePartnerVerificationDecision({decision:'activate',reason:'Evidence was independently reviewed'},base,'2026-08-12T09:00:00Z').valid,true);
  assert.equal(validatePartnerVerificationDecision({decision:'activate',reason:'Evidence was independently reviewed'},{...base,licenceExpiresAt:'2026-08-01'},'2026-08-12T09:00:00Z').valid,false);
  assert.equal(validatePartnerVerificationDecision({decision:'reject',reason:'short'},base,'2026-08-12T09:00:00Z').valid,false);
});

test('classification maps to existing Company roles without creating a parallel master',()=>{
  assert.deepEqual(PARTNER_COMPANY_ROLE,{developer:'developer',external_agency:'agency',referral_partner:'referral_partner',service_provider:'service_provider'});
});

test('Inventory relationship classifications exclude service providers',()=>{
  assert.equal(partnerClassificationForRelationship('developer'),'developer');
  assert.equal(partnerClassificationForRelationship('listing_source_agency'),'external_agency');
  assert.equal(partnerClassificationForRelationship('referral_source'),'referral_partner');
  assert.equal(Object.values({developer:'developer',agency:'external_agency',referral:'referral_partner'}).includes('service_provider'),false);
});

test('Inventory link event validates first link, replacement and unlink append semantics',()=>{
  const first=validateInventoryOrganizationLinkEvent({action:'linked',relationship:'developer',partnerVersionId:'version-1',reason:'Record exact developer provenance'});assert.equal(first.valid,true);assert.equal(first.value.supersedesEventId,null);
  const current={id:'event-1'};const replacement=validateInventoryOrganizationLinkEvent({action:'replaced',relationship:'developer',partnerVersionId:'version-2',reason:'New active governed version accepted'},current);assert.equal(replacement.valid,true);assert.equal(replacement.value.supersedesEventId,'event-1');
  const unlink=validateInventoryOrganizationLinkEvent({action:'unlinked',relationship:'developer',partnerVersionId:null,reason:'Relationship no longer applies'},current);assert.equal(unlink.valid,true);
  assert.equal(validateInventoryOrganizationLinkEvent({action:'linked',relationship:'developer',partnerVersionId:'version-2',reason:'Duplicate current stream'},current).valid,false);
});

test('additive migration creates immutable versions, append-only links and no legacy backfill',()=>{
  const sql=read('src/migrations/084_partner_organization_integration.sql');
  for(const marker of ['CREATE TABLE partner_organization_versions','partner_organization_versions_active_uq','partner_organization_versions_open_uq','prevent_partner_organization_fact_mutation','CREATE TABLE inventory_organization_link_events','prevent_inventory_organization_link_mutation','PartnerOrganization','InventoryOrganizationLink'])assert.match(sql,new RegExp(marker));
  assert.doesNotMatch(sql,/UPDATE\s+companies\s+SET/i);assert.doesNotMatch(sql,/UPDATE\s+listings\s+SET/i);assert.doesNotMatch(sql,/INSERT\s+INTO\s+partner_organization_versions\s+SELECT/i);
});

test('database rules preserve one active/open version while dev.158 permits authorized auto-activation',()=>{
  const sql=read('src/migrations/084_partner_organization_integration.sql'),correction=read('src/migrations/100_dev158_uat040_048_operational_corrections.sql');
  assert.match(sql,/WHERE status='active'/);assert.match(sql,/WHERE status IN \('duplicate_review','pending_verification'\)/);assert.match(correction,/verified_by%created_by/);
});

test('governance routes allow Manager Director or Administrator creation and retain controlled reviews',()=>{
  const route=read('src/routes/partner-organizations.js');
  for(const marker of ["isGovernanceAuthority","Listing Executive, Manager, Director or Administrator authority is required","draft creator cannot decide","FOR UPDATE","verification_auto_activated","version_superseded"])assert.match(route,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});

test('activation maps classification to an existing Company business role',()=>{
  const route=read('src/routes/partner-organizations.js');assert.match(route,/PARTNER_COMPANY_ROLE\[version\.classification\]/);assert.match(route,/INSERT INTO external_company_roles/);assert.doesNotMatch(route,/INSERT INTO companies/);
});

test('Inventory API is optional and never rewrites existing developer or ownership facts',()=>{
  const route=read('src/routes/listings.js');
  assert.match(route,/organization-relationships/);assert.match(route,/INSERT INTO inventory_organization_link_events/);assert.match(route,/companyScopeSql\('c',req\.broker/);
  const organizationBlock=route.slice(route.indexOf("r.get('/listings/:id/organization-relationships'"),route.indexOf("r.patch('/listings/:id/responsible-agent'"));
  assert.doesNotMatch(organizationBlock,/UPDATE\s+listings/i);assert.doesNotMatch(organizationBlock,/inventory_counterparties\s+SET/i);
});

test('Company UI keeps corporate governance inside the Company experience without requiring a personal owner or SHA input',()=>{
  const ui=read('public/app.js');
  for(const marker of ['Governed organization status','openCompanyGovernance','EXISTING COMPANY · GOVERNED ORGANIZATION','No personal owner is required','Legal structure','technical evidence digest automatically'])assert.match(ui,new RegExp(marker,'i'));
  assert.doesNotMatch(ui,/Source evidence SHA-256 \*/);
});

test('Inventory UI explains linked organizations and preserves existing facts',()=>{
  const ui=read('public/app.js');
  for(const marker of ['Linked organizations and source history','optional section','never changes the owner/party, price, availability','Service providers cannot be linked','Save organization link','Append unlink event'])assert.match(ui,new RegExp(marker,'i'));
});

test('Inventory form selects Developer from the active governed Developer Master',()=>{
  const ui=read('public/app.js'),route=read('src/routes/listings.js'),form=ui.slice(ui.indexOf('async function openListingForm'),ui.indexOf('function openCloseModal'));
  assert.match(form,/api\('\/inventory-developers'\)/);
  assert.match(form,/select name="developerOrganizationVersionId"/);
  assert.doesNotMatch(form,/input name="developer"/);
  assert.match(form,/Only active governed Developers are selectable/);
  assert.match(route,/r\.get\('\/inventory-developers'/);
  assert.match(route,/v\.status='active' AND v\.classification='developer'/);
  assert.match(route,/Selected from Developer Master during Inventory draft creation/);
});

test('Inventory creation explains source provenance separately from owner and listing authority',()=>{
  const ui=read('public/app.js'),form=ui.slice(ui.indexOf('async function openListingForm'),ui.indexOf('function openCloseModal'));
  for(const text of ['Who or what supplied this property to NYSA?','Enter the owner only when the owner contacted NYSA directly','does not prove ownership or authorize NYSA to list the property','Add the actual owner and authority/agreement evidence after saving the Draft'])assert.match(form,new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('integration adds no credential, external connector or private identity handling',()=>{
  const sources=['src/partner-organization-domain.js','src/routes/partner-organizations.js','src/migrations/084_partner_organization_integration.sql'].map(read).join('\n');
  for(const prohibited of ['password','apiKey','secretKey','passport','emiratesId','ownerPhone','ownerEmail','fetch(','XMLHttpRequest','WebSocket','property-finder'])assert.doesNotMatch(sources,new RegExp(prohibited.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
});
