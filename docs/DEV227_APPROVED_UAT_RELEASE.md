# DEV227 — approved UAT fixes

Target: CRM Test only, replacing DEV226 (`9db8387b8bdbd66087414ec62adf387c82172e79`). Production and R2 are excluded. The user authorized deployment of all recorded fixes and instructed that nothing else change.

## Reconciled scope: 13 items

| Reference | Included change | Local verification |
|---|---|---|
| DEF-126 | Ordinary Inventory source-text edits no longer submit calculated portal-readiness fields. | PATCH persistence and explicit calculated-field rejection. |
| DEF-127 | Responsible Manager receives the exact pending Inventory verification/exemption task. | Submission, scope, single task, source-decision synchronization and navigation. |
| DEF-128 | Optional mandate metadata/private PDF versions; absence does not block internal conversion. External publication authority remains governed. | Version retention/retrieval, metadata correction, write gates and migration rehearsal. |
| DEF-129 | Calendar failure handling and deterministic/reconciled retry; mapping and audit stay atomic. | Invalid authorization, provider-success/local-failure recovery and concurrent retry mocks. Hosted authorization must be checked separately; no customer invitation is sent by the release tests. |
| DEF-130 | Offer amount in words derives from the exact revision amount, including fils. | Domain cases and rendered synthetic A4 PDF proof. |
| DEF-131 | New/revised Offers need buyer and seller acceptance on the same revision before Booking/Deal. Historical records retain history and are flagged. | Single-side negative path, second-side acceptance, exact identities/evidence, database guards and legacy/default migration checks. |
| DEF-132 | Pending MD details show the correct lifecycle and omit premature payment/advice controls. | Synthetic browser check and retained server payment/advice gates. |
| DEF-133 | Every active signed-in role may read documents including KYC, regardless of ownership/team; write and decision permissions remain governed. | Eight-role, 64-read HTTP matrix; audited reads; anonymous/suspended denial; write-negative checks. |
| SPEC-GAP-003 | Existing Customer can be linked to Inventory owner/party with inherited identity and audited corrections. | No duplicate Customer, persisted link/correction, browser selection and read-only inherited fields. |
| SPEC-GAP-004 | Shared phone, Passport last-four and Emirates ID last-four lookup across core registers and Customer selectors. | Six-API identity matrix, UAE/international phone variants, no-match and full-ID rejection; owner and Lead picker browser checks. |
| SPEC-GAP-005 | Offer filenames include meaningful property/unit, Dubai date and revision. | Bounded/sanitized Unicode filename and disposition tests; issued bytes retained. |
| ENH-001 | All eligible Manager/Director review sources in My Tasks with category/request filters, counts, pagination and exact source decisions. | Nineteen additional source examples, role-decision exclusions, duplicate-free refresh, source-decision sync, official-review browser panel and filter retention. Existing Leave/Marketing and Opportunity workflows remain in the combined queue. |
| ENH-002 | MD Agent/current Team/currency summary with pending approval and quarter/YTD/lifetime net recorded payments; drill-down and filters. | Independently reconciled totals, reversal treatment, authority checks, search/sort/filter checks, 60-Agent paging and browser drill-down/back. |

## Verification receipt

- Full DEV227 regression: **1,694 tests; 1,607 passed; 87 skipped; zero failures**. The skipped tests are not counted as executed coverage.
- Disposable synthetic API/database fixture: passed, including all-role KYC reads and nineteen review-source examples. It clones table definitions/checks/indexes and explicitly installs acceptance guards; it is not a reproduction of every production foreign key/trigger.
- Migration 136: transactional forward/rollback rehearsal passed; existing revision defaults/history retained, new revision default is bilateral, forged acceptance fails.
- Bash deployer syntax and hosting runner JavaScript syntax: passed.
- No real customer approval, invoice payment or Calendar invitation is executed by these tests.
- Human UAT on exact hosted records remains postdeployment acceptance; these local receipts do not claim hosted human acceptance.

## Release and environment safeguards

Only these changes, their tests, migration 136 and required DEV227 release metadata/deployment tooling are included. Historical current-version assertions change from DEV226 to DEV227; their functional assertions are retained. Unrelated letterheads, designs, closure/date diagnostics and local evidence are excluded.

The archive must be built with `npm run release:package -- --commit <full origin-advertised SHA>` in the canonical detached checkout, followed by `npm run release:verify-package -- <zip> <manifest> <manifest-sha256-file>`. Hosting runner/deployer companions must match that same committed source and verified hashes.

The runner obtains only the selected CRM Test application's registered configuration through the documented CloudLinux selector CLI. It never reads live process environments or prints credentials. It verifies the exact Test domain, root and database before backup/deployment. It does not change hosting configuration or integration switches.

The deployer verifies DEV226/135 or an exact DEV227/136 rerun, package/manifest/runtime checksums, full source commit, fresh database/application backups, PDF rendering, one Test worker, health/readiness/version, migration guards and unchanged protected-environment package snapshots.

Migration 136 is additive. No automatic destructive database rollback occurs. Application rollback retains acceptance evidence/guards; processing new bilateral revisions with DEV226 must remain stopped until a verified roll-forward or reviewed database recovery. A fresh predeployment database dump/application archive is mandatory.

Document visibility intentionally expands for active authenticated account roles as expressly requested. Authentication, private file storage and read audits remain; full government identifiers are not added to search/storage. No new editing, review approval or finance-posting permission is granted.

Deployment is not confirmed by this source document. Final hosted results and hashes are recorded in the release evidence after execution.
