# Release 1 Test Findings

Environment: `https://crm-test.nysarealty.com/`

Started: 2026-07-15

Owner: NYSA Release 1 acceptance

This is the authoritative register for findings raised during manual Release 1
acceptance. A finding is not closed merely because code is changed. Closure requires
deployment to CRM Test, user retest, recorded evidence, and an explicit pass.

## Status workflow

`Open` -> `Implemented locally` -> `Deployed to CRM Test` -> `Retest passed` -> `Closed`

## Active findings

### R1-UAT-001: Controlled-values list alignment and hierarchy

- Date raised: 2026-07-15
- Area: Administration -> Controlled Values
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: High
- Evidence: User screenshots show the set name and stable code joined together,
  vertically centred Class and Add definition controls, and definition labels/statuses/
  Activate buttons without fixed columns.
- Required correction:
  - Show set name and stable code on separate lines.
  - Top-align set, class and action cells.
  - Add a labelled Actions column.
  - Render definitions in fixed Definition, Status and Action columns.
  - Preserve a usable responsive layout with multiple definitions.
- Retest condition: One set containing at least five definitions remains aligned at
  desktop and narrow viewport widths and every action is clearly associated with its
  definition.

### R1-UAT-002: Safe edit, correction, deletion and retirement lifecycle

- Date raised: 2026-07-15
- Area: Administration -> Controlled Values
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: Must
- Related acceptance criteria: 181, 183, 184 and 185
- Finding: The frontend exposes creation and activation but no Edit, Delete unused
  draft, Deprecate, Retire or Replace controls. Value sets have no maintenance actions.
  The backend can patch selected definition fields but does not provide the complete
  safe lifecycle required for administrators.
- Agreed business rule:
  - An unused draft set or definition may be edited and deleted.
  - A draft stable code may be corrected only while unused and before activation.
  - Once activated or used, the stable code is immutable.
  - Used values are never hard-deleted; they are deprecated or retired with impact,
    reason, effective date and optional replacement.
  - Class B and C changes continue to require controlled-release governance.
- Required correction:
  - Add edit actions for set details and draft definitions.
  - Add guarded deletion for unused drafts only.
  - Show usage count and impact before status changes.
  - Add Deprecate, Retire and replacement-value actions.
  - Require confirmation, reason, effective date and audit evidence.
- Retest condition: Draft correction/deletion succeeds only at zero usage; used values
  cannot be renamed/deleted; retirement preserves historical records and audit.

### R1-UAT-003: Stable-code format validation

- Date raised: 2026-07-15
- Area: Administration -> Controlled Values
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: High
- Evidence: CRM Test accepted a mixed-case stable code (`Loss_Reason`) and the earlier
  screen accepted a space-separated code.
- Required correction: Validate new stable codes as lower-case snake_case, show an
  inline example, reject spaces/mixed case, and detect duplicates before creation.
- Retest condition: `loss_reason` is accepted; `Loss_Reason`, `loss reason`, blank and a
  duplicate are rejected with clear messages.

### R1-UAT-004: Controlled-value registry consumer wiring

- Date raised: 2026-07-15
- Area: Administration and operational CRM screens
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: Must for full controlled-value acceptance
- Finding: The governed registry is versioned and audited, but several Release 1
  operational dropdowns and reason fields still use fixed application values or free
  text.
- Required correction: Maintain a consumer-by-consumer map and connect approved Class
  A sets to the applicable lead, activity, assignment, task, company and listing fields.
  Class B state machines remain application-controlled.
- Retest condition: Each declared live consumer reads active definitions, excludes
  retired values from new entry, resolves historical labels, and reports by stable code.

### R1-UAT-005: Operational pending-assignment queues and Dubai routing defaults

- Date raised: 2026-07-15
- Area: Leads -> Routing, queues and assignment
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: Must
- Related acceptance criteria: 47, 48, 49, 50, 51, 69, 70 and 71
- Evidence: Managers can assign only after locating and opening an individual lead;
  there is no dedicated pending-assignment queue for their managed teams. Directors
  have company-wide read access but the current policy makes them read-only and blocks
  assignment. Routing matches only source and broad business type, so it cannot express
  the agreed Dubai Rental, Dubai Off-plan and Dubai Secondary Sales destinations.
- Required correction:
  - Add a visible Pending Assignment queue for each manager containing unassigned,
    queued, rejected, timed-out and reassignment-due leads in managed teams.
  - Allow the manager to assign a queued lead to an eligible active member of the
    applicable managed team, with assignment history and audit evidence.
  - When an assignment offer is not accepted within its SLA, or an accepted lead has
    no qualifying first-contact activity within its first-contact SLA, release the
    lead from the agent and return it to the Pending Assignment queue of its routed
    team.
  - Allow any eligible active agent in that same team to self-claim a returned lead.
    Concurrent claims use first-successful-claim handling so only one agent receives
    the lead.
  - Start a new assignment-response cycle after each reassignment without erasing the
    original SLA deadlines, breaches, prior assignees or elapsed queue time. If the new
    assignee again leaves the lead unattended through the applicable SLA, return it to
    the same team queue again and record another breach/reassignment cycle.
  - Add a company-wide Unassigned/Pending Assignment queue for Directors.
  - Permit a Director to assign a lead to any eligible active internal agent and team,
    as a specific intervention exception to the Director's routine read-only access.
  - Route Dubai Rental leads to the Dubai Rental team, Dubai Off-plan leads to the
    Dubai Off-plan team, and Dubai Secondary Sale leads to the Dubai Secondary Sales
    team.
  - Treat the Any source / Any business fallback as the company unassigned queue; it
    must not silently select a team or individual agent.
  - Show routing reason, received time, current team, assignment state, SLA deadline
    and time waiting in the queue.
- Retest condition: On CRM Test, create controlled Dubai Rental, Dubai Off-plan, Dubai
  Secondary Sale and unmatched leads. Each matching lead appears in the correct team
  manager's Pending Assignment queue and can be assigned only to an eligible member of
  that team. The unmatched lead remains in the company Unassigned queue. A Director can
  see all four leads and assign any of them to an eligible active agent, while managers
  cannot see or assign leads outside their managed teams. Let an assignment-acceptance
  SLA expire and separately let an accepted lead pass its first-contact SLA without a
  qualifying activity; each lead returns to its routed team queue and becomes
  self-claimable only by an eligible agent in that team. Two simultaneous claim
  attempts result in exactly one owner. Repeat a missed SLA after reassignment and
  confirm the lead returns again while assignment history, original deadlines, every
  breach and every routing/assignment event remain preserved and audited.

### R1-UAT-006: Website intake events incorrectly occupy maintenance workspace

- Date raised: 2026-07-15
- Area: Administration -> Website Intake Operations
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: Medium
- Related acceptance criterion: 60
- Evidence: Website Intake Operations is an informational event table comparable to
  the audit log. It exposes no configuration or maintenance controls, but occupies a
  separate section in the already dense Administration maintenance workspace.
- Required correction:
  - Remove the standalone Website Intake Operations section from the maintenance
    workspace.
  - Present website intake events within the consolidated Audit/Operations log using
    an event-category filter rather than a separate maintenance screen.
  - Preserve role-restricted visibility of event ID, status, received/processed time,
    attempt count, safe error code and linked lead/contact where available.
  - Expose correction/replay only as a contextual support action for a failed intake
    event; do not present informational events as maintainable configuration.
  - Continue to exclude signing secrets and full sensitive customer payloads from the
    browser and operational log.
- Retest condition: On CRM Test, Administration maintenance no longer contains a
  standalone Website Intake Operations section. An authorized support user can filter
  the consolidated Audit/Operations log to website intake events, inspect safe event
  metadata and access a failed-event support action, while an unauthorized user cannot.
  Accepted and failed intake processing continues to work without exposing secrets or
  full customer payloads.

### R1-UAT-007: Lead qualification version maintenance is not business-friendly

- Date raised: 2026-07-15
- Area: Administration -> Qualification model versions
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: High
- Related acceptance criteria: 95, 97, 98, 101, 102 and 103
- Evidence: The current section is named Qualification model versions and requires an
  administrator to edit Factors JSON and Guidance JSON directly. Factor logic,
  weightage, thresholds and response guidance cannot be safely understood or
  maintained through normal business controls.
- Required correction:
  - Rename the section to Lead Qualification Versions.
  - Provide a dedicated, structured version-maintenance screen rather than JSON text
    areas.
  - Separate the version list from the draft editor and clearly show Draft, Approved,
    Active and Retired status, version number, effective dates and superseded version.
  - Maintain each factor in a row with business label, description, stable code,
    input/source, minimum, maximum, weight percentage, required flag and missing-input
    treatment.
  - Support Add factor, Edit, Reorder and Delete unused draft factor actions. Active,
    approved or historically used versions remain immutable; change starts a new draft
    version.
  - Display a live total weight indicator and prevent approval unless all weights are
    positive and total 100 percent. Preserve the current transparent weighted-score
    calculation and prohibited-sensitive-factor validation.
  - Maintain Cold, Warm and Hot score bands and their response urgency/guidance through
    labelled fields with boundary validation and no overlap or gap.
  - Provide a Test model workspace where an administrator enters sample factor values
    and sees the calculated score, qualification, factor-by-factor contribution and
    response guidance before approval.
  - Require approval reason, show a version comparison, and preserve every historical
    assessment against its exact model version.
- Retest condition: On CRM Test, an administrator creates a draft Lead Qualification
  Version without editing JSON, adds/reorders/edits draft factors, maintains weights
  totalling 100 percent, configures non-overlapping Cold/Warm/Hot bands and response
  guidance, and tests sample inputs with understandable factor contributions. Invalid
  totals, ranges, duplicate codes, sensitive factors and incomplete bands are rejected
  clearly. After approval and activation, the version is immutable; a change creates a
  new draft and historical lead assessments retain the prior version and result.

### R1-UAT-008: NYSA proposal templates lack maintainable inputs and system-field mappings

- Date raised: 2026-07-15
- Area: Administration -> NYSA proposal templates; Lead -> Customer proposal builder
- Status: Revision 12 implemented locally and verified by automated tests; CRM Test
  deployment, authenticated retest and explicit user confirmation pending
- Priority: Must for Quick Proposal acceptance
- Related acceptance criteria: 126, 128, 129, 130, 132, 134 and 135
- Evidence: Administration maintains only template type, name, brand version, lines of
  approved disclaimers and lines of permitted section names. Proposal content and
  authoritative data mappings are hard-coded in the server. An administrator cannot
  define a section's system source, agent input, approved text, required state, order,
  default or preview. The agent workflow therefore does not explain what is populated
  from the lead and what the agent must enter.
- Required correction:
  - Provide a dedicated NYSA Proposal Template Designer with a version list and a
    separate draft editor for Quick, Investment and Comparison templates.
  - Build templates from ordered sections and content blocks. Each block must use one
    clear source type: approved system field, agent input, approved fixed text,
    calculated/saved scenario, approved media, or repeating selected-property block.
  - For system mappings, present a curated business-field catalogue rather than raw
    database paths. It must include approved organization, customer, lead requirement,
    selected property, approved media, saved financial scenario, agent and
    proposal/date/version fields.
  - For agent inputs, maintain the prompt label, help text, control type, required or
    optional status, maximum length, approved default and whether the agent may edit it.
  - Allow the administrator to mark every template section and content field as
    Mandatory or Optional. Mandatory rules are versioned with the template and apply
    consistently to preview, validation and generation.
  - If mandatory authoritative system data is missing, identify the source record and
    direct the user to correct it there rather than silently retyping it in the
    proposal. If a mandatory agent-input field is missing, block generation with a
    clear field-level message. Optional empty fields or sections are omitted cleanly
    without blank headings or placeholder text.
  - Maintain section order, required/default inclusion, permitted content, approved
    disclaimers, call-to-action text, branding version and missing-data behavior through
    normal controls rather than line-based placeholders or JSON.
  - Show a sample-data preview and validation report before approval, including missing
    mappings, unavailable fields, required inputs and unsupported placeholders.
  - Support draft edit, clone to new version, compare, approve, activate and retire.
    Active templates and generated/sent proposal snapshots remain immutable.
  - From a lead, the Quick Proposal wizard must prefill all configured authoritative
    fields, ask only for the configured agent inputs or genuinely missing required data,
    allow property/media/scenario selection, show a preview, and identify mapped versus
    agent-entered content before immutable generation.
  - Present customer name and postal address prominently. Maintain postal address on
    the customer contact and expose it as a curated authoritative proposal mapping;
    missing mandatory address data must direct the user back to that contact.
  - Keep customer-facing output concise: do not show internal brand-version metadata;
    use requirement chips, structured property facts, approved-media positions, a
    conditional sequential icon timeline and three compact next actions instead of
    long administrative paragraphs.
  - Keep KYC workflow status and expiry internal. Customer output may show only a
    simple unhighlighted Passport or Emirates ID reference using the masked final four
    characters.
  - When the configured shortlist maximum is three, demonstrate three matches in the
    draft sample. Render each selected match independently and show its unique stable
    Inventory ID prominently in both preview and generated output.
- Retest condition: On CRM Test, an administrator creates a Quick template without
  editing JSON or raw database paths, maps lead requirement and selected-property
  fields from the approved catalogue, marks system and agent-input fields Mandatory or
  Optional, adds required Highlights and Suitability prompts,
  adds approved Call to Action and Disclaimer content, previews sample output and
  activates the version. From a prepared lead, an agent starts Quick Proposal, sees the
  correct customer and requirement data prefilled, supplies only configured inputs,
  selects up to three matched properties and no more than two approved media items per
  property, sees each selected property's stable Inventory ID, previews and generates
  a reviewed version
  within three minutes. Missing mandatory agent input blocks generation; missing
  mandatory system data identifies the authoritative record to correct; optional blank
  content is omitted cleanly. Missing required mappings are clear, and the generated
  snapshot preserves exact sources, template version, agent input, branding and output.

### R1-UAT-009: Dashboard target maintenance uses technical and misleading labels

- Date raised: 2026-07-15
- Area: Administration -> Dashboard targets, benchmarks and exception thresholds
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: High
- Related acceptance criteria: 163 and 175
- Evidence: The form exposes Scope ID and Unit as free-text inputs even though scope
  entities and KPI units are system-defined. Target is ambiguous, Approved definition
  appears to request another business value although it stores calculation text, and
  Benchmark source does not clearly identify the accountable approver.
- Required correction:
  - Rename the section to Dashboard Performance Targets and Alerts.
  - Rename Metric to KPI.
  - Rename Scope to Applies to, with Company, Business line, Team and Agent choices.
  - Remove the Scope ID text input. After Applies to is selected, show a business-aware
    Business line, Team or Agent dropdown populated from active CRM records. For Company,
    show NYSA Company with no further input.
  - Keep the target record ID system-generated and hidden; do not relabel Scope ID as
    Target ID because they represent different concepts.
  - Rename Period start/end to Target period: From and To.
  - Rename Target to Target number and place the KPI's automatic read-only unit directly
    beside it. Remove Unit as a user-maintained field because the selected KPI already
    defines leads, properties, agents, proposals, touchpoints or exceptions.
  - Remove Approved definition as an editable field. Show the selected KPI's approved
    calculation definition as read-only explanatory text.
  - Replace Exception threshold and Threshold rule with one business sentence:
    Flag as an exception when the actual result [goes above/falls below] [number]
    [automatic unit].
  - Rename Benchmark source to Approved by and make it an authorized-person selector.
    Add Approval basis/reference for the applicable operating plan, policy or approval
    record rather than losing the source evidence.
  - Show a plain-language preview of the completed rule before saving, including target,
    alert boundary, scope, period, approver and calculation definition.
- Retest condition: On CRM Test, an administrator selects a KPI and sees its unit and
  approved calculation definition automatically. Applies to provides the correct active
  business-line/team/agent selector without internal IDs. The administrator enters a
  Target number, configures the exception sentence, selects an authorized Approved by
  person and records the approval basis. The preview is understandable to a business
  user, the saved target applies to the chosen dashboard scope and period, and no unit,
  raw scope ID or editable calculation-definition field is exposed.

### R1-UAT-010: Invitations and Brokers split one user-management lifecycle

- Date raised: 2026-07-15
- Area: Administration -> Invitations and Brokers
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: High
- Related acceptance criteria: 18, 20, 21 and 22
- Evidence: The onboarding-code form is labelled Invitations while the adjacent active
  account maintenance table is labelled Brokers. Administrators must infer that these
  separate sections represent creation/onboarding and maintenance of NYSA users. The
  invite permits an optional email and does not capture the approved team mapping,
  while the Brokers label does not represent administrators, managers, directors,
  accountants and other internal roles. Administrators cannot create an internal user
  record without requiring the invitation-registration flow; there is no distinct
  temporary suspension lifecycle or business-friendly Add/Edit User workflow, and the
  required Admin Assistant role is absent.
- Required correction:
  - Consolidate Invitations and Brokers into a User Management workspace.
  - Use Invite User for the secure account-onboarding action; do not imply that an
    administrator creates or knows the user's password.
  - Also provide Add User for administrators to create an internal user record directly
    with name, email, user role, team and status. The account begins Pending activation
    and uses a one-time activation process for the user to set a permanent password;
    the administrator must never see or set the permanent password.
  - Present clear Pending Invitations, Active Users and Revoked Users views rather than
    unrelated maintenance sections.
  - Rename Brokers to Users and use business labels: Email, User role, Team, Status,
    Invited, Joined and Actions.
  - Require a named email for an individual invitation, select the approved internal
    User role, and select the applicable active Team before issue when the role requires
    team scope. Do not expose generic multi-use invitation controls in the normal user
    creation flow.
  - Limit normal Release 1 role choices to the approved internal roles and make any
    exceptional access type an explicitly governed advanced action.
  - Use clear classifications: Internal User for NYSA employees, External Broker for an
    external identity, and Viewer for read-only access. External Broker is reserved for
    interface identification only in Release 1 and does not enable an external login,
    session, CRM workspace or record access.
  - Add Admin Assistant as an internal user role. Its approved scope is routine user
    maintenance below Administrator/Director privilege, teams and membership,
    operational settings, and listing creation/edit/status/media management. It cannot
    appoint or alter an Administrator/Director, change security policy, erase audit,
    approve its own access, or perform governed approvals reserved to an Administrator
    or Director.
  - Replace the single job-role field with effective-dated user-role assignments. A user
    may hold more than one compatible internal business role, each with its approved
    scope, start/end dates, status, approver and change reason.
  - Require exactly one active Primary role to select the default dashboard. Provide a
    clear workspace switch when another active role has a distinct workspace.
  - Combine explicitly granted capabilities across compatible active roles only within
    each role's approved record/team scope. Security restrictions and explicit denials
    take precedence; Administrator, Viewer and external-user classifications must not be
    silently combined with incompatible internal roles.
  - Enforce Viewer as read-only in the API and UI: no add, edit, delete, amend, assign,
    approve or other state-changing actions within the viewer's permitted record scope.
  - Allow authorized administrators to maintain role/team mapping, revoke/restore
    access and see pending/expired/revoked invitation status with audit evidence.
  - Provide Add, View and Edit User actions. Role, team and access changes require
    confirmation and audit evidence.
  - Provide Suspend User as a temporary reversible state. Suspension immediately
    invalidates sessions, blocks login and preserves ownership/history until an
    authorized administrator reactivates the user.
  - Keep Revoke Access separate from suspension. Revocation immediately invalidates
    sessions, blocks login, requires a reason and preserves the user, assignments and
    audit history; users are not hard-deleted.
  - Preserve immediate session invalidation when access is revoked.
- Retest condition: On CRM Test, an administrator opens User Management, directly adds
  one internal user and separately invites another with an approved role and required
  team. The directly added user exists before activation and securely sets their own
  password; the invited user moves from Pending Invitations to Active Users without a
  duplicate. Edit role/team changes are audited. Suspension immediately ends the
  session, blocks login and can be reversed; revocation separately ends the session,
  requires a reason and preserves history. A Viewer cannot perform any state-changing
  UI or API action. Admin Assistant can maintain routine users, teams, operational
  settings and listings but cannot perform the excluded privileged actions. Assign two
  compatible scoped roles to one user, confirm the primary-role dashboard and alternate
  workspace, then expire one role and verify its permissions end without changing
  history. External Broker remains an interface classification only and cannot
  authenticate or access CRM records in Release 1.

### R1-UAT-011: Organization settings do not provide governed business maintenance or complete proposal defaults

- Date raised: 2026-07-15
- Area: Administration -> NYSA Organization Settings; Proposal generation
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: High
- Related acceptance criteria: 26, 128, 130 and 132
- Evidence: The prior screen directly saved an active version, omitted timezone,
  locale, brand version, proposal footer and logo maintenance, and offered no draft
  editing, approval, retirement or version comparison. Proposal generation used only
  the display name and default disclaimer, formatted the date as raw UTC, and did not
  consistently consume the maintained legal/contact/regional/brand defaults. During
  CRM Test retest on 2026-07-16, the profile draft was successfully created, but the
  selected logo exceeded 2 MB and its separate upload was rejected with a generic size
  error; the browser incorrectly reported that the draft was not saved. Subsequent
  retries created six separate drafts because profile creation completed before logo
  validation failed. The Compare action also lacked an inline explanation of its
  pre-approval purpose.
- Required correction:
  - Rename the screen NYSA company profile and document defaults and explain its
    operational use separately from external company records.
  - Maintain legal identity, customer-facing name, licence, authority, address,
    company contact details, website, default currency, timezone, locale, approved
    brand version, private validated logo, proposal footer and default disclaimer.
  - Enforce Draft -> Approved -> Active -> Retired governance. Drafts alone are
    editable; approval requires a reason and approver; activating an approved
    replacement retires the previous active version without changing history.
  - Show version history and business-readable comparison before activation.
  - Apply the active profile to proposal company/contact lines, currency fallback,
    localized preparation date, brand reference, footer and disclaimer. Snapshot the
    exact organization version and logo hash without disclosing its private storage key.
- Retest condition: On CRM Test, an administrator can create and edit a complete draft
  without selecting a logo and receives a correct persistent success message and row;
  a genuinely invalid selected logo is rejected without misrepresenting the saved
  profile state or creating another draft; failed-logo retry remains linked to the
  same draft. The administrator deletes only the unused duplicate drafts with a reason,
  while approved, active and historical versions remain protected. Compare changes
  clearly explains and displays differences from the immediately preceding version.
  The administrator then
  attaches a valid logo, compares it with the prior version, records an approval reason
  and activates it. The prior active version becomes Retired. A newly generated proposal
  displays the active legal/contact/brand/default fields, localized date, footer and
  disclaimer, and its immutable snapshot identifies the exact organization version and
  logo hash. An unapproved draft never changes generated output. The user explicitly
  confirms the result before this finding is closed.

### R1-UAT-012: Business Hours and SLA Policy fields require technical interpretation

- Date raised: 2026-07-16
- Area: Administration -> Business Hours and SLA Policies
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: High
- Related acceptance criteria: 67 and 68
- Evidence: Working-day start and end are entered as minute-from-midnight numbers,
  while acceptance and first-contact targets use abbreviated technical labels. The
  screen does not explain the business meaning or provide examples, so an administrator
  cannot configure the policy confidently without technical guidance.
- Required correction:
  - Replace minute-from-midnight inputs with time selectors labelled Business day
    starts at and Business day ends at.
  - Rename the SLA inputs Lead acceptance target (business minutes) and First
    customer-contact target (business minutes).
  - Add concise explanations and examples beside the fields, including that elapsed
    time outside approved business hours does not consume business minutes.
  - Preserve versioning and correct conversion to the stored calculation values.
- Retest condition: On CRM Test, an administrator configures working days, business-day
  start/end times and both SLA targets correctly without technical guidance. The saved
  version displays the same business values and controlled deadline examples calculate
  correctly. The user explicitly confirms the result before closure.

### R1-UAT-013: Regulatory and fee assumptions lack complete maintainable calculation and editing rules

- Date raised: 2026-07-16
- Area: Administration -> Regulatory and Fee Assumption Versions
- Status: Revision 6 deployed to CRM Test; closed-form editing workflow and alignment
  user-confirmed on 2026-07-16; calculation and proposal-output retest pending
- Priority: Must
- Related acceptance criteria: 112, 130, 131, 132 and 137
- Evidence: The original screen accepted free-form assumptions JSON. The first
  correction exposed percentage, fixed and progressive tier rows, but CRM Test review
  on 2026-07-16 showed that it still could not accurately represent DLD/trustee,
  property-type, VAT, mortgage-value, quantity, estimate-range or percentage-plus-fixed
  charges. Applicability remained explanatory text rather than an executable rule.
  After the Revision 4 deployment attempt, authenticated CRM Test inspection still
  displayed the older form: a saved fee appeared in editable controls without an
  explicit Edit draft/Save draft changes action. The user also confirmed that a
  mortgage fee must depend on bank financing rather than merely having a mortgage-value
  calculation base.
  Revision 5 then exposed the correct row actions, but the new-draft form remained open
  above the saved table. The user could therefore change controls without first selecting
  Edit draft and without seeing Save draft changes, making the unsaved new-draft fields
  appear to be the persisted record.
- Required correction:
  - Replace JSON maintenance with structured rows for each regulatory or fee item.
  - Maintain business label, stable code, calculation basis, percentage, fixed,
    conditional fixed, percentage-plus-fixed, quantity and estimate-range formulas;
    optional caps; VAT; payer; inclusion in totals; currency; executable transaction,
    property-type and service-channel applicability; effective dates; authority/source;
    and required disclaimer.
  - Provide draft editing, validation, test calculations, approval, activation,
    retirement and version comparison while preserving historical scenario snapshots.
  - Keep saved rows read-only. Require an explicit Edit draft action to expose Save
    draft changes, and an explicit Create new version action for approved, active or
    retired versions.
  - Keep the maintenance form closed by default. Open it only through Start new rule
    set, Edit draft or Create new version; Cancel and successful save must close it.
  - Separate the rule-set name, authority/reference, rule description and placeholder
    onto aligned lines; give the explanatory note and action buttons adequate spacing.
  - Maintain executable funding-method applicability: all funding, cash, bank finance,
    mixed finance, developer payment plan or other. A bank-finance-only fee must not
    calculate for a cash-funded purchase even if a mortgage amount happens to be present.
  - Publish approved calculated results through a curated proposal-placeholder
    catalogue; reject unknown or unavailable placeholders rather than rendering them
    blank or permitting retyped values.
- Retest condition: On CRM Test, an administrator configures the approved Dubai charge
  set without JSON. Tests below/at each price threshold select the correct fixed band;
  purchase-price and mortgage-value bases remain separate; property/service conditions,
  VAT, quantities, composite additions, estimates and caps calculate correctly; excluded
  estimates do not enter exact totals; saved financial scenarios snapshot rule details,
  a cash-funded scenario excludes bank-finance-only fees while a bank-financed scenario
  includes them; draft changes save only after Edit draft and active-version changes
  create a separate new draft;
  exact and range totals and the active version; proposals resolve every approved
  placeholder; unknown placeholders are rejected; and the user explicitly confirms the
  result before closure.

### R1-UAT-014: Administration maintenance is presented as one cumbersome long page

- Date raised: 2026-07-17
- Area: Administration workspace layout
- Status: Correction implemented locally; CRM Test deployment, retest and explicit
  user confirmation pending
- Priority: Must
- Related acceptance criteria: 18, 67, 95, 112, 128, 163 and 181
- Evidence: The user observed that every maintenance form and saved-version table is
  rendered sequentially on one Administration page. Finding and operating one setting
  requires excessive scrolling, and informational/user-record areas visually compete
  with the maintenance currently being performed.
- Required correction: Replace the long page with an Administration workspace that
  has a persistent left maintenance menu and displays only the selected maintenance
  area on the right. Keep User Management and User records under one menu selection;
  keep Website Intake within Operations and Audit; preserve all existing permissions,
  saved state, lifecycle actions and responsive access on smaller screens.
- Retest condition: On CRM Test, an administrator can move between every maintenance
  area through the left menu; only the selected area appears on the right; User
  Management includes its user records; no form, table or action is lost; and the user
  explicitly confirms the layout before closure.

### R1-UAT-015: Property recommendation assistance lacks governed reusable AI services

- Date raised: 2026-07-17
- Area: Leads, structured requirements, inventory matching and proposal preparation
- Status: Revision 1 backend is deployed and configured on CRM Test; Revision 2
  review-first browser controls are implemented locally. CRM Test deployment, live
  functional retest and explicit user confirmation remain pending
- Priority: High value-add
- Related acceptance criteria: 80, 81, 126, 129, 135, 191, 192 and 193
- Evidence: Requirement notes, deterministic inventory linking and proposal narratives
  currently require separate manual interpretation. The user requested reusable AI REST
  capability for three bounded functions: converting conversation notes into a draft
  requirement structure, drafting match/trade-off wording from deterministic evidence,
  and identifying missing customer or inventory information.
- Required correction: Provide authenticated, record-scoped REST endpoints for the
  three agreed functions. Keep all results advisory and require human confirmation;
  never let AI rank inventory, change deterministic eligibility, update a lead or
  listing, or generate unsupported facts. Use strict output schemas, a server-side API
  key, minimized/redacted input, configurable model/version, safe timeouts and failure
  handling, and audit metadata that excludes raw prompts, outputs and credentials.
- Retest condition: On CRM Test, configure the provider credential only in cPanel and
  confirm the status route reports configured without exposing it. Run all three
  functions against an in-scope lead and verify schema-valid advisory output, preserved
  deterministic failures, correct missing-record guidance and no automatic data change;
  verify a cross-scope user is denied, audit records contain only safe metadata, and a
  simulated provider refusal/timeout fails safely. Closure requires the user's explicit
  confirmation.

### R1-UAT-016: Lead qualification is manually selected instead of questionnaire-driven

- Date raised: 2026-07-17
- Area: Lead maintenance and operational qualification assessment
- Status: Correction implemented locally; CRM Test deployment, retest and explicit user
  confirmation pending
- Priority: Must
- Related acceptance criteria: 95, 97, 98, 99, 100, 101 and 102
- Evidence: New-lead capture and lead detail expose Hot/Warm/Cold as directly editable
  dropdowns, while the separate assessment screen expects technical JSON factor input.
  This allows the displayed qualification to bypass the active approved model.
- Required correction: New leads begin Unassessed. Render business questions and answer
  controls from the active Lead Qualification Version, calculate score and Hot/Warm/Cold
  from approved weights and bands, display factor contributions/guidance, and allow only
  an authorized reasoned override. Reassessment creates immutable history.
- Retest condition: On CRM Test, create an Unassessed lead, answer the active model's
  business questions, verify score, contributions, band and response guidance; reject
  missing mandatory answers; permit only a reasoned authorized override; retain prior
  assessments after reassessment; and obtain explicit user confirmation.

### R1-UAT-017: Lead budget fields do not accept common business amount shorthand

- Date raised: 2026-07-17
- Area: New lead and structured-requirement budget capture
- Status: Correction implemented locally; CRM Test deployment, retest and explicit user
  confirmation pending
- Priority: Should
- Related acceptance criterion: 80
- Evidence: Numeric inputs require users to type every zero and reject a normal business
  entry such as `2 M` for AED 2,000,000.
- Required correction: Accept case-insensitive K/M/B shorthand, optional spaces, AED and
  comma-formatted/full amounts; show the interpreted AED amount before save; normalize
  to the exact numeric value on the server; and retain negative, invalid and reversed-
  range validation for browser and direct API submissions.
- Retest condition: On CRM Test, enter `2 M`, `2.5m`, `750K`, `AED 1.5 M`, `2,000,000`
  and a full number in new-lead and structured-requirement budgets; verify the preview,
  stored numeric value and proposal mapping; reject invalid, negative and reversed
  ranges; and obtain explicit user confirmation.

## Agreed amendments

### R1-AMD-001: Controlled-values alignment and layout

- Amendment ID: R1-AMD-001
- Related UAT finding: R1-UAT-001
- Agreed requirement: Separate the value-set name and stable code, top-align set/class/
  actions, provide labelled fixed columns for definitions, statuses and actions, and
  preserve a usable responsive layout for multiple definitions.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-001 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-002: Safe editing/deletion of unused drafts and retirement of used values

- Amendment ID: R1-AMD-002
- Related UAT finding: R1-UAT-002
- Agreed requirement: Allow correction and deletion only for unused drafts; make used
  stable codes immutable; and replace hard deletion of used values with reasoned,
  effective-dated deprecation/retirement, impact visibility, optional replacement and
  complete audit evidence.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-002 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-003: Lowercase snake_case stable-code validation

- Amendment ID: R1-AMD-003
- Related UAT finding: R1-UAT-003
- Agreed requirement: Accept only unique lowercase snake_case stable codes, explain the
  required format inline and reject blanks, spaces, mixed case and duplicates with
  clear messages.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-003 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-004: Connect controlled values to operational consumers

- Amendment ID: R1-AMD-004
- Related UAT finding: R1-UAT-004
- Agreed requirement: Maintain a consumer map and make approved Class A definitions
  authoritative for applicable lead, activity, assignment, task, company and listing
  fields, while preserving historical labels by stable code and keeping Class B state
  machines application-controlled.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-004 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-005: Make Business Hours and SLA Policy fields intuitive

- Amendment ID: R1-AMD-005
- Related UAT finding: R1-UAT-012
- Agreed requirement: Replace minute-from-midnight inputs with Business day starts at
  and Business day ends at time selectors; rename the targets Lead acceptance target
  (business minutes) and First customer-contact target (business minutes); and provide
  explanations and examples beside each field.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-012 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-006 Revision 12: Concise identity reference and three-match inventory presentation

- Amendment ID: R1-AMD-006 Revision 12
- Related UAT findings: R1-UAT-008 and R1-UAT-013
- Agreed requirement: Replace regulatory/fee JSON with individually maintainable
  percentage, fixed, conditional fixed, percentage-plus-fixed, quantity and estimate
  range rules with the correct purchase-price, mortgage-value, property-value or
  quantity basis; support VAT, caps, payer, exact/range total treatment and executable
  transaction, funding-method, property and service-channel applicability; keep the
  maintenance form closed and saved versions read-only until an explicit start-new,
  draft-edit or create-new-version action; align the rule-set summary, authority,
  placeholders, lifecycle note and actions; and expose calculated results
  and audit details through an approved placeholder catalogue. Extend that catalogue
  into a buyer-oriented template designer with governed draft editing, new versions,
  comparison and preview; a configurable one-to-three-property shortlist; a maximum of
  two approved media items per property; mandatory/optional and ready/off-plan or
  cash/bank-finance conditions; buyer requirements; price, built-up area, location,
  developer, status, age/completion, rooms, bedrooms, bathrooms, parking, amenities,
  availability, match rationale, trade-offs and value proposition; and conditional,
  non-guaranteed end-to-end purchase timeline guidance. Enforce shortlist, approved
  media and availability rules during proposal generation. The sample preview must use
  the active NYSA company profile's approved logo, customer-facing name and proposal
  footer, and must clearly identify when no active governed profile exists. Internal
  brand-version metadata must not appear in customer-facing output.
  Within the same draft workflow, allow an administrator to generate a visibly
  watermarked branded draft layout with sample data and print or save it as a draft PDF
  for review before approval; approval and activation remain separate later actions.
  Show customer name and postal address, hide internal brand version, use compact
  requirement chips and property facts, show approved-media positions, filter out
  irrelevant ready/off-plan and cash/bank timeline stages, represent the applicable
  journey sequentially with icons, reduce Next Steps to three actions and keep the
  draft watermark fully within the page. Add customer postal address as an authoritative
  contact field through additive migration `013_customer_proposal_address.sql`. Add the
  maintained mobile number and a simple, unhighlighted identity reference containing
  only the identity type and masked final four characters. Do not print KYC workflow
  status, expiry, a full identity number or document image in the customer proposal;
  identity copies remain Restricted private documents. Use additive migration
  `014_customer_kyc_summary.sql`, require manager/admin authority to mark internal KYC
  verified and audit every internal KYC summary change. Keep the draft badge out of the
  logo/header row so it cannot overlap the header or close control. Demonstrate all
  configured matches in the sample (three when the template maximum is three), render
  each match as a separate numbered property card and show a stable, customer-usable
  Inventory ID on every selected property. Add migration
  `015_inventory_business_reference.sql` to backfill and automatically allocate unique
  sequential Inventory IDs to existing and new inventory.
- Status: Revision 11 is deployed to CRM Test and the user screenshot confirms the
  revised proposal is reachable, but the user identified remaining layout and content
  defects. Revision 12 is implemented locally and all 70 automated tests pass; CRM Test
  deployment/retest remain pending. Revision 6 fee-screen confirmation remains recorded
  separately.
- Retest condition: On CRM Test, the draft badge and close control do not overlap; the
  proposal shows customer name, address and mobile plus only a simple masked identity
  reference; a template configured for three matches previews and generates three
  separately numbered property cards; every card and generated PDF shows its unique
  Inventory ID; and the R1-UAT-008 and R1-UAT-013 retest conditions pass. Closure still
  requires the user's explicit confirmation.

### R1-AMD-007 Revision 1: Operational pending-assignment queues, SLA recycling and Dubai routing defaults

- Amendment ID: R1-AMD-007 Revision 1
- Related UAT finding: R1-UAT-005
- Agreed requirement: Provide scoped manager and company-wide Director assignment
  queues; allow audited assignment within the stated role scope; apply the three Dubai
  team defaults; leave unmatched leads in the company unassigned queue; return
  unattended leads to their routed team queue after assignment-acceptance or
  first-contact SLA breach; and allow eligible agents in that team to self-claim on a
  first-successful-claim basis, with repeat recycling and complete SLA/assignment
  history.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-005 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-008: Consolidate website intake information into Audit/Operations

- Amendment ID: R1-AMD-008
- Related UAT finding: R1-UAT-006
- Agreed requirement: Website intake events are operational/audit information, not
  maintainable configuration. Remove their standalone Administration maintenance
  section and make them available through a filtered consolidated Audit/Operations
  log, with failed-event support actions only in context.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-006 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-009: Business-friendly Lead Qualification Version maintenance

- Amendment ID: R1-AMD-009
- Related UAT finding: R1-UAT-007
- Agreed requirement: Rename Qualification model versions to Lead Qualification
  Versions and replace JSON maintenance with a structured business screen for factor
  logic, weightage, score bands, response guidance, testing, approval and governed
  version history.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-007 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-010: Business-aware dashboard target and alert maintenance

- Amendment ID: R1-AMD-010
- Related UAT finding: R1-UAT-009
- Agreed requirement: Replace technical dashboard-target fields with KPI, Applies to,
  contextual scope selectors, Target period, Target number with automatic unit, a
  plain-language exception rule, Approved by and Approval basis/reference. Keep record
  IDs hidden and show the KPI calculation definition as read-only system context.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-009 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-011 Revision 3: Multi-role internal user management and reserved external identity

- Amendment ID: R1-AMD-011 Revision 3
- Related UAT finding: R1-UAT-010
- Agreed requirement: Replace separate Invitations and Brokers sections with a
  business-labelled User Management workspace covering direct Add User with secure
  activation, Invite User onboarding, pending/active/suspended/revoked users, Edit User,
  approved role/team maintenance, API-enforced Viewer read-only access, separate
  suspend/reactivate and revoke lifecycles, the approved Admin Assistant operational and
  listing scope, multiple compatible effective-dated scoped roles with one primary role,
  and audit evidence. Retain External Broker only as an interface identity
  classification; external authentication and CRM access remain outside Release 1.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-010 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-012 Revision 3: Governed NYSA company profile, safe logo retry and draft cleanup

- Amendment ID: R1-AMD-012 Revision 3
- Related UAT finding: R1-UAT-011
- Agreed requirement: Replace the informational/incomplete Organization Settings
  screen with business-friendly, versioned NYSA company profile and document-default
  maintenance covering complete legal/contact/regional/brand fields and a private
  approved logo; require draft editing, reasoned approval, activation, retirement,
  history and comparison; and make the active version authoritative for proposal
  identity, currency fallback, localized dates, brand reference, footer, disclaimer
  and immutable organization/logo evidence. An unselected optional logo must never be
  uploaded as an empty file, draft-save and logo-upload outcomes must be reported
  separately and accurately, and the first-profile copy action must never clear
  unsaved input. Validate logo size/type/readability before creating a version; keep a
  failed logo retry linked to the same saved draft; allow reasoned, audited permanent
  deletion only for unused drafts; and explain that Compare changes reviews differences
  from the immediately preceding version before approval.
- Status: Revision 3 deployed to CRM Test and verified by 66 automated tests plus
  authenticated comparison smoke test; activation, remaining user retest and explicit
  confirmation pending
- Retest condition: The R1-UAT-011 CRM Test retest condition passes, including creation
  without a logo, accurate partial-success handling for a rejected selected logo,
  same-draft retry, safe deletion of the five unused duplicate drafts and clear version
  comparison, and the user explicitly confirms the result.

### R1-AMD-013 Revision 1: Administration left-menu maintenance workspace

- Amendment ID: R1-AMD-013 Revision 1
- Related UAT finding: R1-UAT-014
- Agreed requirement: Replace the single long Administration page with a responsive
  two-column maintenance workspace: a persistent left menu and only the selected
  maintenance area on the right. Group User Management and User records behind one
  menu choice and retain Website Intake within Operations and Audit without changing
  permissions or governed lifecycle behavior.
- Status: Implemented locally and verified by automated layout-contract tests; CRM
  Test deployment, retest and explicit user confirmation pending
- Retest condition: The R1-UAT-014 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-014 Revision 2: Governed reusable AI assistance and review-first user controls

- Amendment ID: R1-AMD-014 Revision 2
- Related UAT finding: R1-UAT-015
- Agreed requirement: Add reusable authenticated REST services for (1) converting
  conversation notes into draft structured lead requirements, (2) drafting customer-
  friendly match rationale and trade-off wording strictly from server-built
  deterministic evidence, and (3) identifying missing customer, requirement or
  inventory information. Responses remain advisory, schema-constrained and subject to
  human confirmation. AI must not rank inventory, alter deterministic matching or save
  business records. Keep the provider key server-side, minimize/redact direct personal
  identifiers, store only safe run metadata, and fail without business-data mutation.
  Expose the services in their business context through review-first browser controls:
  editable requirement suggestions that only populate the normal form after an explicit
  apply action; editable match rationale/trade-offs that only populate suitability after
  an explicit apply action; and a missing-information review that identifies the source
  record and keeps incomplete-data notes out of customer output. Clear, discard and
  dismiss must be available, and Save new version or Generate proposal must remain a
  separate deliberate user action.
- Status: Revision 1 backend is deployed and configured on CRM Test. Revision 2 browser
  integration is implemented locally and covered by automated service, redaction,
  deterministic evidence, completeness, authentication, migration and review-control
  contract tests; CRM Test deployment, live retest and explicit confirmation pending
- Retest condition: On CRM Test, generate and edit requirement suggestions, discard one,
  apply another and verify nothing persists until Save new version; generate and edit
  match wording for a selected shortlisted property, apply it and verify no proposal is
  generated until the normal Generate action; check gaps and verify source-record
  guidance and editable questions; then the R1-UAT-015 conditions pass and the user
  explicitly confirms the result.

### R1-AMD-015 Revision 1: Model-driven operational lead qualification

- Amendment ID: R1-AMD-015 Revision 1
- Related UAT finding: R1-UAT-016
- Agreed requirement: Treat Hot/Warm/Cold as the output of the active approved Lead
  Qualification Version rather than a routine manual input. Start leads as Unassessed,
  render business questions and governed answer controls, calculate and explain the
  weighted result, restrict overrides to authorized users with a reason, and preserve
  reassessment history.
- Status: Implemented locally and verified by automated question-control, calculation,
  access, migration and browser-contract tests; CRM Test deployment, retest and explicit
  user confirmation pending
- Retest condition: The R1-UAT-016 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-016 Revision 1: Business shorthand for lead budget amounts

- Amendment ID: R1-AMD-016 Revision 1
- Related UAT finding: R1-UAT-017
- Agreed requirement: Accept and preview common K/M/B, AED, comma-formatted and full
  amount entries in new-lead and structured-requirement budgets, normalize them to
  exact server-side numeric values, and preserve range validation for every intake path.
- Status: Implemented locally and verified by automated domain, route and browser-
  contract tests; CRM Test deployment, retest and explicit user confirmation pending
- Retest condition: The R1-UAT-017 CRM Test retest condition passes and the user
  explicitly confirms the result.

## Review discipline

For every new test observation:

1. Assign the next `R1-UAT-###` identifier.
2. Record environment, evidence, priority, required correction and retest condition.
3. Link the finding to the relevant acceptance criterion.
4. Do not mark it closed until CRM Test retest is explicitly confirmed by the user.
5. Include all open findings in the Release 1 acceptance decision.
