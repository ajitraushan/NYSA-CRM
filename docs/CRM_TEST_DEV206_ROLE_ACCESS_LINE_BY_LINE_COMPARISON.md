# CRM Test DEV206 role access line-by-line comparison

Date: 19 September 2026  
Target: CRM Test only  
Deployed baseline: `2.1.0-dev.205`  
Source baseline package: `nysa-core-consolidated-crm-test-dev205-r3.zip`  
Source package SHA-256: `732ca1aab790b3041971c0edde6facb96ae5b96c7de379c1888d1acfca7aef89`  
Rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev205-20260919T052655Z`  
Production and R2 clone: unchanged

## Confirmed operating model

- **Admin is the single administrative role.** There is no selectable Assistant or Admin Assistant role.
- Admin combines system configuration with leave policy, employment configuration, leave-register and leave-decision responsibilities.
- Admin remains outside routine Customers, Leads, Inventory, Opportunities, Deals, receivables, payouts and other business operations.
- Managing Director remains the company-wide business role and is not Admin.
- The historical database value `admin_assistant` is retained only for schema compatibility. It is removed from selectable roles and is centrally denied until an Administrator explicitly reassigns the user to Admin.
- No user assignment is changed automatically by DEV206.

## Access comparison

| Control | Admin | Managing Director | Manager | Sales Agent | Listing Executive | Accountant |
|---|---|---|---|---|---|---|
| System configuration | Maintain | Denied | Denied | Denied | Denied | Denied |
| Users, roles and access | Maintain | Denied | Denied | Denied | Denied | Denied |
| Teams and staff configuration references | Maintain | Business scope only | Managed scope | Own scope | Own scope | Finance scope |
| Customers, Leads and assignment | Denied | Company-wide | Managed scope | Assigned scope | Denied | Denied |
| Inventory and listings | Denied | Company-wide | Managed scope | Permitted scope | Permitted scope | Denied |
| Opportunities and Deals | Denied | Company-wide | Managed scope | Own scope | Participant scope | Read only |
| Receivables, invoices and payouts | Configuration only | Review and approve | Denied | Denied | Denied | Operate |
| Own leave and balance | Allowed when employment is configured | Allowed | Allowed | Allowed | Allowed | Allowed |
| Leave policy and employment configuration | Maintain | Denied | Denied | Denied | Denied | Denied |
| Leave register and decisions | Maintain and decide; self-approval prohibited | Denied | Denied | Denied | Denied | Denied |

## Technical controls

| Requirement | DEV206 implementation | Result |
|---|---|---|
| One administrative role | `ROLE_ACCESS_POLICY.admin` is the only active administrative access profile | Pass |
| No Assistant role selection | `admin_assistant` removed from backend and browser selectable role lists | Pass |
| Safe handling of historical assignments | Historical `admin_assistant` is recognized only as a retired, deny-by-default assignment | Pass |
| Direct Admin workspace | Admin opens Administration directly and has no intermediary dashboard message | Pass |
| One left navigation | Administration maintenance uses an in-page selector instead of a second sidebar | Pass |
| Admin configuration access | Exact `/admin` configuration plus narrow team/staff reference capabilities | Pass |
| Admin business separation | Governed central middleware denies business APIs before route-local legacy checks | Pass |
| Admin leave administration | Central Admin capabilities govern maintenance, register and decisions | Pass |
| Leave routing | Submission resolves an active `role='admin', job_role='admin'` approver from central policy | Pass |
| Leave self-approval | Capability check also rejects matching applicant and approver identities | Pass |
| Managing Director separation | Director remains the business authority; Admin does not inherit MD visibility | Pass |
| Schema and calculations | No migration or calculation change | Pass |

## Exact DEV205 to DEV206 package comparison

Package: `nysa-core-consolidated-crm-test-dev206-r1.zip`  
SHA-256: `c1eecba608f05cf9cf2d17041a1234967c490d2e5a5bfdfc7ccff1c4b358457e`  
Archive files: 319  
Manifest-classified runtime files: 317  
Changed runtime files: 21  
Migration inventory: 126 in DEV205 and 126 in DEV206; every migration is byte-for-byte identical.

| Exact packaged file | Added | Removed | Classification |
|---|---:|---:|---|
| `package.json` | 1 | 1 | Version only |
| `package-lock.json` | 2 | 2 | Version only |
| `public/agent-leave-ui.js` | 2 | 2 | Admin leave wording |
| `public/app.js` | 15 | 24 | Direct Admin entry, no Assistant selection/dashboard, leave navigation and single-level Administration selector |
| `public/index.html` | 4 | 2 | Selector styling and nested-sidebar removal |
| `public/market-intelligence-ui.js` | 1 | 1 | Admin-only governance wording |
| `src/agent-leave-domain.js` | 0 | 4 | Removed obsolete Manager/Director routing helper |
| `src/crm-domain.js` | 1 | 1 | Removed `admin_assistant` from selectable job roles |
| `src/role-access.js` | 18 | 14 | Combined Admin capabilities, retired legacy assignment and central leave principal |
| `src/routes/admin.js` | 3 | 3 | Admin-only route entry and terminology |
| `src/routes/agent-leave.js` | 13 | 13 | Admin maintenance, central Admin approver and matching messages |
| `src/routes/commission-payout.js` | 1 | 1 | Earlier terminology-only correction; governed middleware still denies Admin operations |
| `src/routes/crm.js` | 5 | 4 | Team/staff configuration references use central capabilities |
| `src/routes/dld-market-intelligence.js` | 9 | 9 | Earlier terminology-only correction; central gate remains authoritative |
| `src/routes/document-compliance.js` | 3 | 3 | Earlier terminology-only correction; central gate remains authoritative |
| `src/routes/governance.js` | 1 | 1 | Earlier terminology-only correction; central gate remains authoritative |
| `src/routes/inventory-import.js` | 1 | 1 | Earlier terminology-only correction; central gate remains authoritative |
| `src/routes/lead-operations.js` | 6 | 6 | Earlier terminology-only correction; central gate remains authoritative |
| `src/routes/marketing-material-compliance.js` | 2 | 2 | Earlier terminology-only correction; central gate remains authoritative |
| `src/routes/official-document-evidence.js` | 4 | 4 | Earlier terminology-only correction; central gate remains authoritative |
| `src/routes/partner-organizations.js` | 1 | 1 | Earlier terminology-only correction; central gate remains authoritative |

## Verification evidence

- Focused role, leave, Admin, CRM policy and role-catalogue suite: 100 passed, 0 failed.
- Complete repository regression: 1,424 passed, 0 failed and 73 intentionally skipped; 1,497 total.
- Modified JavaScript syntax checks: passed.
- Exact package and both internal SHA-256 manifests: passed with zero missing or mismatched files.
- Exact package diff check: no trailing whitespace or malformed patch lines.
- Deployment script: LF-only and bound to the package hash above, CRM Test root, rehearsal database, DEV205 baseline and migration 126.
- Local Windows environment has no Bash binary; native `bash -n` remains a server-side pre-execution check.
- Security impact: combines approved administrative responsibilities while retaining deny-by-default business separation.
- Privacy impact: no customer, Lead, Deal or finance access is added to Admin.

## Required after CRM Test deployment and before Production consideration

1. Confirm Admin opens directly in Administration, with no dashboard message and no second left panel.
2. Confirm Admin can open Leave Administration, maintain policy/employment, view the leave register and decide another employee's leave.
3. Confirm Admin receives 403 for Customers, Leads, Inventory, Opportunities, receivables and commission payments.
4. Check whether any user still has the retired `admin_assistant` assignment; explicitly reassign only an approved person to Admin.
5. Confirm the Managing Director account remains Director and has company-wide business access without Administration.
6. Record worker count, health, readiness, backup and rollback evidence.
7. Repeat the functional-specification comparison before seeking Production approval.
