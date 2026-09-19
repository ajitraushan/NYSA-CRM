# Commission-independent transaction closure — 3 September 2026

## Current deployment update — 3 September 2026

**CRM Test dev.178 deployed; human retest pending.** This supersedes earlier local-only/
dev.176 status statements below, which remain historical evidence. User authorized “pl deploy
in crm, all the fixes”. The isolated package includes Accountant four-workspace access,
Opportunity-first Finance references, K/M amounts, receipt-only wording, managed-team Manager
commercial closure and receipt-independent closure at both API and database levels.
Migration114 removed the receipt closure trigger; no other closure gates or Director payout
approval were removed. Deferred receivables/invoicing/new payout-request workflow excluded.

Package SHA-256 `1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`;
latest migration114, 113 total (no113); one verified Test worker PID280206. Exact isolated suite
1,336 total /1,287 passed /49 protected skips /0 failed; 24 separately enabled synthetic DB
checks passed. Health/readiness and installed/served hashes verified. Fresh private application/
database backup verified. Production/R2/PF untouched; no new production personal data.

SPEC-GAP-002 and all previously user-failed items remain **deployed pending human retest**;
no inferred acceptance, original-record repair or cumulative count change (25 items).
Historical dev.174 SHA, migrations108–110, one-worker observation and 1,291/1,261/30/0 result
are unchanged. See [deployment evidence and rollback](CRM_TEST_DEV178_DEPLOYMENT_COMPLETION.md).

## Main blocker and authorized behaviour

SPEC-GAP-002 was the owner's original blocked-closure issue. Owner reaffirmed the flow: Manager closes
the completed transaction; Accountant tracks/collects commission independently; MD approves payout,
not routine transaction closure. Owner replied “yes”, then emphasized “this was the only issue i
raised, and stil u ask deployment without fixing it”. This correction addresses the actual API and
database restriction, not just wording. Status: **implemented and machine-verified locally; NOT
deployed or human accepted**. Prior failure observations remain valid for deployed dev.176.

## Baseline and recovery

Canonical workspace package remains provisional **2.1.0-dev.177**, Git HEAD
`1af87ba994599d8de1bab6d37b2005e609d449fe`, with pre-existing dirty changes preserved. Do not deploy
this workspace wholesale: deferred receivables/invoicing code remains outside the requested release.
Last verified CRM Test dev.176 package SHA:
`5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`; migration 112 and worker
2851276 are historical deployment observations. Paired remote rollback remains
`/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.

Pre-edit UI/routes/tests snapshot:
`remediation-baselines/independent-closure-20260903/before-independent-closure.zip`
SHA-256 `a0c89b75b42676055f73dd71e70dffd5b045db9448a137bf7017dd680174312b`.
Before changing the local database, a verified custom-format dump was created:
`uat-evidence/fixture-backup-2026-09-02T20-25-09-403Z/before-commission-proof.dump`, 1,606,042 bytes,
SHA-256 `134a9047e22424ed151b81381d0a0f3ce79333e09f1652d0210e6d6cdaed9935`.
Backup required an approved process-spawn escalation after Windows EPERM; its loopback/dedicated-
fixture guard succeeded. No remote database or credential output was involved.

Local fixture: `nysa_test_fixture`, restricted `nysa_test_user`, schema through 113 before change.
New migration **114_commission_independent_transaction_closure.sql** applied once locally; second
run applied zero migrations. It drops only `deals_commission_receipt_close_gate`. No business rows,
finance evidence, triggers enforcing finance immutability, or historical migration 088 were changed.
Old trigger function is retained for controlled rollback. Restoration SQL is in
`ROLLBACK_114_COMMISSION_CLOSURE_GATE.sql`; creation was verified inside a rolled-back local
transaction. A policy rollback affects future closures; it must not reopen transactions already closed
under the approved new policy or invent payments. Preserve migration history; subsequent reactivation
uses an explicit forward migration. Restore only relevant file hunks, not unrelated local work.

## Runtime and UI changes

- Close Won no longer queries confirmed commission receipt/variance readiness. It still requires
  authorized Manager/Director, recorded management approval, current version, required document
  compliance, final completion/evidence, and aligned Booking/Inventory/Opportunity state.
- Existing atomic Deal, Opportunity, Booking and Inventory closure and audit logic are unchanged.
- No closure operation creates a receipt, confirmation, commission credit or payout.
- Finance Receipts retains closed Deal-backed Opportunities, searchable by Opportunity reference.
  Existing proof upload, immutable receipt recording and reconciliation continue after closure.
- Commission receipt headings, statuses, confirmation buttons and success messages no longer claim
  that collection is a Close Won gate. Manager guidance explicitly permits outstanding commission.
  Accountant retains receipt-only wording. Non-finance users are directed to Finance for reconciliation.
- Credit/payout restrictions remain. Without confirmed receipt, credit creation is rejected and its
  UI action is hidden. Director-only payout approval is unchanged. No receivables, invoicing, payout
  request or external payment functionality has been enabled by this patch.
- Legacy receipt-confirmation response field `closureReady` is retained for compatibility only; its
  existing zero-variance meaning is not transaction readiness and no UI uses it for closure.

## Verified behaviour (synthetic machine checks, not human UAT)

- Unpaid transaction: Manager closes with zero receipts/confirmations; no finance records are created;
  Accountant still finds the same closed Opportunity in Finance Receipts. The Agent uploads proof
  and prepares expected commission; Accountant records the receipt and confirms collection afterward.
- Partially collected commercial sale and commercial rental: Manager closes with an unconfirmed
  partial receipt; Accountant later records the balance and confirms the aggregate. Closed records stay
  aligned (Sold/Rented), closed Deal version is unchanged by collection, and no automatic payout occurs.
- Each of the three enabled HTTP/PostgreSQL scenarios passes 2/2 tests. Logs:
  `independent-closure-unpaid-runtime.log`, `independent-closure-commercial-partial-runtime.log`,
  `independent-closure-rental-partial-runtime.log`. Commercial authorization fixtures change only their
  newly-created disposable classification after the ordinary lineage test; not full commercial-offer UAT.
- Accountant/Agent closure denied, stale version rejected, empty final evidence rejected, duplicate
  closure rejected, and credit-before-confirmed-receipt rejected.
- Proof/access/receipt regression 6/6, log `independent-closure-finance-runtime.log`; prior runtime
  regressions 11/11, log `independent-closure-prior-runtime.log`; focused UI/contract checks 18/18.
- Full ordinary suite: **1,345 total / 1,288 passed / 57 protected skips / 0 failed**,
  `independent-closure-ordinary.log`. An initial ordinary invocation inherited a protected-test switch
  without its fixture environment; it was rerun in a clean process. The separately enabled guarded
  integration runs above passed against the dedicated local fixture.
- Migration/rollback/remaining finance immutability test 1/1. This check restores the trigger inside
  a transaction and rolls it back, leaving the new independent-closure policy active locally.
- No new authenticated browser or human original-record acceptance is claimed. No production, R2,
  Property Finder or external-payment operation; no production personal data.

Historic dev.174 package SHA, migrations 108–110, one-worker observation and automated
1,291 total / 1,261 passed / 30 protected skips / 0 failed are preserved. Release packaging and an
approved test deployment must include both the API/UI correction and migration 114 together.
