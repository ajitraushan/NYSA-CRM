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

- NYSA Organization Settings are maintained separately from external companies.
- An authorized user can create, view, edit, and search a person or external company.
- Creating an external company never creates authentication access.
- One external company can hold multiple business roles without duplication.
- One contact can hold multiple customer roles without duplication.
- Phone and email channels preserve raw input and store a validated normalized value.
- Mobile numbers are normalized to E.164 and emails to lowercase for comparison.
- WhatsApp capability applies only to phone channels and does not duplicate the phone.
- Screen, API, import, and database rules reject the same invalid channel combinations.
- Exact phone or email duplicates produce a clear review warning.
- Merge is authorized, reasoned, audited, and preserves relationship history.
- Marketing consent cannot become Granted without the exact executed, approved,
  versioned NYSA Marketing Agreement.
- Withdrawal, expiry, or supersession updates effective consent and suppresses
  prohibited marketing communication.
- Communication preference, documentary consent evidence, and restrictions are visible and enforced.

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

- An authorized administrator can draft, test, approve, and activate a separately
  versioned qualification model; an active version cannot be edited in place.
- The approved, versioned model calculates a score and Hot/Warm/Cold result.
- Every result displays the factor contributions and recommended response urgency.
- Authorized users can override the result only with a reason.
- Recalculation creates history rather than rewriting the prior assessment.
- Sensitive traits and social-media conclusions are not scoring inputs.
- Tests cover threshold boundaries, missing inputs, override, and model-version changes.
- Historical assessments retain the exact model version, factor inputs, score,
  result, override, actor, and time after later model changes.

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
- Developer, organization, customer requirement, property, media, and financial
  values come from their authoritative modules and are not silently retyped.
- The agent selects approved images, captions, floor plans, and permitted sections.
- A typical prepared record can produce a reviewed Quick Proposal within three minutes.
- Sent proposals cannot be silently overwritten; a change creates a new version.
- A sent version reproduces the exact recipient, data, media, assumptions, template,
  branding, disclaimer, creator, hash, lead/opportunity, and delivery details.
- Generated customer PDFs and personal data are excluded from Git and public storage.

## 11A. Lead Documents and Attachments

- Authorized users can upload supported operational documents to private storage and
  link an exact version to a contact, lead, activity, listing, proposal, or channel.
- Type, title, direction, classification, status, file metadata, storage reference,
  hash, version, owner, recipient, and event times are recorded.
- Recording "Offer letter sent" requires a link to the precise sent version.
- A generated or sent document version cannot be overwritten; revision creates a new version.
- File download and metadata access enforce role and record scope and create audit evidence.
- Unsupported, oversized, malicious, or unauthorized files fail without partial records.

## 12. Dashboards and Reports

- The role-appropriate dashboard is the default authenticated landing screen.
- Agent dashboard shows personal assignments, qualification, SLA, next actions,
  overdue work, exceptions, recent activities, proposal follow-up, and workload.
- Agents can complete permitted common actions from the dashboard without losing context.
- The agent Call Report filters and drills into calls, outcome, duration, related
  lead/contact, next action, follow-up completion, status, and qualification at call time.
- Manager dashboard consolidates effective-dated reporting scope across agents and
  shows team queue, workload, SLA, aging, calls, activities, follow-up, conversion,
  proposal, consent, document, data-quality, and integration exceptions.
- Managing Director dashboard provides Executive, Sales, Inventory, and Operations
  and Risk views with company-level current, target, prior-period, trend, and variance context.
- Phase 1 executive leading indicators include lead velocity, source quality,
  qualification/aging, SLA and follow-up exposure, capacity, proposal workload,
  inventory readiness, and exception trends; unavailable later-phase financial
  metrics are explicitly marked unavailable rather than invented.
- Authorized drill-down follows company to business line to team to manager to agent
  to underlying record and maintains the selected filters and time period.
- Management reports cover new leads, movement, activities, lost reasons, conversion,
  qualification, SLA, workload, proposal, data quality, and current inventory readiness.
- Reports filter by date, source, team, agent, business line, and stage as applicable.
- All applicable visual components update consistently when a dashboard filter changes.
- Every dashboard/report shows data-as-of or last-refresh time and calculation context.
- Counts reconcile to underlying records for controlled test datasets.
- Exports respect role scope and create an audit event.

## 12A. Controlled Values and Workflow Maintenance

- Administrators maintain stable value codes, labels, descriptions, display order,
  defaults, definition status, effective dates, and replacement mappings.
- Values already used in records cannot be hard-deleted; retirement preserves history.
- Label-only changes do not alter stable codes or historical reports.
- Workflow/security value changes require impact review, transition/report mapping,
  migration where needed, tests, approval, and controlled release.
- Invalid transitions are rejected consistently by screen, API, import, and database rules.

## 13. Security, Privacy, and Audit

- Every endpoint enforces authentication and role/record scope.
- No secret, password, session token, customer file, or generated proposal enters Git or logs.
- Material role, consent, document, lead, qualification-model/assessment, proposal,
  configuration, export, and restricted-file actions are audited.
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
