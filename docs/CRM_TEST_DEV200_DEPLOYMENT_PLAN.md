# CRM Test DEV200 Deployment Plan

Target: CRM Test only (`/home/nysareal/nysa-core-dashboard-dd6262a-stage`, database `nysareal_nysa_r2_rehearsal`).

Baseline: deployed `2.1.0-dev.199`, package SHA-256 `1637473b24085ba43e24088c01cee4c5da6ab6f9c45e8e70567951e260e7a631`, migration 126.

DEV200 replaces unsupported browser payment prompts with an on-page consolidated batch-payment form. The form discloses the batch, approved rows, Agents, total and approval date; requires an actual non-future payment date, bank reference and explicit confirmation; shows inline errors; and submits one idempotent batch release. Active payout due dates display as `YYYY-MM-DD`.

Runtime delta: `package.json`, `package-lock.json`, and `public/commission-payout-ui.js`. No database, schema, payout-policy, calculation, invoice, receivable, permission or integration change.

Deployment is backup-first, checksum-bound, baseline-bound and refuses any target other than CRM Test. Rollback uses the generated pre-DEV200 application archive and database dump. Production and R2 clone snapshots must remain unchanged.
