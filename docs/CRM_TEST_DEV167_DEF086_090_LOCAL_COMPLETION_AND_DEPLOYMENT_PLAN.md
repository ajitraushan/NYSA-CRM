# CRM Test dev.167 — DEF-086 through DEF-090 local completion and deployment plan

## Release boundary

- Target: CRM Test only.
- Candidate: `2.1.0-dev.167`.
- Baseline: deployed CRM Test `2.1.0-dev.166` with migration 106.
- Production, the R2 clone and Property Finder are excluded.
- No database migration is required; migration count remains 106.
- Defect identity and UAT evidence are separate. `DEF-086` through `DEF-090` identify the corrections; UAT-086
  through UAT-090 retain the exact observed result and require human retest after deployment.

## Included defects

| Defect | UAT | Correction |
|---|---|---|
| DEF-086 | UAT-086 | Open ranked Inventory in a dedicated workspace, paginate 10 results at a time and provide an explicit return before or after assignment. |
| DEF-087 | UAT-087 | Place Agent dashboard navigation/actions at the top and use progressive disclosure without removing governed information. |
| DEF-088 | UAT-088 | Preserve the formatted qualification conversion percentage instead of displaying `NaN`. |
| DEF-089 | UAT-089 | Distinguish Overdue, Urgent and Due today work using text and colour, with overdue precedence. |
| DEF-090 | UAT-090 | Remove the duplicate Agent Proposal workload summary while preserving authoritative proposal work. |

## Linked-functionality preservation gate

The release must verify all of the following before packaging:

1. Inventory ranking retains deterministic scoring, immutable matching-run evidence and the exact Opportunity and
   confirmed Requirement Version lineage.
2. `Shortlist and assign to Opportunity` retains its governed Property Match, seven-day Inventory Assignment,
   idempotency, revalidation and no-message/no-Viewing/no-Offer/no-reservation boundary.
3. Returning from ranking before selection leaves the Opportunity unchanged; returning after assignment refreshes
   the Opportunity so the new assignment is visible.
4. Agent task, qualification, operational-exception and recent-activity information remains accessible; the four
   KPI measures remain accessible in the collapsed Performance and SLA details disclosure.
5. Proposal history, generation, correction tasks and Lead entry points remain unchanged. Manager and Managing
   Director proposal workload and approval surfaces remain unchanged.
6. `My Team`, `My tasks`, saved views, call report, filters and export retain their existing role-scoped access.
7. Manager and Managing Director dashboard paths remain unchanged by Agent-only presentation changes.

## Deployment and acceptance boundary

Automated tests and a successful deployment are not a human UAT pass. After CRM Test deployment, UAT-086 through
UAT-090 must be observed against the deployed candidate and recorded individually without inference.
