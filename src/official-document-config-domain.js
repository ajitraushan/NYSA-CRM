export const OFFICIAL_DOCUMENT_CONFIG_POLICY_VERSION = 'r4-official-document-config-v1';

const WORKFLOW_STEPS = [
  { stepCode: 'external_listing', label: 'Prepare external listing' },
  { stepCode: 'buyer_representation', label: 'Confirm buyer representation' },
  { stepCode: 'sale_agreement', label: 'Complete sale agreement' },
  { stepCode: 'transfer', label: 'Prepare property transfer' }
];
const ACCEPTED_STATUSES = new Set(['official_captured', 'external_verified']);
const REQUIREMENT_LEVELS = new Set(['required', 'advisory']);
const clean = value => String(value ?? '').trim();
const stable = value => /^[a-z][a-z0-9_]*$/.test(clean(value));
const instant = value => {
  const normalized = clean(value);
  return normalized && Number.isFinite(Date.parse(normalized)) ? normalized : null;
};

export function predefinedWorkflowSteps() {
  return structuredClone(WORKFLOW_STEPS);
}

export function createOfficialDocumentTypeDraft(input = {}, existing = []) {
  const errors = [];
  const code = clean(input.code);
  const createdAt = instant(input.now);
  if (!stable(code)) errors.push('Document code must be a stable lowercase code');
  if (clean(input.label).length < 3) errors.push('Document name is required');
  if (clean(input.issuer).length < 3) errors.push('Expected issuer is required');
  if (!ACCEPTED_STATUSES.has(input.acceptedStatus)) errors.push('Select a supported verification status');
  if (!clean(input.createdByRef)) errors.push('Administrator reference is required');
  if (!createdAt) errors.push('now must be an ISO timestamp');
  if (existing.some(item => item.code === code && item.status !== 'retired')) errors.push('Document code already exists');
  return {
    valid: errors.length === 0,
    errors,
    draft: errors.length ? null : {
      policyVersion: OFFICIAL_DOCUMENT_CONFIG_POLICY_VERSION,
      code,
      label: clean(input.label),
      issuer: clean(input.issuer),
      acceptedStatus: input.acceptedStatus,
      expiryTracked: input.expiryTracked === true,
      version: 1,
      status: 'draft',
      createdByRef: clean(input.createdByRef),
      createdAt,
      immutable: true
    }
  };
}

export function activateOfficialDocumentType({ draft, approvedByRef, now }) {
  if (!draft?.immutable || draft.status !== 'draft') throw new Error('Only an immutable document draft can be activated');
  const approvedAt = instant(now);
  if (!approvedAt) throw new Error('now must be an ISO timestamp');
  if (!clean(approvedByRef)) throw new Error('Approver reference is required');
  return { ...structuredClone(draft), status: 'active', approvedByRef: clean(approvedByRef), approvedAt };
}

export function createStepDocumentRuleDraft(input = {}, activeDocuments = [], existingRules = []) {
  const errors = [];
  const step = WORKFLOW_STEPS.find(item => item.stepCode === input.stepCode);
  const document = activeDocuments.find(item => item.code === input.documentType && item.status === 'active');
  const createdAt = instant(input.now);
  if (!step) errors.push('Select a predefined workflow step');
  if (!document) errors.push('Select an active document type');
  if (!REQUIREMENT_LEVELS.has(input.level)) errors.push('Select Required or Advisory');
  if (clean(input.reason).length < 5) errors.push('Business reason is required');
  if (!clean(input.createdByRef)) errors.push('Administrator reference is required');
  if (!createdAt) errors.push('now must be an ISO timestamp');
  if (existingRules.some(item => item.stepCode === input.stepCode && item.documentType === input.documentType && item.status !== 'retired')) errors.push('This document is already associated with the workflow step');
  return {
    valid: errors.length === 0,
    errors,
    draft: errors.length ? null : {
      policyVersion: OFFICIAL_DOCUMENT_CONFIG_POLICY_VERSION,
      ruleRef: `${input.stepCode}-${input.documentType}-v1`,
      stepCode: step?.stepCode,
      stepLabel: step?.label,
      documentType: document?.code,
      documentLabel: document?.label,
      level: input.level,
      reason: clean(input.reason),
      acceptedStatuses: document ? [document.acceptedStatus] : [],
      version: 1,
      status: 'draft',
      createdByRef: clean(input.createdByRef),
      createdAt,
      immutable: true
    }
  };
}

export function activateStepDocumentRule({ draft, activeDocuments = [], approvedByRef, now }) {
  if (!draft?.immutable || draft.status !== 'draft') throw new Error('Only an immutable association draft can be activated');
  if (!WORKFLOW_STEPS.some(item => item.stepCode === draft.stepCode)) throw new Error('Workflow step is not predefined');
  if (!activeDocuments.some(item => item.code === draft.documentType && item.status === 'active')) throw new Error('Associated document must remain active');
  const approvedAt = instant(now);
  if (!approvedAt) throw new Error('now must be an ISO timestamp');
  if (!clean(approvedByRef)) throw new Error('Approver reference is required');
  return { ...structuredClone(draft), status: 'active', approvedByRef: clean(approvedByRef), approvedAt };
}
