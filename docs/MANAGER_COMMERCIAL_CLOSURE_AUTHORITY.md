# Manager commercial closure authority — 3 September 2026

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

## Explicit owner decision

Owner: “closure can be done y manager also, does not necessarily requite MD approval”. After being
told that commercial sales/rentals were Director-only, owner confirmed: “yes pl, MD should not doing
operational stuf”. Manager operational approval and closure now includes commercial sale and rental,
within managed-team scope. Director authority remains available, but is not an additional required
approver. No change to Director-only payout approval or any other financial authority.

## Baseline and rollback

LOCAL ONLY; no deployment. Canonical package 2.1.0-dev.177, Git HEAD
`1af87ba994599d8de1bab6d37b2005e609d449fe` plus preserved existing dirty changes. Do not deploy
the provisional workspace wholesale; it includes deferred receivables changes.
Synthetic local PostgreSQL schema remains through migration 113; no schema/config migration or
remote data change. Existing test fixture records remain synthetic.

Pre-edit archive:
`remediation-baselines/manager-commercial-closure-20260903/before-commercial-authority.zip`
SHA-256 `f2865430d706344f591bc0d992bf560a9ebf1d9e5bf143d88416cb4dbd1b5610`.
Contains affected policy, routes, UI and existing tests. Restore only this patch's files/hunks;
remove the new UI test if reverting, preserving other local work. No database rollback is needed
for this runtime-policy correction.

CRM Test remains last verified dev.176; package SHA
`5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`, migration 112, one-worker
2851276 at deployment observation. Paired remote rollback:
`/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.
Historical dev.174 package SHA, migrations 108–110, one-worker observation and automated result
1,291 total / 1,261 passed / 30 protected skips / 0 failed remain unchanged.

## Changes and boundaries

- `canApproveDeal` no longer excludes commercial transactions for managed-team Managers. Approval,
  Close Won and Close Lost share that policy. UI no longer hides these commercial actions or says
  a Director is mandatory. Read-only Manager UI does not show closure actions.
- Standard historical `DIRECTOR_REVIEW` commercial checklist item may be completed by the
  managed-team Manager. UI calls it Commercial completion review, Manager or Director.
  Stored frozen template identity/role is retained; completed_by and audit actor record the actual
  Manager. No historical template or completed review is rewritten.
- This delegation is restricted to commercial sale/rental plus the standard DIRECTOR_REVIEW code.
  Custom Director-only checklist items and other non-commercial Director requirements are unchanged.
- Other-team Managers, Agents, Accountants and ordinary Administrators gain no closure authority.
  Required parties, evidence, checklist completion, management approval, optimistic versions,
  compliance, atomic Deal/Opportunity/Booking/Inventory alignment and audit checks remain.
- SPEC-GAP-002 (commission-independent closure) remains open. This patch does NOT remove the
  existing actual-receipt gate and does not imply all human closure blockers are fixed.

## Verification

- Full ordinary local suite: **1,343 total / 1,287 passed / 56 protected skips / 0 failed**;
  `manager-commercial-closure-tests.log`. Historical results remain preserved.
- Policy and UI focused checks: 15 passed, 0 failed. Both commercial types allow managed Managers;
  other teams/roles remain denied; unrelated Director checklist items remain protected.
- Enabled localhost synthetic HTTP/PostgreSQL closure fixture, commercial_sale: 2 passed, 0 failed;
  commercial_rental: 2 passed, 0 failed. Manager completes standard commercial review, approves,
  and closes; Accountant closure is denied; existing receipt gate still rejects premature closure.
  Committed Deal closed_won, Opportunity Closed Won, Booking completed, Inventory Sold/Rented.
  Stored reviewer is Manager while original checklist role/code remain preserved; closed_by is Manager.
- Logs: `manager-commercial-sale-runtime.log`, `manager-commercial-rental-runtime.log`.
  The commercial authorization fixture changes only its newly-created disposable Deal/checklist/party
  classification after the ordinary offer-lineage test. It is not full commercial-offer human UAT.
- No browser/human acceptance, live original-record retest, release, production/R2/Property Finder
  operation, personal-data use or genuine financial transaction is claimed.
