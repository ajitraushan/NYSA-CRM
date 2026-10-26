# Accountant corrections — 3 September 2026

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

LOCAL ONLY. No deployment, migration or version bump. Canonical package remains provisional dev.177
with unrelated and deferred receivables changes; do not deploy it wholesale. Git baseline
`1af87ba994599d8de1bab6d37b2005e609d449fe` plus preserved working changes. Synthetic local DB
remains through migration 113; no remote data changed.

Pre-edit file snapshot:
`remediation-baselines/accountant-four-tabs-20260903/before-accountant-menu.zip`
SHA-256 `368b2deae34f10d70391d7fc4834ea47abe7239fbdb6f956a60f365c0faf4a0f`.
Original proof integration test is preserved alongside. Roll back only this patch's files/hunks,
preserving unrelated edits; these code changes need no database rollback.

CRM Test last verified deployment: dev.176, SHA-256
`5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`.
Migration 112 and worker 2851276 are historical observations, not fresh checks. Paired rollback:
`/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.
Historical dev.174 SHA, migrations 108–110, one-worker observation and 1,291 / 1,261 / 30 / 0
results are preserved. See [deployment evidence](CRM_TEST_DEV176_DEPLOYMENT_COMPLETION.md).

## Local changes

- Exact Accountant tabs: Dashboard, Opportunities, My Leave, Finance Receipts. Supersedes earlier
  Customers/My Team discussion. Server-side default-deny route policy enforces the same scope.
- Opportunities is a minimal read-only finance view: Opportunity reference/stage, linked Deal,
  agreed commission/splits, expected and confirmed receipt. No sales editing, general customer/lead/
  inventory access, Deal closure or Director payout. Other roles retain existing authorization.
- Existing own-leave and proof/receipt/confirmation operations remain. Accountant proof upload stays;
  proof alone is not payment confirmation. No new invoicing or payout workflow was introduced.
- Finance Receipts searches/displays Opportunity reference first and carries it from Opportunity
  detail. Deal is secondary; internal Deal receipt/audit linkage is preserved. Bank/payment Finance
  reference remains a separate required field, not replaced by Opportunity reference.
- Actual amount received accepts plain/grouped amounts, K/k and M/m including decimals. `100K`
  previews AED 100,000.00; `1.5M` previews AED 1,500,000.00. Shared frontend/API parser stores exact
  numeric amounts; malformed, nonpositive, unsafe and fractional-cent values are rejected, not rounded.

SPEC-GAP-002 (commission-independent closure) is NOT implemented here. The old receipt closure gate
remains. Separate receivables, invoicing and payout additions remain deferred.

## Machine verification, not human UAT

- Ordinary: **1,334 total / 1,278 passed / 56 protected skips / 0 failed**;
  `accountant-four-workspaces-ordinary.log`.
- Synthetic proof/finance/access integration: **6 passed / 0 failed**;
  `accountant-finance-runtime.log`. Distinct Opportunity/Deal references, reference search, minimal
  projection, denied unrelated routes, own-leave reads, proof lifecycle, `20K` stored as 20,000,
  idempotent numeric retry and invalid amount rejection.
- Prior runtime regression: **11 passed / 0 failed**; `accountant-prior-runtime.log`.
- Focused units after final reference spacing adjustment: **5 passed / 0 failed**. Initial Windows
  process-spawn EPERM resolved with project-standard disabled test isolation.
- Local browser: four tabs, filtered Opportunity search, read-only detail, reference carried into
  Finance Receipts, Opportunity-first/Deal-secondary display, upload control, correct K/M previews.
  No browser receipt submitted. My Leave loads and reports no active employment/policy for fixture;
  leave submission is not verified by that observation.
- Screenshots: `uat-evidence/2026-09-03-accountant-workspace/opportunity-reference.jpg` and
  `finance-reference.jpg` (K preview/navigation).
- Deferred dev.177 receivables DB integration not enabled; its earlier Accountant-access expectation
  is outside this four-workspace scope and must be revisited with the future feature.

No production/R2/Property Finder operations, production personal data, genuine bank-payment assertion,
business-record repair or human pass. Deployment and human retest remain required.

## Accountant receipt-only wording — confirmed follow-up

Owner supplied `codex-clipboard-1eca5180-c780-48ee-b00f-f7e4a3d17e1f.png` showing “Close Won
blocked” on Accountant Finance Receipts, stated it was unnecessary for Accountant, and confirmed
“ok confirmed do it” after the proposed receipt-only statuses. Implemented locally in
`public/commission-payout-ui.js`: no Accountant Close Won gate heading, blocked/prerequisite banner,
closure instructions, payout commentary or Close Won confirmation wording. Replacement status is
Not recorded / Awaiting confirmation / Confirmed, derived from recorded receipts and confirmed
reconciliation, never proof upload alone. Button/toast say Confirm actual receipt / Actual receipt confirmed.
If expected commission is not frozen, guidance asks Agent/Manager to prepare it; Accountant authority
is not expanded. Director and other non-Accountant closure messaging remain unchanged.

Baseline remains local provisional 2.1.0-dev.177, Git HEAD recorded above plus preserved dirty files;
CRM Test stays last verified dev.176. No database/configuration/permission/business-rule changes,
migration, release or remote action. This does not implement SPEC-GAP-002.
Pre-edit exact UI backup: `remediation-baselines/accountant-receipt-wording-20260903/before-wording.zip`,
SHA-256 `630e7e874dfaf0cbf8998d1828d4bc11ff0788ea07825e45911f3368908b60d7`.
Rollback uses that UI file and removes only the new wording test; preserve prior local corrections.
Six new synthetic rendering tests cover all three statuses, unfrozen guidance and preserved Director
behaviour; with prior Accountant/access/money units, 11/11 focused tests passed. No new human UAT
pass or browser retest is claimed. No customer/personal data used; production/R2/PF remain untouched.

Full ordinary suite after wording changes: **1,340 total / 1,284 passed / 56 protected skips /
0 failed**, log `accountant-receipt-wording-tests.log`. Earlier test results remain historical evidence.
