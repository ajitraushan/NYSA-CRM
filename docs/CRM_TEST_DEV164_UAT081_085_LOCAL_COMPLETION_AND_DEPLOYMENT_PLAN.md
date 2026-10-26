# CRM Test dev.164 — UAT-081 through UAT-085 local completion and deployment plan

## Current boundary

- Candidate version: `2.1.0-dev.164`.
- CRM Test was upgraded from `2.1.0-dev.162` to `2.1.0-dev.164` on 25 August 2026 after explicit user approval.
- Production, the R2 clone and Property Finder were not targeted.
- Migration count remains 105. This correction uses the existing UAT-081 migration and existing matching,
  assignment and AI-evidence tables; no schema migration is required for UAT-082 through UAT-085.

## Included corrections

1. UAT-081 qualification priority creates the governed Hot/Warm/Cold follow-up obligation and deadline.
2. UAT-082 Requirements completes only after broker confirmation and exact Opportunity/Requirement alignment.
3. UAT-083 deterministic Inventory ranking has a dedicated, correctly labelled Opportunity workspace.
4. UAT-084 reviewed AI summary, confidence, questions and warnings are retained and displayed with the saved
   Requirement and immutable matching evidence.
5. UAT-085 the Agent action is `Shortlist and assign to Opportunity`; one transaction records the shortlist,
   creates/reuses the governed Property Match and origin, creates the seven-day active Inventory Assignment and
   refreshes the Opportunity. It does not communicate, create a Viewing/Offer, or reserve Inventory.

## Verification completed

- Syntax checks: corrected route and browser files passed.
- Focused deterministic/domain/UI tests: 31/31 passed.
- Ordinary regression: 1,214 total; 1,184 passed; 30 protected tests intentionally skipped; 0 failed.
- Protected UAT-081 real HTTP/PostgreSQL suite: 1/1 passed.
- Protected UAT-082/084/085 real HTTP/PostgreSQL suite: 2/2 passed.
- The dev.164 database fixture used two open Opportunities for the same Lead and proved the run binds the explicitly
  selected on-screen Opportunity, not the most recently updated Opportunity.
- Independent database reads proved exact Requirement/run/candidate/decision/origin lineage, one active seven-day
  assignment, stage advancement to Matching, preserved Available stored Inventory status, and no partial run on a
  requirement-lineage rejection.

## Completed package gate

1. The deterministic cumulative dev.164 ZIP was reproduced twice with identical SHA-256.
2. Final package SHA-256: `b609ea5394f4fad9a80531b78468753951a48e20f1ced51d3d208ba1bbf0dfd1`.
3. Package-integrity and extracted-runtime gates passed.
4. The runtime manifest contains 293 ZIP entries and 105 migrations; latest migration is
   `105_dev163_uat081_qualification_follow_up_sla.sql`.

## CRM Test deployment evidence — completed 25 August 2026

1. Explicit user approval was received for deployment to CRM Test.
2. The uploaded ZIP passed external checksum, JSON-manifest and internal runtime-manifest verification.
3. The guarded installer confirmed the exact CRM Test root, database identity and dev.162/migration-104 baseline.
4. Pre-deployment application and database backup:
   `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260825T190056Z` (the retained directory name reflects
   the pre-deployment dev.162 baseline).
5. Migration 105 applied on startup. The final schema state is 105 migrations with latest migration
   `105_dev163_uat081_qualification_follow_up_sla.sql`.
6. Exactly one verified supervised CRM Test LiteSpeed listener remained: PID `4019`.
7. Health returned `ok:true`, `process:ready`, version `2.1.0-dev.164`.
8. Readiness returned `ok:true`, `database:ready`, version `2.1.0-dev.164`.
9. Integration switches remained disabled. Production and R2 clone snapshots were unchanged.

## Human retest order

1. UAT-081: save Hot, Warm and Cold assessments and verify the governed displayed deadlines and open Task.
2. UAT-082: verify an unconfirmed Requirement is not shown completed; confirm it and verify exact aligned completion.
3. UAT-084: generate, review, apply and save an AI Requirement draft; verify the reviewed summary remains prominent.
4. UAT-083: open the Opportunity and run `Rank available Inventory`; verify deterministic/advisory wording and layout.
5. UAT-085: choose one ranked candidate and click `Shortlist and assign to Opportunity`; verify it immediately
   appears in active Inventory Assignments with its expiry and no duplicate manual step.
6. Negative UAT-085: change to a new Requirement Version and verify the old run cannot be assigned and gives a clear
   rerun/alignment message without leaving a partial assignment.

The 25 August 2026 human continuations below supersede the pending status. After SLA activation, UAT-081 passed by
direct assigned-Agent observation. UAT-082 remains failed/incomplete, UAT-083 and UAT-085 remain blocked, and UAT-084
remains partial.

## Human UAT continuation — 25 August 2026, 23:30–23:34 GST

CRM Test directly served `2.1.0-dev.164`. Testing used the signed-in Sunita Sinha Administrator session and synthetic
`uat159cust1` records only. Production, R2 and Property Finder were not opened or used.

The cumulative log records the exact observations. In summary, UAT-081 was blocked because the signed-in identity was
not the assigned Lead owner and no assessment control or new governed qualification Task was available; UAT-082
displayed the corrected current/misaligned Requirement state but exact aligned completion was not reached; UAT-083
displayed the corrected deterministic workspace and label but ranking stopped on the visible Requirement-lineage
error; UAT-084 saved unconfirmed Requirement version 3 and prominently retained the reviewed summary, confidence,
questions and warnings, but matching-context retention was not reached; UAT-085 could not reach candidate selection
or the atomic assignment action. None of UAT-081 through UAT-085 is marked passed from this continuation.

## Assigned Sales Agent continuation — 25 August 2026, 23:36–23:38 GST

The user signed in as assigned Sales Agent `ajitr`. The Hot qualification submission returned
`An active SLA policy with valid Qualification follow-up timings is required`; it did not save and no governed Task
or deadline was created, so UAT-081 failed and Warm/Cold were not attempted. The Agent successfully broker-confirmed
Requirement version 3, but a fresh journey still displayed that version 3 was not linked to
`NYSA-OP-202608-000008`, Match remained blocked, and no visible alignment action was present. The deterministic rank
action returned the exact different-Requirement-Version error. The prominent reviewed AI summary remained visible
with high confidence, retained questions and retained warnings, but matching context and the UAT-085 atomic shortlist
and assignment action were unreachable. No item is marked passed.

## UAT-081 focused rerun after SLA activation — 25 August 2026, 23:45–23:46 GST

After the Administrator activated the maintained SLA policy, assigned Sales Agent `ajitr` saved Hot, Warm and Cold
assessments on synthetic Lead `NYSA-LD-202608-000048`. CORE created the governed Hot Task due 00:01 (Urgent), then
cancelled it as superseded and created the Warm Task due 13:00 (High), then cancelled Warm as superseded and created
the open Cold nurture Task due 18:00 (Normal). The Lead displayed the 15 elapsed-minute Hot target, 240-business-minute
Warm policy through its calculated deadline, and the Cold one-business-day/then-five-business-day guidance. UAT-081
is passed by direct assigned-Agent observation. UAT-082 remained misaligned, so UAT-083 and UAT-085 remained blocked;
UAT-084 remained partial.

## Follow-on correction after dev.164 human UAT — dev.165 deployed to CRM Test

The dev.164 deployment record above is unchanged. The missing ordinary Requirement-version alignment action observed
during UAT-082 was corrected as `2.1.0-dev.165` and deployed to CRM Test after explicit user approval on 26 August
2026. Production, the R2 clone and Property Finder remained excluded.

The local correction adds an assigned-owner/authorized-manager action on the connected Lead journey when the current
broker-confirmed Requirement differs from the linked Opportunity Requirement. Saving requires the exact Opportunity
version, a reason of at least ten characters, and explicit acknowledgement of stale matching impact. The transaction:

1. locks the Opportunity and exact current confirmed Requirement;
2. blocks if Viewing, Offer, Booking or Deal records already exist, so downstream evidence is not silently rewritten;
3. delinks stale active Inventory Assignments with immutable assignment events;
4. retains earlier Property Matches as rejected history and appends Property Match history;
5. updates the Opportunity to the current Requirement Version, records the prior/new IDs in audit, and returns the
   Opportunity to Requirements when a fresh matching run is required; and
6. permits a later match for the same Inventory to create a distinct Property Match lineage keyed by Opportunity,
   Requirement Version and Inventory.

Local verification completed on a disposable PostgreSQL fixture after migration
`106_dev165_opportunity_requirement_realignment.sql`. The real HTTP/database test observed the pre-alignment matching
request rejected with no partial run, the explicit alignment succeeding, the old Property Match remaining rejected
against the older Requirement, a new deterministic run using the new Requirement, and a new atomic shortlist plus
seven-day assignment against a separate Property Match. Protected focused result: 2/2 passed. Ordinary full-suite
result: 1,217 total; 1,187 passed; 30 protected tests skipped by their guards; 0 failed.

These automated observations do not infer a human UAT pass. UAT-082, UAT-083, UAT-084 and UAT-085 retain their exact
dev.164 human statuses until the assigned Agent reruns them in order on dev.165. Production, R2 and Property Finder
were not used by the correction or local verification.

## CRM Test dev.165 deployment evidence — completed 26 August 2026

1. Explicit user approval was received for deployment to CRM Test, and the user completed the authenticated cPanel
   file-picker step.
2. The deterministic package SHA-256 was
   `f333a88861092de66d0211743497666c8c16f51943bdf73923e0d079a5bae455`. Its runtime manifest contained 296 ZIP
   entries and 106 migrations, with latest migration `106_dev165_opportunity_requirement_realignment.sql`.
3. The guarded installer completed its checksum, JSON-manifest, runtime-manifest, exact CRM Test root, database
   identity and dev.164/migration-105 baseline gates before mutation.
4. The installer created the pre-deployment application/database backup at
   `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260825T211530Z`. The legacy `dev162` directory label is
   the exact label emitted by the inherited guarded installer; the guarded baseline check itself required installed
   dev.164 and migration 105.
5. Migration 106 applied. The final schema state reported 106 migrations with latest migration
   `106_dev165_opportunity_requirement_realignment.sql`.
6. Exactly one verified supervised CRM Test LiteSpeed listener remained, PID `3505232`.
7. The installer reported served version `2.1.0-dev.165`, disabled integration switches and unchanged Production/R2
   clone snapshots.
8. An independent public health request returned exactly
   `{"ok":true,"process":"ready","version":"2.1.0-dev.165"}`.
9. An independent public readiness request returned exactly
   `{"ok":true,"database":"ready","version":"2.1.0-dev.165"}`.
10. The signed-in Sales Agent CRM Test workspace rendered after refresh on the existing synthetic Lead. Property
    Finder was not opened, called or changed. No Production or R2 application page was opened.

At deployment completion, human UAT had not yet been rerun on dev.165. The following continuation records the later
assigned-Agent observations in order without inferring a pass.

## Assigned Sales Agent continuation on dev.165 — 26 August 2026, 01:17–01:20 GST

- **Environment and role observed:** CRM Test displayed `NYSA CORE 2.1.0-dev.165`; the signed-in identity displayed
  `ajitr` with role `Sales Agent`. Synthetic Lead `NYSA-LD-202608-000048`, Opportunity
  `NYSA-OP-202608-000008` and broker-confirmed Requirement version 3 were reused. Production, R2 and Property Finder
  were not opened or used.
- **UAT-081:** Not rerun. Its direct dev.164 pass after SLA activation is retained and no new result is inferred.
- **UAT-082 observed result — failed/incomplete on dev.165:** The connected journey displayed Requirement version 3
  as current but not linked to the Opportunity, Match as blocked, and the new `Review and align` action. The impact
  preview stated that two earlier matches would remain rejected history and one stale active assignment would be
  delinked. Selecting `Review and align` produced no usable reason/acknowledgement form and no alignment. The current
  in-app browser logged exactly `Error: prompt() is not supported.` The journey remained misaligned and Match remained
  blocked. No pass is inferred outside this directly observed browser context.
- **UAT-083 observed result — blocked, not passed:** The Opportunity rendered the dedicated
  `Inventory recommendation and assignment` workspace and transparent advisory wording. Selecting
  `Rank available Inventory` returned exactly `Opportunity NYSA-OP-202608-000008 is linked to a different
  Requirement Version. Align the Opportunity before running matching`. No ranking results appeared.
- **UAT-084 observed result — partial, not passed:** Requirement version 3 prominently displayed the complete
  reviewed summary, confidence `high`, all three retained questions, both retained warnings, the review timestamp,
  confirming Agent and the authoritative-fields explanation. Matching-context retention was not observed because no
  new matching run could be created while UAT-082 remained misaligned.
- **UAT-085 observed result — blocked, not passed:** No ranked candidates appeared and there was no
  `Shortlist and assign to Opportunity` control. The visible active assignment
  `c873344a-1538-4ec9-88be-a1cfc23b7fee` pre-existed this continuation and was not created or treated as evidence.
  No new assignment, communication, Viewing, Offer or reservation was created.

This dev.165 continuation does not create a new pass. UAT-081 retains its earlier direct pass; UAT-082 is
failed/incomplete, UAT-083 is blocked, UAT-084 is partial and UAT-085 is blocked.

## Local browser-flow correction after dev.165 human UAT — candidate dev.166

- **Observed blocker addressed:** The dev.165 `Review and align` handler depended on native `prompt()` and
  `confirm()`. The current in-app browser rejected that interaction with `Error: prompt() is not supported.`
- **Correction:** The action now opens an accessible in-page governed form. It displays the immutable impact preview,
  requires an alignment reason of at least ten characters, requires explicit acknowledgement when stale matches or
  assignments exist, and submits the existing optimistic Opportunity version to the unchanged alignment API.
- **Preserved governance:** The API transaction, migration 106, rejected historical matches, immutable assignment
  events, downstream-record blockers and exact Requirement/Opportunity lineage are unchanged. No database migration
  is added; the candidate remains at 106 migrations.
- **Focused verification:** Syntax and UAT-082 through UAT-085 journey checks passed 8/8. Package/dialog checks passed
  5/5. The dialog-specific test proves the alignment flow contains no native `prompt()` or `confirm()` call.
- **Full regression:** 1,222 total; 1,192 passed; 30 protected tests skipped by their guards; 0 failed.
- **Human UAT status:** No pass is inferred. The exact dev.165 results above remain authoritative until candidate
  dev.166 is deployed to CRM Test and rerun by the assigned Sales Agent.
- **Environment boundary:** Local correction only at this point. Production, R2 and Property Finder were not opened,
  called or changed.

## CRM Test dev.166 deployment evidence — completed 29 August 2026

1. The deterministic package reproduced twice with SHA-256
   `1f5de019b9ca243198395ff6ddcf33d676dfea3ecdf89a69f1040b65c2f8d5fd`, 297 ZIP entries and 106 migrations.
2. Full ordinary regression completed before upload: 1,222 total; 1,192 passed; 30 protected tests skipped by guard;
   0 failed. The final package/dialog gate passed 3/3 and the installer Bash syntax check passed.
3. The first uploaded wrapper execution exited before deployment because its generated-script marker self-check
   expected three occurrences while the reviewed generated body contained two. CRM Test remained healthy on dev.165;
   no application or database mutation was observed. The marker count was corrected to the locally traced value,
   package/installer tests passed 2/2, and only the corrected wrapper was overwritten.
4. The corrected guarded installer completed checksum, JSON-manifest, runtime-manifest, exact CRM Test root/database,
   installed dev.165/migration-106 baseline, disabled-integration and protected-snapshot gates.
5. The final deployment reported one verified LiteSpeed listener, PID `1173096`; installed/served version
   `2.1.0-dev.166`; and latest migration `106_dev165_opportunity_requirement_realignment.sql (106 total)`.
6. The exact reported backup path was
   `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260829T113103Z`. The inherited safety body retains the
   legacy `dev162` directory label while separately enforcing the dev.165/migration-106 baseline.
7. Integration switches remained disabled. Production and R2 clone snapshots were reported unchanged. Property
   Finder was not opened, called or changed.
8. Independent health returned exactly `{"ok":true,"process":"ready","version":"2.1.0-dev.166"}`. Independent
   readiness returned exactly `{"ok":true,"database":"ready","version":"2.1.0-dev.166"}`.
9. Human UAT was not resumed because the prior CRM Test Agent session expired on refresh and displayed the sign-in
   screen. No new UAT result or pass is inferred. Assigned Sales Agent sign-in is required before restarting UAT-082.
