# NYSA CRM Permissions Matrix

## Status

This is the proposed internal-role baseline for Release 1. It implements the
approved role list but requires NYSA confirmation of any exceptions before the
role migration is released.

## Scope Codes

- `Own`: records assigned to or created by the user where policy permits
- `Team`: records owned by the user's managed team
- `All`: all company records of that type
- `Finance`: financial fields required for accounting work
- `Read`: view only
- `None`: no access

API authorization is authoritative. Hiding a button is not a security control.

## Proposed Matrix

| Capability | Admin | Sales Agent | Listing Agent | Manager / Team Lead | Director | Accountant |
| --- | --- | --- | --- | --- | --- | --- |
| Manage users, roles, and teams | All | None | None | Team membership request | Read | None |
| Create manual contacts and leads | All | Own | Own when assigned | Team | Read | None |
| View contacts and leads | All | Own | Assigned | Team | All | Limited deal parties |
| Edit customer details | All | Own | Assigned limited fields | Team | Read | Limited finance fields |
| Assign or reassign leads | All | None | None | Team | Read | None |
| Accept or reject assignment | All | Own | Own | Team | Read | None |
| Change lead status | All | Own | Assigned where permitted | Team | Read | None |
| Record calls, notes, and follow-up | All | Own | Assigned | Team | Read | None |
| View communication history | All | Own | Assigned | Team | All | None |
| Manage qualification | All | Own | Assigned input | Team override | Read | None |
| View all inventory | All | Read | Read | Read | Read | Read |
| Create or edit listings | All | If granted | Own | Team | Read | None |
| Archive listings | All | None | None | Request / approved team policy | Read | None |
| Add listing media | All | If granted | Own | Team | Read | None |
| Run financial calculator | All | Own | Assigned | Team | All | All |
| Create customer proposals | All | Own | Assigned | Team | All | Read |
| Send or mark proposal sent | All | Own | Assigned | Team | Read | None |
| Manage viewings and offers | All | Own | Assigned | Team | All | Read |
| Close deal operational steps | All | Own draft | Assigned draft | Team approval | All approval | Finance review |
| View commission details | All | Own summary | Own summary | Team | All | All |
| Edit commission/payment records | All | None | None | Recommendation | Approval | All finance fields |
| View customer identity documents | All | Own when required | Assigned when required | Team when required | All | Finance-required only |
| Upload transaction documents | All | Own | Assigned | Team | Read | Finance-required |
| Delete/anonymize customer data | Controlled admin workflow | Request | Request | Request | Approve policy | None |
| Operational reports | All | Own | Own | Team | All | Finance subset |
| Financial and commission reports | All | Own summary | Own summary | Team summary | All | All |
| Export data | Controlled | Own approved export | Limited | Team controlled | All controlled | Finance controlled |
| View audit history | All | Own business history | Own business history | Team | All | Finance-related |

## Permission Rules

### Administrators

Administrators configure the platform and access policy. High-risk actions such
as data export, permanent deletion, role elevation, and secret configuration
must be separately audited. Administrator access is not a reason to bypass
business approvals.

### Sales agents

Sales agents work their assigned leads, contacts, activities, opportunities,
and proposals. They cannot browse unrelated customer records or reassign leads.

### Listing agents

Listing agents own and maintain inventory. Customer access is limited to leads
or opportunities where they are explicitly participating.

### Managers and team leads

Managers control team queues, assignment, SLA intervention, workload, and team
reporting. They may override qualification or workflow values only with a reason.

### Directors

Directors have company-wide visibility and approval rights but are read-only for
routine activity detail unless a defined approval or intervention is required.

### Accountants

Accountants access deal parties and documents only to the extent required for
commission, invoicing, receipt, and payment work. They do not receive general
lead communication access.

## Sensitive Operations

These actions require a reason and an audit event:

- Role elevation or access revocation
- Cross-team lead reassignment
- Qualification override
- Contact merge
- Communication restriction override
- Data export
- Restricted-document access outside normal record scope
- Commission adjustment or approval
- Proposal replacement after it was sent
- Controlled deletion or anonymization

## Current-to-Planned Role Migration

The current database roles are `admin`, `internal_broker`, `partner_broker`, and
`viewer`. Release 1 must not guess a new role for an existing user. Administrators
will retain access; each other active user must be explicitly mapped to an
approved internal role and team. External partner access remains disabled.
