# NYSA CORE Release 4 — Official Document Evidence Integration Gate 1

**Design date:** 13 August 2026 (Asia/Dubai)  
**Status:** Gate 1 approved by owner — no material implementation started  
**Workspace:** `canonical-worktree`  
**Package:** Official/external document requirements, private evidence and workflow-step advice

**Gate 1 approval:** Approved by owner on 13 August 2026 (Asia/Dubai). This approval covers the
integration boundary only and is not migration, implementation, packaging or deployment authority.

## Decision requested

Approve the integration boundary in this document before migration, API or CRM UI implementation.
The package integrates the already owner-accepted local policy contracts
`r4-official-document-config-v1` and `r4-official-document-evidence-v1` into existing CRM records.

This is the next unfinished offline package because the Inventory duplicate-prevention, Excel import,
Partner Organization and Release 3C packages are already complete locally. It contains no Property
Finder, provider, deployment or external-environment work.

## Intended business outcome

An agent can see which official/external documents are required or advisory at an existing governed
CRM workflow step, attach the exact private PDF through the existing document facility, and submit
its immutable version for independent verification. A verified, current, correctly linked version
satisfies the applicable step requirement. Missing, pending, rejected, expired or wrong-case
evidence blocks only that governed step, not unrelated Inventory maintenance.

CORE records evidence received from the authorized external process. It does not generate, edit or
submit a DLD form, Contract A/B/F, MOU or developer e-NOC.

## Authoritative records to reuse

| Concern | Existing CRM authority | Integration rule |
| --- | --- | --- |
| Private file and immutable version | `documents` and `document_versions` | Reuse the existing private-storage/version model; do not create another file repository. |
| Inventory and transaction context | `listings`, `deals`, their existing Opportunity/Booking/Offer chain | Evidence must resolve to the exact current case; no copied private party details. |
| Entity association | `document_links` | Extend its governed entity coverage where required; do not create generic duplicate links. |
| Agent follow-up | `tasks` | Create or advise one existing CRM Task when follow-up is required; no document work queue. |
| Audit | `audit_log` | Record configuration, submission, verification and supersession decisions without file content or private identity data. |
| Users and permissions | existing broker/user roles and scope | Server-side authorization applies. Full Administrator configuration requires no further approval; uploaded evidence retains independent verification. |

Small additive governance records are still required for active document definitions, predefined-step
rules, evidence metadata and verification decisions. They will reference the authorities above and
will not become new Customer, Inventory, Deal, document, user or Task masters.

## Controlled scope

### Administrator configuration

- Maintain immutable draft versions of official/external document definitions.
- A full Administrator may activate or retire their own configuration version directly. Admin
  Assistant remains draft-only.
- Associate an active definition with one of the predefined CRM workflow steps as `required` or
  `advisory`, with a business reason and accepted evidence status.
- Activate an association separately; editing an active definition or rule creates a revision.
- Admin cannot create an arbitrary workflow step from this facility.

Initial predefined steps remain:

- `external_listing` — Prepare external listing;
- `buyer_representation` — Confirm buyer representation;
- `sale_agreement` — Complete sale agreement; and
- `transfer` — Prepare property transfer.

### Agent evidence workflow

1. Open the relevant existing Inventory or Deal workflow context.
2. View required and advisory document advice from the active rule version.
3. Add an inbound, private PDF using the existing document/version facility.
4. Record official document type/reference, issuer reference, issue/execution time, optional expiry,
   exact file hash/version and exact Inventory and/or Deal context.
5. Submit the immutable evidence version as `pending_verification`.
6. A different authorized user verifies, returns or rejects it with the required reason.
7. Only verified, unexpired, current evidence bound to the same case satisfies the requirement.
8. A correction creates a new immutable document/evidence version and retains the prior history.

### Existing Task integration

- Missing, returned, rejected or approaching-expiry required evidence may propose/create one
  idempotent Task against the existing Lead/Contact context where that context exists.
- The Task identifies the document type, workflow step, due time and safe business reference only.
- Completing a Task never verifies evidence or bypasses the workflow gate.
- No second queue, SLA clock or hidden work item is introduced.

## State and authority rules

- Definition: `draft` → `active` → `superseded` or `retired`.
- Step rule: `draft` → `active` → `superseded` or `retired`.
- Evidence: `pending_verification` → `official_captured` / `external_verified`, `returned` or
  `rejected`; a later correction is a new version.
- The uploader cannot verify their own evidence.
- Draft configuration cannot affect agent advice.
- Advisory evidence never blocks a workflow step.
- Required evidence is fail-closed when missing, pending, rejected, expired, superseded or linked to
  another case.
- Verification does not change Inventory availability, Opportunity stage, Offer, Booking,
  Reservation, Deal status or external-listing status automatically.

## Privacy and safety boundary

- File content remains private under the existing document access controls.
- Governance metadata stores opaque CRM references and hashes, not owner/contact/authority details.
- Responses and audit output must not expose storage keys, private file contents or identity data.
- No external lookup, Dubai REST submission, e-signature, portal publication, provider credential,
  email or WhatsApp delivery is included.
- No legacy document is automatically classified, linked, verified or backfilled.

## Proposed approval workflow

1. **Gate 1 — integration boundary:** approve this authoritative-record, workflow and exclusion design.
2. **Gate 2 — migration/API contract:** review exact additive schema, permissions, endpoints,
   idempotency, concurrency and rollback tests. Proposed migration number: `086` (unapplied).
3. **Gate 3 — local CRM workflow:** review Administrator configuration and Inventory/Deal evidence
   screens after focused and full offline tests.
4. **Gate 4 — package completion:** accept the local functional package and checkpoint evidence.

No gate authorizes migration application, packaging, deployment, restart or external-service access.

## Gate 1 acceptance criteria

Approval confirms that:

1. existing document/version/link records remain the file and version authority;
2. existing Inventory and Deal records remain the case authority;
3. existing Tasks remain the only follow-up work record;
4. configuration is limited to document definitions and associations with predefined workflow steps;
5. evidence requires immutable private PDF metadata, exact case binding and independent verification;
6. only the applicable workflow step can be blocked;
7. CORE will not generate or submit official forms; and
8. no existing record is inferred, rewritten or verified by backfill.

## Explicit exclusions

- Property Finder or any other portal work.
- DLD/official-form generation, field mapping, editing or submission.
- Legal wording, legal approval or signature capture.
- External file transfer, provider connection, calendar or messaging integration.
- Customer, owner, representative, contact or authority maintenance.
- Automatic workflow transition, Inventory mutation, Offer, Booking or Reservation action.
- CRM Test, Production, R2, cPanel, packaging, deployment, migration execution or restart.
