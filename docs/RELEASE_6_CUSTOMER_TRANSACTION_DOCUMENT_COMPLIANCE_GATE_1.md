# Release 6 — Customer and Transaction Document Compliance

**Gate:** 1 — functional scope and authority boundary  
**Date:** 14 August 2026 (Asia/Dubai)  
**Classification:** local/offline design only  
**Status:** owner-approved  
**Proposed migration:** `090` — not created and not applied

**Owner decision:** Gate 1 approved on 14 August 2026 (Asia/Dubai). Approval authorizes Gate 2
schema/API contract design only. It does not authorize material implementation, migration creation or
application, packaging, deployment or any external-environment action.

## Purpose

Provide one governed document-compliance checklist for each customer party and transaction without
rebuilding the existing KYC, Documents, official-document evidence or Task capabilities. The package
will tell an authorized user which documents apply, which are mandatory or advisory, whether current
evidence is missing/pending/accepted/returned/rejected/expiring/expired, and what action is due.

The first slice covers buyer, seller, landlord and tenant parties for sales and leasing. It supports
individual and organization parties. It remains entirely inside CORE and makes no external identity,
government, e-signature, OCR, storage-provider or accounting-system connection.

## Existing authorities retained — no duplication

| Concern | Existing authority retained |
| --- | --- |
| Customer identity summary | Customer KYC status, masked identity reference and Manager KYC review |
| Private file and immutable version | Existing `documents`, `document_versions`, private storage helper and view/download audit |
| Official workflow evidence | Release 4 official-document definitions, step rules, evidence versions and review events |
| Transaction and parties | Existing Deal, Opportunity, Deal Party and governed organization/person references |
| Work queue | Existing Tasks and **My Task Queue** |
| Roles and scope | Existing Administrator, Admin Assistant, Agent, Manager and Director authorities |
| Audit | Existing append-only audit log and immutable evidence history |
| Finance | Existing accounting system remains authoritative; no invoice/accounting document workflow is added |

Release 4 remains authoritative for official documents attached to the named `external_listing`,
`buyer_representation`, `sale_agreement` and `transfer` gates. Release 6 consumes those results when a
matrix requirement points to an official definition; it does not create parallel official evidence.

## Proposed functional workflow

### 1. Administrator maintains the matrix directly

1. Full Administrator creates versioned document requirements by business line (`sale` or `lease`),
   party role (`buyer`, `seller`, `landlord`, `tenant`), party kind (`individual` or `organization`)
   and controlled transaction stage.
2. Each requirement identifies an existing generic document type or an existing Release 4 official
   document definition. It states `required` or `advisory`, expiry behavior, review requirement,
   reminder schedule and business reason.
3. Full Administrator may draft, activate, supersede or retire the configuration directly. Admin
   activity requires no maker-checker approval. Admin Assistant may read and prepare a draft but may
   not activate or retire it.
4. Activation creates an immutable effective-dated version. Existing accepted transaction snapshots
   do not silently change when a later matrix version is activated.
5. CORE rejects overlapping active applicability, contradictory rules, unsupported roles/stages and
   requirements that cannot resolve to an existing document authority.

### 2. Resolve one checklist for the actual case

1. When a customer party is linked to a Deal, CORE resolves the exact matrix version from business
   line, party role and party kind.
2. The Deal shows one combined checklist grouped by party and transaction stage. A customer view shows
   only that customer's applicable records; it does not expose another party's private documents.
3. Current state is derived from immutable evidence and review history. Completing a Task never marks
   a document accepted.
4. A `required` item blocks only its explicitly configured transaction stage. An `advisory` item is
   visible but never blocks. No rule silently changes existing Lead, Inventory or Deal transitions.
5. The checklist records the exact matrix and evidence versions used so a later rule change cannot
   rewrite history.

### 3. Capture, replace and review evidence

1. An authorized case user uploads through the existing private Document/Version path. Evidence is
   linked to the exact customer party and Deal; it is never copied into Task text or analytics.
2. A replacement creates a new immutable version linked to the prior version. The earlier file,
   decision and audit history remain intact.
3. Where review is configured, the responsible Manager or Director may accept, return or reject the
   submitted evidence within existing case scope. The uploader cannot approve their own submission.
4. A full Administrator may make a direct compliance decision, including on an Administrator upload,
   without further approval. The action and same-actor decision are explicitly identified in audit.
5. Return/rejection requires a meaningful non-sensitive reason. Approval never asserts external
   authenticity unless the existing Release 4 definition specifically requires `external_verified`.
6. Agents can see checklist state and their scoped files; they cannot alter configuration or approve
   their own evidence. Admin Assistant cannot approve evidence.

### 4. Expiry and renewal follow-up

1. Expiry is derived from the evidence expiry date and the active frozen reminder policy.
2. The proposed default reminder points are 30, 14 and 7 calendar days before expiry and on expiry.
   Full Administrator may configure a controlled set of reminder offsets per requirement.
3. CORE creates at most one open existing CRM Task per requirement, case, party, evidence version,
   reminder point and cycle. Retry or concurrent evaluation returns the same Task.
4. The Task is assigned to the responsible Deal agent. If overdue, it is visible to the maintained
   reporting Manager. The Task contains only safe references, document label, state and due date—no
   contact channel, identity number, file content, storage key or private authority detail.
5. Task completion records follow-up work only. The requirement remains unsatisfied until accepted
   current evidence exists.

### 5. Restricted access and operational views

- Full Administrator: configuration and authorized case document access; direct Admin decisions.
- Admin Assistant: configuration draft/read and existing scoped case access; no activation or review.
- Agent: own/scoped customer and Deal checklist, upload and replacement; no approval.
- Manager: managed-team checklist and evidence review; no unrestricted organization-wide access.
- Director: authorized organization oversight and drill-down; no configuration editing unless the
  user separately holds full Administrator authority.
- External/viewer roles: no document or compliance access.

Every read, view, download, upload, review and Task endpoint must enforce server-side scope. Navigation
hiding is not a security boundary. Summary views expose status and safe business references only.

## Proposed local implementation boundary

After Gate 1 approval, Gate 2 will define additive migration `090`, deterministic domain contracts,
authenticated APIs, Admin matrix maintenance, customer/Deal checklist panels and My Task Queue
provenance. Migration `090` is available because the withdrawn Release 5 accounting proposal never
created or applied a migration with that number.

The implementation will remain local and reversible. It will use synthetic test data only and will
not apply a migration, package, deploy, restart or access CRM Test, Production, R2, cPanel or any
external service.

## Explicitly deferred

- OCR, document extraction, face/identity matching or automated authenticity claims;
- government, bank, e-signature, storage-provider or accounting integration;
- jurisdictional/legal conclusions or a new Compliance Officer role;
- retention, restriction, deletion/anonymization and privacy-request operations (separate Release 6
  package);
- marketing-material/RERA release control (separate Release 6 package);
- advanced reporting and exports (later Release 6 packages); and
- any Property Finder work.

## Gate 1 acceptance decisions

Owner approval confirms:

1. the first slice covers sale/lease and buyer/seller/landlord/tenant, for individuals and
   organizations;
2. Full Administrator maintains and activates matrices directly with no maker-checker;
3. ordinary evidence review is Manager/Director and not the uploader, while full Administrator may
   decide directly without a second approval;
4. mandatory requirements block only an explicitly configured transaction stage; advisory items
   never block;
5. expiry reminders use the existing My Task Queue and are assigned to the responsible Deal agent,
   with Manager overdue visibility;
6. existing Documents, KYC and Release 4 official-document evidence remain authoritative;
7. the first implementation is local/offline only and may use proposed migration `090`; and
8. all deferred and external work remains outside authorization.

Approval of Gate 1 authorizes Gate 2 schema/API contract design only. It does not authorize material
implementation, migration application, packaging or deployment.
