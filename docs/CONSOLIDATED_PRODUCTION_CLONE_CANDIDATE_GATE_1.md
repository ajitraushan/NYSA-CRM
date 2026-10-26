# NYSA CORE Consolidated Production-Clone Candidate - Gate 1

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** owner-approved on 14 August 2026; Gate 2 contract design authorized  
**Classification:** local/offline readiness design only

## Decision requested

Approve a single consolidated local acceptance-candidate readiness package covering the completed
CORE functional work, before any package, migration execution, hosted access or deployment is
prepared.

This combines a controlled bridge from locally completed functionality to one future end-to-end
candidate with two newly owner-requested connected capabilities: Email and Calendly. The mandatory
environment sequence remains local implementation, authorized provider sandbox verification and CRM
Test acceptance, then one frozen Production/R2-clone candidate, then Production only after a
separate explicit owner approval.

## Why this is the next package

- Release 3B and Release 3C are locally complete.
- Release 4 has reached its planned offline boundary; portal work remains integration-gated.
- Release 5 commission receipt and real-time agent payout is locally complete. The proposed invoice,
  receivable and accounting lifecycle was withdrawn because NYSA's accounting system is
  authoritative.
- Release 6 customer/transaction document compliance and marketing-material compliance are locally
  complete. Privacy Operations and broad new reporting were deferred by owner decision.
- Release 3D is connected-provider integration. The owner has now selected Email and Calendly as the
  two integrations to include; all other providers remain deferred.

Accordingly, no additional approved offline core feature build remains. The next work is to prove
that the completed local changes form one internally consistent, reproducible candidate and to add
the approved Email and Calendly connector boundaries without reopening other integrations.

## Revised two-track scope

### Track A - consolidated CORE readiness

Reconcile and prove all owner-approved local functional packages as one candidate, preserving the
dirty worktree and every previous completion record.

### Track B - Email and Calendly integration

Email and Calendly each require a separate Gate 2 provider contract, local disabled-by-default
adapter, synthetic provider simulator and focused security/idempotency tests. Local implementation
must not contain credentials or perform provider requests. Real account connection, OAuth consent,
webhook registration and sandbox verification require later explicit authorization and must pass
before either connector is included in the frozen clone candidate.

CORE already has Google Calendar/Meet and `.ics` fallback capability in migrations `041` through
`044`. Calendly will complement that capability as a customer scheduling and event-reconciliation
source. It will not create a second CRM meeting register or independently duplicate an event already
projected into the existing Activity/Viewing records.

The recommended Email boundary is individual authorized staff mailboxes, approved templates and
manual messages, immutable send/receive correlation, failure evidence and CRM timeline projection.
It excludes bulk campaigns, automated nurture, unsolicited sending, autonomous AI sending and a
second contact or conversation master.

The recommended Calendly boundary is controlled scheduling-link preparation, invitee-created and
invitee-cancelled reconciliation, timezone-safe CRM Meeting projection, idempotent webhook handling,
reschedule/cancellation evidence and `.ics` fallback. It excludes silent booking, automatic Deal or
Opportunity stage changes, and treating a Calendly event as a property viewing without explicit CRM
classification.

## Owner provider decisions - 14 August 2026

- **Email provider:** Microsoft 365.
- **Email account model:** individual authorized staff mailboxes, as proposed; no organization-wide
  mailbox ingestion.
- **Calendly ownership:** one NYSA organization/team account with controlled agent/host mapping.
- **Calendly use:** both customer meetings and property viewings, distinguished by an explicit
  governed event-type mapping.

The Email connector will therefore use a Microsoft 365-specific adapter behind the provider-neutral
CORE communication boundary. Gate 2 will define the minimum authorization scopes for manual send,
CRM-linked reply synchronization, webhook/delta reconciliation and disconnect/revocation. It will
not ingest unrelated mailbox history, expose mailbox credentials, enable bulk marketing or send an
AI-generated message without a staff action.

The Calendly connector will map a controlled customer-meeting event into the existing CRM Meeting
activity and a controlled property-viewing event into the existing Viewing workflow. A Calendly
event cannot create a second CRM register, reserve Inventory or advance an Opportunity. A property
viewing must still have an existing eligible Opportunity/Inventory context and pass the existing
Viewing rules. Unknown or ambiguous event types enter reconciliation rather than being guessed.

When Calendly is configured to create an attendee calendar event through its connected calendar,
CORE must retain one provider-origin mapping and must not create a duplicate Google or Microsoft
calendar event for the same booking. Existing Google Calendar/Meet behavior remains available for
non-Calendly workflows and as historical compatibility; `.ics` remains the safe fallback.

## Proposed outcome

Gate 4 of this readiness package will provide:

1. an exact local source and artifact inventory without rewriting or discarding the dirty worktree;
2. a feature inclusion/exclusion ledger tied to every completed Gate 4 record;
3. a cumulative migration manifest with dependencies, reversibility notes and exact preconditions;
4. an offline production-shaped migration rehearsal report against disposable data only;
5. a configuration and feature-switch contract containing names and required states but no secrets;
6. a role/workflow end-to-end UAT matrix covering Agent, Manager, Director and Administrator paths;
7. a complete automated regression, syntax, security-boundary and local HTTP smoke report;
8. a checksum-ready candidate manifest and promotion runbook design, without producing or deploying
   a hosted-environment package under this authorization; and
9. a precise list of remaining external prerequisites and owner approvals.
10. provider-specific Email and Calendly contracts, disabled-by-default connector implementations,
    synthetic provider verification and a separately gated sandbox acceptance plan.

## Source and migration boundary

The canonical worktree currently contains 33 migration files numbered `060` through `092`. That is
a local file count, not a claim that all 33 are unapplied in every hosted environment. The exact
hosted delta must later be determined from authorized read-only environment evidence; it will not be
guessed from filenames or historical notes.

Migrations `080`, `081` and `082` are existing Property Finder/portal-scoped artifacts. Property
Finder is expressly deferred. Gate 2 must record their dependency treatment without changing,
testing, packaging or enabling Property Finder functionality. Email and Calendly switches also
remain off in offline verification except when their local synthetic adapters are selected.

Migration `092_release3b_matching_completion.sql` is locally created and unapplied. The completion
records for migrations `083` through `091` also state that they remain unapplied. No migration will
be applied to CRM Test, the Production clone, Production, R2, cPanel or any external database under
this Gate 1 proposal.

## Proposed gated workflow

### Gate 1 - scope and acceptance approval

- Freeze the included local functional stories and explicit exclusions.
- Confirm that accounting duplication, deferred privacy/reporting, Property Finder and every
  integration other than Email and Calendly stay out.
- Confirm the Email provider/account model and the Calendly account/ownership model.
- Approve the offline verification and later environment sequence.

### Gate 2 - candidate contract

- Produce the exact file/module inclusion ledger.
- Produce the ordered migration/dependency contract and schema assertions.
- Define configuration names, default-safe states, startup prerequisites and rollback boundaries.
- Define the synthetic end-to-end UAT matrix and acceptance evidence.
- Produce separate Email and Calendly authorization, API, webhook, retry, reconciliation, privacy,
  retention and failure contracts from current official provider documentation.
- Present this contract for owner approval before migration rehearsal or candidate assembly.

### Gate 3 - offline execution and review

- Rehearse the approved cumulative migration path in a disposable local PostgreSQL environment using
  synthetic data only.
- Run focused package checks, the complete repository suite, syntax checks, permission/boundary
  checks and local application smoke tests.
- Exercise the consolidated synthetic UAT matrix without external requests.
- Exercise Email and Calendly through local simulators only, including duplicate events, invalid
  signatures, retries, cancellations, reconciliation and provider-unavailable behavior.
- Present failures, exclusions and unresolved dependencies; do not hide or waive them.

### Gate 4 - local readiness freeze

- Freeze the evidence and checksum-ready manifest design.
- Record whether the local source and disabled-by-default connector code are ready to enter the
  separately authorized provider-sandbox and CRM Test process.
- Do not deploy, restart or access a hosted environment.

## Proposed end-to-end local UAT lanes

- **Agent:** customer/lead requirement, governed Inventory match, shortlist promotion, Opportunity
  operations, leave application and document compliance visibility.
- **Manager:** exact assigned approvals in My Task Queue, team-scoped controls and no unauthorized
  Director/Admin activity.
- **Director:** organization-wide operational authority, Deal receipt and payout drill-down, and
  controlled approval paths.
- **Administrator:** direct configuration maintenance where approved, governed evidence maintenance,
  no unintended maker-checker requirement for ordinary Admin configuration, and no access expansion
  into Director-only payout operations.
- **Cross-cutting:** immutable evidence, idempotency, stale-version rejection, audit continuity,
  external-switch-off behavior and no private-data exposure in synthetic review.

## Explicit exclusions

- Property Finder, Bayut/dubizzle, WhatsApp, SMS, lead-provider and every connected capability other
  than the specifically approved Email and Calendly lanes.
- Provider credentials, private customer/contact/owner/authority data or Production-derived data.
- Invoice generation, receivable accounting, journal posting, tax, payroll or payment execution.
- Deferred Privacy Operations and broad replacement dashboard/reporting.
- Migration application, deployment packaging, service restart or hosted-environment modification.
- Direct Production-clone deployment before CRM Test acceptance; the approved promotion policy does
  not allow that sequence to be skipped.

## Gate 1 acceptance points

The owner is asked to confirm:

1. the next package is consolidated local candidate readiness, not another feature story;
2. one future end-to-end Production-clone candidate remains the target, after mandatory CRM Test
   acceptance;
3. the four role-based UAT lanes are sufficient;
4. accounting duplication, deferred reporting/privacy, Property Finder and every integration other
   than Email and Calendly remain out;
5. the dirty worktree must be preserved and reconciled through an inclusion ledger, never reset or
   cleaned destructively; and
6. Email and Calendly remain disabled-by-default and require separate provider-sandbox acceptance
   before inclusion in the frozen clone candidate; and
7. Gate 1 approval authorizes Gate 2 design only, not migration rehearsal, account connection,
   credential handling, webhook registration, packaging, deployment, restart or external access.

## Provider decisions recorded for Gate 2

1. Microsoft 365 is the selected Email provider.
2. Individual authorized staff mailboxes are the selected initial Email account model.
3. One NYSA organization/team account is the selected Calendly ownership model.
4. Calendly will cover customer meetings and separately classified property viewings.

Gate 2 may now design the exact Microsoft 365 and Calendly contracts from current official provider
documentation. These decisions do not authorize OAuth application creation, account connection,
credential or token handling, webhook registration, provider requests or sandbox access.

The NYSA owner approved Gate 1 on 14 August 2026. The exact proposed migration, API, permission,
event-correlation and local-verification boundary is recorded in
`CONSOLIDATED_EMAIL_CALENDLY_GATE_2_MIGRATION_API_CONTRACT.md` for separate Gate 2 approval.
