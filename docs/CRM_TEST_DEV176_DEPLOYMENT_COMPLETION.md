# CRM Test dev.176 — deployment confirmed

Date: 2 September 2026. Target: https://crm-test.nysarealty.com/ only.
Owner authorized dev.176 only, then explicitly answered “ok” to uploading the package,
checksum, manifest and installer to `/home/nysareal` before installing into CRM Test.
Earlier upload permission blocks caused no installation. A subsequent file-chooser
timeout also caused no installation; all four uploads were finally observed complete.

## Release identity and live checks

- Installed/served version: **2.1.0-dev.176**.
- Package: `nysa-core-consolidated-crm-test-dev176.zip`, 9,860,577 bytes, 299 entries.
- Package SHA-256: `5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`.
- Executed installer SHA-256: `3e923690b42a29f85ae1adbb45dd44e7ead00e078063e26f6d9b03fd0edb6010`.
- Installer completed with `Deployment confirmed` and exit **0**.
- Health: `{"ok":true,"process":"ready","version":"2.1.0-dev.176"}`.
- Readiness: `{"ok":true,"database":"ready","version":"2.1.0-dev.176"}`.
- Registered migrations: **112**, latest `112_dev176_commission_proof.sql`.
- All 111 previously applied migration files matched before replacement. Only migration 112 was added.
- One verified Test LiteSpeed listener: PID **2851276**, independently observed again after installation.
- Exact installed runtime manifest passed. Served `/commission-payout-ui.js` SHA-256
  `8a41ee3a8105a2c1dfb2cc54f453220e06213c430c6ec3f2f45144e8b7d444d3`
  matches the isolated candidate.
- Proof table, same-Deal receipt FK, immutable proof trigger and audit entity checks passed;
  excluded receivables table absent. Existing database contract passed.
- Browser at the release-specific Test URL rendered the sign-in screen. No login credentials
  were entered, and no original business records were modified to claim functional acceptance.
- Host log: `/home/nysareal/dev176-deployment-20260902-approved.log`.

## Fresh rollback point

Created and checked before application replacement:
`/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.

Directory mode **700**; PostgreSQL archive listing, application tar listing and checksums verified.
Backup content stayed on the host; it was not downloaded or printed.

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| pre-dev176.dump | 1,280,980 | `a79c32f8a287873ad82609f2a3f671a6f3dba5d5820214d9592d9663ac21ee5d` |
| pre-dev176-app.tar.gz | 9,500,201 | `628caf789e6b9949a2cade3e0acdd31779407814cab199dc91087bcfac30b8cd` |

Existing .env and private evidence storage were preserved. The app backup includes .env.
Rollback must retain uploaded proof/audit records and additive migration 112 compatibility.
Restoring the paired database over intervening user writes requires approval. No rollback was needed.

## Tests and acceptance boundary

- Isolated candidate ordinary suite: **1,315 total / 1,268 passed / 47 protected skips / 0 failed**.
- Separately enabled local DB checks: **5 proof/finance + 11 prior UAT regressions + 2 governed closure passed**.
- Exact-package/installer checks: **2 passed**. A process-isolated invocation hit sandbox `spawn EPERM`;
  `--test-isolation=none` completed both checks without changing the package.
- Bash syntax passed; local snapshot and package hashes preserved.
- These are machine checks and deployment verification, not human UAT passes.
- All previously user-failed issues remain pending human retest. Original booking persistence,
  suspected Deal-stage bypass and the second Lead's contact/pipeline interpretation remain unproven
  on the user's original records. No user-record repair was performed.

## Scope and protected environments

Dev.176 includes earlier dev.174/175 corrections, private commission-proof upload/history/download,
same-Deal proof selection, receipt history, Accountant/Director/full-Administrator Finance Receipts
navigation and receipt calendar-date correction. Only nine runtime files differ from dev.175;
this is not a count of defects. The cumulative register has 24 items, including one specification gap.

Local provisional dev.177, migration 113, receivables/invoices/VAT schedules, broader Accountant menu
changes, Accountant payout requests and commission-independent Deal closure were excluded.
Existing receipt closure gate and Director-only payout remain unchanged. Proof upload is not payment
confirmation. Proof access is private and scoped; no production personal data was copied.

Production and R2/Production clone were not targeted; their package fingerprints remained unchanged.
Property Finder, Microsoft 365 and Calendly switches stayed disabled. Historical dev.174 SHA
`30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
one-worker observation and **1,291 / 1,261 / 30 protected skips / 0 failed** remain unchanged.
Historical dev.175 deployment, rollback and test evidence also remains unchanged.

Evidence: `docs/uat-evidence/2026-09-02-dev176-deployment/01-health-backup-worker.jpg`
(SHA-256 `8bb4377a7d05aaaaaaca636a87fdbc2ccb3536ed5147b6effed2b032a18b3bb8`),
and `02-installer-served-asset.jpg` in the same directory
(SHA-256 `c206f6cd679f72fbf1b32526e6e6e07a552c5662d3e367f7a06cba6d41c09364`).

Status: **dev.176 deployment complete; human UAT pending**.
