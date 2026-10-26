# CRM Test dev.176-only deployment

Owner authorization: “yes pl only 176” on 2026-09-02, explicitly excluding provisional dev.177 and all newly scoped finance/access/payout/closure changes.

AGENTS.md, CRM_CHANGE_POLICY.md and BASELINE.md read. Target only `https://crm-test.nysarealty.com/`, root `/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`. Live read-only baseline: dev.175, health ready, one exact Test worker PID 4184054. Prior deployment record binds migrations 1–111 and package SHA `80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b`; installer rechecks migrations before mutation.

Source isolated from the pre-receivables dev.176 snapshot, SHA `03f34219c56f78fa1d7951cdec8e95c33d9ebdc257c355b9748f1cc74d2a45e9`, with unchanged root runtime from the exact dev.175 package. Canonical local dev.177 work is preserved and not deployed. Isolation path: `tmp/dev176-only-20260902`.

- Candidate: `nysa-core-consolidated-crm-test-dev176.zip`, 9,860,577 bytes, 299 entries.
- SHA-256: `5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`.
- Installer SHA-256: `3e923690b42a29f85ae1adbb45dd44e7ead00e078063e26f6d9b03fd0edb6010`.
- Exactly nine runtime changes: package files; app navigation, commission UI and proof CSS; commission date normalization, commission routes, new private proof module and migration 112.
- All 111 prior migration files match the dev.175 archive byte-for-byte; only migration `112_dev176_commission_proof.sql` is new. No migration 113 or receivables source.
- Existing commission-receipt closure gate and Director-only payout remain unchanged. Newly discussed restricted Accountant menus, general Opportunity access and payout request/confirmation flow are excluded.

Reverification against isolated source: ordinary **1,315 total / 1,268 passed / 47 protected skips / 0 failed**; separate DB tests **5 proof + 11 prior UAT + 2 governed closure passed**. Logs copied to `docs/dev176-isolated-*-tests.log` (ordinary: `dev176-isolated-deployment-tests.log`). Initial isolated closure run could not find a pre-existing synthetic organization logo because the working directory changed; setting the guarded test's private-storage directory to the existing fixture storage resolved the fixture-path issue. No application/package change was made for that test environment correction. Bash syntax and separate exact-package/installer checks required before execution.

Installer checks exact archive SHA, identity, target, worker socket, database baseline, unchanged applied migrations and disabled integrations. Before runtime replacement it creates a mode-700 paired PostgreSQL dump/app archive and verifies both archive listings/checksums. Preserve .env and existing private evidence storage. Restart only verified Test workers; require one new worker, dev.176 health/readiness, migration 112, proof FK/immutability/audit entity, no receivables table and exact installed runtime hashes. Protected Production/R2 package fingerprints must stay unchanged.

Rollback prefers source restoration while retaining additive migration 112 and any new proof/audit records. A paired DB restore must not discard intervening user writes without approval. Fresh remote rollback path will be recorded after installation. No production data copying, business-record repair, integration activation or human UAT pass is authorized or inferred. Historical dev.174 SHA/migrations/worker/test evidence remains intact.

## Execution outcome — 2 September 2026

Owner explicitly approved the four-file upload to `/home/nysareal`. The exact installer completed
with exit 0. CRM Test serves dev.176; health/readiness ready, migration 112, one verified worker
PID 2851276. Fresh paired rollback is
`/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.
Production/R2 fingerprints unchanged; excluded integrations disabled; dev.177 absent.
See [completion, checksums and acceptance boundary](CRM_TEST_DEV176_DEPLOYMENT_COMPLETION.md).
