# CRM Test dev.178 deployment completion — 2026-09-03 Dubai

## Human retest update — 3 September 2026

Owner reports after dev.178 deployment: “this is done, i was able to close the deal.”
Owner then explicitly clarifies: “manager closed the deal”.
**Human-confirmed result: Manager successfully closed the tested Deal.** The previously
reported inability to proceed with closure is cleared for this reported retest.
Linked item: SPEC-GAP-002. This report does not specify the receipt/confirmation state at
closure, commercial/residential type, exact record reference, or downstream pipeline/inventory
state; those are not inferred. Accountant screens and other defects are not accepted by this
statement. Full commission-independent closure acceptance remains limited to the evidence above.

Documentation-only update against recorded CRM Test dev.178 package SHA-256
`1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`, migration114/count113,
rollback `/home/nysareal/crm-backups/consolidated-crm-test-dev178-20260902T204149Z`.
No new tests, migrations, application/data changes, private data access or production/R2/PF action.
Historical package hashes, worker observations and automated totals are preserved.

Status: **deployed and machine-verified; human UAT pending**.
User authorized “pl deploy in crm, all the fixes”. The browser skill was used to upload the four
release artifacts through the existing cPanel session and run the target-locked installer.

## Deployed identity

- URL: https://crm-test.nysarealty.com/?release=2.1.0-dev.178
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`.
- Database: `nysareal_nysa_r2_rehearsal`.
- Installed/served version: **2.1.0-dev.178**; health process ready and database readiness ready.
- Package SHA-256: `1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`.
- Package size 9,691,277 bytes; 297 entries; 16 runtime changes against exact deployed dev.176.
- Latest migration **114_commission_independent_transaction_closure.sql**; **113 total**.
  Existing 001–112 byte-identical; deferred migration113 intentionally absent.
- Exactly one verified Test LiteSpeed listener: **PID280206**.
- Installer SHA-256: `9df9473c5853cf4cce840b97917ac0a4bc4ca38c5cff53f9c3d7ff6a4dda34f1`.
- Host log: `/home/nysareal/dev178-deployment-20260903-approved.log`.

Installer verified every installed runtime hash, disabled integration switches, retained financial
tables/immutable proof controls and same-Deal proof FK, absence of the commission receipt closure
trigger, and absence of deferred receivables. Production and R2 package fingerprints unchanged.
Publicly served commission-payout-ui.js, accountant-workspace-ui.js and money-input.js hashes
match the isolated package. Browser renders the sign-in page; no credentials entered or original
user transactions changed to manufacture functional acceptance.

## Fixes included

Previous dev.174–176 corrections are retained. Accountant sees only Dashboard, Opportunities,
My Leave and Finance Receipts, with server restrictions. Finance references are Opportunity-first;
receipt amounts accept K/M with validation; commission proof upload remains. Receipt messaging
does not describe collection as a transaction closure gate. Managed-team Managers can complete
standard commercial review/approval/closure without extra MD approval. Custom Director-only
items remain protected. Both API and migration114 remove commission collection as a Close Won
prerequisite. Other closure evidence/compliance/approval/alignment checks remain. Collection can
continue after closure without inventing receipts, credits or payouts. Director payout approval
is unchanged. Receivables/invoicing/VAT schedules and new Accountant payout requests are deferred.

## Verified rollback point

Before replacement, installer created and verified:
`/home/nysareal/crm-backups/consolidated-crm-test-dev178-20260902T204149Z` (mode700).

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| pre-dev178.dump | 1,288,043 | `6564ff46c009f9c046b8a20095ccdbe56ce934d5212aa913400896a80cd5f118` |
| pre-dev178-app.tar.gz | 9,505,723 | `b8dd7d49ce0ff4382c699b08742d933e61649d358a5f2e57b40464b9ef32831a` |

PostgreSQL archive and application tar listings verified. Backup stayed private on the host;
contents were not downloaded. Existing .env/private evidence retained. No rollback needed.
Restoring a database over subsequent writes or reinstating the old closure policy requires
deliberate approval. Do not silently discard receipts or proof uploaded after this release.

## Verification boundary

Exact isolated ordinary suite: **1,336 total /1,287 passed /49 protected skips /0 failed**,
including two exact package/installer checks. Separately enabled synthetic database checks:
6 proof/access +11 prior runtime +1 migration/rollback +2 unpaid closure +2 commercial sale
+2 commercial rental = **24 passed**. See dev178 logs and deployment plan for harness corrections.
These results do not establish human acceptance or original-record repair. All user-reported
failures, including SPEC-GAP-002, are **deployed pending human retest**, not marked human passed.

Screenshots: `docs/uat-evidence/2026-09-03-dev178-deployment/01-installer-confirmed.jpg`,
`02-health-backups.jpg`, `03-served-asset-hashes.jpg`.
Historical dev.174 SHA `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`,
migrations108–110, one-worker observation and 1,291/1,261/30 protected skips/0 failed preserved.
Production, R2/Production clone and Property Finder not targeted. No new production personal data.
