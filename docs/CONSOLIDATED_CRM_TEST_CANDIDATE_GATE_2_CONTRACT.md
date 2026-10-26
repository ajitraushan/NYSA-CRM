# NYSA CORE Consolidated CRM Test Candidate - Gate 2 Contract

**Date:** 15 August 2026 (Asia/Dubai)  
**Candidate:** `2.1.0-dev.146`  
**Status:** deployed to CRM Test after fresh explicit approval; technical gates passed  
**Target:** CRM Test only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`)  
**Protected:** Production and the Production/R2 clone must remain unchanged

## Outcome

One checksum-bound CRM Test candidate consolidates the owner-approved local functional work from
Releases 3 through 6. It is intended to support one real CRM end-to-end business test. It is not a
Production or clone candidate until CRM Test defects are corrected and the exact accepted package is
frozen again.

## Runtime inclusion ledger

The archive includes only the installable application runtime and its controlled deployment evidence:

- `app.cjs`, `package.json`, `package-lock.json`;
- complete `public/` browser runtime, including the approved local functional interfaces;
- complete `src/` server runtime and migrations `001` through `095`;
- `MANIFEST.sha256` and `RUNTIME_MANIFEST.sha256`;
- this contract, the CRM Test UAT runbook and the CRM-Test-only deployer.

The build script walks those roots deterministically, rejects unsafe archive paths, hashes every
file and uses a fixed ZIP timestamp. It never derives package scope from Git state, so the dirty
working tree is preserved without accidentally including unrelated output.

## Archive exclusions

- `.env`, credentials, tokens, private storage, uploads, database data and runtime logs;
- `.git`, `node_modules`, tests, local prototypes, temporary files and historical outputs;
- previous deployment packages and backups;
- Property Finder or WhatsApp credentials/account configuration;
- Production or clone deployment scripts.

## Functional inclusion ledger

| Area | Candidate treatment |
|---|---|
| Release 3A trusted intake, Customer 360 and broker priority | Included |
| Release 3B governed requirements and Inventory matching | Included |
| Release 3C governed selection and response evidence | Included as prepared/not-sent CRM workflow |
| Native WhatsApp delivery/inbound webhooks | Excluded; no provider activation |
| Inventory import duplicate prevention and partner master | Included |
| Official document evidence and DLD market-data import | Included; external source calls remain absent |
| Commission receipt and Director-only payout | Included |
| Agent employment and leave | Included |
| Customer/transaction document compliance | Included |
| Marketing-material compliance | Included; no publication/send |
| Microsoft 365 Email and Calendly | Schema/UI boundaries included; connectors disabled pending integration |
| Property Finder | Existing historical code/schema retained for baseline compatibility; every switch remains off and no PF work/UAT occurs |
| Invoice/accounting replacement, Privacy Operations, replacement dashboards | Excluded by owner decision |

Migration `085` remains included because it is the governed internal selection/response evidence
workflow. It does not send a WhatsApp message and does not constitute native WhatsApp integration.

## Ordered migration contract

The expected CRM Test baseline is application `2.1.0-dev.145` with migration
`094_release3d_calendly_scheduling.sql`. A read-only preflight must prove the actual baseline before
mutation. Dev.146 adds migration `095`; the cumulative migration inventory becomes:

| Order | Migration | Purpose | Principal dependency |
|---:|---|---|---|
| 83 | `083_inventory_duplicate_prevention.sql` | Inventory import duplicate identities/review | Inventory and import foundation |
| 84 | `084_partner_organization_integration.sql` | Partner organization master | Broker/Admin governance |
| 85 | `085_release3c_governed_share_response.sql` | Prepared selection and response evidence | Requirements, matching, Tasks |
| 86 | `086_release4_official_document_evidence.sql` | Official/external document evidence | Documents, Inventory, Deals |
| 87 | `087_release4_dld_market_intelligence.sql` | Governed imported market evidence | Areas, Inventory, Admin governance |
| 88 | `088_release5_commission_receipt_realtime_payout.sql` | Receipt, agent credit and payout | Deals, brokers, audit |
| 89 | `089_agent_employment_leave.sql` | Employment, leave, approval Tasks | Brokers, reporting lines, Tasks |
| 90 | `090_release6_customer_transaction_document_compliance.sql` | Transaction document rules/evidence | Deals, parties, official evidence, Tasks |
| 91 | `091_release6_marketing_material_compliance.sql` | Marketing material release controls | Inventory, media, campaigns, Tasks |
| 92 | `092_release3b_matching_completion.sql` | Current deterministic matching completion | 075-079 matching/Inventory authority |
| 93 | `093_release3d_microsoft365_email.sql` | Disabled Microsoft 365 Email boundary | Leads, Contacts, Activities, Brokers |
| 94 | `094_release3d_calendly_scheduling.sql` | Disabled Calendly scheduling boundary | Leads, Opportunities, matches, Tasks/Viewings |
| 95 | `095_dev146_full_scope_uat_governance.sql` | UAT contact/action, recovery, accepted-term replacement and Lead-SLA supersession governance | Leads, Opportunities, Offers, Bookings, Deals, Inventory |

All thirteen migrations are additive and transaction-runner-managed. They must not insert their own
`schema_migrations` row. The runner commits one migration and its registration together. The
candidate corrects earlier local self-registration in migrations `088` through `094`, adds migration `095` without self-registration, and aligns the
new connector grants to the existing `nysareal_nysar2app` application role.

### Preconditions

- exact CRM Test application root and database identity;
- exactly one managed CRM Test worker before deployment;
- baseline application/migration pair `dev.145`/`094`, or an exact idempotent `dev.146`/`095` replay;
- package, outer checksum, JSON manifest and internal manifests agree;
- application and custom-format database backups exist and are non-empty before installation;
- Production and clone application/health snapshots are captured and unchanged afterward.

### Rollback boundary

Every migration is individually transactional, but the twelve-file sequence is cumulative. If a
later migration fails, earlier committed migrations cannot be safely undone with ad-hoc reverse SQL.
Recovery therefore uses the pre-deployment database dump plus the pre-deployment application archive.
No down-migration or destructive table drop is authorized.

## Configuration contract

Existing CRM Test secrets remain server-side and are never copied into the package. The following
integration switches must remain false/unset for this deployment:

- `PROPERTY_FINDER_SANDBOX_ENABLED=0`
- `PROPERTY_FINDER_ALLOW_READS=0`
- `PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS=0`
- `PROPERTY_FINDER_PRODUCTION_ALLOW_READS=0`
- `PROPERTY_FINDER_PRODUCTION_ALLOW_DRAFT_CREATE=0`
- `PROPERTY_FINDER_PRODUCTION_ALLOW_PUBLISH=0`
- `MICROSOFT365_EMAIL_ENABLED=0`
- `CALENDLY_ENABLED=0`

Native WhatsApp integration has no enabled connector in this candidate. Existing external-launcher
compatibility and internal prepared/not-sent evidence do not authorize native delivery.

## Verification gates before CRM Test mutation

1. syntax-check every runtime JavaScript file;
2. run focused consolidation/package tests;
3. pass the complete local suite;
4. verify migration registration, grants and order;
5. build the archive twice and require identical SHA-256;
6. inspect archive paths, manifests and credential exclusions; and
7. perform read-only CRM Test baseline and worker-count preflight.

## Authorization boundary

This package did not authorize deployment by itself. Fresh explicit user approval was received before
the dev.146 CRM Test mutation. Production, the Production/R2 clone, native WhatsApp, provider
credential handling, Microsoft 365, Calendly and every other external integration remained outside
scope; Property Finder stayed disabled throughout final verification.
