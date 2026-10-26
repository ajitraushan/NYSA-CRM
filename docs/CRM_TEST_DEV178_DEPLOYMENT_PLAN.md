# CRM Test dev.178 deployment plan — 2026-09-03

User authorization: “pl deploy in crm, all the fixes”. Target remains CRM Test only,
https://crm-test.nysarealty.com/, `/home/nysareal/nysa-core-dashboard-dd6262a-stage`,
database `nysareal_nysa_r2_rehearsal`. Production, R2 clone and Property Finder excluded.

## Baseline and exact candidate

Observed pre-deployment: installed/healthy dev.176; one Test worker, PID 2851276.
Baseline package SHA-256 `5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`;
latest migration 112. Existing rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.
Canonical HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`, dirty work preserved.
Canonical provisional dev.177 is NOT deployed. Build isolated from exact dev.176 plus approved changes.

Candidate `nysa-core-consolidated-crm-test-dev178.zip`: 9,691,277 bytes, 297 entries,
SHA-256 `1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`.
Installer SHA-256 `9df9473c5853cf4cce840b97917ac0a4bc4ca38c5cff53f9c3d7ff6a4dda34f1`.
113 migration files: unchanged 001–112 plus 114. Migration 113 and receivables excluded.

## Scope

Retains previous dev.174–176 fixes and commission proof upload. Adds Accountant four-workspace
navigation and server access boundary, minimal finance Opportunity view, Opportunity-first
references, K/M receipt amounts with exact validation, receipt-only wording, scoped Manager
commercial closure, and commission-independent transaction closure at API and database levels.
Migration 114 drops only the commission-receipt closure trigger. All other governed closure
checks and immutable financial evidence remain. Manager operational closure requires no extra
MD approval; Director-only payout approval remains unchanged. No receivables, invoices/VAT
schedules or new Accountant payout-request workflow in this release.

## Verification and execution gates

Exact isolated suite: 1,336 total / 1,287 passed / 49 protected skips / 0 failed, including two
package/installer checks. Separately enabled local DB checks: proof/access 6/6, prior UAT
runtime regressions 11/11, migration/rollback 1/1, unpaid closure 2/2, commercial sale 2/2,
commercial rental 2/2. Initial isolated harness lacked historical support files and had stale
version assertions; support was restored and assertions changed only for release identity.
An attempted combined no-isolation DB invocation shared a closed pool; separate invocations
above passed. These are not human UAT results. Bash syntax checked before upload.

Installer verifies exact target, hash, prior schema/files and disabled external switches;
takes a private fresh PostgreSQL archive and application tar (including .env), checks both;
then installs, migrates and restarts only verified Test workers. Postchecks require healthy/ready
dev.178, latest migration 114/count113, no receipt closure trigger, preserved proof/finance
contracts, no receivables, exactly one Test worker and unchanged protected package fingerprints.
No genuine user transaction is closed or receipt confirmed just to demonstrate deployment.

Rollback requires the paired fresh pre-deployment backup. Reintroducing the old receipt closure
gate or overwriting intervening records must be deliberate and authorized, not automatic.
Private proof storage is preserved. Production data/schema/config are not changed.

Historical dev.174 identity remains: SHA-256
`30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations108–110,
one-worker observation, 1,291 total /1,261 passed /30 protected skips /0 failed.
