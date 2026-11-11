# DEV270 D-2 review draft

**CRM Test application and package evidence is ready for review. The Production read-only preflight source is ready for review. The separate Production backup, install and smoke operator is open. No upload or hosted action has been performed.**

## Candidate and baseline

| Item | Value |
|---|---|
| Candidate | `2.1.0-dev.270`, `15d1b7e7a620a75c995a125fa10d2930b2403fc9` |
| Advertised ref | `origin/codex/prod-prospect-upload` |
| Package SHA-256 | `1c6649d284af81d5550f612b2142fad707585b7c2da2d072c4ec163851496291` |
| Origin manifest SHA-256 | `9f08bb92340eab228c9f78e9403d4303d9a4e9b1545d7da679856f023fc289f3` |
| CRM Test deploy config SHA-256 | `918485f5595b83e4f95c6d24c39003fb1368f322922f611f59c487f41dff43bd` (LF and generated on-disk bytes match) |
| CRM Test installed baseline | DEV269 `e5db302e12a21d2597ecab0dc340fa2eae534381`, `nysareal_nysa_dev247_smoke`, 170 migrations, 306 tables, 111 triggers |
| Last recorded Production baseline | RC1 `b6e013c51f46be482858e733160fa7e675ff3106`, `nysareal_nysacrm`, 140 migrations, 258 tables, 108 triggers |
| Candidate schema | 171 migrations, 307 public tables, 111 triggers on both PostgreSQL 13.23 rehearsal paths |
| CRM Test baseline schema manifest SHA-256 | `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944` |
| Candidate schema manifest SHA-256 | `ecc526b734cb42116ec00cd5d55b4ade0916df2e02c5673f7be7ab37fbc92e8b` |
| Canonical CRM Test operator SHA-256 | `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911`, from candidate origin commit. Verified identical to the DEV269 approved operator source. |

The local origin package build and provenance verification passed. `DEV270_CONFIG_HASH_VERIFICATION.json` independently binds the generated config to the same package and manifest and pins both schema manifests. `DEV270_SHA256SUMS.txt` lists the operator, its dependencies and the release artifacts. The provenance manifest records 1,699 tests, 1,593 passed, 106 skipped, and zero failures. `GOVERNED_SKIPPED_TESTS.txt` names the 106 skips from the governed source run. The selector excluded 94 historical artifact test files separately.

## Verification

- PostgreSQL 13.23 ran the actual application migration entry point from a Production-shaped migration-140 fixture with no CRM Test database role. It reached 171, matched the full candidate catalog contract, and wrote no 169 cleanup audit entry. See `PRODUCTION_SHAPED_PG13_REHEARSAL.json`.
- The synthetic historical CRM Test drift replay matched the accepted pre-recovery catalog, removed exactly 12 simulated orphan messages and five orphan notifications, emitted one audit record, restored the full historical catalog, and continued to 171. See `CRM_TEST_HISTORICAL_DRIFT_PG13_REHEARSAL.json`.
- The upload and Prospect Diary PostgreSQL integrations passed (see `PG13_INTEGRATION_RAW.txt`). Covered CSV and XLSX, all row outcomes, UAE phone normalization, Agent and Manager scope, Director preview, email-only ownership, suppression and follow-up blocking, batch audit, skipped-result download and idempotent commit. The parser accepted 2,000 rows and refused 2,001.
- Agent and Manager preview and commit passed in Chrome through the exact extracted package at `/index.html`. The locally booted Production-mode application was ready, omitted WhatsApp campaign navigation, and returned 404 for the tested WhatsApp, campaign and simulator routes. See `EXACT_PACKAGE_BROWSER_RESULT.json`.
- The RC1 and accepted DEV269 versions of `src/crm-policy.js` match byte-for-byte. The `leadScopeSql` change is deferred. Conversion follow-up carryover and hiding the converted-record activity form are deferred.

## Production setting names

`PGDATABASE`, `PGUSER`, `LEAD_RESPONSE_ENVIRONMENT`, `NYSA_ENVIRONMENT`, `LEAD_WHATSAPP_ENABLED`, `LEAD_WHATSAPP_INBOX_ENABLED`, `WHATSAPP_SANDBOX_ENABLED`, `WHATSAPP_SANDBOX_CALLBACK_APPROVED`, `WHATSAPP_SIMULATED_PROVIDER_ENABLED`, `PROSPECT_OUTSIDE_CALLING_HOURS_MODE`. Exact live selector settings and current worker inventory require an approved Production preflight.

## Migrations 141–171

- 141_meta_lead_source_inbox.sql — schema only
- 142_nonvoice_follow_up_jobs.sql — schema only
- 143_lead_integration_setup.sql — schema only
- 144_nonvoice_response_workflow.sql — schema only
- 145_nonvoice_provider_inbox.sql — schema only
- 146_cpanel_email_cursor.sql — schema only
- 147_nonvoice_handoff_pending.sql — schema only
- 148_nonvoice_ai_chat.sql — schema only
- 149_nonvoice_chat_budget.sql — schema only
- 150_nonvoice_delivery_evidence.sql — schema only
- 151_nonvoice_protected_connections.sql — schema only
- 152_nonvoice_pause_control.sql — schema only
- 153_nonvoice_retry_health.sql — schema only
- 154_nonvoice_manager_escalation.sql — schema only
- 155_website_shared_lead_response.sql — schema only
- 156_nonvoice_unassigned_response_queue.sql — updates existing follow-up queue state
- 157_incoming_leads_campaign_register.sql — schema only
- 158_web_intake_phase1_foundation.sql — seeds initial WEB Intake configuration
- 159_dev248_intake_corrections.sql — schema only
- 160_whatsapp_sandbox_foundation.sql — schema only
- 161_whatsapp_campaign_foundation.sql — schema only
- 162_whatsapp_stage_b_workspaces.sql — schema only
- 163_whatsapp_template_components.sql — backfills template fields
- 164_whatsapp_dev259a_workspaces.sql — backfills WhatsApp workspace fields
- 165_whatsapp_dev259a_review_corrections.sql — backfills WhatsApp approval/suppression fields
- 166_whatsapp_simulated_provider_stub.sql — seeds paused simulator control and grants to the connected role
- 167_whatsapp_simulator_fault_contract.sql — schema only
- 168_restore_governed_trigger_contract.sql — reconciles Lead counters
- 169_restore_full_schema_contract.sql — no Production DML on the canonical path. Historical CRM Test drift path deletes 12 messages and five notifications and records one audit
- 170_prospect_diary.sql — backfills shared suppression restrictions. Task cancellation code runs only on later Prospect status changes
- 171_prospect_upload.sql — adds upload records, batch linkage and email-only Prospect support. No existing row rewrite in migration SQL

## Security, rollback and approval boundary

The upload checks actor and selected owner scope on preview and commit, uses a server-issued review token, rechecks duplicate and suppression outcomes during commit, and records the uploader, target owner, timestamp, file name, SHA-256, and counts. Results expose row numbers and scope-safe reasons. Files are parsed in memory. Upload writes only batch evidence, Prospects and any supplied notes. It creates no calls, tasks or WhatsApp consent.

The hosted deployment controls in `CRM_CHANGE_POLICY.md` and mandatory exact-root worker verification in `AGENTS.md` apply. CRM Test A–D require four exact approvals, new output paths, exact origin file downloads and host SHA-256 checks. Use the canonical operator directly by path with a scoped-backup path. Phase B must create fresh verified app and database backups. Stop only exact-root command/CWD-verified workers and require green readiness and exactly one verified worker before acceptance. Rollback before readiness restores application files and the selector environment. A database restore requires separate approval.

Production remains on hold. The CRM Test operator is expressly tied to the Test root/domain and sets its simulator on. The read-only Production preflight source is `tools/production-prospect-readonly-preflight.mjs` at `16da8bbccac6ad940c02f9ab51806707a52f70e9`, SHA-256 `36ecbf8fac1cecd92346c172c46b07bd25db12430bc1f0fe0474c1687905a78f`. The full RC1 schema expectation, preflight config and local receipt are included. PostgreSQL 13.23 reproduced the exact P-6 catalog counts. The preflight logic rejected a wrong database identity, a simulator-enabled registration and a trigger difference locally. The successful catalog assertion used the disposable database and a substituted name in the reported identity. The Linux selector, real registration, disk and /proc checks still require the separately approved hosted preflight. A separately reviewed Production backup, install and smoke operator, approved fresh application archive and PostgreSQL 13.23 custom dump, and phase-specific receipts are outstanding. Production disk use must be below 90% before backup. Hosted paths and absence have not been checked. No Production phase starts after 18:00 Dubai on 12 November. WN-15 remains paused.
