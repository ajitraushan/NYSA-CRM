# DEV251 production approval packet

31 October 2026. **Preparation only. Production deployment and main promotion are not authorized.**

The live Director acceptance check passed. Source and current Test technical
acceptance are complete; production execution remains held for exact approval.

## Exact release

- Version: `2.1.0-dev.251` — the same package explicitly approved and installed
  on CRM Test, without a subsequent runtime edit or relabelled build.
- GitHub source: `8f722679c92eabcd2efb6cef824d5225b28dbcf4`.
- Tree: `e3bc1aa96f8b0fd104ef868e57df4348aa53ed64`.
- Draft PR: https://github.com/ajitraushan/NYSA-CRM/pull/8 — do not merge yet.
- Archive: `nysa-core-2.1.0-dev.251-origin.zip`.
- Archive SHA-256: `749f077d323d846c9e468aafe5ef31f1d215eed9afdde98baca9c8bc5e12178a`.
- Manifest SHA-256: `4676cbbb600efd48f81cb168e265cf9c06c153e4a61225ab07472c2459d12e53`.
- Built only with `npm run release:package -- --commit
  8f722679c92eabcd2efb6cef824d5225b28dbcf4`; mandatory provenance verifier passed.
- All 455 runtime-file hashes and ten PDF formats passed on the actual Linux
  host. Production staging is private; it is not an installed application.
- The origin-built archive is retained in this local approval folder and private
  hosting storage. GitHub holds its governed source, manifests and safe receipts;
  no database backup, private configuration or recovery key is committed.

## Scope and preservation

This retains the previously approved DEV240–248 functionality and adds UI-001:
shared authenticated design tokens, page headers, Dubai date presentation,
filters, accessible rows, compact states, business labels and the three-step
External Portal Listings presentation. Existing workflow commands and access
checks remain authoritative. The sole API change is additive task source
metadata and a masked provisional-name fallback. Deterministic feature loading
and a null-safe read-only Lead binding address presentation failures.

PDF dependencies are patched; the production audit reports zero advisories.
The explicitly tested Puppeteer/Chromium pair is recorded in the PDF verification
document. Approved templates and their text/page counts are unchanged.

UI-001 adds no migration. Original migrations 1–140 match installed RC1 byte for
byte. Pending 141–159 are byte-identical to the successful production-data R2
rehearsal. The reviewed SQL companion retains its production database/role and
140-migration baseline guards, role substitution and per-file transactions.

Preserve every existing user, password, team, reporting relationship and
assignment. The four production teams without reporting managers and three
unmatched business-line mappings remain flagged for later maintenance; do not
copy CRM Test mappings or infer replacements.

## Evidence

| Check | Result |
|---|---|
| Isolated GitHub-origin regression | 1,496 passed; 93 intentionally skipped; zero failures |
| Restricted PostgreSQL API test | All 159 migrations; task source, assignee scope, masked hints and Viewer denial passed |
| Synthetic UI | 111 views, 83 drill-downs; no JS, automated accessibility, typography or page-width failures |
| Breakpoints | 1280 / 768 / 390 pixels |
| Hosted Linux PDFs | All ten formats passed; before/after text and page counts identical |
| Production dependency audit | Zero advisories |
| Live Agent | Four card drill-downs and supporting screens passed; no business record was changed |
| Live Manager | All 15 cards passed; desktop/tablet/mobile width checks passed |
| Live Director | 68 cards across Executive/Sales/Inventory/Operations and Risk; desktop/tablet/mobile checks passed |
| CRM Test deployment | Readiness green, configuration preserved, exactly one verified root/cwd worker |
| Production-data migration rehearsal | Existing proof reused: 19 pending migrations passed, 257 original non-ledger tables preserved |
| R2 recovery | Original DEV93 / 61 restored; all 109 original table fingerprints verified |
| Off-server recovery | Production RC1 / 140 and Test DEV248 / 159 authenticated and verified in memory |

The primary intake queue was empty during Agent read-only UAT. Outcome behaviour
is covered by synthetic interaction and PostgreSQL lifecycle tests; no real
customer was picked up, contacted, completed or otherwise changed for testing.
Live exploratory navigation was repeated after each API load completed. An
existing rapid-switch Diary request can target a removed container; its unchanged
request lifecycle is outside this release, and must not be claimed as a new fix.

## Production operations requiring final approval

1. Approve this exact source/package, PR main promotion and a named maintenance
   window. Recheck production is RC1 / 140 and that no source/configuration drift
   occurred. Reverify origin advertisement, package/manifest hashes and provenance.
2. Audit the exact production root `/home/nysareal/nysa-crm` and each worker's
   command marker **and** `/proc/<pid>/cwd`. The preparation observation found two
   original workers; neither was stopped during preparation. Stop only this
   registered application, reconcile verified stale workers, and require zero
   before replacing files or applying schema changes. Never use a broad kill.
3. Immediately refresh a **quiesced paired** database/custom dump with owners and
   grants, application, resolved dependencies, registered configuration, private
   storage and original-table fingerprints. Encrypt on hosting, verify ciphertext
   and authenticated component integrity in the approved Windows-account-protected
   `C:\Users\ajitr\NYSA-Recovery` destination before database mutation. Existing
   preparation copies are not substitutes. Any browser staging in Downloads must
   be explicitly covered by approval, contain ciphertext only and be moved after
   verification.
4. Apply only reviewed migrations 141–159 with the production-role companion.
   Reconcile all original columns/rows before service provisioning. Do not start
   a generic automatic migration against unreviewed Test-role grants.
5. Apply the private pending configuration bound to this candidate and the
   recorded baseline-environment hash: independent identity-encryption and keyed
   matching secrets, match-key version, WEB/website actor references, NIA actor
   reference, shared website signature secret and the internal reconciliation
   worker flag. Reuse existing valid values; never rotate an existing key silently.
6. Create only the two planned disabled-login service actors if still missing:
   System – WEB Intake (internal broker, no job role/team/posting) and System – NIA
   Intake (Viewer, no job role/team/posting). Record audit entries. Do not grant
   human operational access or alter existing accounts.
7. Backfill only the new auxiliary deterministic contact-match-key records from
   existing active contact channels in bounded batches; preserve all canonical
   Customer attributes, consent, ownership and relationships. Reconcile and audit
   counts, not personal values. This is required before a new website producer is
   activated so existing Customers remain matchable.
8. Swap only the verified runtime/dependencies; preserve ownership, private files
   and configuration. Do not broaden filesystem permissions. Perform one
   controlled start; request `/api/readiness`; require expected version, database
   green and exactly one verified root/cwd worker. A duplicate or stale worker
   fails acceptance.
9. Verify all runtime hashes, ten PDF formats, authentication boundaries,
   dashboard/card APIs and approved role screens. Keep optional email/WhatsApp,
   Meta retrieval, AI outreach and voice flags off. Do not send customer messages.

## Website companion: separate explicit decision

Production WordPress currently has no CORE bridge plugin, outbox or contact-save
callback. Its theme matches the exact existing governed patch baseline. A private
review copy was derived from the same origin package and passed PHP lint; the
production web runtime reports PHP 8.1. No production website file, option or
table was changed.

CRM installation alone will **not** activate website-to-CORE delivery. If approved
as part of the window, the companion uses only the existing origin contact
template, guarded contact-save hook and CORE Lead Bridge 1.2.0; configures the
production intake URL and matching private signature secret; and creates its
durable outbox through the existing plugin activation. Fresh paired WordPress
recovery and source/configuration hashes are required before applying it. Preserve
newly received enquiries and durable outbox payloads during any rollback; do not
blindly restore a database over newer customer submissions. No website redesign,
new business policy or live outreach/provider activation is included.

## Rollback

Before any mutation, verify the complete paired set and encrypted off-server
receipt. On a failed acceptance gate: stop the exact application and verified
workers; restore original runtime/dependencies, private files and registered
configuration; restore the quiesced RC1 database with its owners/grants if schema
or data changed; reconcile original fingerprints and assignments; start RC1 once
and verify readiness plus exactly one worker. Retain diagnostics privately.
Do not recreate the original duplicate-worker defect. Any website rollback must
retain submissions received after its backup and keep the new producer disabled
until CRM acceptance is green.

## Still excluded / not deployed to production

- UI-001 and cumulative DEV240–248 changes are on CRM Test; production remains RC1.
- Production intake configuration/service actors, match-key backfill, stale-worker
  reconciliation and website bridge activation await exact final approval.
- Email verification/OTP (LEAD-009), WhatsApp/SMS OTP, voice, optional live outreach
  and provider activation are not completed by this release.
- The held Admin invitation correction and unrelated functional changes remain
  outside this release.

The approval request must distinguish CRM deployment/main promotion from the
website companion and record the maintenance window. No production activation
may be inferred from approval of this preparation document.
