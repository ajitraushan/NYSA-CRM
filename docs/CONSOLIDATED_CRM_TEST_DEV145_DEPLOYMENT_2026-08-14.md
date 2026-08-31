# Consolidated CRM Test dev.145 Deployment

Date: 2026-08-14  
Target: CRM Test only  
Deployed version: `2.1.0-dev.145`

## Result

The consolidated candidate was deployed to CRM Test and is ready for owner-led end-to-end UAT.

- Package checksum and JSON manifest: verified before deployment
- Application and PostgreSQL backups: verified
- Active CRM Test workers: **1**
- Final health result: `ok=true`, `database=ready`, `version=2.1.0-dev.145`
- Health requests during the successful recovery/deployment completion: **1**
- Schema migrations: **94**, latest `094_release3d_calendly_scheduling.sql`
- Installed runtime manifest: verified
- Representative consolidated database contract: verified
- Property Finder, Microsoft 365, and Calendly runtime switches: disabled
- Production and Production/R2 clone: not targeted or modified

Verified backup location:

`/home/nysareal/crm-backups/consolidated-crm-test-dev145-20260814T095330Z`

## Controlled recovery notes

The first attempt stopped before backup or changes because two CRM Test workers were present. The older known managed worker was retained and the newer duplicate orphan was removed.

The next attempt stopped safely during backup because CRM Test has no local `.env` file and receives its database settings from the managed worker environment. The backup logic was corrected to include `.env` only when present. No application files, migrations, or restart occurred during that stopped attempt.

The successful attempt completed application and database backups, installed the consolidated runtime, and performed one controlled worker replacement. CloudLinux did not automatically wake the replacement worker during the guarded wait. A single request to the CRM Test health endpoint activated the managed worker, completed migrations, and returned the successful dev.145 result above. No second restart or additional health request was made.

## UAT handover

Use `docs/CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md` for the single full-flow test. Record any issue with the role, page, record type, expected result, actual result, and time observed. Do not use real private owner/contact/authority information in test records.
