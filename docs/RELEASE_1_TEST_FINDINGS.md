# Release 1 Test Findings

Environment: `https://crm-test.nysarealty.com/`

Started: 2026-07-15

Owner: NYSA Release 1 acceptance

## Release-level disposition

On 2026-07-19 the NYSA owner explicitly accepted Release 1 for controlled
production promotion. This release decision does not silently close individual
findings or manufacture missing evidence. Finding statuses below remain the durable
record of what was deployed and retested on CRM Test. Any residual item not separately
closed is accepted for this release and must either be monitored in production or
scheduled through the amendment protocol in Release 1.1.

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
- Status: Deployed to CRM Test. The authenticated synthetic routing suite passed
  30/30 scenarios on 2026-07-19; elapsed-SLA/repeat-recycling functional retest and
  explicit user confirmation remain pending.
- Priority: Must
- Related acceptance criteria: 47, 48, 49, 50, 51, 69, 70 and 71
- Evidence: Managers can assign only after locating and opening an individual lead;
  there is no dedicated pending-assignment queue for their managed teams. Directors
  have company-wide read access but the current policy makes them read-only and blocks
  assignment. Routing matches only source and broad business type, so it cannot express
  the agreed Dubai Rental, Dubai Off-plan and Dubai Secondary Sales destinations.
- Required correction:
  - Every manual, website and imported lead must enter with no broker assigned. Routing
    may select only the applicable team queue; it must never silently select a named
    agent. Remove broker/team assignment controls from initial lead capture and reject
    direct API attempts to assign during creation.
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
  - Initial broker assignment may be performed only by the responsible team lead or a
    Director. Administrator access alone does not grant operational assignment authority.
  - Route Dubai Rental leads to the Dubai Rental team, Dubai Off-plan leads to the
    Dubai Off-plan team, and Dubai Secondary Sale leads to the Dubai Secondary Sales
    team.
  - Treat the Any source / Any business fallback as the company unassigned queue; it
    must not silently select a team or individual agent.
  - Show routing reason, received time, current team, assignment state, SLA deadline
    and time waiting in the queue.
- Retest condition: On CRM Test, create controlled Dubai Rental, Dubai Off-plan, Dubai
  Secondary Sale and unmatched leads. Each matching lead appears in the correct team
  manager's Pending Assignment queue with no broker owner and can be assigned only by
  that team lead to an eligible member of the team. Confirm manual capture, website
  intake, imports and routing rules cannot preassign a broker. The unmatched lead remains
  in the company Unassigned queue. A Director can
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
- Status: Revision 2 implemented locally and verified by automated tests. Business line is
  governed, factors are labelled cards, active coverage and Draft -> Test -> Approve ->
  Activate are visible, and the false `age` inside `mortgage` sensitive-factor match is
  corrected. Consolidated CRM Test deployment, retest and explicit confirmation pending
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
- Status: Revision 13 implemented locally and verified by automated tests; CRM Test
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
  - Treat the Manager maintained against a Team as the authoritative reporting manager
    for every active user assigned to that team. Do not require a second manager field
    against each agent.
  - Show the derived reporting line in User Management as `Reports to`, and show the
    corresponding team against the manager as `Manages`.
  - When an approved Manager role is assigned to an unmanaged team, establish that
    user as the team manager. Prevent a second manager from silently replacing the
    incumbent; intentional replacement must use Team maintenance.
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
  authenticate or access CRM records in Release 1. Assign Addi as Manager of Core Sales
  Team and Ajitr as Sales Agent in that team; User Management shows `Addi — Manages:
  Core Sales Team` and `Ajitr — Reports to: Addi`. Move Ajitr to another team and verify
  the reporting line changes automatically. Attempt to assign a second Manager to Core
  Sales Team and verify that the system requires an explicit Team-maintenance change.

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
- Status: Revision 2 review-first controls are deployed on CRM Test. The audit fix is
  deployed and requirement drafting passed. R1-AMD-014 Revision 4 proposal-builder
  integration is implemented locally; CRM Test deployment, functional retest and
  explicit user confirmation remain pending
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
- Status: Guided model activation and R1-AMD-023 Revision 1 are deployed to CRM Test.
  Qualification calculation passed and the user explicitly confirmed that manager override
  works without re-entering customer answers. Finding remains open pending confirmation of
  retained assessment history and negative authorization/reason checks
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
- Status: Revision 1 deployed to CRM Test; retest failed for lowercase `m`. Revision 2
  implemented locally; deployment, retest and explicit user confirmation pending
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

### R1-UAT-018: Existing-customer selection is not searchable or alphabetical

- Date raised: 2026-07-17
- Area: New lead capture and existing-customer selection
- Status: Revision 1 deployed to CRM Test; retest found the dropdown was no longer
  visibly available. Revision 2 implemented locally; deployment, retest and explicit
  user confirmation pending
- Priority: Should
- Related acceptance criteria: 27 and 30
- Evidence: The existing-contact field is a static dropdown ordered by the most recently
  updated record. A user cannot type a name such as `Ajit` to bring matching customers
  to the top, and scanning a large list is unnecessarily slow.
- Required correction: Rename the field in business language, provide case-insensitive
  name/email/phone search, show matching customers first in alphabetical order, keep
  non-matching permitted customers available alphabetically, and preserve the selected
  customer and existing scope controls.
- Retest condition: On CRM Test, open new-lead capture, type `ajit`, verify every permitted
  matching customer appears first in alphabetical order, select one and create the lead;
  clear the search and verify all permitted customers are alphabetical; verify a no-match
  search leaves all customers available; and obtain explicit user confirmation.

### R1-UAT-019: Related-listing terminology does not explain its business purpose

- Date raised: 2026-07-17
- Area: New lead capture and lead summary
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: Should
- Related acceptance criterion: 81
- Evidence: The label `Related listing` is system terminology and does not tell the user
  whether the field records the customer's original property enquiry or limits later
  matching.
- Required correction: Label the field `Property that prompted this enquiry (optional)`,
  use `No specific property linked` as the empty choice, explain that the link records a
  particular property already enquired about without restricting later inventory matching,
  and use `Original property enquiry` in the saved lead summary.
- Retest condition: On CRM Test, create one lead with a specific originating property and
  another without one; verify the labels and saved lead summaries are clear, and verify
  later inventory matching remains available for both leads; then obtain explicit user
  confirmation.

### R1-UAT-020: Initial preferred areas do not reliably flow into structured matching requirements

- Date raised: 2026-07-17
- Area: New lead capture and structured requirements
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Priority: Must
- Related acceptance criteria: 80 and 81
- Evidence: The initial Preferred areas field stores free text, while deterministic
  matching reads the separately saved structured requirement's area array. Comma-separated
  areas entered during lead capture are not automatically presented in that later form.
- Required correction: Label the initial field as comma-separated, trim values, remove
  case-insensitive duplicates, preserve each area separately, and prefill Structured
  requirements from the lead when no authoritative requirement version exists. Existing
  requirement versions remain authoritative and prefill the next version for review.
- Retest condition: On CRM Test, create a lead with `Dubai Marina, Palm Jumeirah, dubai
  marina`; verify the lead stores two clean areas, Structured requirements opens with
  `Dubai Marina, Palm Jumeirah`, save the version and confirm both areas independently
  satisfy matching evidence; then obtain explicit user confirmation.

### R1-UAT-021: Failed new-customer lead capture leaves an orphan customer and unclear outcome

- Date raised: 2026-07-17
- Area: New lead capture, duplicate review and save confirmation
- Status: Revision 2 deployed to CRM Test; valid new-customer lead creation succeeded on
  user retest. Failure rollback, duplicate handling, exact queue count and explicit full
  retest confirmation remain pending
- Priority: Must
- Related acceptance criteria: 27, 30, 47 and 206
- Evidence: The first save returned Internal Server Error without a committed-success
  confirmation. The retry then reported a potential duplicate based on the same contact
  information even though no lead had been created. The browser currently creates a new
  customer and lead through separate requests, so a failed lead request can retain the
  customer and produce a legitimate email/phone duplicate warning on retry.
- Required correction: Create a new customer, its primary channels, role and the lead in
  one database transaction. If any lead step fails, roll back the new customer and its
  channel records. Explain that duplicate detection is based on matching email or phone,
  not name alone. Disable repeat submission while saving, retain the form after failure,
  identify clearly that no lead was created, and show a clear committed-success message
  only after both records and queue history are saved.
- Retest condition: On CRM Test, force a lead validation or database failure after entering
  a new customer and verify that no customer, channel, lead, assignment or audit fragment
  remains; correct the input and save once, verify exactly one customer and one lead exist,
  and see a clear assignment-queue success message. Retry the same email or phone and verify
  the duplicate message identifies the matching basis and requires reviewed confirmation.

### R1-UAT-022: Customer and reusable KYC records lack a dedicated workspace

- Date raised: 2026-07-17
- Area: Customers, KYC, consent, channels and related records
- Status: Revision 3 implemented locally and verified by automated tests with a primary
  Customers workspace, authoritative Customer/KYC record, customer document register,
  customer-originated lead creation and lead-to-customer navigation;
  consolidated CRM Test deployment, retest and explicit user confirmation pending
- Priority: Must
- Related acceptance criteria: 27, 30, 31, 34, 35, 36, 41, 126, 143 and 191
- Evidence: Customer and KYC data are stored against the reusable contact record, but the
  browser exposes maintenance only contextually after opening a lead. There is no dedicated
  Customer workspace where authorized users can find and maintain the master customer,
  review KYC once and see its reuse across all related leads and downstream records.
- Required correction: Add a role-scoped Customers workspace with an alphabetical/searchable
  list and a dedicated customer record. Present identity and customer roles, normalized
  contact channels, postal address, associated company, communication preferences,
  documentary consent/restrictions, KYC summary and expiry, private linked documents,
  duplicate/merge controls, ownership and audit history. Show related leads, requirements,
  activities, proposals and financial scenarios without copying KYC into each lead. Keep the
  customer/contact ID as the authoritative source; all consumers read the current permitted
  KYC state and proposals expose only approved masked identity references. Restrict full
  private documents and verification actions by role, record every review/change, and flag
  expired or review-due KYC.
- Retest condition: On CRM Test, locate a customer independently of a lead, maintain channels,
  roles, address, consent and an authorized KYC review, then open two leads for that customer
  and confirm both resolve the same current customer/KYC record without duplicate entry.
  Confirm related records are visible within role scope, proposals use only the masked ID
  reference, unauthorized users cannot view private KYC documents or verify KYC, expiry is
  flagged, and every material action is audited.

### R1-UAT-023: Manual lead creation permits incomplete customer and requirement data

- Date raised: 2026-07-17
- Area: New lead capture and existing-customer completeness
- Status: Correction implemented locally; CRM Test deployment, retest and explicit user
  confirmation pending
- Priority: Must
- Related acceptance criteria: 27, 31, 41 and 80
- Evidence: New lead capture visibly requires only the customer name and opportunity title;
  email, phone, preferred channel, both budget limits and preferred area can be omitted.
  This produces customers that cannot be contacted and leads that cannot support reliable
  qualification, matching or proposal preparation.
- Required correction: For new-customer manual lead capture, require customer name, valid
  email, valid international phone and preferred channel. For every manually created lead,
  require Budget from, Budget to and at least one normalized preferred area. Enforce the
  same rules in the API. When an existing customer is selected, block creation if its email,
  phone or preferred channel is missing and direct the user to complete the authoritative
  Customer record rather than entering a lead-specific copy.
- Retest condition: On CRM Test, verify browser and direct API reject each missing mandatory
  field separately with a business-readable message; verify invalid email/phone, invalid or
  reversed budgets and blank/comma-only areas are rejected; complete an existing customer
  through the Customer record and then create one valid lead with both budget limits and
  multiple normalized areas.

### R1-UAT-024: Structured requirements use free text, hide AI failures and fail to save blanks

- Date raised: 2026-07-17
- Area: Lead -> Structured requirements and AI-assisted requirement draft
- Status: R1-AMD-024 Revision 1 implemented locally and verified by automated tests; CRM
  Test deployment, live retest and explicit user confirmation pending
- Priority: Must
- Related acceptance criteria: 80, 81, 126, 191, 192 and 193
- Evidence: Property type is free text rather than a governed inventory-compatible choice;
  Generate suggestions can finish without persistent output or an actionable error; and Save
  new version returns Internal server error when optional bedroom limits are left blank.
- Required correction: Use governed business-line and property-type choices compatible with
  inventory matching, support one or more property types, normalize blank optional numeric
  limits to database null, validate direct API values, and show AI success or failure inside
  the review panel with a safe run reference when available. Never save an AI suggestion until
  the user applies and separately saves it.
- Retest condition: On CRM Test, select one and multiple governed property types, save with
  blank bedroom limits, and confirm a new version is created without an internal error. Generate
  AI suggestions and confirm either editable options or a persistent actionable error appears;
  apply a reviewed option and confirm it remains unsaved until Save new version is selected.

### R1-UAT-025: Interface typography is too small for comfortable operational use

- Date raised: 2026-07-17
- Area: CRM Test -> all browser workspaces
- Status: Closed. R1-AMD-025 Revision 1 is deployed to CRM Test and the user explicitly
  confirmed on 2026-07-18 that the increased font size is working.
- Priority: Usability
- Related acceptance criteria: 18, 67, 135 and 197
- Evidence: During Structured Requirements and AI suggestion retesting, the user observed
  that the interface font appears too small and requested an approximately 15% increase
  throughout the application.
- Required correction: Increase every maintained browser font-size declaration by 15%,
  including body text, labels, controls, buttons, tables, navigation, dashboards, modals,
  review cards and responsive typography, without changing permissions or workflow behavior.
- Retest condition: On CRM Test, review representative dashboard, lead, customer,
  administration, Structured Requirements, AI review and proposal-preview screens at 100%
  browser zoom and confirm text is materially easier to read without clipping or overlap.

### R1-UAT-026: Saved financial scenarios expose technical JSON and an unclear layout

- Date raised: 2026-07-18
- Area: Lead -> Saved financial scenarios
- Status: R1-AMD-026 Revision 2 implemented locally and verified by automated tests;
  CRM Test deployment, functional retest and explicit user confirmation pending
- Priority: Must
- Related acceptance criteria: 112, 113, 114, 115, 116, 117 and 118
- Evidence: The scenario form exposes `Inputs JSON` and places the saved table and technical
  payload editor in one undifferentiated modal. An operational user cannot confidently enter,
  review or explain a mortgage or investment scenario.
- Required correction: Replace JSON with separate business-labelled mortgage and investment
  forms, support business amount shorthand, prefill a linked property, display the calculated
  headline and approved assumption version, require acknowledgement of the indicative nature,
  and retain every saved scenario as an immutable snapshot for proposals.
- Retest condition: On CRM Test, create one linked mortgage scenario and one investment-return
  scenario using business-form inputs; confirm LTV/DBR or gross/net/cash returns, applicable fee
  context, disclaimer and assumption version are readable; reopen both and verify the original
  snapshots remain unchanged.

### R1-UAT-027: Private lead documents lack a usable register and governed field behaviour

- Date raised: 2026-07-18
- Area: Lead -> Private documents
- Status: R1-AMD-027 Revision 1 implemented locally and verified by automated tests;
  CRM Test deployment, security/functional retest and explicit user confirmation pending
- Priority: Must
- Related acceptance criteria: 137, 145, 146, 147, 148, 149, 191, 192 and 193
- Evidence: The lead exposes only a technical upload form; existing documents and versions are
  not visible. Document Type is free text, Direction/Status/Classification lack business
  guidance, Approved template is unexplained, and a generic checkbox can create marketing
  consent without separately reviewing channels and effective dates.
- Required correction: Provide a lead document register with version history, authenticated
  download and revision actions; consume the active `document_type` controlled-value set with
  safe operational fallbacks; govern Direction and Status combinations; make outbound recipient
  conditional; enforce restricted-file scope; preserve immutable hashes; and move executed
  Marketing Agreement evidence into a separate confirmed consent action.
- Retest condition: On CRM Test, upload inbound, outbound and internal examples, verify invalid
  direction/status combinations and sent-without-recipient are rejected, upload a new version
  without overwriting history, verify restricted access with authorized and unauthorized users,
  and record consent only from an approved signed Marketing Agreement version with explicitly
  selected channels and dates.

### R1-UAT-028: Lead tasks do not explain operational ownership or action status

- Date raised: 2026-07-18
- Area: Lead -> Tasks
- Status: R1-AMD-028 Revision 1 implemented locally and verified by automated tests;
  CRM Test deployment, functional retest and explicit user confirmation pending
- Priority: Usability
- Related acceptance criteria: 18, 67, 93, 119 and 120
- Evidence: The Tasks popup does not explain its distinction from Activities and omits the
  assignee, instructions, start and cancellation workflow from its compact table.
- Required correction: Present tasks as the lead action plan, display owner/deadline/priority/
  instructions/outcome, allow Open -> In progress -> Completed or Cancelled actions, require an
  outcome or reason, and permit only an authorized leader to select another owner.
- Retest condition: On CRM Test, create a task for the lead owner, create a leader-assigned task,
  start and complete one with an outcome, cancel another with a reason, and verify due/overdue
  dashboard indicators and unauthorized reassignment protection.

### R1-UAT-029: Proposal approval downloads the PDF and delivery status is misleading

- Date raised: 2026-07-18
- Environment: CRM Test (`https://crm-test.nysarealty.com/`)
- Area: Lead -> Proposal builder -> generated proposal review and delivery
- Status: R1-AMD-006 Revision 21 deployed to CRM Test; authenticated on-screen PDF rendering
  explicitly confirmed by the user on 2026-07-18. Manager approval, external-delivery evidence,
  Lead Documents reconciliation and negative role/frame tests remain pending before this parent
  finding can close
- Priority: Workflow and audit integrity
- Related acceptance criteria: 133, 135, 136, 137, 139, 143, 148, 149 and 193
- Evidence: Selecting PDF downloads the file rather than presenting an on-screen manager
  review. The Review action immediately changes status without confirming the exact rendered
  version. `Record sent` does not transmit the document, does not explain that delivery must
  already have occurred externally, and the retained proposal document is not visibly linked
  from the proposal workflow to the lead document register.
- Required correction: Present the exact private immutable PDF on screen before approval;
  require an explicit manager confirmation; distinguish external delivery recording from
  actual system transmission; retain recipient/channel/time audit evidence; and expose the
  generated, reviewed and externally delivered version in Lead Documents. Do not claim live
  email or WhatsApp delivery unless a separately approved connector is configured.
- Retest condition: On CRM Test, generate a new proposal and confirm Review on screen renders
  the exact PDF without downloading it. Confirm approval cannot occur without the checkbox,
  approval records the manager against that version, the next action clearly says Record
  external delivery and warns that it does not transmit the PDF, and the exact version, hash,
  status, recipient and delivery time are visible under Open Lead Documents. Confirm an agent
  cannot perform manager approval.

### R1-UAT-030: Generated proposal PDF does not use the approved booklet format

- Date raised: 2026-07-18
- Environment: CRM Test (`https://crm-test.nysarealty.com/`)
- Area: Lead -> Proposal builder -> generated/downloaded immutable PDF
- Status: Closed. R1-AMD-006 Revision 20 was deployed to CRM Test and the user explicitly
  confirmed the newly generated branded proposal format works on 2026-07-18
- Priority: Customer-facing document quality and template governance
- Related acceptance criteria: 128, 130, 132, 134, 135, 137 and 139
- Evidence: The downloaded proposal is a 6.3 KB, two-page, text-only PDF. It omits the
  approved booklet composition, logo and selected property image and does not match the
  branded draft sample reviewed in Administration. The server used a separate generic text
  renderer instead of the active approved proposal-template layout.
- Required correction: Generate the immutable reviewed/downloaded PDF from the active
  approved booklet design and authoritative proposal snapshot. Include active organization
  branding, masked customer reference, requirement summary, up to three separately identified
  property matches, selected approved media, property facts, reviewed narrative and trade-offs,
  applicable purchase journey, next steps, disclaimer, creator/date/version and page footer.
  The on-screen review and downloaded file must be the same stored bytes and hash.
- Retest condition: On CRM Test, generate a fresh proposal with the active organization logo,
  one to three selected properties and approved images. Review it on screen and download it;
  confirm both show the same branded booklet format, customer/requirement/property content,
  selected images, timeline, next steps and disclaimer without clipping or overlap. Confirm
  the reviewed and downloaded document-version hash is unchanged. Explicit user confirmation
  is required before closure.

### R1-UAT-031: Proposal booklet wastes page space and the budget range escapes its box

- Date raised: 2026-07-18
- Environment: CRM Test (`https://crm-test.nysarealty.com/`)
- Area: Lead -> Proposal builder -> generated immutable PDF
- Status: R1-AMD-006 Revision 22 implemented and visually verified locally; CRM Test deployment,
  fresh-version retest and explicit user confirmation pending
- Priority: Customer-facing document readability and layout quality
- Related acceptance criteria: 128, 130, 134 and 135
- Evidence: The branded booklet uses a largely empty standalone purchase-journey page and leaves
  excessive unused space on property pages. A full formatted budget range can exceed the fixed
  requirement-chip width instead of remaining inside its border.
- Required correction: Use a compact responsive requirement-chip layout, abbreviate large budget
  values without changing their meaning, place the purchase journey and next steps in available
  summary-page space, enlarge approved-media presentation and balance each property page with
  aligned suitability, highlight and trade-off cards. Preserve the one-property-per-page hierarchy
  and exact immutable proposal data.
- Retest condition: On CRM Test, generate a fresh proposal with a budget range and three selected
  properties. Confirm the complete budget range remains inside its box, the summary contains the
  journey and next steps without clipping, there is no mostly empty journey-only page, and all
  property pages remain balanced with media, facts and reviewed narrative. Explicit user
  confirmation is required before closure.

### R1-UAT-032: Generated proposals have no manager or director approval queue

- Date raised: 2026-07-18
- Environment: CRM Test (`https://crm-test.nysarealty.com/`)
- Area: Proposal approval workflow and role dashboards
- Status: R1-AMD-006 Revision 23 deployed to CRM Test and the Team Manager queue is visible.
  Revisions 24 through 30 are implemented locally; CRM Test deployment, cross-role retest and explicit
  user confirmation pending
- Priority: Operational workflow and approval control
- Related acceptance criteria: 21, 135 and 137
- Evidence: A proposal can require and record Manager approval, but no pending work item appears
  on the Team Manager or Managing Director dashboard. The reviewer must already know the lead and
  navigate into its Proposal Builder. The existing backend also excludes the Managing Director
  from proposal approval despite providing company-wide dashboard visibility.
  CRM Test follow-up evidence shows the new queue can surface an older pending immutable Version 1
  created before the branded renderer correction; the reviewer correctly sees the stored legacy
  bytes, but the queue must prefer a subsequently generated current version rather than retain both.
  The visible queue also joins customer, lead, proposal, team and requester values without adequate
  spacing, uses the ambiguous label "Less than 1 hour", omits the submitted timestamp and provides
  no search facility for a growing approval register.
  After the searchable register was deployed, entering the visible status "pending" returned zero
  results because status was omitted from the searchable record. Proposals also have no stable,
  business-friendly reference suitable for search, customer discussion and document traceability.
- Required correction: Show a Proposal approvals queue on Team Manager and Managing Director
  dashboards. Display the customer, lead, proposal/template/version, team, requester and waiting
  age, with Open lead and Review on screen actions. Restrict Team Managers to their actively
  managed teams, give the Managing Director company-wide approval scope, keep Administrators and
  agents out of the business-approval queue and do not broaden Director access to routine lead editing.
  Show only the latest generated version per proposal, display the exact submitted timestamp and a
  precise minute/hour/day waiting duration, separate the values into readable lines, and provide
  role-scoped server-side search with pagination.
  Assign every proposal an immutable monthly business number and expose it consistently in the
  builder, approval register, PDF and generated document reference. Let an authorized business
  reviewer either approve or return the exact immutable version with a mandatory correction reason;
  notify the requester through an assigned correction task and require a new version for resubmission.
  Present the approval register in its own clearly labelled dashboard tab for Team Managers and
  Managing Director/Administrator instead of repeating it among unrelated dashboard sections.
- Retest condition: On CRM Test, generate proposals under two different teams. Confirm each Team
  Manager sees and can approve only the managed-team item; the Managing Director sees and can
  approve both; an Agent sees no approval queue and cannot call the approval API; approval removes
  the exact version from the queue and retains reviewer/time/audit evidence. Explicit user
  confirmation is required before closure.

### R1-UAT-033: Sign-in has no password recovery path

- Date raised: 2026-07-18
- Environment: CRM Test (`https://crm-test.nysarealty.com/`)
- Area: Authentication and User Management
- Status: R1-AMD-029 Revision 1 implemented locally; CRM Test deployment, security retest and
  explicit user confirmation pending
- Priority: Access continuity and account security
- Related acceptance criteria: 19, 22 and 62
- Evidence: After an invalid password, the sign-in screen offers only Sign in and invitation
  redemption. An existing user cannot request a password reset or enter a new password.
- Required correction: Add a privacy-preserving Forgot password workflow without claiming an email
  delivery connector. Show the same response for registered and unregistered emails. Let only an
  Administrator issue a short-lived, one-time reset code through User Management; store only its
  hash, require new-password confirmation, expire or cancel unused codes, revoke existing sessions
  after successful reset and retain audit evidence without storing the password or code.
- Retest condition: On CRM Test, request resets for a registered and unregistered email and confirm
  the public responses are indistinguishable. As Administrator, issue a code and confirm it is shown
  only once and expires after 30 minutes. Confirm an Admin Assistant cannot list or issue codes.
  Redeem a valid code with matching passwords of at least 12 characters; confirm the old password,
  code reuse and prior sessions fail while the new password succeeds. Explicit user confirmation is
  required before closure.

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

### R1-AMD-006 Revision 13: Guided proposal preparation, shortlist and approved media

- Amendment ID: R1-AMD-006 Revision 13
- Related UAT findings: R1-UAT-008 and R1-UAT-015
- Agreed requirement: Replace the unexplained empty proposal controls with one guided
  preparation workflow. State which prerequisite is missing when no active proposal
  template, company profile, structured requirement or available inventory exists.
  Let the user start a proposal only from an active template. Suggest up to the
  maintained shortlist maximum using transparent system criteria for preferred area,
  property type, budget, bedroom range and recorded availability confirmation; display
  each criterion and keep the user's selection deliberate. Group approved media under
  its inventory property, show authenticated previews, explain that upload and approval
  happen in Inventory, and enforce the template's media-per-property limit. Present
  financial assumptions as an editable customer-facing explanation of the selected
  immutable scenario and its governed fee-rule version, or explicitly say that no
  financial calculation is included. Generate only after the user reviews properties,
  media, narrative, assumptions and an approved disclaimer.
- Status: Implemented locally and verified by automated domain and browser-contract
  tests; CRM Test deployment, authenticated retest and explicit user confirmation pending.
- Retest condition: On CRM Test, open Proposal builder for a prepared lead and verify
  that prerequisites are clear; start a proposal from an active template; review the
  system-suggested matches and their visible criteria; select no more than the template
  maximum; select only approved media under its matching inventory property and no more
  than the maintained per-property limit; review the financial-scenario explanation or
  the no-calculation statement; generate an immutable draft; and explicitly confirm the
  result. Also verify an unprepared lead is blocked with the precise record to maintain.

### R1-AMD-006 Revision 14: Actionable proposal readiness and authoritative maintenance

- Amendment ID: R1-AMD-006 Revision 14
- Related UAT findings: R1-UAT-008 and R1-UAT-015
- Agreed requirement: Present missing proposal information with business labels instead of
  technical field codes and route every correction to its authoritative record. Preferred
  areas, funding method and bedroom range must open Structured requirements. Built-up area
  and availability confirmation must open the exact Inventory record. Every suggested
  property must provide direct Inventory and property-media actions; media is uploaded to the
  listing and requires manager approval before proposal use. Do not duplicate these fields in
  the proposal or allow AI to invent missing values.
- Status: Implemented locally and verified by all 94 automated tests; CRM Test deployment,
  authenticated retest and explicit user confirmation pending
- Retest condition: On CRM Test, run Check missing information with the reported requirement
  and Inventory gaps. Confirm business labels are shown, each maintenance action opens the
  correct source record, updated values are reflected after reopening the builder, property
  media can be uploaded and approved from Inventory, and only approved media becomes
  selectable against its matching property.

### R1-AMD-006 Revision 15: Inventory media compatibility and clear coordination actions

- Amendment ID: R1-AMD-006 Revision 15
- Related UAT findings: R1-UAT-008 and R1-UAT-015
- Agreed requirement: Inventory property media must accept valid JPEG files using either the
  `.jpg` or `.jpeg` extension, including common WhatsApp image names, while retaining file
  signature, size and type security validation. The media screen must explain that uploads
  await manager approval. The listing-detail coordination action must be clearly identified as
  an internal note rather than a listing-save action, reject an empty note with an explicit
  message, confirm successful posting and report API failure.
- Status: Implemented locally and verified by all 94 automated tests; CRM Test deployment,
  authenticated retest and explicit user confirmation pending
- Retest condition: On CRM Test, upload a valid `.jpeg` property image and confirm it is listed
  as pending, approve it as a manager and confirm it becomes proposal-selectable. In the same
  inventory record, confirm an empty Add note action explains what is required and a completed
  coordination note is saved and immediately displayed. Confirm listing changes remain under
  Edit listing and do not depend on media upload or coordination notes.

### R1-AMD-006 Revision 16: Balanced property-image quality and performance controls

- Amendment ID: R1-AMD-006 Revision 16
- Related UAT findings: R1-UAT-008 and R1-UAT-015
- Agreed requirement: Keep property proposals fast without silently reducing image quality.
  JPG/JPEG, PNG and WEBP property images must retain their original bytes but be limited to
  5 MB, 24 megapixels and 6000 pixels on either edge. Images must have at least 1200 pixels on
  the long edge and 720 pixels on the short edge, with an aspect ratio from 1:2 through 2:1.
  Apply the same immediate browser guidance and authoritative server validation. PDFs used as
  floor plans or brochures are exempt from image-dimension rules and retain the existing 8 MB
  media limit.
- Status: Implemented locally and verified by all 95 automated tests; CRM Test deployment,
  authenticated retest and explicit user confirmation pending
- Retest condition: On CRM Test, confirm a compliant high-quality image uploads without
  recompression and remains pending approval. Confirm clear rejection messages for an image
  over 5 MB, below the minimum dimensions, above 24 megapixels or 6000 pixels, and outside the
  1:2–2:1 aspect range. Confirm an allowed PDF floor plan remains uploadable.

### R1-AMD-006 Revision 17: Optional inventory coordination notes

- Amendment ID: R1-AMD-006 Revision 17
- Related UAT finding: R1-UAT-015
- Agreed requirement: Internal coordination notes are optional staff conversation and are not
  an inventory-maintenance requirement. Present them in a collapsed optional section and state
  clearly that they do not affect editing the listing, changing availability or maintaining
  property media. A note body is required only when the user deliberately chooses Add note.
- Status: Implemented locally and verified by all 95 automated tests; CRM Test deployment,
  authenticated retest and explicit user confirmation pending
- Retest condition: On CRM Test, edit and save an inventory listing, change its availability
  and maintain media without opening or completing Internal coordination notes. Expand the
  optional section and confirm a completed note can still be added independently.

### R1-AMD-006 Revision 18: Structured requirement to proposal-timeline mapping

- Amendment ID: R1-AMD-006 Revision 18
- Related UAT findings: R1-UAT-008 and R1-UAT-015
- Agreed requirement: Do not request duplicate timeline content during proposal generation.
  Automatically combine the current Structured Requirements timeline with the active proposal
  template's maintained, conditionally applicable purchase-journey stages. Include ready-
  property, off-plan, cash and bank-finance stages only when applicable. Store the resulting
  approved text in the immutable proposal snapshot and print it in the generated PDF.
- Status: Implemented locally and verified by all 96 automated tests; CRM Test deployment,
  authenticated retest and explicit user confirmation pending
- Retest condition: On CRM Test, use a lead whose current Structured Requirements timeline is
  `6-12 months`, generate a proposal without entering duplicate timeline text and confirm no
  mandatory-timeline error occurs. Confirm the PDF and immutable snapshot include the customer
  timing plus the applicable approved template stages and omit irrelevant stages.

### R1-AMD-006 Revision 19: On-screen proposal review and honest delivery evidence

- Amendment ID: R1-AMD-006 Revision 19
- Related UAT finding: R1-UAT-029
- Agreed requirement: Enforce the sequence Generate immutable PDF -> Review exact PDF on
  screen -> Confirm manager approval -> deliver outside CRM -> Record external delivery.
  Provide inline authenticated PDF review, explicit approval confirmation and optional audit
  comments. Do not describe delivery recording as system transmission while no email or
  WhatsApp connector exists. Automatically retain and expose the exact proposal document and
  its generated/reviewed/sent status, hash, recipient and event time in Lead Documents.
- Status: Implemented locally; automated verification, CRM Test deployment, authenticated
  retest and explicit user confirmation pending
- Retest condition: The R1-UAT-029 CRM Test retest condition passes and the user explicitly
  confirms the workflow. Actual one-click customer transmission remains outside this
  correction until a delivery connector is separately approved and configured.

### R1-AMD-006 Revision 20: Render the immutable PDF in the approved booklet format

- Amendment ID: R1-AMD-006 Revision 20
- Related UAT finding: R1-UAT-030
- Agreed requirement: Remove the separate generic text-only proposal renderer. Build the
  immutable PDF from the active organization profile, approved proposal-template rules and
  authoritative proposal snapshot using the same customer-facing booklet hierarchy that is
  reviewed in Administration. Render branding, customer and requirement summary, numbered
  property pages, selected approved JPEG/PNG media, facts and reviewed narrative, applicable
  purchase journey, next steps, disclaimer, creator/date/version and page footer. Preserve
  one exact stored byte stream for on-screen review, download, approval and delivery evidence.
- Status: Closed. The booklet fixture was rendered to PNG with Poppler and visually inspected;
  the correction was then deployed to CRM Test and the user explicitly confirmed the newly
  generated branded proposal format works on 2026-07-18.
- Retest condition: The R1-UAT-030 CRM Test retest condition passes and the user explicitly
  confirms the generated proposal format.

### R1-AMD-006 Revision 21: Permit the authenticated private PDF review frame

- Amendment ID: R1-AMD-006 Revision 21
- Related UAT finding: R1-UAT-029
- Agreed requirement: Permit the Proposal Review screen to embed only its locally created
  authenticated `blob:` PDF URL. Retain `X-Frame-Options: DENY` and
  `frame-ancestors 'none'` so an external site still cannot embed CRM Test. Do not permit
  arbitrary external frame origins, weaken document access checks or bypass the immutable
  document-version audit path.
- Status: Deployed to CRM Test; the user explicitly confirmed authenticated on-screen PDF
  rendering works on 2026-07-18. Unauthenticated access denial and third-party framing denial
  remain pending before the broader R1-UAT-029 finding can close.
- Retest condition: On CRM Test, open Review on screen for an authorized proposal version and
  confirm the exact PDF renders inside the modal without a content-blocked message. Confirm an
  unauthenticated request is denied and a third-party page still cannot frame CRM Test. The
  manager confirmation must remain unavailable if PDF retrieval itself fails.

### R1-AMD-006 Revision 22: Compact responsive proposal-booklet pagination

- Amendment ID: R1-AMD-006 Revision 22
- Related UAT finding: R1-UAT-031
- Agreed requirement: Keep requirement values within responsive boxes, show large budget values in
  a concise business format such as `AED 2m - AED 2.5m`, use the summary page for the indicative
  journey and next steps instead of creating a sparse standalone page, enlarge approved-media
  presentation and align the property suitability, highlights and trade-offs in balanced cards.
  Support the governed maximum of three properties without overlap, clipping or data loss.
- Status: Implemented locally. A four-page, three-property A4 fixture was rendered with Poppler and
  every page was visually inspected; CRM Test deployment and explicit user confirmation pending.
- Retest condition: The R1-UAT-031 CRM Test retest condition passes and the user explicitly confirms
  the corrected format.

### R1-AMD-006 Revision 23: Role-scoped proposal approval queue

- Amendment ID: R1-AMD-006 Revision 23
- Related UAT finding: R1-UAT-032
- Agreed requirement: Add a visible Proposal approvals queue to Team Manager and Managing Director
  dashboards with customer, lead, proposal, template/version, team, requester, waiting age, Open
  lead and Review on screen actions. Team Manager scope is limited to actively managed teams;
  Managing Director and Administrator scope is company-wide. Permit those roles to approve the
  exact reviewed version without granting the Managing Director general lead-edit capability.
- Status: Deployed to CRM Test and the Team Manager queue is visible. Authenticated cross-role
  scope retest and explicit user confirmation remain pending; the finding remains open.
- Retest condition: The R1-UAT-032 CRM Test retest condition passes and the user explicitly confirms
  the operational approval workflow.

### R1-AMD-006 Revision 24: Show only the latest proposal version awaiting approval

- Amendment ID: R1-AMD-006 Revision 24
- Related UAT finding: R1-UAT-032
- Agreed requirement: Preserve every immutable historical PDF, but show only the latest version of
  each proposal in the operational approval queue. When a corrected Version 2 is generated, the
  obsolete pending Version 1 must no longer remain as a separate approval item. Never regenerate
  or overwrite Version 1 during review.
- Status: Implemented locally with dashboard query and browser-contract tests; CRM Test deployment,
  authenticated retest and explicit user confirmation pending.
- Retest condition: On CRM Test, retain a pending legacy Version 1, generate a corrected Version 2
  and confirm the queue shows only Version 2. Review Version 2 and confirm the proposal disappears
  from the queue while both immutable versions remain accessible in proposal/document history.

### R1-AMD-006 Revision 25: Searchable timestamped proposal approval register

- Amendment ID: R1-AMD-006 Revision 25
- Related UAT finding: R1-UAT-032
- Agreed requirement: Present each pending approval as a readable operational record with distinct
  customer/lead, proposal/version, team/requester and action columns. Replace "Less than 1 hour"
  with the exact submitted date/time and a precise elapsed duration in minutes, hours or days.
  Provide role-scoped server-side search across customer, lead, proposal, team, requester and version,
  with pagination so a large queue remains usable. Apply Revision 24 latest-version filtering to the
  same register.
- Status: Implemented locally with parameterized server-side search, pagination, scope enforcement,
  responsive layout and automated contract tests; CRM Test deployment, authenticated retest and
  explicit user confirmation pending.
- Retest condition: On CRM Test, create enough pending proposals to span more than one page. Confirm
  each row shows a submitted timestamp and precise waiting duration, search finds matching customer,
  lead, proposal, team, requester and version values only within the signed-in reviewer's scope,
  Previous/Next navigate correctly, only the latest generated version of each proposal is present,
  and Open lead/Review on screen still work. Explicit user confirmation is required before closure.

### R1-AMD-006 Revision 26: Newest approval requests first

- Amendment ID: R1-AMD-006 Revision 26
- Related UAT finding: R1-UAT-032
- Agreed requirement: Sort the operational proposal approval register by submission timestamp in
  descending order so the newest pending request is always shown first. Preserve this order across
  server-side search and pagination, using a stable identifier as the tie-breaker for requests with
  the same timestamp.
- Status: Implemented locally with deterministic database ordering and an automated contract test;
  CRM Test deployment, authenticated retest and explicit user confirmation pending.
- Retest condition: On CRM Test, submit at least three proposals at visibly different times and
  confirm the newest request appears first, the oldest last, and the same descending order is
  retained after searching and moving between pages. Explicit user confirmation is required before
  closure.

### R1-AMD-006 Revision 27: Complete approval search and monthly proposal number

- Amendment ID: R1-AMD-006 Revision 27
- Related UAT finding: R1-UAT-032
- Agreed requirement: Make approval search cover every business-facing value shown in the row,
  including proposal number, title, template, version, pending/awaiting-review status, customer,
  lead, team, requester and submitted date/time. Assign each proposal exactly one immutable reference
  in the format `NYSA-PR-YYYYMM-######`, where the six-digit sequence restarts each Dubai business
  month and is allocated transactionally. Existing proposals must be backfilled deterministically.
  Show the reference in proposal history/selection, the approval register, generated PDF and the
  linked document reference; proposal versions continue to use the same proposal number.
- Status: Implemented locally with migration `020_proposal_business_numbers.sql`, concurrency-safe
  monthly counters, parameterized search and automated migration/route/UI/PDF contract tests; CRM
  Test deployment, migration verification, authenticated retest and explicit user confirmation pending.
- Retest condition: On CRM Test, verify migration `020` is recorded and existing proposals have unique
  references. Create two new proposals and confirm consecutive current-month numbers. Generate more
  than one version and confirm the proposal number does not change. Confirm search by `pending`, full
  or partial proposal number, title, template, version, customer, lead, team, requester and visible
  submission date returns the expected scoped rows; a value outside the reviewer's scope returns none.
  Confirm the same number appears in the builder, approval register, PDF and Lead Document reference.
  Explicit user confirmation is required before closure.

### R1-AMD-006 Revision 28: Dedicated proposal approvals dashboard tab

- Amendment ID: R1-AMD-006 Revision 28
- Related UAT finding: R1-UAT-032
- Agreed requirement: Provide a dedicated `Proposal approvals` dashboard tab for Team Managers,
  Managing Director and Administrator. Show the current pending count on the tab, render the
  searchable approval register as the tab's primary content and remove the register from Team
  performance, Executive, Sales, Inventory and Operations and Risk sections so it cannot be lost
  among unrelated management information. Retain the same role scope, search, pagination,
  newest-first order and review actions.
- Status: Implemented locally with separate Manager/Executive view contracts and automated domain/
  browser tests; CRM Test deployment, authenticated visual/functional retest and explicit user
  confirmation pending.
- Retest condition: On CRM Test, sign in as Team Manager and Managing Director. Confirm each sees a
  dedicated `Proposal approvals (n)` tab, selecting it shows only the approval register without the
  general KPI/panel collection, the register is absent from every other dashboard tab, and scope,
  search, pagination, ordering, Open lead and Review on screen continue to work. Confirm an Agent
  sees no approval tab. Explicit user confirmation is required before closure.

### R1-AMD-006 Revision 29: Separate system administration from business approval

- Amendment ID: R1-AMD-006 Revision 29
- Related UAT finding: R1-UAT-032
- Agreed requirement: Treat Administrator as a system-governance role, not a business approver.
  Remove the Proposal approvals dashboard tab from Administrator, reject Administrator access to
  the approval-register API and proposal-review action, and prevent a crafted dashboard view from
  rendering the queue. Retain managed-team approval for Team Managers and company-wide approval for
  Managing Directors. This restriction must not remove the Administrator's maintenance, security or
  audit responsibilities.
- Status: Implemented locally with policy, route, dashboard and regression tests; CRM Test deployment,
  authenticated cross-role retest and explicit user confirmation pending.
- Retest condition: On CRM Test, confirm Administrator has no Proposal approvals tab and receives
  access denied from both the approval queue and review APIs. Confirm Team Manager sees only managed-
  team requests, Managing Director sees the company queue and Agent has no approval access. Explicit
  user confirmation is required before closure.

### R1-AMD-006 Revision 30: Return proposal to requester for correction

- Amendment ID: R1-AMD-006 Revision 30
- Related UAT finding: R1-UAT-032
- Agreed requirement: In the exact immutable PDF review, present two explicit business decisions:
  Approve for external delivery or Request changes. Request changes requires a meaningful reason,
  preserves the returned PDF and decision evidence, removes it from the pending approval queue,
  changes the proposal state to Changes requested and creates an urgent correction task assigned to
  the user who generated that version. The requester can see the reason in proposal history and must
  generate a new immutable version for another approval attempt; the returned version is never edited
  or overwritten.
- Status: Implemented locally with migration `022_proposal_changes_requested.sql`, atomic decision/
  task creation and browser/API regression tests; CRM Test deployment, cross-role workflow retest and
  explicit user confirmation pending.
- Retest condition: On CRM Test, review a generated version as Team Manager or Managing Director.
  Confirm Request changes is blocked without a meaningful reason; submit a reason and verify the item
  leaves the approval queue, the requester receives an urgent task containing that reason, and the
  immutable returned PDF remains viewable. Generate Version 2 and confirm only Version 2 returns to
  the approval queue while Version 1 retains its Changes requested decision. Approve Version 2 and
  confirm it can proceed to recorded external delivery. Explicit user confirmation is required.

### R1-AMD-006 Revision 31: Administrator personal action-request queue

- Amendment ID: R1-AMD-006 Revision 31
- Related UAT finding: R1-UAT-032
- Agreed requirement: Removing business-approval authority from Administrator must not hide work
  returned to that Administrator as the original requester. Provide a prominent My action requests
  queue in Administration showing only tasks assigned to the signed-in Administrator, including
  returned-proposal reason, priority, deadline, customer and lead. Allow the requester to open the
  lead, start the task and complete it with an outcome. Do not expose the proposal approval queue or
  grant Administrator approval authority.
- Status: Implemented locally and verified by 101 automated tests; CRM Test deployment, functional
  retest and explicit user confirmation pending.
- Retest condition: On CRM Test, generate a proposal as Administrator and return it for changes as
  Managing Director. Confirm the Administrator sees the urgent correction under My action requests,
  can read the reason, open the correct lead, start and complete the action, but still has no Proposal
  approvals tab and cannot call the approval or request-changes APIs. Explicit user confirmation is
  required before closure.

### R1-AMD-006 Revision 32: Governed returned-proposal correction work item

- Amendment ID: R1-AMD-006 Revision 32
- Related UAT finding: R1-UAT-032
- Agreed requirement: A returned proposal must not appear as an ordinary task with generic
  Complete and Cancel actions. Show the proposal number, returned immutable version, reviewer,
  return timestamp and full reviewer remarks as a distinct Proposal changes requested work item.
  Provide View returned PDF and Revise same proposal actions. Revision must open the same proposal,
  preserve its business reference and explain that a new immutable version is required. Generating
  that corrected version must automatically complete the correction work item and resubmit the new
  version for manager review; users must not manually complete or cancel the correction task and
  must not create a second proposal merely to respond to review remarks.
- Status: Implemented locally with migration `023_proposal_correction_tasks.sql` and verified by
  101 automated tests; CRM Test deployment, functional retest and explicit user confirmation pending.
- Retest condition: On CRM Test, return a generated proposal with a clear reason. Sign in as the
  original requester and confirm My tasks shows the exact remarks and returned PDF with only View
  returned PDF and Revise same proposal. Revise and generate the next immutable version; confirm
  the correction task completes automatically, the proposal number is unchanged, the version
  increments and the new version reappears in the authorized approval queue. Explicit user
  confirmation is required before closure.

### R1-AMD-007 Revision 2: Operational pending-assignment queues, SLA recycling and Dubai routing defaults

- Amendment ID: R1-AMD-007 Revision 2
- Related UAT finding: R1-UAT-005
- Agreed requirement: Provide scoped manager and company-wide Director assignment
  queues; require every intake channel to create a broker-unassigned lead; restrict
  routing rules to team queues; allow initial assignment only by the responsible team
  lead or Director; apply the three Dubai team defaults; leave unmatched leads in the
  company unassigned queue; return
  unattended leads to their routed team queue after assignment-acceptance or
  first-contact SLA breach; and allow eligible agents in that team to self-claim on a
  first-successful-claim basis, with repeat recycling and complete SLA/assignment
  history.
- Status: Revisions 1 and 2 are deployed to CRM Test. The authenticated synthetic
  routing suite passed 30/30 intake, routing, access, queue, assignment, rejection,
  atomic claim and history scenarios on 2026-07-19. Elapsed-SLA/repeat-recycling
  functional retest and explicit user confirmation remain pending.
- Retest condition: The R1-UAT-005 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-007 Revision 3: Governed routing-rule maintenance

- Amendment ID: R1-AMD-007 Revision 3
- Related UAT finding: R1-UAT-005
- Agreed requirement: Administrators must be able to edit an active routing rule and
  retire or reactivate a rule without deleting its history. Every edit and lifecycle
  action requires a reason and an audit entry. An active source/business combination
  must be unique, and an Any source / Any business fallback may route only to the
  Company Unassigned Queue so that a named team cannot unintentionally capture every
  unmatched lead.
- Status: Deployed to CRM Test with migration `026_routing_rule_governance.sql`.
  Business routing and company fallback passed the 30/30 authenticated live suite;
  lifecycle/audit functional retest and explicit user confirmation remain pending.
- Retest condition: On CRM Test, edit a specific routing rule and confirm its changed
  values are saved only after entering a reason. Retire it, confirm it no longer routes
  new leads, then reactivate it with a reason. Confirm a duplicate active match and an
  Any source / Any business rule pointing to a named team are both rejected. Confirm
  the Company Unassigned fallback remains valid and audit history records every action.
  Explicit user confirmation is required before closure.

### R1-AMD-007 Revision 4: Routing-table rendering and destination confirmation

- Amendment ID: R1-AMD-007 Revision 4
- Related UAT finding: R1-UAT-005
- Agreed requirement: The routing-rule register must render immediately after a rule
  is created or changed and must not depend on an undefined browser helper. When a
  source-specific or business-specific rule has no destination team selected, require
  explicit confirmation before saving it to the Company Unassigned Queue so an omitted
  destination is not silently accepted.
- Status: Deployed to CRM Test. Live browser evidence confirms the routing register,
  Actions column and maintained rules render without the prior helper error; destination
  warning retest and explicit user confirmation remain pending.
- Retest condition: On CRM Test, create a rule and confirm it appears immediately with
  Edit and Retire actions and no browser error. Attempt to save a specific matching
  rule without selecting a team and confirm the Company Unassigned warning appears.
  Cancel once and confirm nothing is saved; confirm once and verify the saved queue.
  Explicit user confirmation is required before closure.

### R1-AMD-007 Revision 5: Correct new-lead self-claim denial

- Amendment ID: R1-AMD-007 Revision 5
- Related UAT finding: R1-UAT-005
- Agreed requirement: An agent attempting to self-claim any brand-new unassigned lead,
  including a lead in the Company Unassigned Queue with no responsible team yet, must
  receive the governed access denial before team-eligibility validation. Self-claim
  remains available only after an SLA or rejection cycle returns the lead to its
  responsible team queue.
- Status: Deployed to CRM Test as `af25465`; 106/106 local automated tests and the
  authenticated 30/30 live routing suite pass. Explicit user confirmation remains
  pending.
- Retest condition: On CRM Test, attempt agent self-claim against a new team-routed lead
  and a new Company Unassigned lead; both must return the controlled after-SLA-recycling
  denial without assigning the lead. Complete an authorized assignment and rejection or
  SLA recycle, then confirm exactly one eligible team agent can self-claim successfully.
  Explicit user confirmation is required before closure.

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
- Status: Deployed to CRM Test; usability retest failed and Revision 2 is required;
  explicit user confirmation pending
- Retest condition: The R1-UAT-007 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-009 Revision 2: Guided qualification lifecycle and business-labelled factor design

- Amendment ID: R1-AMD-009 Revision 2
- Related UAT findings: R1-UAT-007 and R1-UAT-016
- Agreed requirement: Replace Business line free text with governed choices for All business
  lines, Sale, Rental, Off-plan and Commercial. Show active-version coverage for each business
  line and explain that only an Active version can assess a lead. Separate the version list
  from a closed-by-default draft editor and present Draft -> Test -> Approve -> Activate as a
  guided sequence. Render each factor as a labelled card with Factor name, Question shown to
  agent, Help text, Stable code, Answer type/choices, Source, score range, weight, required
  rule and missing-answer treatment; provide reorder and remove controls. Supply coherent
  starter factors rather than placing unrelated concepts across one unlabeled row. Make score
  bands and response guidance plain-language sections, show live total weight and coverage,
  and replace the operational error with a business message naming the lead business line and
  the administrator action required. Detect prohibited personal/social attributes as whole
  terms, identify the offending attribute clearly and never reject legitimate real-estate
  wording such as mortgage because it contains a matching text fragment.
- Status: Implemented locally and verified by automated tests; consolidated CRM Test
  deployment, retest and explicit user confirmation pending
- Retest condition: On CRM Test, an administrator sees whether Sale, Rental, Off-plan and
  Commercial have an active version; creates a draft using only governed business-line choices
  and clearly labelled factor cards; reorders, tests and approves it; activates it with visible
  confirmation; and then successfully assesses a matching lead. A nonmatching/no-active case
  identifies the business line and directs activation without technical wording.

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

### R1-AMD-011 Revision 4: Team-derived reporting manager

- Amendment ID: R1-AMD-011 Revision 4
- Related UAT finding: R1-UAT-010
- Agreed requirement: The Manager maintained against a Team is the single authoritative
  reporting manager for all active users assigned to that team. User Management derives
  and displays `Reports to` for team members and `Manages` for the manager; it does not
  duplicate the relationship with a separately editable agent-manager field. Assigning
  a Manager role to an unmanaged team establishes the team manager, while a conflicting
  second Manager is blocked and must be handled as an intentional replacement in Team
  maintenance. Existing unambiguous team/Manager assignments are reconciled without
  arbitrarily selecting among conflicting records.
- Status: Implemented locally with migration `024_team_reporting_lines.sql` and verified
  by 102 automated tests; CRM Test deployment, retest and explicit confirmation remain
  pending. R1-UAT-010 remains open.
- Retest condition: On CRM Test, Addi is the maintained Manager of Core Sales Team and
  Ajitr is a Sales Agent in that team. User Management shows that Addi manages Core
  Sales Team and Ajitr reports to Addi without a separate per-agent mapping. Moving
  Ajitr to another team changes the derived reporting line. A second Manager assignment
  is rejected until the manager is deliberately replaced through Team maintenance, and
  the user explicitly confirms the result.

### R1-AMD-011 Revision 5: Structure-first manager hierarchy

- Amendment ID: R1-AMD-011 Revision 5
- Related UAT finding: R1-UAT-010
- Agreed requirement: A Team Manager dashboard must show every active team the signed-in
  manager is maintained to manage and every active Sales Agent or Listing Agent assigned
  to those teams, even when the selected reporting period contains no leads. Organization
  structure is not period activity. Display the maintained team, manager and agents first,
  then show each agent's lead count for the selected period, including zero. Use a team-
  assignment correction message only when the manager genuinely has no maintained team.
- Status: Implemented locally and verified by 103 automated tests; CRM Test deployment,
  retest and explicit confirmation remain pending. R1-UAT-010 remains open.
- Retest condition: On CRM Test, sign in as Aadi while Aadi is the maintained Manager of
  CORE Test Sales Team and Ajitr is its active Sales Agent. With a period containing no
  leads, the hierarchy still shows CORE Test Sales Team, Manager Aadi and Ajitr with zero
  leads in the selected period. Selecting Ajitr narrows the manager workspace correctly.
  The user explicitly confirms the result.

### R1-AMD-011 Revision 6: Agent reporting context

- Amendment ID: R1-AMD-011 Revision 6
- Related UAT finding: R1-UAT-010
- Agreed requirement: An Agent dashboard must identify the signed-in user's maintained
  primary team and that team's maintained reporting manager. This is a compact personal
  organization context, not a manager hierarchy: an Agent must not see other team members
  or manager-only drill-down controls. The displayed reporting line is derived from Team
  maintenance and is not separately editable on the Agent dashboard.
- Status: Implemented locally and verified by 104 automated tests; CRM Test deployment,
  retest and explicit confirmation remain pending. R1-UAT-010 remains open.
- Retest condition: On CRM Test, sign in as Ajitr. The Agent dashboard shows `My team:
  CORE Test Sales Team` and `Reports to` with the manager currently maintained against
  that team. It does not expose other agents or the Team -> Agent -> Lead manager
  hierarchy. The user explicitly confirms the result.

### R1-AMD-011 Revision 7: Role-aware reporting structure

- Amendment ID: R1-AMD-011 Revision 7
- Related UAT finding: R1-UAT-010
- Agreed requirement: Display maintained reporting structure consistently at the top
  right of each operational dashboard. A Managing Director sees every direct-report Team
  Manager together with the maintained unit/team name. A Team Manager sees every active
  reporting Sales Agent and Listing Agent together with the unit/team name. An Agent sees
  the maintained line manager and unit/team name. Each role sees only its own reporting
  scope; this context does not grant broader record access or expose manager drill-down
  controls to Agents. Reporting relationships remain derived from Team maintenance.
- Status: Implemented locally and verified by 104 automated tests; CRM Test deployment,
  retest and explicit confirmation remain pending. R1-UAT-010 remains open.
- Retest condition: On CRM Test, confirm the top-right reporting panel independently as
  Managing Director, Team Manager and Agent. The Director lists direct-report managers
  with units, the Manager lists reporting agents with units, and Ajitr lists the maintained
  line manager with CORE Test Sales Team. Confirm that each list remains visible when the
  selected period contains no activity and that no role gains records outside its scope.

### R1-AMD-011 Revision 8: Authoritative reporting lookup and upward manager line

- Amendment ID: R1-AMD-011 Revision 8
- Related UAT finding: R1-UAT-010
- Agreed requirement: Resolve an Agent's reporting team from the maintained broker team,
  active primary role assignment or active team membership so the dashboard agrees with
  User Management. Every active Team Manager automatically reports to the single active
  Managing Director at company level, while the Manager also sees all reporting Agents.
  A versioned browser/server reporting-context contract must identify a stale application
  worker instead of incorrectly instructing the user to change valid maintenance data.
  When maintenance is genuinely missing, name the exact Administration paths: CRM teams
  and User Management.
- Status: Implemented locally and verified by 104 automated tests; CRM Test deployment,
  retest and explicit confirmation remain pending. R1-UAT-010 remains open.
- Retest condition: On CRM Test, Ajitr's dashboard agrees with User Management and shows
  Aadiyya with CORE Test Sales Team. Aadiyya's Manager dashboard shows the active Managing
  Director under `Reports to` and the Agents assigned to Aadiyya's managed teams under
  `My reporting agents`. The Director sees the maintained managers with unit names. No
  dashboard displays a false maintenance warning, and the user explicitly confirms.

### R1-AMD-011 Revision 9: Explicit Manager-to-Director reporting

- Amendment ID: R1-AMD-011 Revision 9
- Related UAT finding: R1-UAT-010
- Agreed requirement: Manager and Director remain permission roles, while `Reports to`
  is an explicit governed organization relationship. User Management provides each active
  Manager with a `Reports to Director` selector restricted to active Managing Directors.
  Director dashboards show only Managers explicitly assigned to that Director; Manager
  dashboards show the maintained Director upward and team-derived Agents downward. When
  exactly one active Managing Director exists, migration `025` safely backfills all active
  Managers; it must not guess when the Director is ambiguous.
- Status: Implemented locally and verified by 105 automated tests; CRM Test deployment,
  migration, retest and explicit confirmation remain pending. R1-UAT-010 remains open.
- Retest condition: On CRM Test, User Management shows Aadiyya's `Reports to Director`
  selector set to Sunita Sinha. Aadiyya's dashboard shows Sunita under `Reports to`, and
  Sunita's dashboard shows Aadiyya with every unit Aadiyya manages. Changing the selector
  updates both dashboards without changing Manager or Director permissions. The user
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

### R1-AMD-014 Revision 3: Complete AI runs with governed audit evidence

- Amendment ID: R1-AMD-014 Revision 3
- Related UAT finding: R1-UAT-015
- Agreed requirement: Permit `AiAssistanceRun` in the governed audit entity constraint
  so a schema-valid provider response can be recorded as completed with its safe audit
  metadata. Retain the existing rule that raw prompts, generated output and credentials
  are never written to the audit log.
- Status: Implemented locally and verified by the complete automated test suite; CRM
  Test deployment, live functional retest and explicit user confirmation remain pending.
- Retest condition: On CRM Test, migration 019 is recorded; generating a structured-
  requirement suggestion returns reviewable advisory output; its run is `completed` with
  a provider response ID; an `AiAssistanceRun` completion audit exists without raw input
  or output; and the user explicitly confirms the result.

### R1-AMD-014 Revision 4: Review-first proposal highlights and suitability drafting

- Amendment ID: R1-AMD-014 Revision 4
- Related UAT finding: R1-UAT-015
- Agreed requirement: In Proposal builder, let the user first review and select a
  deterministic system shortlist, then use the existing governed match-explanation
  service to draft editable highlights, suitability, value rationale and material
  trade-offs for those selected properties. AI must use only the recorded requirement
  and inventory evidence; it must not rank or select properties, alter the transparent
  match score, choose media, save proposal content or generate a proposal. Preserve the
  separate missing-information check and require a distinct user Generate action after
  all AI wording has been reviewed or amended.
- Status: Implemented locally and verified by automated tests; CRM Test deployment,
  provider-backed retest and explicit user confirmation pending.
- Retest condition: On CRM Test, select a reviewed shortlist, generate highlights and
  suitability, confirm the draft cites the selected Inventory IDs and contains no
  unsupported facts, edit the wording, run the missing-information check, and confirm
  no proposal record or version changes until the user deliberately generates the
  immutable draft. Closure requires the user's explicit confirmation.

### R1-AMD-015 Revision 1: Model-driven operational lead qualification

- Amendment ID: R1-AMD-015 Revision 1
- Related UAT finding: R1-UAT-016
- Agreed requirement: Treat Hot/Warm/Cold as the output of the active approved Lead
  Qualification Version rather than a routine manual input. Start leads as Unassessed,
  render business questions and governed answer controls, calculate and explain the
  weighted result, restrict overrides to authorized users with a reason, and preserve
  reassessment history.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-016 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-016 Revision 1: Business shorthand for lead budget amounts

- Amendment ID: R1-AMD-016 Revision 1
- Related UAT finding: R1-UAT-017
- Agreed requirement: Accept and preview common K/M/B, AED, comma-formatted and full
  amount entries in new-lead and structured-requirement budgets, normalize them to
  exact server-side numeric values, and preserve range validation for every intake path.
- Status: Deployed to CRM Test; lowercase `m` retest failed and Revision 2 is required;
  explicit user confirmation pending
- Retest condition: The R1-UAT-017 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-016 Revision 2: Case-insensitive budget shorthand and browser normalization

- Amendment ID: R1-AMD-016 Revision 2
- Related UAT finding: R1-UAT-017
- Agreed requirement: Accept lowercase and uppercase `k`, `m` and `b` consistently,
  preview their identical interpreted amount, validate the range before submission and
  send the normalized numeric amount to the server.
- Status: Implemented locally with automated lowercase/uppercase parsing, browser
  normalization and route-contract tests; CRM Test deployment, retest and explicit user
  confirmation pending
- Retest condition: Enter `2 M`, `2 m`, `2M`, `2m` and `2.5m` in Budget from/to on CRM
  Test; each displays and stores the intended AED value, invalid/reversed input is rejected
  before submission, and the user explicitly confirms the result.

### R1-AMD-017 Revision 1: Searchable alphabetical existing-customer selection

- Amendment ID: R1-AMD-017 Revision 1
- Related UAT finding: R1-UAT-018
- Agreed requirement: Replace the update-date-ordered existing-contact dropdown with a
  business-labelled customer selector that ranks case-insensitive name/email/phone
  matches first, alphabetizes matching and remaining customers, retains access scope,
  and preserves the selected customer while the search changes.
- Status: Deployed to CRM Test; visible-dropdown retest failed and Revision 2 is required;
  explicit user confirmation pending
- Retest condition: The R1-UAT-018 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-017 Revision 2: Retain the visible alphabetically sorted customer dropdown

- Amendment ID: R1-AMD-017 Revision 2
- Related UAT finding: R1-UAT-018
- Agreed requirement: Retain an always-visible, clearly labelled existing-customer
  dropdown ordered alphabetically. Keep search as a separate optional aid that moves
  matching permitted customers to the top without replacing or hiding the dropdown.
- Status: Implemented locally with browser-contract coverage; CRM Test deployment,
  retest and explicit user confirmation pending
- Retest condition: Open New lead on CRM Test and confirm both Search existing customers
  and Select existing customer are visible. With an empty search, the dropdown is fully
  alphabetical; entering `ajit` moves matching customers first while all permitted
  customers remain selectable; clearing search restores the full alphabetical order.

### R1-AMD-018 Revision 1: Business-friendly originating-property terminology

- Amendment ID: R1-AMD-018 Revision 1
- Related UAT finding: R1-UAT-019
- Agreed requirement: Replace `Related listing` with business language that records the
  property which prompted the enquiry, clearly describes the optional empty state and
  confirms that this reference does not restrict later inventory matching.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-019 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-019 Revision 1: Preferred-area continuity into structured requirements

- Amendment ID: R1-AMD-019 Revision 1
- Related UAT finding: R1-UAT-020
- Agreed requirement: Treat comma-separated preferred areas as distinct normalized
  alternatives, remove case-insensitive duplicates, prefill the first Structured
  requirements version from lead capture, and keep saved structured versions
  authoritative for matching and proposals.
- Status: Deployed to CRM Test; user retest and explicit confirmation pending
- Retest condition: The R1-UAT-020 CRM Test retest condition passes and the user
  explicitly confirms the result.

### R1-AMD-020 Revision 1: Atomic new-customer lead capture and explicit save outcome

- Amendment ID: R1-AMD-020 Revision 1
- Related UAT finding: R1-UAT-021
- Agreed requirement: Commit the new customer, channels, role, lead, initial queue history
  and audit evidence in one transaction; roll everything back on failure; explain
  email/phone duplicate matching; prevent repeat submission; and distinguish committed
  success from a failed creation attempt clearly.
- Status: Deployed to CRM Test; save-button retest failed and Revision 2 is required;
  explicit user confirmation pending
- Retest condition: The R1-UAT-021 CRM Test retest condition passes and the user explicitly
  confirms the result.

### R1-AMD-020 Revision 2: Reliable lead-submit control and visible failure fallback

- Amendment ID: R1-AMD-020 Revision 2
- Related UAT finding: R1-UAT-021
- Agreed requirement: Mark Create lead explicitly as the form submit button, bind the
  repeat-submission guard to that control safely, and display a visible refresh/retry
  message if the expected control is unavailable rather than failing silently before the
  API request.
- Status: Deployed to CRM Test; valid new-customer lead creation succeeded on user retest.
  Remaining R1-UAT-021 rollback/duplicate/count evidence and explicit confirmation pending
- Retest condition: On CRM Test, submit a valid new lead once and verify the button changes
  to Creating lead, exactly one request is made, the lead commits, the success message is
  displayed and the assignment queue contains the lead. Confirm a failed request restores
  the button and displays Lead not created with the server message.

### R1-AMD-021 Revision 1: Dedicated Customer workspace with reusable governed KYC

- Amendment ID: R1-AMD-021 Revision 1
- Related UAT finding: R1-UAT-022
- Agreed requirement: Provide a dedicated role-scoped Customer workspace for the master
  customer profile, roles, channels, address, consent/restrictions, reusable KYC status and
  expiry, private linked documents, duplicate/merge governance, ownership, audit and related
  leads/requirements/activities/proposals/scenarios. Store KYC once against the customer and
  resolve it for every related workflow without copying it into individual leads.
- Status: Implemented locally and verified by automated tests; consolidated CRM Test
  deployment, retest and explicit user confirmation pending
- Retest condition: The R1-UAT-022 CRM Test retest condition passes and the user explicitly
  confirms the result.

### R1-AMD-021 Revision 2: Customer-first navigation and lead relationship direction

- Amendment ID: R1-AMD-021 Revision 2
- Related UAT finding: R1-UAT-022
- Agreed requirement: Make Customers a primary CRM navigation workspace. Customer detail
  owns profile, roles, channels, address, consent/restrictions, verification, KYC, private
  documents, duplicate/merge governance, related records and audit. Show all related leads
  from the customer record. Lead detail must not be the entry point for maintaining KYC;
  it shows a read-only customer/KYC summary and an explicit Open customer record action.
  New-lead capture may perform only the minimum customer selection or quick creation needed
  to link the lead, directing completion and verification to the authoritative customer.
- Status: Agreed; implementation, automated verification, CRM Test deployment, retest and
  explicit user confirmation pending
- Retest condition: From primary CRM navigation, open Customers without first opening a
  lead, locate a customer and maintain verification/KYC there. Confirm that the customer
  displays all related leads, each lead links back through Open customer record, lead detail
  does not independently edit KYC, and two leads resolve the same current customer data.

### R1-AMD-021 Revision 3: Reliable customer master and customer-originated lead/document flow

- Amendment ID: R1-AMD-021 Revision 3
- Related UAT finding: R1-UAT-022
- Agreed requirement: Correct the Customer record failure against the governed consent
  schema. Make the Customer master the operational starting point by allowing an authorized
  user to create a lead with that customer preselected and to maintain one private immutable
  document register containing direct customer documents and documents linked through the
  customer's related leads. Preserve record scope, restricted-document access, authenticated
  downloads, immutable versions and audit evidence.
- Status: Deployed to CRM Test; opening the customer record and loading the customer document
  register were confirmed on 2026-07-18. Customer-originated lead, linked-document and
  restricted-access retest evidence remains pending
- Retest condition: On CRM Test, open the newly created `ajitxxx` customer without an error,
  confirm its KYC/contact/consent summary loads, upload and download an authorized customer
  document, create a lead from the customer action and verify the lead form preselects that
  exact customer without creating a duplicate. Confirm related-lead documents appear in the
  same register and an unauthorized user cannot access a restricted document.

### R1-AMD-021 Revision 4: Readable customer register layout

- Amendment ID: R1-AMD-021 Revision 4
- Related UAT finding: R1-UAT-022
- Agreed requirement: Present every Customer-register row as clearly separated primary and
  secondary information. Customer/address, email/phone/channel, role/company and KYC/expiry
  must not run together. Keep stable column widths, readable spacing and horizontal scrolling
  at narrower browser widths without compressing the action control.
- Status: Deployed to CRM Test and explicitly accepted by the user on 2026-07-18 for the
  readable customer-register layout; broader R1-UAT-022 evidence remains open
- Retest condition: On CRM Test, open Customers at normal desktop zoom and confirm every
  primary value and its secondary information render on separate lines with readable spacing;
  narrow the browser and confirm the table scrolls without overlapping or clipping values.

### R1-AMD-021 Revision 5: Standalone customer creation and reliable KYC approval

- Amendment ID: R1-AMD-021 Revision 5
- Related UAT finding: R1-UAT-022
- Agreed requirement: Make Customer Master a genuine operational starting point by exposing
  a prominent standalone Create customer action. Require name, email, international phone and
  preferred channel, perform the existing duplicate review, open the saved customer record and
  leave lead creation optional. Correct KYC persistence so an authorized manager or
  administrator can save a verified review without a PostgreSQL UUID type error.
- Status: Deployed to CRM Test and explicitly confirmed by the user on 2026-07-18 for
  standalone customer creation and KYC saving; broader R1-UAT-022 evidence remains open
- Retest condition: On CRM Test, create a customer without creating a lead, confirm duplicate
  review and mandatory contact validation, open the saved customer, save pending and verified
  KYC reviews, then optionally create a related lead. Confirm no duplicate customer is produced
  and the KYC audit entry is retained.

### R1-AMD-022 Revision 1: Mandatory customer contact and lead requirement essentials

- Amendment ID: R1-AMD-022 Revision 1
- Related UAT finding: R1-UAT-023
- Agreed requirement: Require name, email, international phone and preferred channel when
  creating a new customer from manual lead capture. Require Budget from, Budget to and at
  least one preferred area for every manually created lead. Apply equivalent API validation;
  for an incomplete existing customer, direct correction to the authoritative Customer
  record rather than accepting lead-specific duplicate data.
- Status: Implemented locally with browser, domain and route-contract verification; CRM
  Test deployment, retest and explicit user confirmation pending
- Retest condition: The R1-UAT-023 CRM Test retest condition passes and the user explicitly
  confirms the result.

### R1-AMD-023 Revision 1: Override an existing qualification without re-answering

- Amendment ID: R1-AMD-023 Revision 1
- Related UAT finding: R1-UAT-016
- Agreed requirement: Separate calculation from manager override. Calculating a new
  assessment requires the approved customer-level answers. An authorized manager or
  Director instead selects Override this result from an existing assessment, chooses a
  different final qualification and records the mandatory reason without re-entering any
  factor answers. Preserve the original calculated score, temperature, inputs and
  contributions; create a separate immutable audited override record and update the lead's
  current qualification.
- Status: Deployed to CRM Test; the user explicitly confirmed that an existing calculated
  result can be overridden with a reason without re-entering qualification answers. Retained
  history and negative authorization/reason checks remain pending before the parent finding
  can close
- Retest condition: On CRM Test, calculate a Warm assessment once, select Override this
  result, change it to Cold with a reason without answering the questions again, and confirm
  history shows both the original calculated assessment and the audited override. Reject an
  override without authority, a different result or a reason.

### R1-AMD-024 Revision 1: Governed and reliable Structured Requirements

- Amendment ID: R1-AMD-024 Revision 1
- Related UAT findings: R1-UAT-015 and R1-UAT-024
- Agreed requirement: Replace free-text Property types with governed inventory-compatible
  choices supporting one or more selections and govern Business line consistently. Normalize
  empty optional bedroom limits to null before persistence so Save new version cannot produce
  a database type error. Validate property choices server-side. Generate suggestions must
  always produce either editable review cards or a persistent, actionable error with a safe
  run reference; AI remains advisory and saving remains a separate explicit action.
- Status: Implemented locally and verified by 87 automated tests; CRM Test deployment,
  functional retest and explicit user confirmation pending
- Retest condition: The R1-UAT-024 CRM Test retest condition passes and the user explicitly
  confirms the result.

### R1-AMD-024 Revision 2: Full-width saved requirement summary

- Amendment ID: R1-AMD-024 Revision 2
- Related UAT finding: R1-UAT-024
- Agreed requirement: Display every saved Structured Requirement version as a full-width,
  readable summary card. Do not reuse the three-column activity-row layout, which places the
  only content in its narrow marker column and causes words, dates and values to wrap vertically.
- Status: Implemented locally and verified by automated layout-contract tests; CRM Test
  deployment, visual retest and explicit user confirmation pending
- Retest condition: On CRM Test, save and reopen a requirement and confirm its version,
  business line, purpose, funding, timeline, date, areas and property types read horizontally
  in a full-width card without overlap, clipping or narrow-column wrapping.

### R1-AMD-025 Revision 1: Increase interface typography by 15%

- Amendment ID: R1-AMD-025 Revision 1
- Related UAT finding: R1-UAT-025
- Agreed requirement: Increase all maintained browser font-size declarations by exactly
  15% while retaining the existing information hierarchy, responsive layouts and workflow
  behavior. Validate dense tables, forms, modals, navigation, dashboards, AI review cards
  and proposal previews for clipping and overlap.
- Status: Deployed to CRM Test and explicitly confirmed by the user on 2026-07-18. Amendment
  and related finding are closed.
- Retest condition: The R1-UAT-025 CRM Test retest condition passes and the user explicitly
  confirms the typography before closure.

### R1-AMD-026 Revision 1: Business-friendly immutable financial scenarios

- Amendment ID: R1-AMD-026 Revision 1
- Related UAT finding: R1-UAT-026
- Agreed requirement: Replace raw JSON with distinct mortgage-affordability and investment-
  return forms, linked-property prefilling, business amount shorthand, clear calculated results,
  approved fee-rule/assumption evidence and an acknowledgement that outputs are indicative.
  Preserve saved inputs and outputs as immutable proposal-ready snapshots.
- Status: Implemented locally and verified by automated tests; CRM Test deployment, functional
  retest and explicit user confirmation pending.
- Retest condition: The R1-UAT-026 CRM Test retest condition passes and the user explicitly
  confirms the result.

### R1-AMD-026 Revision 2: Fee-rule readiness and review-before-save calculations

- Amendment ID: R1-AMD-026 Revision 2
- Related UAT finding: R1-UAT-026
- Agreed requirement: Before accepting financial inputs, show whether an approved Regulatory
  and Fee Assumption version is active and identify the Administration maintenance action when
  it is missing. Separate calculation from persistence: Calculate and review must show the
  monthly EMI, loan amount, down payment, LTV, DBR when income is supplied, total interest,
  total repayment, upfront cash and applicable fee estimate before Save immutable snapshot is
  available. Investment scenarios must similarly preview gross yield, net yield, cash-on-cash
  return, effective rent, net income and applicable fees. Bind the save to the exact assumption
  version reviewed and require recalculation if that active version changes.
- Status: Implemented locally and verified by automated calculation, route and browser-contract
  tests; CRM Test deployment, authenticated retest and explicit user confirmation pending.
- Retest condition: On CRM Test with no active assumption version, the form is blocked before
  data entry and directs the administrator to approve and activate one. After activation, enter
  the screenshot mortgage example, calculate without saving, verify EMI/LTV/DBR and fee output,
  confirm the disclaimer, save once, reopen the scenario and verify the immutable values and
  exact assumption version. Change an input and verify a fresh preview is required. Closure
  requires the user's explicit confirmation.

### R1-AMD-027 Revision 1: Governed private lead document register

- Amendment ID: R1-AMD-027 Revision 1
- Related UAT finding: R1-UAT-027
- Agreed requirement: Replace the upload-only popup with a scoped document register and
  immutable version history; provide maintained document types and explained source/use,
  classification, status, approved-template and recipient controls; enforce valid combinations
  and restricted-file access; and separate signed Marketing Agreement upload from the deliberate
  recording of consent channels and dates.
- Status: Implemented locally and verified by automated tests; CRM Test deployment, security/
  functional retest and explicit user confirmation pending.
- Retest condition: The R1-UAT-027 CRM Test retest condition passes and the user explicitly
  confirms the result.

### R1-AMD-028 Revision 1: Business-friendly lead action plan

- Amendment ID: R1-AMD-028 Revision 1
- Related UAT finding: R1-UAT-028
- Agreed requirement: Explain tasks as future work distinct from completed Activities; display
  assignee, priority, deadline, instructions, status and outcome; support start, complete and
  reasoned cancellation; and restrict selection of another owner to an authorized leader.
- Status: Implemented locally and verified by automated tests; CRM Test deployment, functional
  retest and explicit user confirmation pending.
- Retest condition: The R1-UAT-028 CRM Test retest condition passes and the user explicitly
  confirms the result.

### R1-AMD-028 Revision 2: Visible personal task workspace

- Amendment ID: R1-AMD-028 Revision 2
- Related UAT finding: R1-UAT-028
- Agreed requirement: Every internal CRM user with assigned work must have an obvious Tasks entry
  in the primary navigation and a My tasks action on the role dashboard. The personal workspace must
  show only tasks assigned to the signed-in user, support open, overdue, due-today, upcoming and
  completed views, allow business-text search, and provide lead drill-down, Start, Complete and
  reasoned Cancel actions. Dashboard task counts remain summaries and must not substitute for the
  underlying actionable queue.
- Status: Implemented locally and verified by 101 automated tests; CRM Test deployment, functional
  retest and explicit user confirmation pending.
- Retest condition: On CRM Test, sign in separately as Agent, Team Manager, Managing Director and
  Administrator. Confirm Tasks is visible, each user sees only personally assigned tasks, filters and
  search work, and permitted status actions update the queue and lead action plan. Confirm another
  user's task cannot be obtained or changed. Explicit user confirmation is required before closure.

### R1-AMD-028 Revision 3: Keep My tasks inside the role dashboard

- Amendment ID: R1-AMD-028 Revision 3
- Related UAT finding: R1-UAT-028
- Agreed requirement: Supersede the separate primary-navigation Tasks screen and the dashboard
  shortcut that replaces the user's role context. Present My tasks as a dashboard tab alongside the
  role's other dashboard tabs. Selecting it must retain the authenticated role header, dashboard
  actions and tab strip while showing the same personally scoped, searchable status queue. Provide
  My dashboard and My tasks tabs for Agents; Team performance, Proposal approvals and My tasks for
  Team Managers; and the applicable executive tabs plus My tasks for Managing Directors and
  Administrators. Do not give Administrators business-approval access through this layout change.
- Status: Implemented locally and verified by 101 automated tests; CRM Test deployment, visual/
  functional retest and explicit user confirmation pending.
- Retest condition: On CRM Test, sign in separately as Agent, Team Manager, Managing Director and
  Administrator. Confirm My tasks appears in the role-dashboard tab strip, selecting it retains the
  same named role dashboard header, and the standalone top-level Tasks tab and separate My tasks
  shortcut are absent. Confirm task filters, search, returned-proposal actions and role scoping still
  work. Explicit user confirmation is required before closure.

### R1-AMD-029 Revision 1: Secure administrator-assisted password recovery

- Amendment ID: R1-AMD-029 Revision 1
- Related UAT finding: R1-UAT-033
- Agreed requirement: Provide Forgot password and Set new password paths on the sign-in screen.
  Prevent account enumeration by returning an identical request response for every email. Because
  Release 1 has no live email connector, place valid requests in Administrator-only User Management,
  where an Administrator can issue a cryptographically random, 30-minute one-time code for private
  out-of-band delivery. Store only the code hash; require password confirmation and the existing
  minimum length; invalidate the code and all active sessions after use; audit issue, cancellation
  and completion actions. Admin Assistant must not access reset codes or requests.
- Status: Implemented locally with migration `021_password_reset_requests.sql`, API/browser contract
  tests and session-revocation controls; CRM Test deployment, security retest and explicit user
  confirmation pending.
- Retest condition: The R1-UAT-033 CRM Test retest condition passes and the user explicitly confirms
  the workflow before closure.

### R1-UAT-034: Administration entry-form alignment after production promotion

- Date raised: 2026-07-19
- Environment observed: `https://crm.nysarealty.com/`
- Area: Administration -> Controlled Values, Business Hours & SLA, Lead Routing &
  Queues, and CRM Teams
- Status: Closed on CRM Test. The alignment package based on commit `33d5ef4` was
  deployed and the user explicitly confirmed on 2026-07-19 that CRM Test is fine.
  Production promotion remains a separate deployment action.
- Priority: High presentation correction; no database or business-rule change
- Evidence: Production smoke-test screenshots show labels, inputs, contextual help and
  action buttons using different vertical baselines. Help text changes the height of
  individual flex items, routing secondary actions wrap into an ambiguous row, and
  team/SLA actions do not consistently align with their related controls.
- Required correction: Use explicit responsive grids for these four entry forms,
  preserve equal label/control baselines, group primary actions with the form, keep
  routing defaults as a distinct secondary action, and collapse to an unambiguous
  single-column layout on narrow screens.
- Retest condition: On CRM Test at desktop and narrow widths, open all four maintenance
  areas and confirm labels and controls align, help text stays below its own control,
  primary actions remain clearly associated with the form, and no control or action
  overlaps, clips or wraps into an unexplained position. Explicit user confirmation is
  required before closure and before any production hotfix.

### R1-AMD-030 Revision 1: Align administration entry forms

- Amendment ID: R1-AMD-030 Revision 1
- Related UAT finding: R1-UAT-034
- Agreed requirement: Present Controlled Values, Business Hours & SLA, Lead Routing
  and CRM Teams entry controls in dedicated responsive grids. Give labels a common
  baseline, keep help text under the related field, align primary action groups with
  the control row, and place Configure Dubai defaults on its own clearly identified
  secondary row. Preserve all existing validation, APIs, governance and data.
- Status: Implemented; 107 automated tests passed, CRM Test deployment completed and
  the user explicitly accepted the visual retest on 2026-07-19. Production promotion
  remains pending.
- Retest condition: The R1-UAT-034 CRM Test retest condition passes and the user
  explicitly confirms the alignment before production promotion.

### R1.1-UAT-021: Sales Agent customer register returns an internal error

- Date raised: 2026-07-21
- Environment observed: `https://crm-test.nysarealty.com/`
- Area: Sales Agent -> Customers and standalone customer creation
- Status: First correction deployed to CRM Test, but authenticated retest failed with
  PostgreSQL `42601` at `ORDER BY`. R1.1-AMD-008 Revision 1 is implemented locally;
  redeployment, authenticated retest and explicit user confirmation are pending. The
  finding remains open.
- Priority: High operational correction
- Evidence: The Sales Agent customer workspace returned `Internal server error` while
  loading `GET /api/crm/contacts`, before the standalone customer flow could complete and
  reopen the saved record.
- Required correction: Preserve the existing owner/lead Sales Agent scope while resolving
  permitted customer IDs independently of optional display joins and lead counts. The
  resulting customer register must include a newly created, agent-owned customer even when
  it does not yet have a lead and must not expose unrelated customers.
- Related amendment: R1.1-AMD-008
- Failed-retest diagnosis: The Sales Agent branch of `contactScopeSql` closed its nested
  assigned-to/created-by group and `EXISTS` subquery but not the outer owner-or-lead
  expression. The route therefore appended `ORDER BY` to incomplete SQL. Revision 1 adds
  the missing parenthesis and a balance regression assertion.
- Retest condition: On CRM Test, complete the no-search, search, standalone-create,
  immediate-open, related-lead and cross-agent denial checks recorded under R1.1-AMD-008.
  Explicit user confirmation is required before closure.

### R1.1-UAT-022: Opened leads have no clear customer-to-outcome lifecycle

- Date raised: 2026-07-21
- Environment observed: `https://crm-test.nysarealty.com/`
- Area: Lead detail
- Status: Correction implemented locally; CRM Test deployment, visual/functional retest
  and explicit user confirmation pending. The finding is open.
- Priority: High workflow-clarity correction
- Evidence: An opened lead exposes a Stage selector but does not visually explain the
  Customer -> Lead -> Contacted -> Qualified -> Viewing -> Negotiation -> Won progression,
  does not separate Lost as a terminal outcome and does not clarify that sibling leads for
  one customer may be at different stages.
- Required correction: Add a selected-lead lifecycle tracker that highlights the current
  stage, keeps Lost separate and explains the customer-to-many-leads relationship without
  combining sibling-lead histories.
- Related amendment: R1.1-AMD-009
- Retest condition: On CRM Test, complete every-stage, Lost, same-customer/multiple-lead
  and responsive-layout checks recorded under R1.1-AMD-009. Explicit user confirmation is
  required before closure.

### R1.1-UAT-023: Sales Agent lead form fails while loading company scope

- Date raised: 2026-07-21
- Environment observed: `https://crm-test.nysarealty.com/`
- Area: Sales Agent -> customer -> Create lead
- Amendment ID: R1.1-AMD-008 Revision 2
- Related UAT finding: R1.1-UAT-023
- Agreed requirement: A Sales Agent must be able to open and save a valid lead for an
  accessible customer regardless of whether KYC is unverified or pending review. The
  company lookup must use complete, parameterized owner/related-lead scope SQL and must not
  expose unrelated companies.
- Status: Open. CRM Test logged PostgreSQL `42601` at `src/routes/crm.js:155` while
  `GET /api/crm/companies` appended `ORDER BY` to an unclosed `companyScopeSql` predicate.
  The failure occurs before lead creation and is not expected KYC behaviour. The correction
  is implemented locally; deployment, retest and explicit confirmation are pending.
- Retest condition: Deploy the committed correction to CRM Test, fully replace the worker,
  open Create lead for Ajit's unverified customer, save one valid lead and confirm there is
  no new `42601` log entry or duplicate/partial lead. Verify unrelated-company denial and
  obtain explicit user confirmation before closure.

### R1.1-UAT-024: Manager has no actionable pending KYC review queue

- Date raised: 2026-07-21
- Environment observed: `https://crm-test.nysarealty.com/`
- Area: Manager dashboard and Customer KYC
- Amendment ID: R1.1-AMD-010
- Related UAT finding: R1.1-UAT-024
- Agreed requirement: Provide a distinct Manager KYC reviews queue scoped to pending
  customers owned by active members of maintained teams. Open the customer from the queue
  and allow the scoped Manager or Administrator—not the Sales Agent—to record an audited
  verified, rejected or expired decision using masked identity details only.
- Status: Open. The current server names Manager approval as required but its owner-only
  authorization prevents a non-owner Manager from acting, and no dashboard queue exposes
  pending work. The correction is implemented locally; deployment, authenticated scope and
  decision retest, and explicit user confirmation are pending.
- Retest condition: Submit Ajit's customer for review; confirm Ajit's maintained Manager
  sees and decides it, the item leaves the pending queue, an unrelated Manager is denied,
  and Ajit cannot self-verify. Confirm lead creation is independent of KYC approval. Explicit
  user confirmation is required before closure.

### R1.1-UAT-025: Customer-originated lead capture repeats customer identity input

- Date raised: 2026-07-21
- Environment observed: `https://crm-test.nysarealty.com/`
- Area: Customer Master -> Create lead for this customer
- Amendment ID: R1.1-AMD-011
- Related UAT finding: R1.1-UAT-025
- Agreed requirement: Carry the opened customer's identifier into lead capture as a locked
  Customer Master reference. Show the existing identity/contact/KYC summary read-only and
  suppress customer search, selection and new-customer inputs. Persist only a new lead linked
  to the existing customer; never duplicate or re-key customer identity in this path.
- Status: Open. The form currently preselects the customer in a general-purpose dropdown but
  still presents customer selection/identity controls. The integrated correction is
  implemented locally; CRM Test deployment, retest and explicit confirmation are pending.
- Retest condition: Open Ajit's customer, create and save a lead without entering customer
  identity, and confirm one lead links to the same customer ID with no duplicate customer.
  Explicit user confirmation is required before closure.

#### R1.1-AMD-011 Revision 1: Clarify Lead pipeline search scope

- Amendment ID: R1.1-AMD-011 Revision 1
- Related UAT finding: R1.1-UAT-025
- Agreed requirement: Replace the misleading `Lead or customer name` placeholder with
  existing-lead wording and explain that a Customer Master record enters the pipeline only
  after its first lead is created. Customer Master remains the entry point for zero-lead
  customers.
- Status: Implemented locally. CRM Test deployment, Manoj before/after-lead retest and
  explicit user confirmation are pending; the finding remains open.
- Retest condition: Confirm the corrected wording, confirm Manoj with zero leads is not
  represented as a pipeline lead, create Manoj's first lead from Customer Master, and confirm
  the linked lead is then returned when searching Manoj. Explicit confirmation is required.

## Review discipline

For every new test observation:

1. Assign the next `R1-UAT-###` identifier.
2. Record environment, evidence, priority, required correction and retest condition.
3. Link the finding to the relevant acceptance criterion.
4. Do not mark it closed until CRM Test retest is explicitly confirmed by the user.
5. Include all open findings in the Release 1 acceptance decision.
