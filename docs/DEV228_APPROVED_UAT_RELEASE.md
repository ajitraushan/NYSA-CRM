# DEV228 — DEF-134–137, CRM Test only

Scope: four approved defect references, including the acceptance-record PDF explicitly requested under DEF-136. No enhancements, database migrations, routing-rule updates, data correction or historical acceptance rewrites. Production and R2 are excluded.

Source baseline: DEV227 `00d391f3182ba6117ae7a156c36f0b3045c0d4a5`; migration 136 remains the latest. Implementation verification and the unproven prior acceptance-mismatch limitation are recorded in `UAT_DEF134_137_FIX_VERIFICATION_2026-10-25.md`.

Runtime changes are the seven files listed in that verification report, plus package version metadata for `2.1.0-dev.228`. Existing test changes only advance version assertions; functional assertions are retained. New focused tests and a rollback-only synthetic issuance integration test accompany the fixes. Release/hosting companions are versioned copies of the governed DEV227 deployment flow, targeting the same exact CRM Test root/database. No Calendar provider refresh is performed for this release.

Build only with `npm run release:package -- --commit <full-advertised-origin-SHA>`; run `npm run release:verify-package -- <zip> <manifest> <manifest-sha256-file>` before deployment. The detached GitHub-source builder must pass the release suite and record source and package hashes. Untracked diagnostics, letterheads, designs and local evidence are excluded from runtime packaging.

Before mutation the deployer verifies the exact DEV227/136 baseline (or exact DEV228 rerun), takes and validates a fresh database dump and application archive, verifies package provenance and runtime checksums, and records protected-environment package snapshots. It checks all ten existing approved PDF formats, health/readiness/version, migration count, runtime hashes and the Test worker. Application rollback restores the fresh DEV227 application archive; no schema rollback is necessary.

This source plan does not itself confirm deployment. Final result, GitHub SHA, package hashes, backup and hosted smoke checks are recorded separately under `uat-evidence/release-dev228-20261025/`.
