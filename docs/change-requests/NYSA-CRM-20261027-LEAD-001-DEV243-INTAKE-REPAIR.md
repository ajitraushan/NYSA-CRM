# NYSA-CRM-20261027-LEAD-001 — DEV243 intake repair

## Authorization and target

- Target: CRM Test and `staging.nysarealty.com` only.
- Observed baseline: CRM Test `2.1.0-dev.242`, Git commit `e41bb0bb9b787ffa04526b1a783c0e13542500b3`, migration 155; staging bridge version 1.0.0.
- User acceptance input on 27 October 2026: one synthetic/approved NIA submission and one Contact Us submission.
- Production, production data, users, passwords, assignments and configuration remain unchanged.
- WhatsApp, email, Meta and voice sending remain disabled. This change captures and displays test intake only.

## Evidence and root cause

- The Contact Us request reached CORE and created a canonical Lead. CORE returned `setup_required` for the Lead Response case because no valid fallback owner had been configured.
- The DEV242 WordPress bridge incorrectly treated that partial 2xx response as fully accepted, cleared its retry payload and left the Lead without a Lead Response case.
- NIA writes to the active WordPress route `/nysa/v2/advisory-assessments`. The DEV242 bridge listened to the obsolete `/nysa-ai/v1/leads` route, so the submitted NIA assessment did not enter the bridge outbox or CORE.
- No customer values or credentials were copied into this evidence record.

## Repair

1. Listen only to the active NIA assessment route and derive the idempotency key from its `assessment_id`.
2. Require both `leadId` and `followUpCaseId` before a WordPress delivery becomes accepted and its payload is scrubbed.
3. Keep `setup_required` deliveries recoverable as `needs_setup`; retry them without enabling outreach.
4. Recover accepted website Leads that were saved before fallback setup and have no Lead Response case.
5. Configure the already-approved pilot fallback owner in CRM Test only, preserving every other setup field and recording an audit entry.
6. Keep website recovery independent of Meta credentials by using the existing website intake actor.

The original NIA submission cannot be reconstructed because it never entered the bridge. It must be resubmitted once after DEV243 is deployed.

## Verification and preservation

- Governed release suite: 1,550 tests; 1,459 passed, 91 skipped, zero failures.
- Disposable PostgreSQL rehearsal: all 155 migrations and 50 non-voice workflow checks passed with synthetic data, including the new recovery and idempotency case.
- No migration is added. The CRM Test code deployment verifies all 155 existing table contents are unchanged before restart.
- The fallback-owner configuration changes only `lead_integration_setup.draft.fallbackOwnerId`, increments its revision and writes immutable audit evidence. Outreach remains paused.
- The staging update is hash-gated to the exact DEV242 plugin and preserves its outbox rows.
- A fresh paired CRM Test/staging backup and encrypted off-server copy must be verified immediately before deployment.
- The release must be packaged only from its GitHub-advertised commit and pass `release:verify-package` before deployment.

## Acceptance

1. The existing Contact Us Lead has exactly one Lead Response case after recovery.
2. Lead Response shows source **Website / NIA** and does not invent missing consent, country or requirement data.
3. Resubmit one NIA test after deployment; it reaches the WordPress outbox and CORE and opens exactly one Lead Response case.
4. Submit one new Contact Us test; it opens exactly one Lead Response case.
5. Confirm no WhatsApp, email, Meta, REM or voice message is sent.
6. Confirm CRM production remains byte-identical at the package identity check and is not restarted.

## Rollback

- Stop CRM Test, restore the paired pre-DEV243 database dump and application archive, reinstall locked production dependencies, and restart CRM Test on DEV242.
- Restore the prior staging bridge file from the paired backup; the WordPress database dump remains available if a data rollback is required.
- Re-verify CRM Test readiness, live integration flags, staging bridge activation and production identity.
