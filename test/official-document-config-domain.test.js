import test from 'node:test';
import assert from 'node:assert/strict';
import { predefinedWorkflowSteps, createOfficialDocumentTypeDraft, activateOfficialDocumentType, createStepDocumentRuleDraft, activateStepDocumentRule } from '../src/official-document-config-domain.js';

const now = '2026-08-09T08:00:00.000Z';
const admin = 'ADMIN-SYN-1';

test('workflow steps are predefined and cannot be supplied by Admin', () => {
  assert.deepEqual(predefinedWorkflowSteps().map(item => item.stepCode), ['external_listing', 'buyer_representation', 'sale_agreement', 'transfer']);
  const activeDocument = { code: 'developer_clearance_letter', label: 'Developer Clearance Letter', acceptedStatus: 'external_verified', status: 'active' };
  const result = createStepDocumentRuleDraft({ stepCode: 'admin_invented_step', documentType: activeDocument.code, level: 'required', reason: 'Required before completion', createdByRef: admin, now }, [activeDocument]);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /predefined workflow step/i);
});

test('Admin can draft and activate a new official document definition', () => {
  const result = createOfficialDocumentTypeDraft({ code: 'developer_clearance_letter', label: 'Developer Clearance Letter', issuer: 'Property Developer', acceptedStatus: 'external_verified', expiryTracked: true, createdByRef: admin, now }, []);
  assert.equal(result.valid, true);
  assert.equal(result.draft.status, 'draft');
  assert.equal(result.draft.immutable, true);
  const active = activateOfficialDocumentType({ draft: result.draft, approvedByRef: admin, now });
  assert.equal(active.status, 'active');
  assert.equal(active.expiryTracked, true);
});

test('duplicate document codes are rejected', () => {
  const existing = [{ code: 'developer_clearance_letter', status: 'active' }];
  const result = createOfficialDocumentTypeDraft({ code: 'developer_clearance_letter', label: 'Developer Clearance Letter', issuer: 'Property Developer', acceptedStatus: 'external_verified', createdByRef: admin, now }, existing);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /already exists/i);
});

test('Admin can associate an active document with a predefined step through draft and activation', () => {
  const activeDocument = { code: 'developer_clearance_letter', label: 'Developer Clearance Letter', acceptedStatus: 'external_verified', status: 'active' };
  const result = createStepDocumentRuleDraft({ stepCode: 'transfer', documentType: activeDocument.code, level: 'required', reason: 'Obtain developer clearance before transfer', createdByRef: admin, now }, [activeDocument], []);
  assert.equal(result.valid, true);
  assert.equal(result.draft.stepLabel, 'Prepare property transfer');
  assert.deepEqual(result.draft.acceptedStatuses, ['external_verified']);
  const active = activateStepDocumentRule({ draft: result.draft, activeDocuments: [activeDocument], approvedByRef: admin, now });
  assert.equal(active.status, 'active');
});

test('inactive documents and duplicate associations cannot enter the active workflow advice', () => {
  const inactive = { code: 'developer_clearance_letter', label: 'Developer Clearance Letter', acceptedStatus: 'external_verified', status: 'draft' };
  assert.equal(createStepDocumentRuleDraft({ stepCode: 'transfer', documentType: inactive.code, level: 'required', reason: 'Obtain developer clearance', createdByRef: admin, now }, [inactive], []).valid, false);
  const active = { ...inactive, status: 'active' };
  const duplicate = [{ stepCode: 'transfer', documentType: active.code, status: 'active' }];
  const result = createStepDocumentRuleDraft({ stepCode: 'transfer', documentType: active.code, level: 'required', reason: 'Obtain developer clearance', createdByRef: admin, now }, [active], duplicate);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /already associated/i);
});
