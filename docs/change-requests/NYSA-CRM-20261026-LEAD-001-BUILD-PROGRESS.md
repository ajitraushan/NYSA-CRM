# Nonvoice implementation progress

Reference NYSA-CRM-20261026-LEAD-001 v1.2 â€” 27 October 2026

## Baseline and target

Isolated development worktree at origin/main 4f1034167c591acb87fe9c025af48835d58630e3, package 2.1.0-rc.1, migration head 140. Only design/change-request documents existed as local changes at build start. No production data copied. Development rollback: revert this increment's tracked diffs and remove only its identified new files; preserve all prior design documents. Target is local synthetic testing, not Production/CRM Test deployment. Production's prior observed baseline is recorded in v1.2; no live health check was performed here.

## Increment 1 implemented

- Default-disabled Meta GET verification and signed POST notification receipt, approved Page allowlist, 256 KiB ingress bound, reference validation, duplicate/altered-reference handling and durable receipt only after database transaction.
- Additive migration 141 creates reference-only lead_source_inbox, unique source/account/event key and pending-work index. No raw lead answers/contact details stored in this table. Migration drafted, NOT APPLIED or rehearsed against PostgreSQL yet.
- Nonvoice domain rules: UAE/India confirmed-location eligibility, local message hours and immediate acknowledgement exception, source digests, generation cancellation on reply/takeover/opt-out/booking, unknown-outcome pause, template/permission/cap/budget gates, advisory tier with unknown facts retained.
- Domain functions are a tested policy foundation, not a durable step scheduler or live messaging worker. They are not wired to send adapters.

## Verification

26 targeted tests passed, 0 failed, 0 skipped: new domain/HTTP tests plus existing communication-domain regression. Command: node --test test/lead-follow-up-domain.test.js test/meta-intake.test.js test/communication-domain.test.js. HTTP tests use an injected synthetic transaction fixture: they verify route behavior, not actual PostgreSQL locking, migrations or concurrent uniqueness. Module syntax checked. Full regression, real-database tests and package provenance build remain pending.

## Explicitly incomplete

Meta Graph retrieval/token refresh and reconciliation; mapping new consent/form versions; CRM customer/lead linking and identity review; durable sequence jobs/leases; WhatsApp/email adapters and inbound processing; conversational AI; calendar booking; handoff/digest/operational UI; permissions and budget ledger integration; PostgreSQL migration/concurrency rehearsal; full regression; GitHub PR/CI and verified candidate package. Voice code is excluded pending the route gate.

## Configuration and activation boundary

The endpoint requires META_INTAKE_ENABLED=true, META_APP_SECRET and META_WEBHOOK_VERIFY_TOKEN (distinct protected values of at least 32 characters), and comma-separated numeric META_ALLOWED_PAGE_IDS. Defaults are disabled. Do not configure/subscribe a live Page yet: pending_retrieval currently has no retrieval worker, visibility UI or complete operational recovery. The webhook response truthfully says durably_received, never lead_created. Meta event IDs, not expiring signatures, provide replay deduplication; source binding and HMAC authenticate the reference. Full retrieved form evidence integrity belongs in the next increment.

No outbound calls/messages, provider signup, workflow changes, packaging, deployment, production schema/configuration/data changes or migration application performed. Existing users/passwords/teams unchanged. Private customer evidence and production snapshots not used.

## Full sign-off incorporation â€” 27 October 2026

The complete Sign-off NYSA-CRM-20261026-LEAD-001 v1.1 (full).docx supersedes the earlier truncated note and inferred defaults. Updated v1.2 in place; prior copy retained as PRIOR-SIGNOFF-HISTORY. Approved exact timing, budget, chat and scoring decisions recorded in sections 6, 7, 18, 19 and 24. Estimate revised to 17â€“25 working days plus external waits; conditional 28 October start yields 19 Novemberâ€“1 December readiness, not deployment approval.

Policy foundation updated: unknown/mismatched country/timezone now blocks every automated channel including step 0; only AE/Asia/Dubai and IN/Asia/Kolkata accepted. Added approved limit constants (USD 20 voice/day, USD 10 messages/day, Dubai reset, 8-minute call duration, concurrency 2), 24-hour responsive-chat eligibility with handoff after 10 replies without progress, and explicit Immediately timeline normalization. These are policy helpers/constants, not a running budget ledger, chat provider or voice implementation. Remaining integration work above still applies.

Verification refreshed: 29 targeted tests passed, 0 failures/skips, using the same three test files. No migration applied or PostgreSQL integration verification yet. Diff whitespace checks pass. No calls/messages or production changes. Existing users/passwords/teams unchanged.

## Increment 2 â€” durable jobs and the requested user interface

Local development only, 27 October 2026. The build continues from the same clean-main baseline plus increment 1. Production and CRM Test have not been modified.

Implemented:

- Migration 142: durable cases, six nonvoice steps (0/2/3/5/6/7), prerequisite waits, job leases and idempotent channel events. Voice-dependent steps stay waiting; there is no voice adapter or fabricated call outcome.
- Case creation requires an accepted source-to-lead link, new/unassigned lead and active operating fallback. Nonpilot/unknown location or incomplete permission creates an existing CORE task with no automation jobs. No staff, password, team or lead ownership changes.
- Replies cancel scheduled generations and preserve accountable work. Claimed sends become unknown for reconciliation. Late opt-out still applies after booking and records the authoritative contact restriction. Expired claims are not blindly redelivered.
- Migration 143 plus Administration â†’ Lead integrations: audited nonsecret setup drafts, optimistic revision checks, readiness messages, fixed approved limits and safe aggregate recovery counts. Draft save cannot connect/activate any provider. No API-key/password inputs. Setup refs are not yet wired to provider adapters.
- UI module is loaded through the existing application bootstrap. Operational queues, lead board, digest and real connection/test flows still require implementation; this is the initial setup/status interface.

Verification:

- All 143 migrations applied successfully in a new isolated PostgreSQL 16 cluster on loopback, synthetic data only; no existing database reused. Each run uses a unique schema. This proves fresh-schema compatibility, not production upgrade rehearsal.
- 39 targeted tests passed, including actual PostgreSQL uniqueness/locking, concurrent worker claims, expired-lease recovery, reply/opt-out transactions, Admin operational-role denial, and concurrent audited setup saves.
- Governed release regression: 1,540 tests, 1,449 passed, 91 skipped, zero failures. Database-specific test remains opt-in; it was run separately above. Fixed an existing Windows-only source-inspection test reader to normalize CRLF; lifecycle assertions and runtime behavior unchanged.
- Headless local browser checked setup draft save, status feedback, desktop/mobile rendering and absence of mobile horizontal overflow using actual application CSS and synthetic API responses. Screenshots visually inspected; not a full authenticated CRM Test UAT.
- Diff whitespace and module syntax checks passed. No package built or deployment performed. No external channel traffic.

Database test command: NYSA_FOLLOWUP_DB_TEST=local-synthetic with a protected local dependency path, then node --test test/nonvoice-follow-up-postgres.test.js test/lead-follow-up-domain.test.js test/meta-intake.test.js test/communication-domain.test.js. The fixture hardcodes loopback port 55481 and validates dedicated database/user identity; it ignores ambient production PG configuration. Temporary cluster is stopped after verification and synthetic evidence retained privately in local Temp.

Next: Meta retrieval/mapping and governed customer/lead linking; release dependent jobs from verified evidence; full dispatch eligibility, budgets and provider adapters; inbound authenticated WhatsApp/email; calendar booking; agent board, tiers and digest. Live accounts are prerequisites for provider end-to-end tests, not for local synthetic development. CRM Test deployment waits for a completed reviewed candidate, advertised GitHub source and canonical package verification. The held Admin invitation fix is not included.

## Increment 3 — nonvoice CRM Test preparation, 27 October 2026

Candidate 2.1.0-dev.240, draft PR #4. This section supersedes earlier increment status lists; it does not claim provider acceptance or remote deployment.

Implemented Meta Graph retrieval with explicit approved API version, encrypted source evidence, consent/form mapping, normalized identity and duplicate review, atomic CORE linking without guessed classification; protected write-only encrypted connection setup; native 360dialog authenticated inbound processing and outbound templates; read-only cPanel IMAP reply ingestion and SMTP TLS delivery; shared conservative USD 10/day reservations; generation/permission/pause/restriction checks immediately before submission; unknown outcome recovery without blind resend; bounded English/Hindi AI booking conversation with evidence and cancellation; scoped agent board, score review, digest, customer-confirmed CORE callback booking, pagination, metrics and enquiry confirmation. Voice prerequisites remain waiting.

User decision recorded: after 30 staffed minutes without Hot acceptance, alert the existing active team manager for manual reassignment. Migration 154 adds idempotent manager alert references. This creates an urgent CORE task, never automatic agent reassignment or a claim that an external WhatsApp alert was sent. Missing manager setup creates an owned urgent setup exception; no team/manager is copied or invented. Existing assignments stay unchanged.

Migrations 141–154 are additive to the version-140 synthetic baseline. All 154 migrations pass; before/after row digests of every original non-ledger table in the seeded migration-140 fixture match. Original synthetic owner/team/password markers remain unchanged. This is synthetic upgrade verification, not a production-data rehearsal or remote backup restore.

Targeted verification: 61 passed, zero failed/skipped, including concurrent claims/budgets/callback slots, replay, opt-out during AI preparation, encrypted credentials, pause, a reply-to-callback journey, and 30-minute manager alert idempotency/missing setup. Prior full release regression: 1,545 tests, 1,454 passed, 91 skipped, zero failures. Final isolated origin build receipt is authoritative for the packaged commit.

Local synthetic UI was inspected using actual CSS and modules, including setup save, scoped response details and Dubai callback date/time with India local-time preview. This is not authenticated CRM Test UAT. No provider credentials entered, external calls/messages sent, mailbox read or remote database modified. Production and CRM Test remain unchanged.

Open acceptance items: real Meta/360dialog/email/OpenAI connectivity and approved test recipients/templates/consent; Sunita's operating identity/team setup; external calendar availability/two-slot automatic booking/invitations; internal WhatsApp handoff notifications; exception resolution/reconciliation actions; provider-end-to-end and two-minute load acceptance. Customer-confirmed CORE callback fallback is implemented and truthfully reports calendar not connected. Native WhatsApp messages without a context reference that match multiple prior outgoing messages are safely held for review. Website intake follows the approved Meta canary and is not represented as connected. These gaps prevent live canary activation; the candidate is for disabled-feature CRM Test review.

Dependency audit: npm reports 9 high and 1 moderate findings in the existing Puppeteer/browser dependency tree; none were reported for the three added pinned email packages. No unrelated browser/PDF dependency upgrade was made.

Release metadata assertions in historical feature tests now expect DEV240; behavior assertions are unchanged. The first final regression correctly rejected the old RC1 expectations after the version bump; the refreshed run and isolated package receipt follow.

Final working-tree release regression: 1,545 tests; 1,454 passed; 91 skipped; zero failures. All changed JavaScript syntax and Git whitespace checks pass. The 61 opt-in targeted tests were run separately against the dedicated synthetic PostgreSQL fixture.

## DEV241 manager-owned escalation correction - 27 October 2026

User-approved follow-up to DEV240: prevent manager self-escalation; use a distinct active reporting manager from CORE primary-team reporting line, otherwise owned overdue/manual-review task. No ownership/password/team/configuration changes. Recipient gets case-scoped read access for the alert lifetime, not new write authority. 62 targeted tests passed including all 154 migrations, manager routing edge cases and concurrent duplicate suppression. Migration count unchanged; no new migration. Production and installed Test unchanged. Origin package receipt records final regression.
