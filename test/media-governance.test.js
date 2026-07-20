import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeMediaGovernance,mediaRightsAreCurrent,validateMediaReview} from '../src/media-governance.js';

test('property media requires documented current usage rights',()=>{
  assert.match(normalizeMediaGovernance({}).error,/Confirm/);
  assert.match(normalizeMediaGovernance({usageRightsConfirmed:true,rightsBasis:'legacy_approved'}).error,/documented/);
  assert.match(normalizeMediaGovernance({usageRightsConfirmed:true,rightsBasis:'owner_authorized',rightsExpiresAt:'2025-01-01'},new Date('2026-01-01')).error,/future/);
  assert.deepEqual(normalizeMediaGovernance({usageRightsConfirmed:true,rightsBasis:'developer_authorized',rightsExpiresAt:'2027-01-01'},new Date('2026-01-01')),{usageRightsConfirmed:true,rightsBasis:'developer_authorized',rightsExpiresAt:'2027-01-01'});
});

test('only current permitted-use media can be approved',()=>{
  const current={usageRightsConfirmed:true,rightsBasis:'agency_authorized',rightsExpiresAt:'2027-01-01'};
  assert.equal(mediaRightsAreCurrent(current,new Date('2026-01-01')),true);
  assert.equal(validateMediaReview(current,{approvalStatus:'approved'},new Date('2026-01-01')),null);
  assert.match(validateMediaReview(current,{approvalStatus:'rejected'},new Date('2026-01-01')),/reason/);
  assert.match(validateMediaReview({...current,rightsExpiresAt:'2025-01-01'},{approvalStatus:'approved'},new Date('2026-01-01')),/rights/);
});

test('property media routes govern duplicates rights cover ordering and review',()=>{
  const routes=readFileSync(new URL('../src/routes/files-proposals.js',import.meta.url),'utf8');
  const domain=readFileSync(new URL('../src/media-governance.js',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const migration=readFileSync(new URL('../src/migrations/030_property_media_governance.sql',import.meta.url),'utf8');
  for(const marker of ['usage_rights_confirmed','rights_basis','rights_expires_at','is_cover','rejection_reason'])assert.match(migration,new RegExp(marker));
  for(const marker of ['Duplicate media file','media_metadata_changed','cover_selected'])assert.match(routes,new RegExp(marker));
  assert.match(domain,/A rejection reason is required/);
  for(const marker of ['Media use rights','Set as cover','Reject with reason','Save caption and order'])assert.match(ui,new RegExp(marker));
});
