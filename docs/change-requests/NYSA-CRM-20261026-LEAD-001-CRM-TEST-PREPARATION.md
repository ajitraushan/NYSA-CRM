# LEAD-001: disabled-feature CRM Test preparation

Date: 27 October 2026, Asia/Dubai. Candidate: 2.1.0-dev.241. Draft PR: https://github.com/ajitraushan/NYSA-CRM/pull/4.

## Baseline and scope

Main source 4f1034167c591acb87fe9c025af48835d58630e3, tree 2416fe6856c2e4417ae1dc4dbae6d0c7ee87aaaf. Isolated branch codex/lead-intake-follow-up-20261027. BASELINE.md records Test DEV239/migration140; remote state has not been verified or modified by this preparation. New paired runtime/database/configuration backups and a verified encrypted off-server copy are required immediately before Test installation. Historical backup alone is insufficient.

Every external channel is disabled. BUILD-PROGRESS increment 3 records implemented features and remaining acceptance gaps. The separate held Admin invitation fix is excluded. Production remains unchanged.

## Test installation plan - not executed

1. Record actual Test version, runtime hashes, migration ledger, flags and health. Take consistent paired runtime/database/configuration backups; encrypt an off-server copy and verify through an isolated restore. Retain recovery keys privately outside Git.
2. Verify the exact advertised-origin commit and archive with the mandatory verifier. Never package from the working tree. Install locked dependencies in the target runtime. Local connector tests inject synthetic clients; they do not prove real mail-library connectivity.
3. Install only in CRM Test; apply migrations 141-154 with the governed migrator. Compare original user/password/team/ownership snapshots. Do not copy assignments or configure production.
4. Keep every external flag false and database pause TRUE. No scheduler, subscriptions, polling, AI requests or outbound traffic until separately configured provider tests. Saving UI setup cannot activate traffic.
5. Run authenticated scope/role UAT with synthetic records: Admin config only; operating roles for lead work. Verify queue, tier review, callback, opt-out, pause, recovery and existing CRM regressions.
6. On failure stop Test and restore the complete paired files/database/configuration backup and prior flags, then verify prior health. Do not reverse selected migrations over a mixed runtime/schema.

## Provider setup before test activation

Admin > Lead integrations saves nonsecret mapping and operating owner. Protected credential entry requires LEAD_CONNECTION_SETUP_ENABLED and a private 64-hex LEAD_CONNECTION_KEY. A distinct protected 64-hex LEAD_EVIDENCE_KEY encrypts evidence. Retain both keys for recovery outside Git. Credentials must never enter mapping drafts, logs, screenshots or task output.

Verified cPanel connection: lead@nysarealty.com, mail.nysarealty.com SMTP465/IMAP993 with TLS certificate verification. Outlook remains in use. Initial read-only IMAP cursor deliberately skips history; subsequent polling never sets Seen or deletes messages. Initialize before first test send. UIDVALIDITY changes require review rather than mailbox replay.

Required: authorized Meta Page/form, explicit approved Graph version, new 360dialog sender with approved step 0/2/5 templates, protected cPanel password, OpenAI server access and approved test-only recipient allowlists. Approve content version and conservative per-message/AI cost ceilings; unknown outcomes retain reservations in the USD10 Dubai-day cap. Never invent prices, consent or phone-verification evidence. Configure 360dialog webhook Basic authentication and exact account/phone IDs. Generic HMAC relay is a separate contract, not native provider verification.

Runner: node src/nonvoice-worker-runner.js, local/crm-test only. No scheduler installed. Test polling latency/load against the approved SLA. Voice-dependent steps remain waiting; no invented call outcomes. Voice implementation awaits UAE/India route gates.

## Acceptance gaps and activation hold

Confirm Sunita's existing operating identity/team and active manager. After 30 staffed minutes without Hot acceptance, an urgent CORE manager task requests manual reassignment; this is the user's approved interim behavior, not automatic assignment or a WhatsApp notification. Missing setup remains owned and flagged.

Real provider connectivity, internal WhatsApp handoff notification, external calendar free/busy/two-slot booking/invitations, exception resolution actions, two-minute load acceptance and authenticated Test UAT remain open. CORE customer-confirmed callback fallback works and explicitly says calendar not connected. Contextless WhatsApp replies matching multiple outbound messages are safely held for review. Website follows approved Meta canary and is not yet connected. UAT owner/canary size require confirmation before live activation.

No production or Test deployment, remote migration, provider signup, mailbox read or external traffic was performed. Exact packaged commit, archive hashes, migration count and isolated test receipt are supplied by the origin manifest and verification record. This candidate is for disabled-feature review and cannot start a live canary.

DEV241 supersedes DEV240: manager-owned Hot leads use only a distinct active reporting manager derived from the owner primary team. Self/missing/inactive reporting manager results in owned urgent manual review. No new migration, reassignment or hierarchy changes. See MANAGER-OWNER-ADJUSTMENT.md for baseline, privacy/scope and synthetic test evidence.
