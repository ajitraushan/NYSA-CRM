import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPropertyFinderPreflight, propertyFinderMinimumImageCount, PROPERTY_FINDER_IMAGE_POLICY } from '../src/property-finder-preflight.js';
import { normalizePortalPermitEvidence, normalizePortalPreparation } from '../src/portal-publication-domain.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const now=new Date('2026-08-05T12:00:00.000Z');
const listing={inventoryReference:'R3B-UAT-PF-140',inventoryHeadline:'R3B-UAT PF quality fixture',workflowStatus:'approved',verificationStatus:'verified',status:'Available',marketingAgreementCount:1,propertyType:'Villa',bedrooms:'4',sizeSqft:4200};
const fields={publicationTitle:'Four-bedroom family villa in Meydan',publicationDescription:'Accurate approved property description. '.repeat(25),offeringType:'sale',uaeEmirate:'dubai',propertyCategory:'residential',furnishingType:'unfurnished',bathrooms:'5',publicationPrice:10000000,downPayment:0,propertyType:'villa',complianceType:'rera',videoUrl:'https://www.youtube.com/watch?v=pf-dev140'};
const preparation={revisionNumber:2,isCurrent:true,readinessSnapshot:{ready:true},mappingVersionCode:'pf-1.0.1',effectiveMappingVersionCode:'property-finder-enterprise-api-1.0.1-dev.142',permitMatched:true,portalFields:fields};
const permitEvidence={permitNumber:'SYNTHETIC-PERMIT'};
const resolutions={publicProfile:{id:'profile-1',resolved:true},location:{id:'location-1',resolved:true},project:{requested:false,resolved:true},compliance:{matched:true}};
const selections=Array.from({length:10},(_,index)=>({propertyMediaId:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,deliveryUrl:`https://media.example.test/villa-${index+1}.jpg`,availableUntil:'2026-08-20T00:00:00.000Z',width:1440,height:1080,colourSpace:'sRGB'}));
const media=selections.map((item,index)=>({id:item.propertyMediaId,approvalStatus:'approved',usageRightsConfirmed:true,rightsExpiresAt:'2026-09-01T00:00:00.000Z',mediaType:'image/jpeg',fileSizeBytes:500000,fileHash:String(index+1).padStart(64,'0')}));
const build=(mediaSelections=selections,selectedMedia=media)=>buildPropertyFinderPreflight({listing,preparation,permitEvidence,resolutions,mediaSelections,selectedMedia,now});

test('dev.140 enforces PF quality-ready image counts and exact technical limits',()=>{
  assert.equal(propertyFinderMinimumImageCount(listing,fields),10);
  assert.deepEqual(PROPERTY_FINDER_IMAGE_POLICY.acceptedTypes,['image/jpeg','image/png','image/webp']);
  assert.equal(build().ready,true);
  assert.equal(build().payload.media.images.length,10);
  const tooFew=build(selections.slice(0,9),media.slice(0,9));assert.equal(tooFew.ready,false);assert.match(tooFew.checks.find(check=>check.code==='media').detail,/at least 10/);
  const small=build([{...selections[0],width:799},...selections.slice(1)],media);assert.match(small.checks.find(check=>check.code==='media').detail,/800 x 600/);
  const portrait=build([{...selections[0],width:800,height:1080},...selections.slice(1)],media);assert.match(portrait.checks.find(check=>check.code==='media').detail,/aspect ratio/);
  const cmyk=build([{...selections[0],colourSpace:'CMYK'},...selections.slice(1)],media);assert.match(cmyk.checks.find(check=>check.code==='media').detail,/CMYK/);
  const duplicateMedia=media.map((item,index)=>index===1?{...item,fileHash:media[0].fileHash}:item);assert.match(build(selections,duplicateMedia).checks.find(check=>check.code==='media').detail,/Duplicate/);
});

test('dev.140 keeps YouTube and 360 links optional, governed and payload-bound',()=>{
  const normalized=normalizePortalPreparation({...fields,portalCode:'property_finder',currency:'AED',portalLocationReference:'Meydan',portalPropertyReference:'F-502',portalAgentReference:'profile-1'});
  assert.equal(normalized.error,undefined);assert.equal(normalized.fields.videoUrl,fields.videoUrl);
  assert.match(normalizePortalPreparation({...fields,portalCode:'property_finder',currency:'AED',portalLocationReference:'Meydan',portalPropertyReference:'F-502',portalAgentReference:'profile-1',videoUrl:'https://example.com/video'}).error,/YouTube/);
  assert.match(normalizePortalPreparation({...fields,portalCode:'property_finder',currency:'AED',portalLocationReference:'Meydan',portalPropertyReference:'F-502',portalAgentReference:'profile-1',virtualTourUrl:'http://tour.example.test/360'}).error,/HTTPS/);
  assert.equal(build().payload.media.videos.default,fields.videoUrl);
});

test('dev.140 makes unstated permit price optional and requires the PF permit category',()=>{
  const base={portalCode:'property_finder',complianceType:'rera',permitType:'property',permitNumber:'SYNTHETIC',issuingCompanyLicenseNumber:'SYNTHETIC-LICENCE',propertyReference:'F-502',advertisingPurpose:'sale',permittedPropertyType:'villa',permittedLocation:'Meydan',advertisingCopy:fields.publicationDescription,currency:'AED'};
  assert.equal(normalizePortalPermitEvidence(base).permittedPrice,null);
  assert.match(normalizePortalPermitEvidence({...base,permitType:''}).error,/Property or Project/);
});

test('dev.140 UI retains context, explains disabled actions and links media maintenance',()=>{
  const ui=read('public/app.js'),connector=read('src/property-finder-sandbox.js'),route=read('src/routes/property-finder-sandbox.js');
  for(const marker of ['EXTERNAL_PORTAL_CONTEXT','Add or approve property media','external-permit-disabled-reason','Property video URL','360° virtual-tour URL','Property Finder image quality is enforced','Do not invent a price'])assert.ok(ui.includes(marker),marker);
  assert.match(connector,/permitType=\$\{encodeURIComponent/);
  assert.match(route,/facts_snapshot->>'permitType'/);
  assert.match(route,/file_size_bytes,file_hash/);
});
