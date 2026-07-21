# Release 1.1 Customer Reliability and Lead Lifecycle — CRM Test Deployment

Target: `https://crm-test.nysarealty.com/` only

Production deployment is not authorized by this package.

## Included corrections

- R1.1-AMD-008 / R1.1-UAT-021: Sales Agent role-scoped customer-register loading and
  standalone customer creation verification.
- R1.1-AMD-009 / R1.1-UAT-022: selected-lead lifecycle tracker with a separate Lost
  outcome and explicit customer-to-many-leads explanation.
- R1.1-AMD-008 Revision 2 / R1.1-UAT-023: syntactically complete Sales Agent company
  lookup while opening the existing-customer lead form.
- R1.1-AMD-010 / R1.1-UAT-024: team-scoped Manager KYC review queue and decision access.
- R1.1-AMD-011 / R1.1-UAT-025: locked Customer Master feed into customer-originated
  lead creation, without repeated customer identity input.

Both findings remain open after deployment. Closure requires successful CRM Test retest
and explicit confirmation from the NYSA owner.

## Failed first retest and Revision 1

The first R1.1-AMD-008 CRM Test retest failed with PostgreSQL `42601`, syntax error at
`ORDER BY`. The Sales Agent branch of `contactScopeSql` was missing the final parenthesis
of its outer owner-or-related-lead expression. R1.1-AMD-008 Revision 1 corrects that
predicate in `src/crm-policy.js` and adds a generated-SQL balance regression assertion.
The initial deployment must not be accepted as the customer correction; deploy the
Revision 1 package, restart fully and repeat the complete customer-scope retest.

## cPanel deployment

1. Confirm the browser address, cPanel application root and configured database belong to
   CRM Test. The expected database is `nysareal_nysacrm_r1test`. Stop immediately if any
   production identity, `crm.nysarealty.com`, or production database appears.
2. Record the currently deployed CRM Test commit/package and create a verified CRM Test
   database backup. This correction has no new migration, but the backup and rollback gate
   still apply.
3. Upload the supplied `nysa-core-r1-1-customer-lifecycle-crm-test-<commit>.zip` outside
   the live application directory and verify its supplied SHA-256 before extraction.
4. Extract it into a new staging directory. Preserve the existing CRM Test `.env`, private
   `storage/`, logs and other runtime-only data; do not copy them from or into the ZIP.
5. Copy the extracted application files into the CRM Test application root. Do not run a
   package against the production root. No database migration is introduced by this package.
6. In cPanel Setup Node.js App, confirm the CRM Test application root and startup file
   `app.cjs`, then fully stop and restart the CRM Test Node.js application so both updated
   route code and browser assets load in the same worker.
7. Open `https://crm-test.nysarealty.com/api/health` and require HTTP 200 with
   `{ "ok": true, "database": "ready" }`. Hard-refresh the CRM Test browser before retest.

## Required CRM Test retest

1. Sign in as a Sales Agent. Open Customers without search, search by name/email/phone,
   and confirm no internal error occurs and no unrelated customer is visible.
2. Create a complete customer. Confirm the customer saves and opens immediately while it
   has zero leads. Create a lead from that customer and confirm it remains available in the
   customer register and existing-customer selector.
3. With a second Sales Agent, confirm the first agent's unrelated customer cannot be read.
4. Open leads at New, Contacted, Qualified, Viewing, Negotiation, Won and Lost. Confirm
   `New` is presented as `Lead`, the exact selected stage is highlighted and Lost is a
   separate terminal outcome.
5. Open two leads for the same customer at different stages. Confirm each opened lead has
   its own highlighted position and the customer-to-many-leads explanation is visible.
6. Repeat the lifecycle check at desktop and narrow browser widths. Record screenshots and
   the authenticated API results against each amendment.
7. Submit Ajit's customer KYC as Pending review. Sign in as the maintained Manager, confirm
   it appears under KYC reviews, open it and verify it. Confirm it leaves the queue, an
   unrelated Manager is denied and Ajit cannot mark the customer Verified.
8. From Ajit's opened customer select Create lead for this customer. Confirm customer search
   and identity-entry controls are absent, the Customer Master summary is read-only, and the
   saved lead references the same customer without creating a duplicate.

For each correction record the Amendment ID, related UAT finding, agreed requirement,
deployment/retest status and evidence satisfying the retest condition. Do not close either
finding until the NYSA owner explicitly confirms it.

## Rollback

If health, customer loading, scope denial or lead opening fails, stop the CRM Test worker,
restore the previously recorded CRM Test application package, restore the database backup
only if a separate data issue requires it, restart CRM Test and verify health. Do not use
production as a test, fallback or rollback target.
