import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mediaApprovalPlan,normalizeMediaGovernance,mediaRightsAreCurrent,validateMediaBatch,validateMediaReview} from '../src/media-governance.js';

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

test('property media names a maintained manager and otherwise auto approves',()=>{
  assert.deepEqual(mediaApprovalPlan({managerId:'manager-1'},'uploader-1'),{approvalStatus:'pending',approvedBy:null,approvedAt:null,automatic:false});
  const automatic=mediaApprovalPlan({managerId:null},'uploader-1',new Date('2026-07-20T12:00:00Z'));
  assert.equal(automatic.approvalStatus,'approved');
  assert.equal(automatic.approvedBy,'uploader-1');
  assert.equal(automatic.automatic,true);
  assert.equal(automatic.approvedAt.toISOString(),'2026-07-20T12:00:00.000Z');
});

test('property photos are validated as one bounded duplicate-free batch',()=>{
  assert.match(validateMediaBatch([]),/at least one/);
  assert.match(validateMediaBatch(Array.from({length:6},(_,i)=>({buffer:Buffer.alloc(1),fileHash:String(i)}))),/no more than 5/);
  assert.match(validateMediaBatch([{buffer:Buffer.alloc(1),fileHash:'same'},{buffer:Buffer.alloc(1),fileHash:'same'}]),/same file/);
  assert.match(validateMediaBatch([{buffer:Buffer.alloc(11),fileHash:'a'}],{maxFiles:5,maxTotalBytes:10}),/exceeds/);
  assert.equal(validateMediaBatch([{buffer:Buffer.alloc(1),fileHash:'a'},{buffer:Buffer.alloc(1),fileHash:'b'}]),null);
});

test('property media routes govern duplicates rights cover ordering and review',()=>{
  const routes=readFileSync(new URL('../src/routes/files-proposals.js',import.meta.url),'utf8');
  const domain=readFileSync(new URL('../src/media-governance.js',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const migration=readFileSync(new URL('../src/migrations/030_property_media_governance.sql',import.meta.url),'utf8');
  const reconciliation=readFileSync(new URL('../src/migrations/031_orphaned_property_media_approval.sql',import.meta.url),'utf8');
  for(const marker of ['usage_rights_confirmed','rights_basis','rights_expires_at','is_cover','rejection_reason'])assert.match(migration,new RegExp(marker));
  for(const marker of ['Duplicate media file','media_metadata_changed','cover_selected','automatic_no_manager','responsibleMediaReviewer'])assert.match(routes,new RegExp(marker));
  for(const marker of ["/crm/listings/:id/media/batch",'batch_uploaded','validateMediaBatch'])assert.match(routes,new RegExp(marker));
  assert.match(domain,/A rejection reason is required/);
  assert.match(reconciliation,/auto_approved_no_responsible_manager/);
  assert.match(reconciliation,/manager\.id IS NULL/);
  for(const marker of ['Media use rights','Set as cover','Reject with reason','Save caption and order','multiple accept','media-file-review','Send selected photos'])assert.match(ui,new RegExp(marker));
});
