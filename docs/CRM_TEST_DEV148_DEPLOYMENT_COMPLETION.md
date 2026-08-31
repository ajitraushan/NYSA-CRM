# CRM Test dev.148 deployment completion

**Deployment:** completed 16 August 2026 (Asia/Dubai)
**Target:** CRM Test only
**Version:** `2.1.0-dev.148`
**Migration state:** 95 migrations through `095_dev146_full_scope_uat_governance.sql`

## Verified result

- Package checksum and embedded archive/runtime manifests verified.
- Existing `2.1.0-dev.147` CRM Test baseline verified before installation.
- CRM Test database and application backup created at
  `/home/nysareal/crm-backups/consolidated-crm-test-dev148-20260816T061514Z`.
- Health returned `ok: true`, `process: ready`, version `2.1.0-dev.148`.
- Readiness returned `ok: true`, `database: ready`, version `2.1.0-dev.148`.
- Exactly one CRM Test Node worker remained: PID `903929`, command label
  `lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`.
- A second rerunnable deployment invocation verified the exact installed runtime manifest and made no
  further change.
- Production and Production/R2 clone were not targeted. Property Finder, Microsoft 365 email and
  Calendly switches remained disabled under the deployment gate.

## Retest focus

1. Search and select an eligible existing Customer.
2. Create the Lead and confirm a Sales Agent self-created Lead is immediately assigned and accepted.
3. Confirm the Lead appears once and no partial/duplicate record was created.
4. Retest website buyer/investor profile and Property Selection continuation separately when test
   intake evidence is available; those paths were unchanged and passed local regression coverage.
