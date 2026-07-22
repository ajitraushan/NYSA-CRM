# Release 2.1A Connected Operations CRM Test Plan

## Boundary

This plan validates the connected operating flow and coordinated ownership build on
`https://crm-test.nysarealty.com/` only. It does not authorize production or modify the frozen
Release 1.1 production-candidate archive.

Before deployment, back up the current CRM Test application and isolated rehearsal database,
verify both checksums, apply migration `039_release2_connected_operations.sql` atomically and
reconcile the Release 1.1 control counts and the existing R2 Opportunity population.

## Role walkthroughs

### Sales Agent

1. Sign in as a maintained Sales Agent and open the normal dashboard.
2. Confirm **My operating sequence** shows Customer through Deal in order, with later slices
   visibly unavailable rather than missing.
3. Identify one next case, its owner, current step, blocker and next action without opening a
   separate report.
4. Open that case and confirm Customer, Lead, qualification, Opportunity and property context are
   linked rather than re-entered.
5. Confirm the Agent cannot see governed reassignment controls.

### Manager

1. Sign in as a maintained Manager and confirm **Team operating sequence** shows scoped counts and
   team cases requiring attention.
2. Drill into a managed-team case and select **Review reassignment**.
3. Confirm the impact preview identifies the Lead and every open Opportunity separately.
4. Move the Lead and one selected open Opportunity to an eligible active Sales Agent in a managed
   team, recording a reason.
5. Confirm an out-of-team destination, inactive user, stale preview and closed Opportunity are
   rejected without a partial update.

### Administrator and Director

1. Confirm both roles can access company-wide Lead reassignment and the company assignment queue.
2. Reassign a controlled Lead plus selected open Opportunities and verify the displayed owner/team.
3. Reopen Assignment history and Opportunity Ownership history. Confirm the prior and new owners,
   team, actor, time, scope and reason remain visible.
4. Confirm the Director retains routine read-only Opportunity behavior outside the explicit
   governed reassignment command.

## Data integrity and reconciliation

- Customer, Lead, requirement, qualification, campaign/source and Listing masters are not copied.
- Unselected Opportunities retain their existing owner.
- Selected records either all change in one transaction or none change.
- Opportunity versions increment; stale versions are rejected.
- Lead assignment history and Opportunity assignment history are append-only.
- Existing R1.1 broker, contact, Lead, Listing and audit populations reconcile before and after,
  allowing only the controlled new assignment/audit rows.
- Duplicate-open-Opportunity protections remain effective.

## Acceptance

R2.1A is not accepted from automated tests alone. A representative Agent and Manager must each
identify ownership, current step, blocker and next action from their normal work area without
developer assistance. Record screenshots, test identities, exact source commit, database migration,
pre/post counts and any finding before acceptance.
