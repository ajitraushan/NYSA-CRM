# Release 1 Administration Corrections - CRM Test Deployment

Target: `https://crm-test.nysarealty.com/` only

Production deployment is not authorized by this package.

## Scope

This is one consolidated Release 1 correction candidate covering R1-UAT-001 through
R1-UAT-014 and R1-AMD-001 through R1-AMD-013. All findings remain open until CRM Test
deployment, successful retest and explicit user confirmation.

## Required pre-deployment controls

1. Confirm the application and database are the CRM Test instances, including the
   database name `nysareal_nysacrm_r1test`. Stop if any production identity appears.
2. Record the deployed CRM Test code commit and create a verified CRM Test database
   backup before applying migrations.
3. Restore that backup into an isolated verification database and apply migrations
   `011_organization_profile_governance.sql` and
   `012_release1_admin_uat_corrections.sql` and the additive
   `013_customer_proposal_address.sql` and `014_customer_kyc_summary.sql` there first.
4. Verify broker, team, lead, listing, proposal, audit and migration row counts before
   and after the isolated migration. Run application startup twice and confirm each
   migration is recorded once in `schema_migrations`.
5. Apply the same package to CRM Test, restart once and confirm `/api/health` returns
   HTTP 200 with database ready.

## CRM Test smoke and retest matrix

- Controlled values: alignment, lowercase snake_case, guarded unused-draft deletion,
  immutable used codes, retirement/replacement and consumer mappings.
- Routing: Dubai Rental, Off-plan and Secondary Sales defaults; company fallback;
  manager/director queue scope; atomic self-claim; repeated acceptance and first-contact
  SLA recycling with complete history.
- Administration: consolidated intake operations, structured qualification versions,
  business-time SLA controls, structured fee calculations and dashboard targets.
- Proposal: governed company identity, template mappings, required/optional configured
  prompts, authoritative data validation, approved media/scenario selection and exact
  immutable PDF snapshot.
- Users: invite and direct pending creation, activation, multi-role/team assignment,
  Admin Assistant permissions, Viewer denial, Suspend/Reactivate/Revoke and session
  invalidation. External Broker remains interface identity only.

Record the Amendment ID, related UAT finding, agreed requirement, status and exact
retest evidence for every result. A successful smoke test changes status only to
`Deployed to CRM Test` or `Retest passed`; closure requires explicit user confirmation.

## Rollback

If startup, migration reconciliation or a critical smoke test fails, stop further
restarts, preserve logs, restore the prior CRM Test application package and use the
verified CRM Test backup according to the reviewed recovery decision. Do not use the
production database or production application as a test or rollback target.
