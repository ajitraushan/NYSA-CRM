# Release 1 Acceptance Criteria

## Release Definition

Release 1 is Lead Operations and Customer Sales Enablement. It is complete only
when the criteria below pass in an isolated test environment and the controlled
production smoke test passes after deployment.

## 1. Product Identity

- All user-facing NYSA Pocket Ledger text is replaced with NYSA CRM.
- Package description, page title, login, dashboard, server log, and documentation agree.
- The rename does not change production URL, database identity, users, or existing records.

## 2. Users, Roles, and Teams

- An admin can create and deactivate teams.
- An admin can assign a manager and internal members to a team.
- Existing administrator login survives the role migration.
- Each active non-admin user has an explicitly approved role and team mapping.
- API tests prove that users cannot access records outside their permitted scope.
- Revoking a user invalidates their active sessions.

## 3. Contacts and Companies

- An authorized user can create, view, edit, and search a person or company.
- One contact can hold multiple customer roles without duplication.
- Mobile numbers are normalized to E.164 and emails to lowercase.
- Exact phone or email duplicates produce a clear review warning.
- Merge is authorized, reasoned, audited, and preserves relationship history.
- Communication preference, consent status, and restrictions are visible and enforced.

## 4. Lead Capture and Ownership

- Authorized users can create leads from every approved manual source.
- Imported leads use stable external identifiers and do not duplicate on retry.
- A new lead enters a company queue with received timestamp and source.
- Routing assigns a team and responsible agent according to configured rules.
- Assignment acceptance, rejection, timeout, and reassignment are timestamped and audited.
- Managers can reassign only within permitted scope unless an admin intervenes.
- No lead can silently lose company, team, or responsible-agent ownership history.

### NYSA website intake

- An approved website form creates one company-owned lead with source, campaign,
  page/form, consent, received time, and customer requirement fields.
- Invalid authentication, oversized bodies, malformed data, and replayed requests
  are rejected without partial contact or lead records.
- Retrying the same accepted website event does not create another contact or lead.
- Processing failure is visible to authorized support users and can be replayed
  after correction without bypassing validation or audit.
- Secrets and full sensitive payloads are absent from browser code, application
  logs, Git, and user-visible error messages.

## 5. SLA and Work Queues

- Business hours and SLA values are configurable.
- Acceptance and first-contact due times are calculated consistently.
- Agent and manager dashboards show approaching and breached SLA records.
- SLA alerts do not duplicate on retry or page refresh.
- Reassignment preserves the original SLA and assignment history.
- Paused/nurture states follow an explicit approved timer policy.

## 6. Lifecycle and Customer Requirements

- Lead statuses follow the approved lead lifecycle.
- Invalid status transitions are rejected by the API.
- Qualified leads can be converted without retyping contact or requirement data.
- Lost, unqualified, and duplicate outcomes require approved reasons.
- Requirements capture business line, budget, area, property, funding, purpose, and timeline.
- Requirements can be matched or linked to current inventory without changing the listing.
- Stage movement and requirement changes remain visible in history.

## 7. Activities, Tasks, and Follow-Up

- Users can record calls, notes, meetings, emails, WhatsApp records, and outcomes.
- Active leads require a next action unless placed in an approved holding/terminal state.
- Tasks have assignee, due time, priority, status, and completion outcome.
- Dashboard views separate overdue, due today, upcoming, and completed work.
- Managers can review team activity without changing the original author or timestamp.
- Corrections or deletions follow role policy and remain auditable.

## 8. Qualification

- The approved, versioned model calculates a score and Hot/Warm/Cold result.
- Every result displays the factor contributions and recommended response urgency.
- Authorized users can override the result only with a reason.
- Recalculation creates history rather than rewriting the prior assessment.
- Sensitive traits and social-media conclusions are not scoring inputs.
- Tests cover threshold boundaries, missing inputs, override, and model-version changes.

## 9. Financial and ROI Calculator

- Mortgage calculations reproduce independently verified test examples.
- Inputs include price, down payment, loan, rate, term, fees, income, and debt where applicable.
- Outputs include estimated monthly payment, total repayment, interest, LTV, and DBR when possible.
- ROI outputs distinguish gross yield, net yield, annual costs, vacancy, and cash-on-cash return.
- All regulatory and fee assumptions display their version/effective date and are configurable.
- Results display an estimate/non-guarantee disclaimer.
- Calculator scenarios are immutable snapshots linked to the customer and property.

## 10. Property Media

- Authorized listing users can upload supported media within configured limits.
- Files are private by default and cannot be guessed through a public URL.
- File type, size, hash, source, approval status, order, and owner are recorded.
- Invalid or unauthorized files are rejected without partial business records.
- Proposal generation includes only approved media.

## 11. Customer Proposal Builder

- An agent can select a customer and one property without retyping stored data.
- Comparison supports up to three properties.
- Quick, Investment, and Comparison templates apply NYSA branding consistently.
- The agent can edit highlights, suitability narrative, assumptions, and approved disclaimers.
- Generated output shows property, financial assumptions, agent, date, and version.
- Financial results in the PDF exactly match the selected saved scenario.
- A typical prepared record can produce a reviewed Quick Proposal within three minutes.
- Sent proposals cannot be silently overwritten; a change creates a new version.
- Creation, version, hash, creator, lead/opportunity, and sent status are recorded.
- Generated customer PDFs and personal data are excluded from Git and public storage.

## 12. Dashboards and Reports

- Agent dashboard shows assigned leads, SLA, next actions, and overdue tasks.
- Manager dashboard shows team queue, workload, SLA breaches, movement, and conversion.
- Management reports cover new leads, movement, activities, lost reasons, conversion, and booked value.
- Reports filter by date, source, team, agent, business line, and stage as applicable.
- Counts reconcile to underlying records for controlled test datasets.
- Exports respect role scope and create an audit event.

## 13. Security, Privacy, and Audit

- Every endpoint enforces authentication and role/record scope.
- No secret, password, session token, customer file, or generated proposal enters Git or logs.
- Material role, lead, qualification, proposal, export, and restricted-file actions are audited.
- Communication restrictions prevent prohibited outreach in the application workflow.
- Production cookies remain Secure, HttpOnly, and appropriately SameSite.
- Security headers and request-size limits remain present.
- Database queries remain parameterized.

## 14. Migration and Production Readiness

- Existing users, listings, comments, audit entries, and sessions migrate without loss.
- Migration succeeds on an isolated restored production backup.
- Re-running startup does not reapply an existing migration.
- A fresh database can apply all migrations from zero.
- Automated syntax and critical workflow tests pass on the committed source.
- Dependency audit has no unresolved critical or high production vulnerability.
- A new verified PostgreSQL backup exists before production deployment.
- Health, login, existing inventory, lead creation, assignment, activity, calculator,
  proposal generation, and permissions smoke tests pass in production.
- Project documents and release notes match the deployed Git commit.

## Explicitly Out of Scope for Release 1

- External broker access
- Customer portal
- Automated social-media screening
- Full opportunity, viewing, offer, negotiation, and deal workflow beyond conversion scaffolding
- Commission settlement
- Full transaction document management
- Live email, Google Calendar, and WhatsApp integration unless separately approved
- Live Property Finder, Bayut, or Meta integration; Release 1 provides the common
  event/mapping/failure foundation and the NYSA website intake only
