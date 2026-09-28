# CRM Test DEV215 — Assignment Queue Convenience

Target: CRM Test only. Production is unchanged.

Baseline source: DEV214 commit `71c2d04ea04c041f9b49e8bfd2b1c5745d75aec6`.
Baseline deployment rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev214-20260928T165008Z`.

## Change

- Replaced repeated Manager/Director assignment cards with one compact table.
- Added Customer/Lead search plus business type, routed team, campaign and SLA filters.
- Added closest-to-SLA and oldest-waiting ordering.
- Added row selection and **Select all visible**.
- Uses the routing-rule team by default and lists only active Sales Agents who belong to every selected routed team.
- Shows each Sales Agent's current open Lead count.
- Assigns up to 100 selected Leads in one database transaction after one confirmation.
- Keeps an individual **Assign** action for exceptional rows.
- Team change is an explicit exception and requires a reason.
- Audit evidence records the acting Manager/Director, event timestamp, original team, selected team, selected agent, batch size and team-change reason.

## Business rules preserved

- Routing rules continue to select the default team from source, business type and area.
- Managers may assign only into teams they manage; Directors retain company scope.
- The selected agent must be an active Sales Agent in the effective team and eligible for the Lead's area.
- Assignment acceptance and first-contact SLA deadlines are recalculated for the new assignment cycle.
- Any invalid or stale row aborts the whole batch; no partial assignment is committed.

## Database and rollback

No migration is required. Rollback is application-package rollback to DEV214. Assignment events committed by users after deployment remain business records and are not deleted by an application rollback.
