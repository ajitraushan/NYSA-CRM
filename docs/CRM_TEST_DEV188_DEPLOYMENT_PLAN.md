# CRM Test dev.188 deployment plan

Date: 2026-09-05 (Asia/Dubai)

## Approved scope

- CRM-188: responsive left-side role navigation on desktop, retaining horizontal navigation on smaller screens.
- Receivables terminology: identify the Commission Receivables Register and each receivable/Opportunity/instalment; replace generic `Open invoice` with the record's next action.
- Replace the right overlay drawer with an in-page Receivable workspace.
- Make the dark-theme due-date picker visible and allow every additionally inserted invoice row to be removed before confirmation.
- When the Accountant confirms new invoices, issue every instalment immediately with a generated `NYSA-INV-YYYY-######` identity and system invoice date.
- Provide a NYSA-branded paper tax-invoice PDF for preview, print and download.
- Explain and preserve the relationship: collection posts a commission-only Finance Receipt excluding VAT; payout remains a separate controlled workflow.

## Baseline and target

- Deployed baseline: `2.1.0-dev.186`, SHA-256 `c755654a60d7c1574d06a76b3e109dfccb9195b03630bcfe3d472092ef1655d4`.
- Latest migration remains `118_dev186_187_receivable_workflow.sql` (118 migrations); this release is migration-neutral.
- Target: CRM Test `/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`.
- Candidate: `2.1.0-dev.188`.
- Candidate package: `nysa-core-consolidated-crm-test-dev188-r3.zip`, SHA-256 `c94a52e4aa00f7c51e8f9cab187aef700c11d9f413870bf33a75674f7a12c9b4`.

## Safety and rollback

The target-locked deployment must verify package and runtime manifests, current version, database identity and disabled integrations. It must create and verify a recoverable application archive and PostgreSQL dump before mutation. Production and the R2 clone are excluded and must remain unchanged.

## Verification

- JavaScript syntax checks and focused requirements tests.
- Full source regression suite.
- Isolated candidate continuity tests.
- Post-deployment version, health, readiness, runtime-manifest and single-worker checks.
