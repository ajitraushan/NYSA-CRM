# NYSA CORE Environment and Release Promotion Policy

Approved by the NYSA owner on 2026-08-01.

## Environment roles

| Environment | URL | Purpose |
|---|---|---|
| Local canonical worktree | Local only | Implementation, static checks and the complete automated test suite. |
| CRM Test | `https://crm-test.nysarealty.com/` | Active development integration, unit/integration verification and iterative business UAT. Development candidates may be replaced as defects are corrected. |
| R2 production clone | `https://crm-r2-clone.nysarealty.com/` | Final acceptance of one frozen, checksum-bound release candidate under production-like conditions. It is not the daily development environment. |
| Production | `https://crm.nysarealty.com/` | Live accepted application only. Promotion requires explicit owner approval and the exact candidate accepted on the R2 clone. |

## Mandatory promotion sequence

1. Implement in the canonical local worktree and pass targeted plus complete automated tests.
2. Package a development candidate and deploy it only to CRM Test.
3. Correct defects through new numbered development candidates on CRM Test.
4. Freeze one exact version, ZIP and SHA-256 checksum after CRM Test acceptance.
5. Deploy that exact frozen package to the R2 clone and complete final end-to-end acceptance.
6. Promote the same accepted package and checksum to Production after explicit approval.
7. After Production verification, align CRM Test and the R2 clone to the exact Production application version and migration level before beginning another release.

No environment may be skipped. A package changed after R2-clone acceptance is a new candidate and must repeat R2-clone acceptance.

## Meaning of post-production alignment

Alignment means the same application version, immutable package checksum, migration set and controlled configuration contract. It does **not** mean silently copying Production customer data into CRM Test or overwriting test evidence. Database refreshes, sanitization and test-data resets are separate controlled operations requiring an explicit backup and authorization.

Before the next release begins, record for all three hosted environments:

- HTTP health result and served application version;
- database identity and latest migration;
- installed package checksum;
- worker/PID count and application root;
- backup path from the last deployment; and
- confirmation that environment-specific secrets, URLs and database names remain isolated.

## Deployment safeguards

- CRM Test scripts must refuse the R2 clone and Production database/application identities.
- R2 clone scripts must refuse CRM Test and Production identities.
- Production scripts must refuse CRM Test and R2 clone identities.
- Every deployment takes application and database backups before mutation.
- Production, CRM Test and R2 clone are changed only by an environment-specific, checksum-bound script.
- Development code is never edited directly on a hosted server.

## Stable-operation and restart discipline

- Local development absorbs small functional changes and runs focused plus complete regression testing without hosted restarts.
- CRM Test receives one consolidated, numbered and checksum-bound candidate after the intended local scope is reviewed. It is not restarted for every small source edit.
- A CRM Test candidate uses one controlled maintenance window, one verified stop/start cycle and one post-start worker audit. Any additional restart requires a recorded failure reason.
- R2 clone and Production receive only a frozen candidate. Production is never used for iterative development, troubleshooting by repeated restart, or direct source correction.
- Each hosted deployment must verify the exact application root, database identity, package checksum, migration level, liveness, database readiness and worker count before and after the single restart.
- A deployment is not complete while an old worker for the same application root survives. Unexpected duplicate workers stop all connector and external-write testing until the process lifecycle is reconciled.

## Current Release 3A application

Release 3A CRM Test UAT passed and the NYSA owner approved UAT sign-off on 2026-08-02. The exact
frozen candidate is application `2.1.0-dev.114`, WordPress staging connector `1.9.4`, and package
`nysa-core-r3ai-lossless-output-dev114.zip` with SHA-256
`573e527710750cba82e5ffedbe32dde3feb43e188a77e91209b0320d2fb2c15a`.

This approval closes the CRM Test UAT gate only. R2-clone deployment and acceptance, explicit
Production promotion approval, Production verification, and exact post-Production alignment of CRM
Test and the R2 clone remain mandatory. The live gate ledger is maintained in
`../release-artifacts/release-3/r3a/RELEASE_3A_DEV114_UAT_ACCEPTANCE_AND_PROMOTION.md`.
