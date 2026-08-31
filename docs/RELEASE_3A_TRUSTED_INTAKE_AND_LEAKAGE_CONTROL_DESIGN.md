# Release 3A Design - Customer Intelligence, Trusted Intake and Broker Action

Status: Approved for phased development  
Design date: 2026-07-31  
Environment path: local implementation → CRM Test development/UAT → frozen R2-clone acceptance → Production  
Governing outcome: **broker speed with accuracy**

Environment governance follows `ENVIRONMENT_AND_RELEASE_PROMOTION_POLICY.md`. The R2 clone is a
final-acceptance environment, not the day-to-day development environment.

## 1. What Release 3A will achieve

Release 3A will deliver a usable customer-to-broker-action loop. It will make every incoming enquiry
visible, traceable and owned; build a concise Customer 360 profile; explain what is important now;
and give the broker reviewed AI-suggested actions that open the correct governed workflow.

It will also help a broker understand whether contact information looks credible, prevent
accidental duplicate Customers or Leads, route the work to the right team, start the correct
response clock and show managers any enquiry that is not progressing.

It also creates the controlled campaign identity and first-party profile needed by Release 3B AI
Inventory matching. Release 3A provides AI customer summaries and next-best-action suggestions;
it does not yet perform the deeper eligible-Inventory ranking of Release 3B or native WhatsApp
delivery of Release 3D.

The five frozen capabilities are:

| Requirement | Plain-language outcome |
|---|---|
| `R3A-INTAKE-EMAIL-42` | Explain whether an email looks usable and credible without claiming that the person is verified. |
| `R3A-DUPLICATE-43` | Reuse the correct Customer and avoid creating the same enquiry twice. |
| `R3A-LEAKAGE-44` | Give every enquiry an accountable queue or broker, a clock and a recoverable next action. |
| `R3A-CAMPAIGN-45` | Replace free-text campaign names with controlled campaign identities while retaining the original source evidence. |
| `R3A-PROFILE-46` | Deliver a usable Customer 360 view of the client, their needs, relationship, active pursuits and engagement with NYSA. |
| `R3A-BROKER-PRIORITY-46A` | Give the broker one time-sensitive landing screen that clearly explains what to do first and why. |
| `R3A-AI-ACTION-46B` | Suggest practical next actions from governed Customer evidence and let the broker execute or dismiss them with one controlled step. |
| `R3A-WEBSITE-PROFILE-46C` | Ingest approved profile/requirement outputs from NYSA website tools without duplicate entry and show their source clearly. |

### Definition of end-to-end and ready to use

Release 3A will not be accepted merely because tables, APIs or screens exist. At least one approved
NYSA website journey must work as follows:

1. The customer submits the website form or profiling tool once.
2. CORE authenticates and accepts the event without duplication.
3. The correct existing Customer is reused or a governed new Customer is created.
4. A Lead, source evidence, requirement evidence, ownership and SLA clock are created together.
5. The Customer appears on the correct broker/manager landing screen at the correct priority.
6. The broker opens one Customer 360 screen and sees the client brief, active need, missing facts,
   relevant pursuit and reason for urgency.
7. CORE presents safe next-action suggestions with evidence.
8. The broker accepts, edits or dismisses a suggestion. Acceptance opens or creates the governed
   call, task, requirement, matching or follow-up action; it does not merely display advice.
9. The broker records the outcome, which updates the timeline, next action and future priority.
10. If the broker does not act, the item enters the manager recovery view without manual
    reconciliation.

## 2. What already exists

The current application already provides important **technical foundations**, but several are not
yet visible or usable as an end-to-end business capability:

- A signed, size-limited and idempotent website-intake endpoint exists in the application code.
  The NYSA website is not yet connected to it, so this is not currently a live onboarding channel.
- Email normalization and international phone-number validation.
- Exact Customer matching by normalized email or phone.
- A governed Customer duplicate-review queue.
- Database fields can retain source, campaign code, page, form and external event evidence. The
  normal broker screens do not currently present all of this evidence clearly.
- Team/Area routing, assignment offers, acceptance and first-contact SLA clocks.
- Timed-out assignment recovery with immutable assignment history.
- Task, no-next-action, SLA-risk and SLA-breach dashboard evidence.
- Immutable Lead-to-Opportunity campaign/source attribution.

Release 3A will connect, expose and strengthen these foundations. It will not claim that a backend
field or unused endpoint is an operational capability, and it will not create a separate competing
intake or assignment system.

### Meaning of normalized data

**Normalized** means storing a consistent comparison form while retaining the value entered by the
customer. For example:

- `Ajit@Gmail.com ` becomes `ajit@gmail.com` for duplicate comparison.
- `050 123 4567` with the correct UAE context is stored in international form such as
  `+971501234567` for matching and communication.
- Different spellings or free-text locations are mapped to an approved Area identity where the
  evidence is sufficient.

Normalization does not mean changing the customer's name or inventing missing information. The
original submitted value remains available as evidence.

## 3. Intended user journey

### Step 1 - Receive the enquiry safely

NYSA's actual website forms will be mapped to a documented intake contract. The website server,
not browser JavaScript containing a visible secret, submits the enquiry to CORE. The server first
authenticates the source and preserves the original event identifier and payload hash. Repeating
the same event does not create a second Lead.

The initial connection work will identify every approved website lead form and map its customer,
requirement, source, campaign, page, form, property and consent fields. The website must generate a
stable unique event ID and send the applicable consent-statement version. The connection will be
proved first in CRM Test, then repeated unchanged against the frozen candidate on the R2 clone
before any production activation.

Invalid or temporarily unavailable enrichment services must never cause the enquiry to disappear.
The event will either create governed work or enter a visible intake-attention queue with a precise
reason.

### Step 2 - Check contact quality

The system performs quick deterministic checks:

1. Normalize the email and phone.
2. Validate email syntax.
3. Check whether the email domain can normally receive mail using a time-limited DNS lookup.
4. Compare the domain with a controlled disposable/temporary-email risk list.
5. Flag obvious placeholder or role-address patterns for review.

The result will use understandable labels such as:

- **Confirmed by customer** - separate evidence confirms the channel.
- **Credible domain** - format and domain checks passed; the person is not verified.
- **Review advised** - disposable, placeholder or conflicting evidence was found.
- **Check unavailable** - the external/domain check timed out; the Lead remains accepted.
- **Invalid format** - the value cannot be used as an email address.

The detailed reason and check time will be visible. A warning will not silently reject a Lead when
a usable phone number or another valid contact route exists.

### Step 3 - Reuse the right Customer and control duplicates

The system applies these rules in order:

1. The same authenticated external event ID returns the existing result.
2. An exact normalized email and phone match reuses the existing Customer.
3. If email matches one Customer and phone matches another, the event enters an identity-conflict
   review queue. The system does not guess or merge the Customers.
4. A name-only or other approximate match is a warning, never an automatic merge.
5. For the same Customer, the system checks whether an open Lead already represents the same
   source/property/campaign and materially similar requirement within the controlled review
   window.
6. A materially different requirement creates another Lead for the same Customer. One person can
   legitimately have several enquiries.

An unresolved possible duplicate remains an accountable intake work item with an SLA clock. A
Manager chooses **use existing Lead**, **create a distinct Lead**, or **reject as invalid**, and must
record a reason. The original submission remains immutable.

### Step 4 - Route and start accountability

The current controlled routing policy remains authoritative. Source, business line and primary Area
select the team queue. If no rule matches, the enquiry enters the visible company fallback queue;
it is never assigned silently to an arbitrary broker.

The accountable state will always be one of:

- awaiting intake/duplicate review;
- awaiting manager/team assignment;
- offered to a broker and awaiting acceptance;
- accepted and awaiting first contact;
- active with a next action;
- deliberately paused/nurtured under policy; or
- terminal with a controlled reason.

Every transition retains who acted, when, why and the applicable SLA policy.

### Step 5 - Recover work before it leaks

The Agent sees accepted Leads ordered by urgency. The Manager sees one recovery queue combining:

- unresolved intake or identity conflict;
- unassigned/team-queue ageing;
- assignment acceptance warning or breach;
- first-contact warning or breach;
- active Lead with no next action;
- overdue next action or task;
- repeated reassignment/recycling; and
- failed website intake requiring authorized replay.

The queue will show the exact problem and the permitted recovery action. Recovery is transactional:
for example, reassignment updates the Lead and its selected open Opportunity consistently and
preserves the old owner/history.

### Step 5A - Make the landing screen operational

The broker landing screen will be designed around **time and consequence**, not around generic KPI
cards. It will answer three questions immediately:

1. What must I do now?
2. Why is it ahead of my other work?
3. What exact action opens the correct record?

The proposed order is:

1. **Immediate attention** - breached first-contact clocks, overdue critical actions, today's
   viewings needing confirmation, expiring reservations/offers and a pursuit affected by newly
   unavailable Inventory.
2. **New enquiries** - recently received website/manual leads awaiting acceptance or first contact,
   ordered by remaining response time.
3. **Due today** - calls, follow-ups, viewings, offer responses and other committed actions.
4. **High-potential opportunities** - AI-assisted prioritization inside the safe time band, based on
   governed qualification, requirement readiness, recent engagement and eligible Inventory fit.
5. **Waiting and monitor** - customer/provider responses that are not yet overdue, clearly separated
   so they do not hide actionable work.

Each work card will show:

- Customer name and Lead/Opportunity reference.
- Current status and historical qualification separately.
- The required action and one direct action button.
- Deadline plus an understandable countdown such as **38 minutes remaining** or **overdue by 2h**.
- **Why now**, using two or three plain-language reasons.
- Received time, last substantive interaction and age since that interaction.
- Contact credibility/communication restriction warning.
- Source and governed campaign; page/form details are available in the evidence drill-down.
- Requirement readiness and, after Release 3B, eligible Inventory match count.
- The time at which the priority calculation was last refreshed.

The Agent sees only owned work. Managers see the same priority model across their responsible teams
plus unassigned and recovery work.

### How AI will prioritize without hiding urgent work

A deterministic rules engine first places work into the correct time/consequence band. Hard facts
such as an SLA deadline, confirmed viewing time, offer expiry or missing next action cannot be
overruled by AI.

AI may then rank records **within the same safe band**, summarize the relevant evidence and suggest
the next action. Every suggestion will show **Why AI placed this here** and the evidence used. The
broker can accept, dismiss or correct the suggestion; the decision is recorded. AI cannot suppress
a hard-deadline item, alter a deadline, change status, contact a customer or reserve Inventory.

If AI is unavailable, the rules-based priority screen continues to work. This gives speed without
making the landing page dependent on an external model.

### Step 6 - Use governed campaign identity

Administrators/Directors maintain campaigns with a stable reference, name, owner, objective,
applicable properties, audience, channels, start/end dates, planned budget, status, source IDs and
operational targets.

Incoming enquiries retain the raw campaign value exactly as received. When a controlled mapping
exists, the Lead also links to the governed campaign. An unknown value is accepted but appears in
an **Unmapped campaign** queue. The system never invents a new campaign from free text.

Release 3A reports volume, response, qualification and accepted conversion. It does not calculate
financial CPL, CPA or ROI.

### Step 7 - Present a useful client profile

The Customer screen becomes the primary customer-centric workspace, called **Customer 360**. It
will show a concise first-party profile assembled from authoritative records:

- contact routes and their confidence/verification evidence;
- communication consent and restrictions;
- active and historical Leads and Opportunities;
- original source and governed campaign;
- latest qualification and structured-requirement version;
- last substantive interaction;
- accountable broker/team; and
- current next action and overdue warning.

It will also organize customer-declared information into understandable sections:

- **What the customer wants:** purpose, transaction type, areas, property type, budget, funding,
  timeline and constraints.
- **What matters to the customer:** declared lifestyle/investment priorities, must-haves,
  preferences and acceptable trade-offs.
- **Readiness:** qualification evidence, funding readiness, missing information and decision
  timeline.
- **NYSA relationship:** original source, campaign, prior/active pursuits, properties shared,
  responses, viewings, offers and outcomes.
- **Engagement:** last substantive interaction, response pattern and agreed next action.

This is a governed summary, not a hidden personality score. Facts retain their source and date.
Most values will be calculated from existing records rather than copied into another editable
profile table.

### Step 8 - Provide AI-suggested actions that lead somewhere

AI will receive a deliberately limited Customer evidence packet: current profile facts,
requirements, lifecycle state, deadlines, recent recorded interactions, restrictions and permitted
actions for the user's role. Direct identity/document data that is unnecessary for the suggestion
will be excluded.

Suggestions will come from a controlled action catalogue, for example:

- call the new Lead before the response deadline;
- ask the customer for specific missing requirement information;
- confirm budget/funding readiness;
- review eligible Inventory matches when Release 3B is available;
- prepare a governed shortlist or proposal;
- schedule or confirm a viewing;
- follow up an unanswered offer;
- return to matching after a rejected property; or
- escalate an Inventory availability conflict.

Each suggestion shows **Recommended action**, **Why now**, **Evidence used**, **Confidence/data
gaps** and **What happens if delayed**. The broker can:

- **Do now** - open the correct governed form or create the exact task/activity;
- **Schedule** - create an owned task with a deadline;
- **Edit** - adjust the wording/timing without changing authoritative facts; or
- **Dismiss** - select or record a reason so the same unsuitable suggestion is not repeated
  without new evidence.

AI cannot directly send a message, call a customer, alter Customer facts, change lifecycle stage,
approve KYC, select unavailable Inventory or reserve property. The broker remains responsible.

## 4. Proposed screens

### Agent

- The time-sensitive priority workspace described above becomes the first operational content on
  the landing screen.
- Work cards are customer-centred: the Customer is primary, with each active Lead/Opportunity shown
  as a separate pursuit beneath that Customer.
- A **Customer 360** action opens identity, current needs, relationship history, engagement,
  missing evidence and suggested next actions in one workspace.
- A small **Contact quality** panel on the Lead showing usable channels and warnings.
- A clear **Why this Lead reached me** explanation showing routing evidence.
- One **Next action** control with due time and overdue state.
- A client-profile summary accessible from the Lead without re-entering Customer information.

### Manager

- One **Lead recovery** register, sortable by severity, age, team, broker, source and reason.
- Duplicate/intake-conflict decisions with side-by-side evidence.
- Drill-down from every count to the exact contributing records.

### Administrator/Director

- Campaign maintenance with Draft, Active, Paused, Completed and Retired states.
- External campaign-code mapping and unmapped-value queue.
- SLA/routing configuration remains in the existing governance workspace.

### Layout amendment

The existing module boundaries remain for governance, but they will no longer dictate the normal
broker journey. The proposed navigation hierarchy is:

1. **My work** - time-sensitive customer/action priority screen.
2. **Customers** - Customer 360 register and profile.
3. **Pipeline** - Leads and Opportunities when a broader register is required.
4. **Inventory** - governed property records and later AI matches.
5. **Tasks and calendar** - planned execution.

The landing page will not repeat several disconnected KPI sections before showing actionable work.
Summary counts remain compact and every count drills into the same prioritized customer records.

Proposed simplified layout:

```text
MY WORK                                      Data refreshed 10:32
Immediate 3 | New 5 | Due today 7 | Waiting 4

IMMEDIATE ATTENTION
Customer / pursuit      Why now                  Time          Suggested action
Aisha · NYSA-LD-...     New investment enquiry  38 min left   Call and confirm funding  [Do now]
Omar · NYSA-OP-...      Offer expires today     1h 20m left   Confirm response           [Open]

NEW ENQUIRIES
Customer / source       Contact quality         Requirement   First action
Ravi · Website form     Credible domain          70% complete  Ask timeline              [Do now]

DUE TODAY
Customer / pursuit      Agreed action            Due           Status
...

HIGH-POTENTIAL / WAITING
Separated below actionable work so it cannot hide a deadline.
```

```text
CUSTOMER 360 · AISHA RAHMAN
Owner: Agent A | Contact: permitted | Last interaction: today | Next action: 38 min

NOW                 WHAT THE CUSTOMER WANTS       READINESS
Call before SLA     Investment apartment          Funding confirmation missing

WHY NOW
- Website enquiry received 22 minutes ago
- Preferred area and budget are recorded
- First-contact deadline is approaching

AI-SUGGESTED ACTIONS
1. Call and confirm funding method       [Do now] [Schedule] [Dismiss]
2. Ask whether handover timing is fixed  [Draft question]   [Dismiss]

ACTIVE PURSUITS | REQUIREMENTS | ENGAGEMENT | TIMELINE | DOCUMENTS
```

## 5. Data and technical design

If the design is approved, durable schema will use a new forward migration after migration 061;
migration 061 will not be edited.

The likely additions are:

- Immutable email-credibility assessment records containing outcome, reason codes, check time,
  method and ruleset version.
- Accountable intake-review records for identity conflicts and possible repeated Leads.
- Idempotent leakage-alert/recovery records linked to the Lead or intake event.
- A stable campaign master, versioned campaign changes and external-source mappings.
- A governed campaign link on the Lead while preserving the existing raw campaign code.
- Read models/queries for the client profile and manager recovery register.
- A deterministic priority calculation/read model, plus separately stored AI suggestion evidence,
  broker decision and model/ruleset version.
- A provider-neutral Customer evidence builder and controlled next-action catalogue so AI can only
  suggest actions the current user is permitted to perform.
- Immutable AI-assistance records containing the evidence hash, model/configuration version,
  suggestions, user decision and resulting governed action link.

Credibility checks will run behind a small provider-neutral interface. The first implementation can
use local rules plus DNS with a strict timeout and cache. A commercial verification provider may be
added later without changing the business statuses or screens.

All create/reuse/review/routing actions will be server-enforced and transactional. Browser-only
validation will never be treated as the control.

## 6. Accuracy and safety controls

- Never claim **verified person** from a valid email domain.
- Never probe a mailbox by sending hidden email or attempting intrusive SMTP verification.
- Never discard an enquiry because DNS or a verification provider is unavailable.
- Never auto-merge Customers using a name or fuzzy score.
- Never treat a repeated enquiry as a duplicate merely because the same Customer returned.
- Never overwrite original source, campaign or intake evidence during reconciliation.
- Never auto-create a campaign from an unknown external string.
- Never pause or close a Lead without an authorized action, controlled reason and audit history.
- Never allow AI to push a hard-deadline item below lower-consequence work or hide it from the
  broker.
- Never present AI prose without a usable governed action or an explicit informational label.
- Never infer sensitive traits, wealth, personality or intent that the customer did not declare or
  that NYSA cannot support from recorded first-party evidence.
- Keep Customer restrictions and consent separate from email credibility.
- Apply role and team scope to every register, decision and export.

## 7. Realistic limitations

### Email credibility is not identity verification

A valid format and working mail domain do not prove that the mailbox exists, belongs to the named
person or will accept a message. Catch-all domains, corporate security and anti-spam controls make
perfect mailbox verification unrealistic. Disposable-domain lists also become outdated. The
system will therefore show evidence and confidence, not a false guarantee.

### Duplicate detection cannot be fully automatic

Families can share phone numbers, people can use several emails and names can be written in many
ways. Exact matches can be reused safely in defined cases; ambiguous matches require human review.

### SLA evidence covers activity recorded in CORE

Until connected email, telephony and WhatsApp arrive in Release 3D, CORE cannot know automatically
that a broker contacted a client outside the system. The broker must record the outcome, and the
system can only measure recorded evidence.

### Campaign reporting is operational, not financial

Release 3A can report enquiry and conversion counts. Reliable CPL, CPA and ROI require reconciled
provider spend, closed revenue and commission information and remain Release 6.

### Client profiling uses NYSA first-party facts only

Release 3A will not scrape social media, infer protected/sensitive traits or create psychological
profiles. AI-assisted requirement interpretation and property ranking begin in Release 3B.

### External alerts are deferred

The recovery queue and warnings are available inside CORE. Email, WhatsApp or mobile push alerts
depend on the connected-channel controls in Release 3D.

### AI ranking depends on recorded evidence

AI cannot accurately prioritize from facts that were never captured. Release 3A customer summaries
and action suggestions will be strongest for time urgency, ownership, requirement completeness and
recorded engagement. Requirement-to-Inventory potential becomes materially better only after the
Release 3B matching capability is accepted. The screen will label missing evidence instead of
guessing.

### AI can still be wrong

The model can misunderstand incomplete notes or propose an action that is not commercially useful.
For this reason, permitted actions, hard deadlines and lifecycle controls remain deterministic;
suggestions cite evidence; broker review is mandatory; and dismiss/correction feedback is retained.
The rules-based screen and manual workflows remain available if the AI provider is unavailable.

### Website and AI production readiness require external inputs

End-to-end website activation requires access to the approved NYSA website forms or their payload
specifications, a staging/test path, consent wording/version ownership and secure secret exchange.
Ready-to-use AI suggestions require an approved model/provider configuration, credentials,
retention decision and operating cost limit. Local development can remain provider-neutral, but
production acceptance cannot honestly be claimed without these inputs and an end-to-end test.

## 8. Delivery sequence inside Release 3A

1. **Customer-centred foundation:** Customer 360 evidence model, website mapping contract and
   controlled next-action catalogue.
2. **Data trust:** live website test intake, email credibility evidence, intake conflict handling
   and repeated-Lead review.
3. **Broker control tower:** time-sensitive landing screen, complete accountable states, recovery
   register and drill-down reconciliation.
4. **AI action assistance:** evidence-bound summary/suggestions, broker decision and executable
   governed action links with deterministic fallback.
5. **Campaign/profile completion:** controlled campaigns, website profile ingestion and complete
   first-party Customer 360.
6. **Consolidated verification:** migration rehearsal, full regression suite and R2 clone UAT.

Each internal build remains cumulative. Nothing will be deployed to Production while Release 3A is
being developed or tested.

## 9. Acceptance evidence

| Requirement | Minimum acceptance demonstration |
|---|---|
| `R3A-INTAKE-EMAIL-42` | Send signed test enquiries from each approved NYSA website form into the R2 clone; test credible, malformed, disposable-risk, unavailable-check and phone-only cases; show source/campaign/page/form evidence; prove retries create one Lead and no result claims identity verification. |
| `R3A-DUPLICATE-43` | Replay the same event, reuse an exact Customer, hold an email/phone conflict for review, preserve two genuinely different enquiries and prove no unauthorized merge. |
| `R3A-LEAKAGE-44` | Follow one enquiry from receipt through routing, acceptance and first contact; deliberately breach each clock and reconcile every recovery count to its record and history. |
| `R3A-CAMPAIGN-45` | Map one external campaign ID end to end, retain the original value, place an unknown value in the unmapped queue and prove operational counts reconcile. |
| `R3A-PROFILE-46` | Open one Customer with several Leads/Opportunities and reconcile every displayed profile fact, owner and next action to its authoritative record. |
| `R3A-BROKER-PRIORITY-46A` | Present mixed urgent, new, due-today and waiting work; prove hard deadlines always win, every priority has a plain-language reason, Agent/Manager scopes reconcile and the screen remains usable when AI is unavailable. |
| `R3A-AI-ACTION-46B` | Generate evidence-linked actions for several Customer states; prove Do now/Schedule/Edit/Dismiss work, role/lifecycle controls cannot be bypassed, outcomes feed the timeline and deterministic workflows continue when AI fails. |
| `R3A-WEBSITE-PROFILE-46C` | Ingest one approved website profiling journey, retain the submitted source/version, avoid duplicate entry and reconcile every displayed Customer 360 fact to the received or subsequently confirmed evidence. |

Engineering evidence will include unit tests, PostgreSQL transaction/integration tests, role-scope
tests, static UI regression tests, migration rehearsal, the complete `npm test` suite with exact
totals and an R2 clone traceability table. No capability will be called complete solely because a
screen exists.

## 10. Explicitly deferred

- Deeper eligible-Inventory scoring, comparison and property ranking: Release 3B.
- Governed property showcase and WhatsApp response workflow: Release 3C.
- Native WhatsApp Business, connected email/calendar and provider webhooks: Release 3D.
- Listing-agreement generation and portal publication: Release 4.
- Commission/payment leakage: Release 5.
- Financial marketing ROI and advanced compliance analytics: Release 6.
