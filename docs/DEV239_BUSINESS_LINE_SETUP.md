# DEV239 business-line organisation and KPIs

Approved scope: user-maintained business lines, existing teams and reporting managers, supported KPI selection and targets, dashboard filtering/drill-down. CRM Test only. No routing, qualification, opportunity, booking, deal, compliance, ownership or access-authority changes.

Baseline: DEV238 commit `4b8c023dc8b6fddbed536345fb763c794954b306`, migration 139. Recoverable installed baseline backup recorded in DEV238 receipt: `/home/nysareal/crm-backups/consolidated-crm-test-dev238-20261025T222022Z`. DEV239 deployment takes a fresh paired database/application backup before mutation. Rollback restores that pair together.

## Maintenance

Administration → Business lines & KPIs: create a unique stable code, name, description and reason; Edit / KPIs maintains the display name, status and applicable supported KPIs. History shows audited before/after values, reason, person and date. Retiring a line is blocked while teams or approved/active line targets remain linked. Removing a KPI is blocked while its line targets remain approved/active. No hard-delete action exists for business-line masters.

The same screen lists teams, their existing Team Managers, current business-line mappings and future changes. Maintain / history schedules a mapping from today or a future Dubai date, with a required reason and stale-state check. The history is retained. A second mapping cannot overwrite an existing effective date; choose a later date. Existing Team Managers are maintained in CRM teams; Agent memberships/primary reporting team and Manager→Director reporting remain in User records. Business-line membership grants no authority.

Initial masters: Off-plan Sales, Secondary Sales and Rental. All fourteen existing supported KPIs initially remain available; Admin chooses each line's applicable set. No goals or thresholds are invented. Migration 140 maps only the exact reviewed names Off Plan Team, Secondary team and Rental Team to the approved lines. These initial mappings establish the reporting baseline for their existing records from 1900-01-01. All other teams remain explicitly unassigned. This is an initial approved reporting interpretation, not a claim that historic organisation evidence existed in 1900.

Team mapping is resolved at the record creation date in Dubai time. Future dated changes therefore do not reclassify earlier records. Lead-derived dashboards use the record's assigned team, not the current Agent's primary team. Inventory currently has no assigned-team field, so its reporting team is derived from its posting user's maintained team; inventory ownership is not changed. Changes to that existing user team association are not an immutable inventory organisation history. Reliable historical inventory actuals remain unavailable as in DEV238.

## Targets and dashboards

Dashboard targets now uses stable maintained business-line IDs/names, not transaction labels. A line target requires an enabled KPI. Existing daily/weekly/monthly schedules, future target revisions, lifecycle and audit remain unchanged. Transaction filtering remains separately labelled Transaction type. Business-line hierarchy and drill-down use the maintained mapping and retain the businessLineId filter. Existing all-line Agent four-card layout and Manager/Director layouts remain unchanged. Selecting a business line shows its applicable supported KPI cards; inventory cards remain Director-only. No Agent or Manager gains company inventory drill-down access.

Company, team, Agent and line targets remain separate, without aggregation or implicit substitution. A whole-Agent/team target is not compared to a partial selected-line slice. Company-wide line targets are shown to Director at whole-line scope; Manager partial-team and Agent slices do not inherit the whole-company line goal. Existing record access restrictions remain enforced in every query.

Unassigned records are visible through Business line not assigned. Existing saved views containing businessType retain their transaction filtering; new business-line filters use a separate businessLineId key. Company inventory snapshots are not overwritten by line-scoped reads, and unassignable company integration failure counts are not attributed to a selected line.

## Data and release

Migration 140 adds business_lines, business_line_kpis and effective-dated team_business_line_assignments, their lookup indexes, initial approved configuration and two specific audit entity names while preserving the prior audit allow-list. Database grants are limited to the existing governed application role `nysareal_nysar2app`; no PUBLIC grant is used. Synthetic fixture tests map that role to the restricted local test user as already governed by the fixture runner.

New authenticated endpoints: GET /crm/business-lines; Admin-only GET/POST /admin/business-lines, POST /admin/business-lines/:id, GET /admin/business-lines/:id/history, POST /admin/team-business-lines/:id. Existing dashboard and target endpoints consume the maintained configuration. No external connector contract, workflow endpoint or transaction classification is changed.

Release must use the pushed GitHub SHA through the canonical origin-only package command, then verify-package before CRM Test deployment. Production and R2 are protected by the deployment snapshot checks. Tests cover synthetic database lifecycle, dates, optimistic concurrency, KPI applicability, manager/agent isolation, target comparisons and record drill-down consistency, plus cumulative regression and PDF renderer gates. Live Admin verification is read-only after migration; no operational/customer test records are required on CRM Test.
