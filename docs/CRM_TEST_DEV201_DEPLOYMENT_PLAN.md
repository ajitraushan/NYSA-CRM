# CRM Test DEV201 Deployment Plan

Target: CRM Test only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`).

Baseline: deployed `2.1.0-dev.200`, package SHA-256 `3497a0eecce7fac8af900557986ceab9546810a9a4a0fbb6cbd76e04009902fd`, migration 126.

DEV201 corrects the live-tested batch-payment date guard. PostgreSQL returns the MD decision timestamp as a JavaScript `Date`; DEV200 converted that object with `String(...).slice(0,10)`, producing a weekday fragment rather than an ISO date and rejecting a valid same-day payment. DEV201 compares the payment date and approval date as Dubai calendar dates.

Runtime delta: `package.json`, `package-lock.json`, and `src/routes/commission-payout.js`. No database, schema, payout-policy, calculation, invoice, receivable, permission or integration change.

Deployment is backup-first, checksum-bound, baseline-bound and refuses any target other than CRM Test. Rollback uses the generated pre-DEV201 application archive and database dump. Production and R2 clone snapshots must remain unchanged.
