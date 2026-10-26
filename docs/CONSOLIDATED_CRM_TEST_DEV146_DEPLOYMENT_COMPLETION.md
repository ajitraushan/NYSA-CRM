# NYSA CORE Consolidated CRM Test dev.146 — Deployment Completion

**Date:** 15 August 2026 (Asia/Dubai)  
**Version:** `2.1.0-dev.146`  
**Target:** CRM Test only  
**State:** deployed and technically verified; focused owner UAT remains pending

## Deployment evidence

- The checksum-bound dev.146 ZIP, SHA-256 file, JSON manifest and deployment script were uploaded
  to `/home/nysareal/` and the package checksum, JSON manifest, internal manifest and runtime
  manifest were verified.
- The installed and served version is `2.1.0-dev.146`.
- `/api/health` reports process ready and `/api/readiness` reports database ready.
- Migration inventory is 95, with `095_dev146_full_scope_uat_governance.sql` current.
- The consolidated database contract, including `offer_replacement_actions` and
  `opportunities.next_action_code`, passed.
- Property Finder, Microsoft 365 Email and Calendly enablement flags are disabled in the live CRM
  Test worker environment.
- The exact installed runtime manifest matches the candidate.
- Production and Production/R2 clone package snapshots remained unchanged.
- The verified pre-dev.146 database and application backup is retained under
  `/home/nysareal/crm-backups/consolidated-crm-test-dev146-20260815T181445Z`.

## Worker hygiene

The pre-deployment gate found two workers with the exact CRM Test application label and stopped
before changing files or the database. Both verified CRM Test processes were replaced through the
CRM Test restart marker, and the service was normalized to one fresh worker. A stale worker that
retained the prior Property Finder sandbox environment was subsequently replaced after the saved
cPanel setting was changed to `0`.

The final account-level Node process audit found exactly one live Node process: the single CRM Test
worker. No duplicate, idle, orphaned, Production, Production/R2 clone or preview Node worker
remained to remove. Stopped cPanel application definitions were retained because they are not live
workers and deleting them would be unnecessary and destructive.

## UAT disposition

UAT-001 through UAT-022 are deployed to CRM Test in dev.146 and remain pending focused owner UAT.
Deployment and automated verification do not mark a business UAT observation as passed. Existing
remote records were not silently repaired; the deployed controls prevent recurrence and provide
the governed recovery paths recorded in the consolidated UAT document.

No deployment or restart was performed against Production or the Production/R2 clone.
