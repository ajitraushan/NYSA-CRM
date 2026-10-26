# CRM TEST DEV220 release record

## Frozen baseline

- Target: CRM TEST only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`).
- Source branch: `codex/crm-dev218-approved-documents-theme`.
- Pre-change source and installed baseline: DEV219 commit `7df5e915b3a6034f9bb0e3a6a1154a9443e1ded0`, version `2.1.0-dev.219`.
- Database baseline: migration `132_approved_documents_and_brand.sql` (132 total).
- Rollback point: `/home/nysareal/crm-backups/consolidated-crm-test-dev219-20261006T184138Z` plus the mandatory fresh DEV220 pre-deployment snapshot.
- Protected environments: Production and the R2 clone remain outside scope and unchanged.

## Confirmed defect and DEV220 scope

The CRM TEST error log records `spawn /tmp/chromium EACCES` when an approved Offer Letter is generated. The CloudLinux/cPanel host does not allow the packaged browser to execute from shared `/tmp`. This is an infrastructure-runtime failure; the Offer business data is not rejected and no Offer record is created before the PDF succeeds.

DEV220:

1. extracts and launches packaged Chromium from the application-owned `tmp/pdf-renderer` directory with owner-only permissions;
2. retains the packaged Chromium/Puppeteer compatibility and actionable HTTP 503 failure response introduced in DEV219;
3. adds an installer-time synthetic PDF preflight for all nine approved formats—Buyer Proposal, Financial Illustration, Offer Letter, Viewing Confirmation, A2A Buyer, A2A Seller, Listing NOC, Agent Payout and Tax Invoice—before the CRM TEST worker restart, with application rollback on deployment failure;
4. loads independent browser feature modules in parallel while preserving `app.js` as the final workspace-restoration gate; and
5. serves build-versioned scripts and local brand-font/image assets with immutable caching, while keeping HTML, bootstrap and unversioned executable assets non-cacheable.

There is no migration, business-rule, role, permission, ownership, external-integration or production-data change. The renderer preflight uses only a synthetic document reference.

## Acceptance and rollback

- The exact GitHub-advertised commit must pass the full suite and production dependency audit.
- The mandatory origin-only package and manifest must pass `release:verify-package` before upload.
- Local synthetic generation of all nine approved report/form formats must return valid `%PDF-` documents.
- The guarded installer must create and verify a fresh database dump and application archive before mutation.
- The same nine-format synthetic rendering gate must pass on CRM TEST before worker restart; any format failure restores the DEV219 application archive.
- Health, readiness, version, runtime checksums, migration state, disabled integrations and protected-environment snapshots must pass.
- Production and R2 clone are not deployment targets.
