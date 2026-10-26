# CRM Test dev.190 — payout eligibility and access correction plan

Date: 2026-09-05 (Asia/Dubai)

## Authority and baseline

- User-authorized scope: implement and deploy the verified bundle to CRM Test.
- Live/source baseline: CRM Test `2.1.0-dev.189`.
- Baseline package: `nysa-core-consolidated-crm-test-dev189-r4.zip`.
- Baseline SHA-256: `9f7569b86eaf8b4d35fec6bd2a2cbd8b81dcade62872b48f28bed937c4d06451`.
- Existing rollback point: `/home/nysareal/crm-backups/consolidated-crm-test-dev189-20260905T105119Z`.
- Planned target: CRM Test application and `nysareal_nysa_r2_rehearsal` database only.
- Production, R2 clone, Property Finder, Campaign Management and Performance Management are excluded.

## Included corrections

1. Permit an authenticated Accountant to view and print generated NYSA invoice PDFs.
2. Provide the requested five quarterly payout slabs as new-policy draft defaults: 55%, 60%, 65%, 70% and 75% at AED 0/100k/200k/300k/400k thresholds.
   “Up to” is inclusive: exact AED 100k/200k/300k/400k boundaries remain in the lower slab.
3. Require the Administrator to choose one of two maintained methods: Quarterly achieved rate, or Crossing Deal only. No method is silently selected.
4. For Quarterly achieved rate, preserve earlier Deal records and add the difference as an auditable true-up on the crossing Deal.
5. Add effective-dated Social-media Active/Inactive status to each eligible Agent under Administration → User records.
6. Require a reason and evidence reference for every Agent eligibility status change and record it in the audit log.
7. Resolve Agent social-media status on the commission receipt date. Active Agents receive +5 percentage points in payout slabs 1–3 only.
   The increment is not applied retroactively to receipts dated while the Agent was Inactive.
8. Preserve the exact status-version reference and applied increment on each immutable payout calculation.
9. Display payout readiness before calculation. Rows without an active policy for their receipt date are blocked with a clear message instead of failing after Prepare.
10. Display Commission Payment receipt dates as calendar dates.
11. Derive the quarter from the actual company-receipt date for all accumulation and quarterly-reset calculations.
12. Show the actual Opportunity reference throughout Commission Payments, with the Deal reference retained as supporting detail.
13. Provide an Agent-quarter calculation sheet showing every Opportunity, gross commission, cumulative quarter amount, achieved rate, current-Deal payout, prior-Deal true-up and payment now.
14. Provide the calculation sheet as a printable NYSA-formatted PDF and as a downloadable email attachment.

## Database change

- Migration `121_agent_social_media_payout_eligibility.sql` adds effective-dated Agent eligibility, overlap prevention, payout-calculation provenance and audit support.
- Existing migrations 001–120 remain byte-for-byte unchanged in the isolated candidate.
- The restricted local synthetic database rebuilt successfully through all 121 migrations.

## Tests

- Focused and regression tests: 26 passed, 0 failed.
- Full automated suite: 1,356 passed, 72 intentionally skipped, 0 failed.
- Accountant invoice access is now asserted against the exact `/finance/receivables/:id/document` path.
- Accountant/MD payout-sheet access and role boundaries are asserted against the exact Agent-quarter PDF path.

## Candidate

- Version: `2.1.0-dev.190`.
- Package: `nysa-core-consolidated-crm-test-dev190-r6.zip`.
- SHA-256: `220c14b96cb8650d30c716acf75e4e857f06893def782421fe58eb62a94d171f`.
- Candidate is checksum-bound to the exact deployed dev.189 package.

## Deployment and rollback gate

Deployment was explicitly authorized on 2026-09-05. Create a fresh dated backup of the dev.189 application and database before applying migration 121, install only the manifest-listed files, restart the single CRM Test worker, and verify version, migration, Accountant invoice PDF access, payout-sheet PDF access, role boundaries, readiness and payout-calculation contracts. Roll back to the new pre-dev.190 backup if any verification fails.

The payout policy will not be activated silently. Administrator activation requires selection of one of the two maintained calculation methods and an effective date.
