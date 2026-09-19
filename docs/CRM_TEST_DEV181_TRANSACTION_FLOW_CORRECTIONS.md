# CRM Test dev.181 transaction-flow corrections — superseded, not deployed

Dev.181 was an intermediate, migration-neutral candidate. Final scope review found that its closure-document model remained party-based. It was not deployed and is superseded by dev.182, which adds true transaction-level completion-document configuration and verification.

## Decision and environment

This correction set must be completed before Performance Management or Campaign Management begins.
Target is **CRM Test only**. Production, the R2/Production clone, Property Finder and all external
integrations are excluded. No deployment was performed while preparing this candidate.

Authoritative deployed baseline: `2.1.0-dev.179`, exact package SHA-256
`e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434`.
Git reference at start: `1af87ba994599d8de1bab6d37b2005e609d449fe` plus the preserved recorded
working-tree changes. Pre-change source copies and hashes are under
`remediation-baselines/pre-transaction-flow-20260904T2230GST`.

Restricted local synthetic database backup before mutation:
`uat-evidence/fixture-backup-2026-09-04T18-15-47-907Z/before-commission-proof.dump`,
1,953,615 bytes, SHA-256 `13882e36bef1522d4e4271c01b49335be38418a92d1da2c0f84daded39355527`;
archive listing verified by the fixture backup tool. No remote database was used.

## Corrections included

1. **DEF-121 — automatic Opportunity-to-Receivables handoff**
   - A Closed Won Opportunity with no active payment schedule appears automatically in
     **Closed Opportunities awaiting invoicing**.
   - The queue shows Opportunity reference, closure date, calculated expected commission and the
     missing payer action before an invoice exists.
   - **Create payment schedule** carries the exact Opportunity into the form; manual Deal/reference
     entry is not required.
   - Cancelling the only schedule returns the Opportunity to the awaiting queue for replacement.
   - The exact read-only awaiting path was added to the Accountant allowlist; no wider sales,
     Inventory, Lead, Customer, administration or payout access was granted.

2. **DEF-117 — current pipeline state**
   - Closed Won and Closed Lost Opportunity outcomes now rank ahead of older open pursuits when the
     dashboard selects the one current contributing record for a Lead.
   - Dashboard counts and contributing-record drill-downs continue to reconcile. Lead history is not
     rewritten and multiple Opportunities are not double-counted as multiple Leads.

3. **CR-20260904-01 — closure-document clarity**
   - The Deal section uses **Transaction documents**, **Required documents**, **Refresh document
     checklist**, and an explicit Admin-configuration message.
   - The unclear “party-document checklist resolved and frozen” confirmation is replaced by
     “Document checklist refreshed for the current transaction details.”
   - A transaction-only seller record no longer becomes an additional Close Won blocker. Any
     configured required document instance still blocks until its evidence requirement is satisfied.

4. **CR-20260904-02 — commission wording**
   - Accountant heading is **Commission and collection** and contains no Close Won, closure-gate or
     payout instruction.
   - Visible operational labels resolve to Transaction value, Agreed agent split, Expected commission,
     Commission received, Referral fee (if applicable), Confirm commission details and Record
     commission receipt.
   - Existing Opportunity commission values and agent split remain the calculation source. Commission
     collection remains separate from transaction closure and Director payout approval.

## Candidate identity

Candidate: `nysa-core-consolidated-crm-test-dev181.zip`, 9,720,901 bytes, 306 entries,
SHA-256 `0ec7d9d170067a7e300f3cb37ffaf5471ef86de34eb853084bbd0dfc23ca1bf8`.
It is a migration-neutral delta from exact dev.179: 116 migrations remain, latest migration remains
`116_opportunity_finance_identity.sql`, and no historical migration byte changed.

Declared runtime delta is limited to package metadata and these seven files:

- `public/commission-payout-ui.js`
- `public/document-compliance-ui.js`
- `public/receivables-ui.js`
- `src/accountant-access.js`
- `src/commission-receivables.js`
- `src/dashboard-pipeline.js`
- `src/routes/document-compliance.js`

The first immutable candidate, dev.180, was rejected during isolated verification because its wording
listener assumed a browser `document` in a non-browser renderer. It was not deployed or overwritten.
Dev.181 includes the compatibility correction.

## Verification

- Complete canonical suite: **1,369 total / 1,300 passed / 69 protected skips / 0 failed**.
- Receivables HTTP/PostgreSQL suite: **19/19 passed**, including Accountant denial boundaries,
  automatic Closed Won handoff, direct Opportunity selection, schedule/cancellation behavior, 5% VAT,
  partial payments, reversals, reconciliation and duplicate protection.
- Dashboard/transaction HTTP/PostgreSQL suite: **12/12 passed**, including Closed Won versus a newer
  Requirements-stage pursuit and count/drill-down reconciliation.
- Isolated dev.181 focused syntax/UI/access/wording suite: **13/13 passed**.
- Exact package/hash/migration/runtime-delta verification: **1/1 passed**.

Protected skips require separately enabled database, browser or external-service fixtures; they are not
failures. The enabled database suites above ran only against the restricted loopback fixture.

## Security, privacy and rollback

The awaiting queue exposes finance-operational Opportunity reference, closure date and commission
calculation only to existing finance-authorized roles. It does not expose contact details, sales notes,
Inventory data or payout authority. No customer or production data was added to code, logs or artifacts.

Before any CRM Test deployment, create a fresh paired CRM Test application archive and database dump,
verify both archives, verify the exact dev.179 baseline and one live worker, and checksum the dev.181
package. Because dev.181 has no migration, ordinary rollback is the paired application/database restore.
If users create finance evidence after deployment, preserve it and coordinate recovery rather than
silently replacing the database. Production promotion requires a separate explicit approval.
