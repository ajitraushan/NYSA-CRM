# CRM Test DEV197 deployment completion

- Completed: 2026-09-06 (Dubai)
- Installed/served version: `2.1.0-dev.197`
- Target: CRM Test only
- Package SHA-256: `4f3a3e38a303d981914a18cb151fd2c6ec7f4872f566e47ff3b296b2b13126ee`
- Database migration state: unchanged at `126_executing_agent_tier_and_social_uplift.sql` (126 total)
- Schema/data migration: none
- Live worker: one replacement CRM Test worker, PID `450530`, verified against the CRM Test listener by the deployer
- Health: `ok=true`, process `ready`, version `2.1.0-dev.197`
- Readiness: `ok=true`, database `ready`, version `2.1.0-dev.197`
- Rollback backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev197-20260906T131919Z`
- Production and R2 clone: unchanged

## Delivered

- Agent-quarter screen tables and landscape PDFs now use the corrected connected Excel headers.
- Full monetary values retain thousands/million separators.
- A Deal crossing to a higher tier displays the new tier in bold.
- The resulting retrospective Tier Adjustment is displayed against the earlier Deal being adjusted.
- Each calculation table includes totals for Commission Earned, Already Paid, Tier Adjustment, To be Paid and Status.
- Opportunity and Deal references, property particulars and sale price are displayed together with the commission chain.

## Verification

- Corrected three-Deal calculation scenario: passed, including the AED 2,500 earlier-Deal adjustment and AED 34,900 amount-to-pay example.
- Release-focused payout, Accountant, MD batch, PDF, access and packaging tests: 48/48 passed.
- Packaged JavaScript syntax: 144/144 files passed.
- PDF render: landscape A4 visually inspected; no clipping or overlap found.
- Package isolation: seven runtime files changed from exact DEV196; all 126 historical migrations are byte-identical.
- A broad historical repository suite was also sampled. It contains pre-existing version-pinned and missing historical-document failures unrelated to DEV197; release-focused gates above passed before deployment.
