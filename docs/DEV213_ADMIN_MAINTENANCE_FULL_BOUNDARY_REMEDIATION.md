# DEV213 Admin maintenance full-boundary remediation

## Release decision

DEV212 is withdrawn and must not be deployed. Its package was built from GitHub,
but UAT evidence showed that it corrected only the outer CRM and Task routers.
Several Administration modules retained their own operational-staff boundary and
would still reject the configuration-only Admin role.

## Reproducible baseline

- Application: NYSA CORE / CRM
- Target environment: CRM Test only
- Live version verified through `https://crm-test.nysarealty.com/api/health` on
  26 September 2026: `2.1.0-dev.211`
- Withdrawn source candidate: DEV212 commit
  `be002a96251cf75d7006d9c05124411e5ef77723`
- File rollback point: the clean Git commit above
- Database/schema/configuration impact: none
- Data migration: none; latest migration remains
  `128_dev211_uat210_remediation.sql`
- CRM Test rollback: retain the currently served DEV211 deployment and its
  server-side deployment backup until DEV213 passes authenticated UAT
- Production and R2 clone: not targeted

## Root cause

The central capability policy correctly allows Admin configuration requests and
rejects operational business requests. Mixed route modules then applied a second
legacy `hasInternalCrmIdentity` check. Admin is deliberately not an operational
CRM identity, so those secondary checks incorrectly rejected valid `/admin/...`
requests with messages such as “restricted to NYSA staff.”

The general `/admin` capability rule also omitted the `PUT` method used by User
records → Business-area assignment maintenance.

## Corrective scope

The following mixed configuration/business routers now use
`hasNysaStaffIdentity` only as their router-entry identity boundary, after
`requireAuth` has enforced the central capability allow-list:

1. Company profile, Controlled values, Property media policy and Listing policy
2. Dashboard targets
3. Market intelligence configuration
4. Customer and transaction document requirements
5. Proposal designer and Controlled document templates
6. Lead qualification and Regulatory/fee rules

The central `/admin` configuration rule now accepts `GET`, `POST`, `PUT`,
`PATCH` and `DELETE`. Route-specific Admin checks, validation, versioning,
approval, activation, retirement and audit controls remain unchanged.

## Non-regression boundary

Admin remains denied from Customers, Leads, Inventory, Opportunities, Finance,
Receivables, Commission payments and every other operational business endpoint.
No ownership, workflow, approval, compliance or transaction authority is added.
Personal Tasks, My Leave, Leave Administration and Bulk Upload retain their
separately governed capabilities.

Website intake failure resolution can create, reject or reconnect Customers and
Leads, so it is an operational Manager pathway rather than Admin maintenance.
The misleading Integration failures option is removed from the Admin selector;
its protected operational APIs remain unavailable to Admin.

## Acceptance criteria

- Every item visible in the Administration maintenance selector loads without a
  staff-identity denial for an authenticated Admin.
- Create/edit/version/approve/activate/retire operations remain subject to the
  existing route-specific rules and audit trail.
- User-record business-area maintenance succeeds through its existing `PUT`
  endpoint.
- Direct Admin requests to business-process endpoints return HTTP 403 before the
  route handler runs.
- Every Administration selector option resolves from its panel's own heading,
  never its render position. In particular, Commission & payout policy opens
  commission configuration, User records opens existing-user maintenance, and
  About opens deployment identity and version details even when an optional
  maintenance module is absent.
- A release package is eligible only after the full test suite passes from an
  exact GitHub-advertised DEV213 commit and provenance verification succeeds.
