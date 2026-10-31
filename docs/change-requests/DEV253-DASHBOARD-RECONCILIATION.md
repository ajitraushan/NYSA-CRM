# DEV253 — dashboard counts and return navigation

Scope approved: reconcile dashboard card/drill-down counts, retain filters and
scroll on Back/Close, regression test and deploy to CRM Test from GitHub.
Production/main/website remain on hold. Baseline is DEV252 commit
`e87b9f879b61acfe5f97f93194f29e17c27647b0`, migration 159.

## Root causes and corrections

- Task KPIs counted Tasks but drill-downs selected distinct Leads. Return one row
  per Task, keeping its linked Lead as the authorized navigation target.
- Capacity pressure counted agent/team rows but opened contributing Leads.
  Return the matching agent/team groups with their open Lead counts, preserving
  the existing threshold and KPI calculation.
- Won and Hot/Warm details used legacy stage/qualification predicates that
  differed from the card. Use the card's current-status predicates.
- Manager exception details could include company integration failures that its
  card excluded. Use the same company-reader condition as the card.
- Some detail queries silently stopped at 500. Preserve the complete scoped
  count and expose pages of 100 rows (bounded to 500), with stable Lead ordering.
- Card clicks read unsubmitted filter edits. Use the applied API filter snapshot.
- Opening a record removed its parent drill-down. Keep that dialog and restore
  its scroll after record Back; name the Back target accurately. Browser Back
  and Close use a dashboard-specific history entry, leaving the parent DOM and
  filter values intact. Sidebar navigation cleans up the retained dialogs.
- Hierarchy links replaced the dashboard without a return path. Preserve the
  parent DOM/dialog and provide Back to hierarchy, including after applying
  filters within the child dashboard.
- Unassigned hierarchy entries passed empty filter values, opening All agents
  or teams. Pass an explicit Unassigned value and apply NULL predicates in both
  current/prior calculations and detail queries; keep existing role scope.

## Verification

The restricted local PostgreSQL fixture passes all 28 standard KPI checks across
Agent, Manager and four Director views, including nonzero historical Won/Hot
cases, three overdue Tasks on one Lead, 505 distinct Leads over multiple pages,
and a denied cross-team Manager filter. Created fixture records are removed.
Explicit Unassigned agent/team filters and their Manager boundaries also pass.

The actual frontend with a read-only synthetic API passes 174 card/viewport
cases at 1280px and 390px: card/detail totals, unsubmitted filter isolation,
Close, browser Back, record Back and scroll restoration. Focused hierarchy
checks additionally exercise applying child filters before returning. Zero
results and pagination bounds have automated coverage. These source checks are
distinct from post-deployment live role acceptance.

No workflow, access-policy, schema, credential or integration configuration
change is included. No migration is needed. Refresh paired Test recovery and
verify the encrypted off-server copy immediately before deployment. Package only
from the advertised GitHub commit, verify provenance and hashes, and verify the
exact-root worker before stop and exactly one worker after readiness. Retain
DEV252 runtime/dependencies and the paired snapshot for rollback.
