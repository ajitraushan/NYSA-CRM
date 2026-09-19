# CRM Test dev.183 — work queue, invoice-first Finance and counteroffer completion

Status: built and locally verified; not deployed.

## Baseline and rollback

- Source baseline: exact CRM Test dev.182 candidate, SHA-256 `b71c91c549c1cbc94e93aeb7172936898f46a60b5c1c7d4c155faf05532fca64`.
- Deployed production-like CRM Test baseline remains dev.179. No remote state was changed by this work.
- Pre-change recoverable source snapshot: `remediation-baselines/pre-dev183-three-workflows-20260904T230437Z`.
- Target: CRM Test only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`).
- Schema: migration-neutral; 117 migrations, latest `117_transaction_completion_documents.sql`.

## Included corrections

### DEF-122 — current Opportunity work in My Tasks

- My Tasks now includes the authoritative current action for every active Opportunity in the signed-in user's permitted operating scope.
- Each row shows Opportunity reference, customer, current stage, instructions, priority and due date.
- The action opens the Opportunity directly.
- An Opportunity action cannot be closed with the generic Task `Complete` or `Cancel` buttons. It disappears only after the named Opportunity workflow action changes the authoritative next action or closes the Opportunity.
- An explicit open Task with the same Lead, assignee and action subject suppresses the projected duplicate.
- Closed Won and Closed Lost Opportunities are excluded from operational Opportunity actions.
- Existing Lead follow-ups, routed assignments, leave approvals, marketing reviews and proposal corrections remain in the same queue.

### CR-20260904-03 — Accountant invoice-first workflow

- The Accountant Dashboard identifies Closed Won Opportunities awaiting their first commission invoice.
- Receivables starts with `Create commission invoice`, not `Create payment schedule`.
- The queue shows Opportunity reference, closure date and expected commission pending collection.
- The Accountant selects the maintained payer: Customer, Agency or Developer.
- Commission is Opportunity-linked. Deal is not the finance reference.
- VAT is calculated at 5% per invoice.
- One separate invoice is created for each off-plan payment instalment. The Accountant may add multiple invoice rows, each with its own commission amount, due date and milestone.
- The invoice reference and invoice date are recorded separately when each invoice is issued; payments are then recorded against that invoice and may be partial.
- Commission receipt remains post-closure Finance work. It does not block Manager closure and does not approve agent payout.

### DEF-123 — priced counteroffer and agency acceptance

- The Negotiation page now shows the current commercial amount and immutable revision history.
- After a counteroffer note is recorded, the priced-revision form is visible in Negotiation.
- The user records the exact counteroffer amount, deposit, validity, payment terms and conditions as a new inbound immutable revision.
- When that inbound revision is current, the outcome explicitly offers `NYSA / represented party accepted this priced counteroffer`.
- Acceptance is bound to that exact revision and then enables the existing Booking and Reservation step.
- A narrative counteroffer note alone never changes the commercial amount.

## Explicitly unchanged

- Manager closure remains independent of commission receipt.
- Director retains payout approval; no new payout-request workflow is included.
- Accountant sales-data access remains restricted to approved finance projections.
- Performance Management and Campaign Management remain deferred.
- Production, the R2 clone and Property Finder were not accessed or changed.

## Verification

- Full canonical regression: 1,378 tests; 1,308 passed, 70 protected-environment skips, 0 failed.
- Focused dev.183 workflow checks: 13/13 passed in canonical source.
- Focused isolated-runtime checks: 16/16 passed.
- Package identity check: 1/1 passed.
- Syntax checks: passed for every changed runtime JavaScript file.

## Candidate

- Package: `release-artifacts/release-3/consolidated/nysa-core-consolidated-crm-test-dev183.zip`
- Bytes: 9,723,452
- Entries: 307
- SHA-256: `ea097eea49bf5b23bdbd8c28f946585caa0b948fb5498e162a84f7116bd5f528`
- Changed runtime files from dev.182: `package.json`, `package-lock.json`, `public/accountant-workspace-ui.js`, `public/app.js`, `public/offer-ui.js`, `public/receivables-ui.js`, `src/routes/lead-operations.js`.
