# DEV273 D-2 evidence collected

Status: superseded by the complete review packet at `release-artifacts/dev273/DEV273_D2_PACKET.md`. This file retains the detailed original failure dispositions and benchmark evidence.

Both hosted environments start from accepted DEV272 commit 54421912fc1496a1066814cd8b665c19c7e8fd45. The Production baseline is 172 migrations, 313 tables and 113 triggers. Production preflight code requires migration 172 for baseline and candidate and stops unless all four ownership counts are zero. No migration file changed.

The worker checks apply the mandatory hosted-worker verification in AGENTS.md and the hosted-deployment controls in CRM_CHANGE_POLICY.md. Production inspection receipt e922f447 recorded three exact-root workers. CRM Test receipt 8c20b613 recorded two. The revised operators require at least one verified worker before install, record PIDs and start times, quiesce the verified workers and reject a pre-install PID at post-start readiness. The separately reviewed CRM Test restart tool is reserved for WN-15.

## Local verification

- The PostgreSQL 13.23 overdue-ordering integration test ran and passed. The disposable database had migration 172 and governed values seeded by an existing synthetic Admin.
- The two-process digest integration test ran and passed on PostgreSQL 13.23. Two Node processes started their ticks together. One schedule row and one synthetic send were recorded, with one accepted attempt. No SMTP connection was made.
- Twenty-six focused lifecycle, restart, CRM policy, Today and retry tests passed.
- The governed suite reported 1,605 passed, 109 skipped and 23 failed on the in-progress tree. Failures include historical release and shell assertions, and scope or UI assertions that need review against the approved DEV273 behavior. The later governed run in node_modules/dev273-release-r3.log recorded 1,628 passed, 110 skipped and zero failed. This was a working-tree run with fixture tests run separately.

## Local route benchmark

Authenticated loopback HTTP against PostgreSQL 13.23, with 2,000 synthetic Customers and 2,000 synthetic Leads assigned to one Agent in the Manager's team. Responses used page size 25. Search used `benchmark 12` and matched 111 records. Each case used two warmups and 20 timed requests including JSON parsing. The table reports nearest-rank p95 in milliseconds from the in-progress build. This fixture measures a single team's data with local HTTP.

| Role | Customer list | Customer search | Lead list | Lead search |
| --- | ---: | ---: | ---: | ---: |
| Agent | 10.7 | 10.5 | 21.4 | 17.8 |
| Manager | 12.6 | 10.9 | 22.9 | 16.8 |
| Director | 8.4 | 10.6 | 20.9 | 19.5 |

The prior outstanding items are closed or explicitly transferred to approval-gated CRM Test rehearsal: the exact candidate governed run is green, all requested cross-surface rows pass, the canonical package/config/tool hashes are pinned, and the exact-package install/reverse/reinstall is the reviewed CRM Test sequence before Production.

The PostgreSQL 13.23 Production-shaped fixture assigned 58 tables to the saved Production owner role. Starting the DEV272 archive, DEV273 working tree and DEV272 archive in sequence produced green readiness for all three starts. The full schema contract matched at each start, with 172 migrations, 313 tables and 113 triggers. This exercised the application against the same database throughout. The hosted operator and final packages still need rehearsal.

The scope integration test passed with synthetic Customer, Lead, document, proposal and linked task records. It exercised Customer 360 masking, direct document and proposal denial, AI suggestion retrieval denial, task scoping, dashboard and CSV boundaries, search, Reveal and its audit fields. Opportunity list denial ran with no seeded Opportunity in that pass. Positive Opportunity masking and remaining nested or alternate paths still need evidence.

## Disposition of the 23 failures

The table covers the original governed run. The subsequent run reported zero failures.

| Test | Disposition | Reason |
| --- | --- | --- |
| Lead register read scope is company-wide for operational CRM identities | Rewritten | The old assertion granted company-wide Lead reads. DEV273 binds Agent reads to their own assignments and Manager reads to their managed teams, own assignments and permitted unassigned intake. Directors retain company-wide scope. |
| dev.165 exposes a governed exact-version alignment action without rewriting prior matching evidence | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.166 uses an accessible in-page governed Requirement alignment form | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.171 dashboard structure remains under the approved DEV218 workspace palette | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.172 shared CORE shell is preserved under the approved DEV218 tokens | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.173 puts the compact operations overview before the Agent attention queue | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.202 shell structure remains present under the approved DEV218 light workspace | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.203 navy identity remains present under the DEV218 light workspace | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.204 no-teal rule remains under the DEV218 navy and gold palette | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.210 shell remains superseded by the approved light workspace | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| expired assignment cannot return to the same Agent self-claim queue | Rewritten | Updated the old Lead view labels to the Owning Agent filter and own-assignment default. The expired-assignment self-claim checks were retained. |
| current candidate carries the four post-DEV216 corrections | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| DEV248 release identity and design evidence are present | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| DEV267 Prospect Diary release surface is wired without relaxing existing workflows | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| DEV271 technical version and deployment baseline equal accepted DEV270 | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| customers are a primary workspace and lead KYC links to the customer master | Rewritten | Customer 360 now limits linked documents to visible Leads and directly linked Customer documents without a Lead. The old unrestricted document query assertion conflicted with parent scope. |
| Sales Agent customer loading is scope-first and opened leads show a distinct lifecycle | Rewritten | The Customer list now serializes scoped rows through the contact masking function. The existing scope-first assertions were retained. |
| UI-LOGIN-REDESIGN-19 preserves the login contract through the dev.108 cumulative candidate | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| R3A-PROFILE-46 integrates accepted intake into Customer 360 and connected Lead screens | Rewritten | Customer 360 includes active intake evidence attached directly to the Customer or linked to a visible Lead. The old assertion allowed active evidence linked to an out-of-scope Lead. |
| dev.138 HTTP boundary is Director-only, exact-confirmation, tagged-test-only, audit-minimised and write-free | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| dev.139 HTTP and UI boundary is confirmed, Director-only, duplicate-safe and Draft-only | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| historical migration 082 remains while the consolidated runtime version advances | Fixed | Updated the stale DEV272 version assertion to DEV273. The feature assertions were retained. |
| DEF-135 reset clears all filters before reloading and restarts page one | Rewritten | Added the Owning Agent control to the simulated DOM and verified that Reset returns it to its default. |

## Skip count from 109 to 110

The added skip was **DEV273 Customer and Lead HTTP scope across linked surfaces** (test/dev273-surface-scope.integration.test.js). It requires the disposable PostgreSQL fixture and runs only when NYSA_DEV273_SCOPE_FIXTURE is local-synthetic. The governed run lacked that setting. The dedicated PostgreSQL 13.23 run enabled it and passed. Comparing the two governed logs showed this as the only added skip.
