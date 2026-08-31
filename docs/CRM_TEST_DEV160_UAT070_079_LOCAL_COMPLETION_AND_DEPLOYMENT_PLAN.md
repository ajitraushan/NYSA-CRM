# CRM Test dev.160 — UAT-070 to UAT-079 local completion and deployment plan

Date: 25 August 2026  
Target: CRM Test only  
Candidate version: `2.1.0-dev.160`  
Baseline: `2.1.0-dev.159`  
Latest migration: `104_dev160_uat070_079_journey_unblock.sql` (104 total)

## Release decision

UAT-070 through UAT-079 have local corrections and automated evidence. They are cleared for deployment to CRM Test. They are not UAT-passed until the user observes each corrected journey in CRM Test.

## Consolidated defect scope

| ID | Issue | Confirmed RCA | dev.160 correction | CRM Test retest |
|---|---|---|---|---|
| UAT-070 | Password-reset request remained indefinitely on “Please wait”. | Async form handlers used `event.currentTarget` after an `await`; browser event dispatch had cleared that reference, so completion rendering failed. | Capture the form before awaiting and render a deterministic completion state. | Pending |
| UAT-071 | Password-reset queue joined the user name and email without separation. | Both values were rendered inline with no layout wrapper. | Render name and email as separate stacked values. | Pending |
| UAT-072 | Issued one-time code could not be copied or safely handed off. | The code was displayed in a native alert with no governed delivery acknowledgement. | Selectable modal, Copy button, named recipient, expiry, and explicit private-channel delivery confirmation. | Pending |
| UAT-073 | User could not find where to enter the one-time reset code. | The reset-code form was reachable only through low-visibility navigation and reset-request completion did not direct the user there. | Direct sign-in link and post-request “Enter my reset code” action with email prefill. | Pending |
| UAT-074 | “Remember me” behavior was unclear/inconsistent. | UI did not express duration and server/cookie lifetime did not distinguish remembered and browser-session login. | Explicit 7-day opt-in; otherwise a browser-session cookie backed by a bounded 12-hour server session. | Pending |
| UAT-075 | Building maintenance reported a duplicate error after creating the Building. | Building insert and audit were not atomic; the audit vocabulary rejected `InventoryBuilding` after the insert had committed. Duplicate errors also conflated stable code, label and Community. | Transactional insert plus audit, corrected audit vocabulary, and exact duplicate messages. | Pending |
| UAT-076 | A governed Building appeared as “not mapped,” implying it was unusable. | The register displayed external DLD-crosswalk state as if it were the Building’s lifecycle status. | Register displays active/retired Building status; external mapping remains a separate concern. | Pending |
| UAT-077 | First contact and qualification were duplicative and could block the journey. | Contact and assessment were treated as consecutive mandatory stage actions, including a separate manual move to Qualified. | Contact can always be recorded; qualification may follow immediately or later. A completed assessment atomically advances Contacted to Qualified. | Pending |
| UAT-078 | Different objective models could not share one stable model code/version. | Database uniqueness applied only to model code and version, while runtime selection was objective-specific. | Unique identity is stable model code + Customer objective + version; runtime selection remains exact-objective. | Pending |
| UAT-079 | Qualification model could not be retired. | No governed retirement endpoint or Administrator action existed. | Full Administrator retirement action with reason, effective end, and audit evidence. | Pending |

## Confirmed contact and qualification rule

1. Recording the first Customer contact does not require a completed qualification assessment.
2. The agent may capture qualification during that same interaction or return later when the Customer has supplied enough information.
3. Missing or unanswered qualification information does not invalidate the contact record.
4. When an assessment is completed, CORE records its evidence and advances a Contacted Lead to Qualified in the same transaction. There is no second manual “qualify” action.
5. A completed qualification remains a prerequisite for Opportunity creation under the current confirmed journey. This release does not invent an override.

## Automated evidence

- Ordinary regression: 1,167 passed, 0 failed; 26 protected database tests excluded from the ordinary run (1,193 total).
- Protected PostgreSQL evidence: 27/27 passed, with each protected file run against a fresh disposable schema.
- dev.160 correction source/contract tests: 4/4 passed.
- dev.160 real HTTP + PostgreSQL tests: 5/5 passed.
- Property Finder remains disabled and excluded.

## Deployment procedure

1. Verify the candidate ZIP SHA-256 and embedded archive/runtime manifests.
2. Confirm target root `/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`, installed version dev.159, and latest migration 103.
3. Confirm all integration switches remain disabled.
4. Create a timestamped database dump and application backup under `/home/nysareal/crm-backups`.
5. Install the exact candidate runtime, run migrations through 104, and preserve the environment file.
6. Restart only the supervised CRM Test worker.
7. Verify exactly one supervised worker, version dev.160, migration 104, health ready, readiness ready, disabled integration switches, and the dev.160 database contract.
8. Do not target Production, the R2 clone, Property Finder, cPanel configuration, or any external integration.

## Rollback

If any gate fails, restore the pre-dev.160 application archive and database dump, restart only CRM Test, and verify the restored dev.159 version and migration state. The deployment script must fail closed and print the backup location.

## UAT status discipline

Local automated success and CRM Test deployment do not constitute human UAT passage. Record each observed result separately. A failed retest remains open with the exact screen, role, record reference (sanitized), steps, expected result, actual result, severity, evidence, and workaround.
