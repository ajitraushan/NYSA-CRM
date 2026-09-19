# CRM Test dev.182 transaction-flow corrections — 4 September 2026

## Outcome

Dev.182 is a tested **CRM Test candidate**, not a deployed release. It completes the agreed corrections before Performance Management or Campaign Management begins.

1. **CR-20260904-01 — transaction completion documents**
   - Admin can configure a Sale or Lease requirement against the **Transaction**, independently of Buyer, Seller, Landlord or Tenant records.
   - Common labels include Sale Deed, Transfer Deed, Oqood and Ejari, but no statutory mapping is seeded or assumed.
   - A configured mandatory document blocks Close Won by its exact name until evidence is uploaded and any configured review is completed.
   - No seller Customer/master record is required for a transaction completion document.
   - Commission proof and commission collection remain independent of closure.

2. **CR-20260904-02 — commission clarity**
   - The screen separates Commission Details from Commission Received using Opportunity commission and agent-split data.
   - Referral, expected commission and actual receipt actions use plain operational wording.
   - Saving expected commission or uploading payment proof does not close the transaction or approve payout.

3. **DEF-121 — automatic Opportunity-to-Receivables handoff**
   - Closed Won Opportunities without an active payment schedule appear automatically under **Closed Opportunities awaiting invoicing**.
   - The Accountant starts the schedule from that row; the exact Opportunity is carried into the form without manual reference entry.
   - Cancelling the only schedule returns the Opportunity to the queue.

4. **DEF-117 — current pipeline status**
   - Terminal Opportunity outcomes rank ahead of older active pursuits for the same Lead.
   - Pipeline totals and contributing-record drill-downs continue to reconcile without rewriting Lead history.

## Baseline, candidate and migration

- Exact deployed baseline package: dev.179, SHA-256 `e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434`.
- Historical CRM Test rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev179-20260903T191641Z`.
- Pre-change source snapshot: `remediation-baselines/pre-transaction-flow-20260904T2230GST`.
- Restricted local fixture backup: `uat-evidence/fixture-backup-2026-09-04T18-15-47-907Z/before-commission-proof.dump`, SHA-256 `13882e36bef1522d4e4271c01b49335be38418a92d1da2c0f84daded39355527`.
- Candidate: `nysa-core-consolidated-crm-test-dev182.zip`, 9,722,037 bytes, 307 entries, SHA-256 `b71c91c549c1cbc94e93aeb7172936898f46a60b5c1c7d4c155faf05532fca64`.
- Additive migration: `117_transaction_completion_documents.sql`; total migrations: 117. Historical migration bytes are unchanged.

## Verification

- Canonical repository suite: **1,374 total / 1,304 passed / 70 protected skips / 0 failed**.
- Enabled dashboard and Opportunity PostgreSQL suite: **12/12 passed**.
- Enabled Receivables PostgreSQL/HTTP suite: **19/19 passed**.
- New transaction-document PostgreSQL gate: **1/1 passed** — missing Sale Deed blocked Close Won, uploaded Sale Deed passed, with no seller master record.
- Isolated dev.182 focused runtime suite: **50/50 passed**.
- Exact package identity/delta check: **1/1 passed**.

The broad historical suite is not used as an isolated-package acceptance suite because many historical tests intentionally assert the canonical development version and read documentation not installed in a runtime package. Its expected version/document failures do not represent runtime defects; the canonical full suite and the isolated focused runtime suite are the acceptance evidence.

## Security, privacy and rollback

The schema change only permits a document requirement instance to be attached to the transaction rather than a party. Existing private storage, record scope, evidence review and audit controls remain. Accountant access adds only the exact finance awaiting-invoicing read path; payout approval remains with Director. Tests used synthetic records on the restricted loopback fixture.

No CRM Test, Production, R2 clone, Property Finder or external integration was changed. Before deployment, create and verify a fresh paired CRM Test application/database backup, confirm the exact dev.179 baseline and one live worker, then deploy only the checksummed dev.182 artifact and migration 117. Production requires separate approval.
