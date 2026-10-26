# NYSA CORE Release 4 — Official Document Evidence Gate 2 Migration and API Contract

**Contract date:** 13 August 2026 (Asia/Dubai)  
**Status:** Gate 2 approved and implemented locally — migration not applied  
**Depends on:** Approved Official Document Evidence Gate 1 integration boundary  
**Proposed future migration:** `086_release4_official_document_evidence.sql`  
**Reviewable SQL:** `docs/schema-proposals/release4_official_document_evidence.sql.proposed`

**Gate 2 approval:** Approved by owner on 13 August 2026 (Asia/Dubai). Local Gate 3 implementation
was completed against this contract; migration 086 remains unapplied.

**Gate 3 verification:** focused official-document integration, CRM UI and upstream coverage **45/45 passed**;
complete repository regression **802/802 passed**.

## Gate 2 decisions requested

Approve the exact additive persistence, API, permission, idempotency and verification contract below.
Material backend or CRM UI implementation starts only after approval.

## Persistence contract

### Configuration records

`official_document_definitions` gives each official/external document type one stable configuration
identity. It is configuration only and is not a second CRM Document master.

`official_document_definition_versions` stores immutable draft and accepted versions:

- stable definition reference and positive version number;
- label and expected issuer description;
- accepted evidence status: `official_captured` or `external_verified`;
- whether expiry is tracked;
- lifecycle: `draft`, `active`, `superseded`, `retired`;
- creator, approver and timestamps; and
- prior-version reference.

Only one active version and one open draft may exist per definition. An active version is never
edited. Activation supersedes the prior active version in the same transaction. A full Administrator
may draft, activate and retire configuration without a second approval.

`official_document_step_rule_versions` associates one exact active definition version with one
predefined workflow step:

- `external_listing`, `buyer_representation`, `sale_agreement`, or `transfer`;
- `required` or `advisory`;
- meaningful business reason;
- lifecycle, version, creator/approver facts and prior-version reference.

Only one active rule and one open draft may exist for a `(step_code, definition_id)` pair. Admin
cannot create workflow steps through these tables.

### Evidence records

The existing `documents` and `document_versions` tables remain authoritative for the private file,
storage key, file hash, immutable version and access classification. The integration creates an
Inbound, `private` or `restricted`, PDF Document/Version through the existing private-storage helper.

`official_document_evidence_versions` adds only the governed evidence meaning:

- exact `document_version_id`, unique and immutable;
- exact active definition version used at submission;
- official document and issuer references;
- issue/execution time and optional expiry;
- exact `listing_id` and/or `deal_id`, plus derived Opportunity/Lead/Contact references where a Deal
  provides them;
- deterministic `context_hash` and canonical request fingerprint;
- optional prior evidence version; and
- uploader and submission time.

At least one Inventory or Deal reference is required. When both are supplied, the Deal must point to
that Inventory. The `document_links` table receives matching `Listing`, `Deal`, `Opportunity`, `Lead`
and `Contact` links only where those authoritative relations exist. No private party fields are
copied into evidence metadata.

`official_document_evidence_review_events` is append-only. Exactly one terminal decision may be
recorded for an evidence version: `verified`, `returned`, or `rejected`. A verified decision derives
the definition's `official_captured` or `external_verified` outcome. Returned/rejected decisions
require a meaningful reason. The reviewer must differ from the uploader.

`official_document_followup_task_links` links one existing `tasks` record to the exact active step
rule, case and follow-up reason. It supplies provenance and idempotency only; it is not a work queue.

### Derived evidence state

State is derived rather than overwritten:

- no review event: `pending_verification`;
- verified event and current/unexpired/correct case: accepted status;
- verified but expired: `expired`;
- returned or rejected event: that decision;
- newer submitted evidence references the prior version: prior version is `superseded` for current
  step evaluation but remains readable historically;
- different context hash or case: `context_mismatch` for that step.

## Atomic file and evidence submission

The upload endpoint accepts the PDF and official evidence metadata together. It:

1. validates role, case scope, definition version, PDF type/size/hash inputs and business facts;
2. stores the private file using the existing storage helper;
3. begins one database transaction;
4. takes a transaction advisory lock on the canonical submission fingerprint;
5. revalidates the active definition and Inventory/Deal relationship;
6. creates or revises the existing Document and immutable Document Version;
7. creates matching existing `document_links` and one evidence version;
8. writes audit records; and
9. commits, or removes the newly stored file if the transaction fails.

An identical retry returns the existing evidence with HTTP 200. A new successful submission returns
HTTP 201. A reused idempotency key with different canonical facts returns HTTP 409.

## Proposed API surface

### Administrator configuration

- `GET /api/admin/official-document-definitions`
- `POST /api/admin/official-document-definitions`
- `POST /api/admin/official-document-definition-versions/:versionId/activate`
- `POST /api/admin/official-document-definition-versions/:versionId/retire`
- `GET /api/admin/official-document-step-rules`
- `POST /api/admin/official-document-step-rules`
- `POST /api/admin/official-document-step-rule-versions/:versionId/activate`
- `POST /api/admin/official-document-step-rule-versions/:versionId/retire`

Create endpoints create immutable drafts/revisions. Activation/retirement endpoints require a full
Administrator, who may act on their own configuration version without further approval. Admin
Assistant may read and draft but cannot activate or retire configuration.

### Agent and reviewer workflow

- `GET /api/crm/listings/:listingId/official-document-requirements?stepCode=external_listing`
- `GET /api/crm/deals/:dealId/official-document-requirements?stepCode=...`
- `POST /api/crm/official-document-evidence`
- `GET /api/crm/official-document-evidence/:evidenceId`
- `GET /api/crm/document-versions/:versionId/official-evidence`
- `POST /api/crm/official-document-evidence/:evidenceId/review`
- `POST /api/crm/official-document-requirements/:ruleVersionId/follow-up-task`

Responses expose safe business references, labels, state, dates, hashes and role-appropriate actor
display names. They never expose storage keys, raw file content, contact channels, owner/authority
details or configuration payloads not required by the screen.

Existing `/api/crm/document-versions/:versionId/view` and `/download` endpoints remain the only file
read paths and continue to enforce their current private/restricted access and auditing.

## Permission matrix

| Action | Full Administrator | Admin Assistant | Scoped Agent | Scoped Manager/Director | Viewer/external role |
| --- | --- | --- | --- | --- | --- |
| Read active requirements in an accessible case | Yes | Yes | Yes | Yes | No |
| Draft definition/rule | Yes | Yes | No | No | No |
| Activate/retire definition/rule | Yes, including own version | No | No | No | No |
| Upload evidence | Yes when case-writable | Yes when case-writable | Yes when case-writable | Yes when case-writable | No |
| Read evidence/file | Existing case and document scope | Existing case and document scope | Existing case and document scope | Existing case and document scope | No |
| Verify/return/reject | Yes, not own upload | No | No | Yes within managed case, not own upload | No |
| Create follow-up Task | Yes within case | Yes within case | Case owner/writer | Yes within managed case | No |

Every endpoint rechecks server-side scope. A Deal operation resolves through its Opportunity and Lead;
an Inventory-only operation uses existing Inventory read/write authority. UI hiding is never treated
as permission.

## Workflow-step evaluation

For each active rule, the service selects only evidence that:

- uses that rule's exact document definition identity;
- is linked to the exact requested Inventory/Deal case and context hash;
- has a verified review event;
- produces the rule's accepted status;
- has not expired at evaluation time; and
- has not been replaced by a newer submitted evidence version.

Missing, pending, returned, rejected, expired, superseded or context-mismatched evidence blocks a
`required` rule only. `advisory` rules remain visible and never block. The result is advisory to the
existing workflow transition unless that transition explicitly consumes this named step gate in a
later owner-approved slice; this package does not silently add blockers to unrelated transitions.

## Task contract

Follow-up reasons are controlled: `missing`, `returned`, `rejected`, or `expiring`. The service derives
the subject, details, priority, assignee and due time. No recipient/contact value or private document
content appears in the Task.

The canonical Task key is `(rule_version_id, listing_id, deal_id, context_hash, reason, open-cycle)`.
An advisory lock plus unique fingerprint ensures identical or concurrent requests return one Task.
Completing/cancelling the Task closes that cycle; a later genuine recurrence may create a new cycle.
Task completion does not alter evidence state or satisfy a requirement.

## Concurrency, idempotency and rollback

- Definition/rule draft and activation lock their stable stream.
- Partial unique indexes enforce one active and one draft per stream.
- Evidence submission locks its SHA-256 canonical fingerprint and has a unique idempotency key plus
  request fingerprint.
- Review locks the evidence version and permits one terminal decision only.
- Identical review retry returns the recorded decision; a conflicting decision returns HTTP 409.
- Evidence, Document/Version links and audit records commit together.
- Review and audit records commit together.
- Task link, Task and audit records commit together.
- Any failure produces no partial database state; newly stored file content is removed when upload
  persistence fails.

## Audit contract

Add `OfficialDocumentDefinition`, `OfficialDocumentStepRule`, `OfficialDocumentEvidence`, and
`OfficialDocumentFollowup` to the existing audit entity constraint. Minimum actions:

- `draft_created`, `revision_created`, `activated`, `superseded`, `retired`;
- `evidence_submitted`, `evidence_verified`, `evidence_returned`, `evidence_rejected`;
- `followup_task_created` and `followup_task_reused`.

Audit details include safe stable references, version numbers, step, decision, reason, context hash,
file SHA-256 and linked Inventory/Deal business references where available. They exclude storage key,
file content, contact details, private party facts and official-document contents.

## Offline acceptance tests

Focused coverage must prove at least:

1. Admin Assistant can draft but cannot activate or retire configuration.
2. A full Administrator can activate or retire their own definition or rule version without further approval.
3. Activation atomically supersedes the prior active version.
4. Only one active and one draft version exist per configuration stream under concurrency.
5. Arbitrary workflow step codes are rejected.
6. Inactive definitions and rules never enter agent advice.
7. Upload rejects non-PDF, invalid hash, future issue time, invalid expiry and missing case.
8. Both Inventory and Deal links must describe the same authoritative case.
9. Upload creates existing Document, immutable Document Version, links and evidence atomically.
10. Failed persistence removes the newly stored private file and leaves no partial database rows.
11. Identical and concurrent upload retries produce one evidence version.
12. Uploader cannot review their own evidence.
13. Exactly one terminal review event is accepted under retry or concurrency.
14. Expired evidence cannot be verified and verified evidence later evaluates as expired.
15. Returned/rejected evidence requires a meaningful reason.
16. Correction appends a new version and preserves the prior file/evidence/review history.
17. Required missing/pending/rejected/expired/wrong-case evidence blocks only its named step.
18. Advisory evidence never blocks.
19. One follow-up reason/case/cycle produces one existing CRM Task under retry/concurrency.
20. Completing a Task neither verifies evidence nor satisfies a requirement.
21. Unauthorized and out-of-scope API calls return 403 without information leakage.
22. File view/download continues through existing audited private-document routes only.
23. API and audit output contains no storage key, private contact, owner or authority information.
24. No Inventory, Opportunity, Offer, Booking, Reservation or Deal state changes automatically.
25. No official document is generated, edited, submitted or transmitted externally.
26. Focused tests and the complete local repository suite pass.

## Explicit exclusions

- Property Finder, portal publication/reconciliation or any provider connector.
- DLD form generation, mapping, legal wording, signature or Dubai REST submission.
- External delivery, messaging, email, calendar or e-signature integration.
- New workflow-step creation or automatic workflow transitions.
- Customer, owner, contact, representative or authority maintenance.
- Legacy document inference, classification, verification or backfill.
- Migration application, packaging, deployment, restart or external-environment change.

## Gate 2 approval

Approval authorizes local implementation against this contract only. It does not authorize applying
migration 086 or accessing CRM Test, Production, R2, cPanel or any external service.
