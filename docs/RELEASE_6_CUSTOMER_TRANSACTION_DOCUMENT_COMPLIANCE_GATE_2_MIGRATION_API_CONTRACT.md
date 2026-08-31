# Release 6 — Customer and Transaction Document Compliance

**Gate:** 2 — migration, domain and API contract  
**Date:** 14 August 2026 (Asia/Dubai)  
**Classification:** local/offline design only  
**Status:** owner-approved  
**Migration:** `090_release6_customer_transaction_document_compliance.sql` — created locally after
Gate 2 approval and deliberately not applied

**Owner decision:** Gate 2 approved on 14 August 2026 (Asia/Dubai). Approval authorizes local Gate 3
implementation and synthetic offline testing of this exact contract. Migration `090` must remain
unapplied. No packaging, deployment or external-environment action is authorized.

## Gate 1 decisions carried forward

- Sale/lease document matrices cover buyer, seller, landlord and tenant parties, for individuals and
  organizations.
- Full Administrator maintains and activates configuration directly without maker-checker.
- Manager/Director reviews ordinary evidence and cannot review their own submission; full
  Administrator may decide directly, including their own upload, with explicit audit evidence.
- Required items block only their named Deal transition; advisory items never block.
- Expiry follow-up uses the existing My Task Queue and responsible Deal agent.
- Existing Customer KYC, private Documents/Versions, Release 4 official evidence, Deal checklist,
  Tasks and audit remain authoritative.

## Existing model extension

The existing `deal_checklists` and `deal_checklist_items` remain the Deal completion authority. This
package does not create a second general checklist. It adds a party-document component beneath the
existing Deal checklist and presents both components in one UI.

`transaction_family` is resolved from the existing Deal type:

| Existing Deal type | Matrix family |
| --- | --- |
| `sale`, `off_plan`, `commercial_sale` | `sale` |
| `rental`, `commercial_rental` | `lease` |

An individual party is an active `deal_parties.contact_id`; an organization party is an active
`deal_parties.company_id`. An unpromoted `transaction_counterparty_id` cannot receive private
compliance evidence in this first slice. It is reported as `governed_party_required` until converted
through existing authority.

## Proposed additive migration 090

### 1. Stable requirement and immutable versions

`document_compliance_requirements`

- `id`, stable unique `requirement_code`, creator and creation time.

`document_compliance_requirement_versions`

- requirement/version identity and prior-version reference;
- label and meaningful business reason;
- `transaction_family`: `sale` or `lease`;
- `party_role`: `buyer`, `seller`, `landlord` or `tenant`;
- `party_kind`: `individual` or `organization`;
- `gate_code`: `before_pending_approval`, `before_approval` or `before_close_won`;
- `requirement_level`: `required` or `advisory`;
- `evidence_authority`: `generic_document` or `official_document`;
- controlled existing generic `document_type`, or exact Release 4 `official_definition_id` and
  `official_definition_version_id`, with an exclusive check;
- `review_required`;
- `expiry_mode`: `not_tracked`, `optional` or `required`;
- sorted unique `reminder_offsets_days` constrained to `0..365`;
- lifecycle `draft`, `active`, `superseded`, `retired`, effective time and actor/timestamp facts.

There is at most one active and one draft version per stable requirement. There is at most one active
rule for the exact `(transaction_family, party_role, party_kind, gate_code, evidence authority/type)`
applicability key. Activation locks the stream and supersedes its prior active version atomically.
Activated versions are immutable. Full Administrator may activate their own version directly.

The existing Release 4 definition version must be active at configuration activation. The exact
version is frozen; a later Release 4 revision requires a new compliance requirement version.

### 2. Deal checklist snapshot and requirement instances

`deal_document_compliance_snapshots`

- `id`, existing `deal_checklist_id` (one active snapshot per checklist), `deal_id`;
- Deal version/type and deterministic active-party context hash;
- resolver version, creation actor/time and optional superseded snapshot reference.

`deal_document_requirement_instances`

- snapshot, Deal checklist, Deal and exact active `deal_party_id`;
- frozen party role/kind, gate code, requirement level and label;
- exact requirement/version and evidence authority references;
- responsible Deal agent at resolution time;
- creation facts and deterministic instance fingerprint.

Instances are append-only snapshots, not mutable completion rows. A Deal-party or material Deal-type
change invalidates the current context and requires explicit re-resolution. The prior snapshot remains
historical. Re-resolution under an identical context is idempotent.

### 3. Generic evidence and review events

`document_compliance_evidence_versions`

- exact requirement instance and unique existing `document_version_id`;
- issued/received date and optional expiry;
- optional prior compliance evidence version;
- uploader, idempotency key, request fingerprint and creation time.

The associated existing Document is `restricted`, Inbound and linked to the Deal plus the governed
Contact where the party is an individual. Organization evidence remains linked to the Deal and exact
compliance instance; the first slice does not expand the generic `document_links` type set or copy
private organization details into metadata.

`document_compliance_evidence_review_events`

- one terminal `accepted`, `returned` or `rejected` event per generic evidence version;
- reason required for returned/rejected;
- reviewer/time, `admin_direct` marker and canonical request fingerprint.

Review and evidence rows are immutable. A normal reviewer cannot be the uploader. The service permits
same-actor review only when the current actor is a full Administrator and records `admin_direct=true`.

### 4. Reuse of Release 4 official evidence

`document_compliance_official_evidence_links`

- exact requirement instance and existing `official_document_evidence_versions.id`;
- context fingerprint, creator/time and a unique link fingerprint.

No second file, expiry, issuer, reference or review record is created. The compliance resolver reads
the authoritative Release 4 evidence and review state. The official evidence must belong to the same
Deal, use the frozen definition identity/version and match the current Deal context.

### 5. Existing Task provenance

`document_compliance_followup_task_links`

- unique existing Task, requirement instance and optional generic/official evidence version;
- reminder reason: `missing`, `returned`, `rejected`, `expiring` or `expired`;
- reminder offset, cycle, due date and canonical fingerprint;
- creation actor/time.

Migration 090 adds `document_compliance_follow_up` to the existing `tasks.task_type` constraint. The
Task retains existing Deal-derived Lead/Contact context and is assigned to the responsible Deal agent.
The link—not Task text—holds compliance provenance. A partial unique index permits only one open Task
per canonical requirement/case/evidence/reminder/cycle.

### 6. Audit and grants

The audit entity constraint gains `DocumentComplianceRequirement`, `DocumentComplianceSnapshot`,
`DocumentComplianceEvidence` and `DocumentComplianceFollowup`. Application grants are additive and
least-privilege: configuration tables permit controlled read/insert/update; snapshot, evidence,
review, official-link and Task-link evidence are insert/read only after creation.

No seed matrix is activated by migration. Admin must explicitly create and activate NYSA's approved
requirements, so CORE never guesses legal or operational document obligations.

## Deterministic state contract

For each frozen requirement instance, state is derived:

- no eligible evidence: `missing`;
- uploaded generic evidence awaiting required review: `pending_review`;
- accepted/current evidence: `accepted`;
- terminal review: `returned` or `rejected`;
- accepted evidence inside its next reminder window: `expiring`;
- expiry at or before evaluation time: `expired`;
- newer evidence accepted: prior evidence `superseded`;
- Deal/party context changed: `context_mismatch`;
- unpromoted transaction counterparty: `governed_party_required`.

For `review_required=false`, current generic evidence becomes accepted after successful immutable
submission. Official evidence always follows its Release 4 definition and review contract. Expiry is
required, optional or prohibited according to the frozen rule. Dates are evaluated in Asia/Dubai;
reminder offsets use calendar days.

Only `missing`, `pending_review`, `returned`, `rejected`, `expired`, `context_mismatch` or
`governed_party_required` on a **required** instance block its exact `gate_code`. `expiring` remains
accepted until expiry. Advisory instances never block.

## Proposed API surface

### Full Administrator and Admin Assistant configuration

- `GET /api/admin/document-compliance/requirements`
- `POST /api/admin/document-compliance/requirements`
- `POST /api/admin/document-compliance/requirement-versions/:versionId/activate`
- `POST /api/admin/document-compliance/requirement-versions/:versionId/retire`
- `POST /api/admin/document-compliance/requirements/preview`

Full Administrator may create, activate and retire directly. Admin Assistant may read and create a
draft revision but cannot activate or retire. Preview is read-only and accepts synthetic applicability
facts; it never reads or returns a private file.

### Scoped customer/Deal workflow

- `POST /api/crm/deals/:dealId/document-compliance/resolve`
- `GET /api/crm/deals/:dealId/document-compliance`
- `GET /api/crm/customers/:customerId/document-compliance`
- `POST /api/crm/document-compliance/instances/:instanceId/evidence`
- `POST /api/crm/document-compliance/instances/:instanceId/official-evidence-link`
- `GET /api/crm/document-compliance/evidence/:evidenceId`
- `POST /api/crm/document-compliance/evidence/:evidenceId/review`
- `POST /api/crm/document-compliance/instances/:instanceId/follow-up-task`
- `GET /api/crm/deals/:dealId/document-compliance/gate/:gateCode`

Existing `/api/crm/document-versions/:versionId/view` and `/download` remain the only file read paths.
They must enforce the stricter resolved compliance scope before returning a restricted compliance
document. No response exposes storage keys, raw file data, complete identity references, contact
channels, private organization/authority fields or unrestricted configuration payloads.

## Atomic operations and concurrency

### Resolve

1. Authorize Deal scope and lock the Deal/checklist.
2. Read Deal type and active governed parties.
3. Canonicalize the context and take a transaction advisory lock.
4. Select exact active rules at one database time.
5. Return an existing identical snapshot or insert snapshot plus instances atomically.

### Generic evidence submission

1. Validate case scope, current instance, allowed PDF type/size/hash, dates and idempotency key.
2. Save through the existing private-file helper.
3. Lock the canonical submission fingerprint in one transaction.
4. Recheck context/rule, create or revise existing Document/Version, link it, insert compliance
   evidence and audit.
5. Commit or remove the newly stored file on failure.

Identical retry returns the existing evidence; reused idempotency with different facts returns 409.

### Review and follow-up

Review locks the evidence and permits one terminal event. Identical retry returns the existing event;
conflict returns 409. Task creation locks its canonical requirement/reminder/cycle key and returns an
existing open Task under retry or concurrency. Completing a Task never accepts evidence.

## Permission contract

| Action | Full Admin | Admin Assistant | Agent | Manager | Director |
| --- | --- | --- | --- | --- | --- |
| Read/draft configuration | Yes | Yes | No | No | No |
| Activate/retire configuration | Yes, direct | No | No | No | No |
| Read scoped checklist | Yes | Existing case scope | Own/scoped | Managed-team | Organization scope |
| Resolve checklist | Yes | Existing writable scope | Own/scoped | Managed-team | Organization scope |
| Upload/replace evidence | Yes | Existing writable scope | Own/scoped | Managed-team | Organization scope |
| Review ordinary evidence | Yes, direct | No | No | Managed-team, not own | Yes, not own |
| Create follow-up Task | Yes | Existing writable scope | Own/scoped | Managed-team | Organization scope |
| View/download file | Exact existing case + compliance scope only | Same | Same | Same | Same |

Every endpoint rechecks authority server-side. Full Administrator configuration authority does not
grant Admin Assistant organization-wide file access. Director navigation does not bypass file scope.

## Existing Deal transition integration

The existing transition service may call only the matching gate:

- transition to `pending_approval` → `before_pending_approval`;
- transition to `approved` → `before_approval`;
- transition to `closed_won` → `before_close_won`.

The gate returns rule/instance identifiers, safe labels, state and blocking reason. It never changes
Deal status. Transition integration must be explicit, tested and atomic with the existing optimistic
Deal version check. No Lead, Inventory, KYC or Release 4 transition is silently modified.

## Gate 3 implementation acceptance suite

At minimum, focused tests must prove:

1. migration 090 is additive and has no activated seed obligations;
2. exact sale/lease and party role/kind resolution;
3. unsupported/unpromoted counterparty handling;
4. Admin direct activation and Admin Assistant denial;
5. one active/one draft stream and overlap rejection;
6. immutable versions and historical snapshots;
7. deterministic resolver retry/concurrency;
8. existing Deal checklist remains authoritative and one combined UI is used;
9. generic evidence atomic write/cleanup/idempotency;
10. Release 4 official evidence is linked, not copied;
11. replacement/supersession preserves all history;
12. normal self-review denial and explicit full-Admin direct decision;
13. returned/rejected reason enforcement;
14. required/optional/not-tracked expiry validation;
15. 30/14/7/0 default preview and configured calendar-day offsets;
16. accepted → expiring → expired derived states;
17. required exact-gate blocking and advisory non-blocking;
18. context mismatch after Deal/party change;
19. one existing Task per reminder/cycle under retry/concurrency;
20. Task completion does not satisfy evidence;
21. responsible-agent assignment and Manager overdue scope;
22. customer view cannot expose another Deal party;
23. restricted file scope and audited view/download;
24. safe API/Task/audit payloads with no private content or storage key; and
25. no outbound network, Property Finder or external-environment capability.

The complete local repository test suite must also remain green.

## Gate 2 approval boundary

Approval authorizes local Gate 3 implementation of this exact contract, including creation of
migration 090, deterministic domain/API code, Admin maintenance, customer/Deal checklist UI, My Task
Queue integration and synthetic offline tests. Migration 090 must remain unapplied.

Approval does not authorize deployment, packaging, migration application, external connections,
credentials, real private records, Property Finder, or any deferred Release 6 package.
