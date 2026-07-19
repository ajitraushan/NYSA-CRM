import test from 'node:test';
import assert from 'node:assert/strict';
import { listingWorkflowTransition,validateListingWorkflowAction,listingWorkflowQueue } from '../src/listing-workflow-domain.js';

test('listing workflow allows only governed state transitions',()=>{
  assert.equal(listingWorkflowTransition('draft','submit'),'in_review');
  assert.equal(listingWorkflowTransition('in_review','approve'),'approved');
  assert.equal(listingWorkflowTransition('in_review','request_changes'),'changes_requested');
  assert.equal(listingWorkflowTransition('changes_requested','submit'),'in_review');
  assert.equal(listingWorkflowTransition('approved','submit'),null);
});

test('listing workflow enforces ownership reviewer authority and reasons',()=>{
  assert.match(validateListingWorkflowAction({current:'draft',action:'submit'}),/Only the Listing Executive/);
  assert.equal(validateListingWorkflowAction({current:'draft',action:'submit',isOwner:true}),null);
  assert.match(validateListingWorkflowAction({current:'in_review',action:'approve'}),/Manager or Administrator/);
  assert.match(validateListingWorkflowAction({current:'in_review',action:'request_changes',canReview:true}),/reason is required/);
  assert.equal(validateListingWorkflowAction({current:'in_review',action:'request_changes',canReview:true,reason:'Correct the price evidence'}),null);
});

test('listing executive queues are deterministic',()=>{
  const now=new Date('2026-07-20T12:00:00Z');
  assert.equal(listingWorkflowQueue({workflowStatus:'draft'},now),'incomplete_drafts');
  assert.equal(listingWorkflowQueue({workflowStatus:'in_review'},now),'approval_queue');
  assert.equal(listingWorkflowQueue({workflowStatus:'approved',status:'Closed'},now),'closed');
  assert.equal(listingWorkflowQueue({workflowStatus:'changes_requested'},now),'changes_requested');
  assert.equal(listingWorkflowQueue({workflowStatus:'approved',availabilityConfirmedAt:'2026-07-01T00:00:00Z'},now),'availability_refresh');
  assert.equal(listingWorkflowQueue({workflowStatus:'approved',availabilityConfirmedAt:'2026-07-20T00:00:00Z',permitExpiresAt:'2026-07-25T00:00:00Z'},now),'permit_verification_expiry');
  assert.equal(listingWorkflowQueue({workflowStatus:'approved',availabilityConfirmedAt:'2026-07-20T00:00:00Z',approvedMediaCount:0},now),'media_incomplete');
});

test('browser and routes expose the dedicated Listing Executive lifecycle',async()=>{
  const {readFile}=await import('node:fs/promises');
  const ui=await readFile(new URL('../public/app.js',import.meta.url),'utf8'),routes=await readFile(new URL('../src/routes/listings.js',import.meta.url),'utf8'),migration=await readFile(new URL('../src/migrations/029_listing_executive_workflow.sql',import.meta.url),'utf8');
  assert.match(ui,/listing_agent:'Listing Executive'/);
  assert.match(ui,/renderListingExecutiveDashboard/);
  assert.match(ui,/Submit for review/);
  assert.match(routes,/\/listings-workspace/);
  assert.match(routes,/`workflow_\$\{action\}`/);
  assert.match(routes,/b\.team_id=ANY/);
  assert.match(routes,/Manual listing drafts may be created by a Listing Executive/);
  assert.match(migration,/workflow_status/);
});
