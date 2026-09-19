# CRM Test dev.179 deployment — 3 September 2026

Owner requested deployment for testing of the completed Opportunity-first receivables rework.
AGENTS.md, CRM_CHANGE_POLICY.md and BASELINE.md read in full. Test only; Production,
R2/Production clone, Property Finder, external delivery and new payout approval work excluded.

Baseline: served/installed dev.178 verified via existing cPanel terminal. Exact baseline package
SHA `1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`, migrations114/count113.
Source snapshot and guarded synthetic database rollback are recorded in
`OPPORTUNITY_FINANCE_REWORK_20260903.md`; canonical dirty source remains unchanged by packaging.

Candidate: `nysa-core-consolidated-crm-test-dev179.zip`, 9,719,897 bytes, 306 entries,
SHA `e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434`.
19 runtime changes (including package metadata), from exact178. Every already-deployed migration
and unrelated runtime file retains its exact178 bytes. New migrations:113,115,116; target count116.
Installer SHA `bf0041a473e416ca1c90e61b407d5b6ecf5824c06068400c0f7db7a59dbdce04`.
Target `/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`.

## Exact candidate verification

- Ordinary:1,360 total /1,293 passed /67 protected skips /0 failed.
- Receivables HTTP/PostgreSQL:18/18. Proof compatibility/access:6/6.
- Manager closure with outstanding commission and later Accountant collection:2/2.
- Package/hash/immutable historical migration/installer guard assertions:2/2 separately.
- Initial isolated ordinary run found provisional version assertions and missing local verification
  support files; corrected only isolated test harness/support, no runtime/package changes. Final
  ordinary evidence:`dev179-isolated-ordinary-rerun.log`.
- Initial closure run lacked the existing synthetic organization's private fixture logo. Rerun with
  the explicit canonical local fixture storage path passed2/2; no remote data or production evidence.
  Evidence:`dev179-isolated-closure-rerun.log`, `dev179-isolated-ar.log`, `dev179-isolated-proof.log`.

## Scope and safety

Opportunity-first schedules/invoice register, separate invoice per instalment, 5% VAT, partial
collections with one gross payment producing its linked net receipt atomically; Opportunity proof
and reconciliation work without a Deal. Accountant receives only Dashboard, Opportunities,
My Leave, Finance Receipts and Receivables. Director payout approval and commission-independent
Manager closure remain. Historical financial evidence is retained, not rewritten or autoallocated.
No statutory invoice PDF, bank execution, credit-note subsystem or new payout workflow included.

Installer requires exact root/database/baseline/hash, verifies existing migration bytes, makes fresh
custom DB dump and app archive before writes and verifies both archives. It preserves `.env` and
private storage, restarts only verified Test listeners, checks116 migrations, runtime manifest,
health/readiness, one worker, disabled integration switches and unchanged protected package hashes.

Rollback must restore paired Test database/application backup, with a separately restored recovery
database checked first. Do not drop finance columns or revert app alone after new finance entries;
preserve any postdeployment evidence and coordinate recovery if human testing has begun.
Human UAT remains pending. Historical dev.174 SHA,108–110,one-worker observation and1291/1261/30/0
remain untouched. Manager closure on178 is the user's reported pass, not acceptance of179 finance.
