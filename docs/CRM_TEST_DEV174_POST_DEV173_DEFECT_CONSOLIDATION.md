# NYSA CORE CRM Test — Post-dev.173 Defect Consolidation

## DEF-121 — Closed Opportunity missing from Receivables handoff — dev.182 candidate ready

Owner reports that the Opportunity handoff did not reach Receivables. Accountant screenshot `codex-clipboard-57f938d7-6487-4b98-9f9a-9c1d4b02d25b.png` shows New commission payment schedule with an Opportunity search box and an unselected Opportunity reference. The owner clarifies that `NYSA-OP-202608-000001 · Sale` was entered manually; it was not returned by the system. No Opportunity result was available, including the newly closed September Opportunity from the preceding UAT evidence. Earlier same-session evidence shows All statuses with zero invoices and no awaiting-invoicing list.

**Human UAT failed on dev.179.** Dev.182 now implements and automatically verifies the Closed Won awaiting-invoicing queue, direct Opportunity carry-forward, finance-only access and cancellation return path. CRM Test deployment and human retest remain pending; no human pass is inferred.

## DEF-117 additional human evidence — Closed Won Opportunity not reflected in pipeline — 4 September 2026

Owner reports that Pipeline at a glance shows an older state instead of the current state. The Opportunity list screenshot shows two `CLOSED WON` Opportunities (`NYSA-OP-202608-000001` and `NYSA-OP-202609-000001`) for synthetic customer `uat173round1`; the dashboard screenshot shows Qualified = 1 and Won = 1. Won drill-down contains one exact Lead and visually combines a Won current pursuit with Qualified/Warm historical classification.

This is a further **human UAT failure on dev.179** for existing DEF-117, not a new defect ID. Dev.182 corrects current-record ranking so Closed Won/Closed Lost outrank older active pursuits and verifies summary/drill-down reconciliation. CRM Test deployment and human retest remain pending; Lead history is not rewritten.

## Owner-approved closure and commission changes — 4 September 2026

- **CR-20260904-01 — Transaction Documents and closure checklist:** Admin-configured government completion documents; clear real-estate labels; no separate seller Customer prerequisite in this step; commission proof is not a closure prerequisite. Related history DEF-112.
- **CR-20260904-02 — Commission Details and Commission Payments:** reuse Opportunity commission/split; separate expected figures, external referral fees and actual receipts; clear Accountant handoff; no finance closure gate. Related history DEF-115/119.
- Exact owner observations, scope, exclusions and acceptance criteria: [change request record](CRM_CHANGE_REQUESTS_20260904_CLOSURE_COMMISSION.md).
- Status: implemented and automated verification passed in the isolated dev.182 candidate; deployment and human retest pending. IDs are change requests, not additional entries in the historical defect count. Prior human results remain unchanged.


## My tasks omits ongoing Opportunity next action — 4 September 2026

Owner: “i am into my task now, i dont see this ongoing work in the task, ideallt it should be there riht”.
Screenshot `codex-clipboard-723a1908-277f-4862-8630-91ec3f61a93c.png` shows My tasks,
Open and in progress, two legacy Warm/Cold Lead follow-up rows, no current Opportunity action.
Exact dev179 source inspection: `public/app.js` renderTaskWorkspace calls
`/crm/tasks?mine=1&bucket=open`; `src/routes/lead-operations.js` queries assigned task rows plus
Manager routed-Lead assignment projections, but does not project current Opportunity next actions.
Confirmed integration/coverage gap in this view, not evidence the Opportunity/reservation was lost.
Expected improvement proposed: assigned current Opportunity next action with reference, stage, due
and direct Open Opportunity; routing must respect Agent/Manager ownership, avoid duplicate tasks,
and not let generic Complete bypass governed booking/closure. Owner asks for expected behaviour;
no implementation/deployment performed or broad business-rule change authorized this turn.
Original follow-up rows must not be cancelled merely because newer Opportunity work exists.
Documentation-only against recorded179 baseline/rollback in `CRM_TEST_DEV179_DEPLOYMENT_COMPLETION.md`.
No new tests, database mutation, migration or live reproduction. Human pass not inferred;
Production/R2/PF untouched; prior package hashes/test observations preserved.



## Reservation versus Inventory status report — 4 September 2026

Owner: “the inventory is reserved but status not updated.” Supplied booking screenshot
`codex-clipboard-b58c5f64-4519-4324-a616-dc99bcd60fbe.png` shows booking
`NYSA-BK-202609-000002`, property label `179invuat1`, Reserved, accepted offer
`NYSA-OF-202609-000002`, Revision2, AED220,000 reservation, starts4 September2026 20:15,
expires11 September2026 20:15, and retained reservation evidence. Record this displayed result
only; the database commit, accepted price and exact Inventory ID are not independently verified.
Second screenshot `codex-clipboard-1687d9ad-5779-42b9-af32-bc5b3faf71ec.png` shows
`NYSA-INV-000071`, `uat173round2`, Available, no active Inventory linkage, reservation expiry
not applicable. Different displayed property labels mean same-record identity is unverified.
Status: user-reported reservation/Inventory discrepancy awaiting exact linked Inventory confirmation;
not a confirmed status-sync defect or a passed reservation test. Ask owner to inspect the Inventory
record for `179invuat1` and supply its reference. Do not manually force status or duplicate booking.
Documentation only against recorded Test179 baseline/rollback in
`CRM_TEST_DEV179_DEPLOYMENT_COMPLETION.md`; no fresh runtime verification, migrations, data changes,
new test run or deployment. Prior hashes/results/counts preserved. Production/R2/PF untouched.



## Negotiation counteroffer acceptance guidance — 4 September 2026

Owner reports a customer counteroffer was recorded and asks how to finish negotiation when the
agency agrees. Supplied screenshot `codex-clipboard-0bbec65e-7e11-46af-9535-76ff89a5edde.png`
shows Offer `NYSA-OF-202609-000002`, Countered/Revision1, and a history summary of AED2.9M.
No accepted outcome or revised commercial amount is established by this screenshot.
Read-only inspection of exact dev179 package source confirms: a countered event records narrative,
not a changed revision amount; acceptance binds the current immutable revision. The revision
creation control and current terms have `flow-offer-only` and are hidden in Negotiation by CSS.
This is a newly identified navigation/clarity gap: the user must return to Offer to create the
priced counteroffer revision before accepting it in Negotiation. Do not accept unchanged Revision1
merely because its history mentions AED2.9M. Suggested path: same Offer/new inbound revision,
customer proposer, agreed commercial terms, then Negotiation acceptance by the actual agreeing
counterparty with a clear summary; Booking remains a separate action. No action executed for user.
No new runtime test, fix, deployment, original-record repair, human pass or defect-count change.
Test179 baseline/backup remain as in `CRM_TEST_DEV179_DEPLOYMENT_COMPLETION.md`; Production/R2/PF untouched.



## Owner feedback — 4 September 2026

Owner's exact response after the Opportunity → invoices → payments clarification:
“ok, it works fine.” Recorded as positive human feedback on the Opportunity-linked receivables
flow discussed in this task. Deployment context is CRM Test dev.179 (not freshly reverified this
turn), package SHA`e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434`.
No exact Opportunity, invoice, payment, amounts or executed test steps were supplied; do not infer
individual passes for no-Deal creation, VAT, partial payments, reversals, reconciliation, permissions
or payout, and do not close unrelated defects or infer full-module acceptance.
Documentation-only update: no runtime/database change, migration, deployment or new test run.
Existing snapshot/rollback and historical automated results remain as recorded in
[dev.179 completion](CRM_TEST_DEV179_DEPLOYMENT_COMPLETION.md). Production/R2/PF untouched.


## Opportunity-first finance deployed for retest — dev.179, 3 September 2026

Exact179 package SHA`e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434`
deployed to CRM Test only at owner's request. Opportunity-parent correction is deployed, not
human-accepted: invoices, proofs, collections and reconciliation no longer require a Deal.
Migration116 preserves historical links;113/115/116 applied,count116. Healthy/ready179,
one verified worker3489464 and matching runtime/assets confirmed. Fresh rollback and all evidence:
[deployment completion](CRM_TEST_DEV179_DEPLOYMENT_COMPLETION.md).
Exact isolated ordinary1360/1293/67/0; receivables18/18; proof6/6; Manager closure2/2;
package guards2/2 separately. No human defect count/pass inferred or old174 evidence changed.
Production/R2/PF excluded. Local-only status below records the earlier state, not current deployment.


## Opportunity-first finance rework completed locally — 3 September 2026

The earlier Deal prerequisite was an implementation error against the already documented requirement.
It is now removed in local source: invoices, proofs, payments and reconciliation use Opportunity ID
directly and work before a Deal exists. Additive migration116 preserves all historical Deal-linked
financial rows and resolves them through their Opportunity; it does not rewrite them. A later Deal sees
the same immutable receipt IDs with no copying/re-entry and no automatic payout.

Synthetic no-Deal plus regression checks: receivables18/18, proof6/6, independent closure2/2,
ordinary1360/1293/67/0. Local Accountant browser confirmed a Viewing Opportunity with no Deal,
Opportunity proof, AED1,000 invoice commission/net receipt, 25/75 split and confirmed reconciliation.
This is agent-driven local evidence, not human UAT. CRM Test remains dev.178; migration116 and this
source are not packaged/deployed. Production/R2/PF untouched; cumulative defect count unchanged.
See [implementation, safeguards and rollback](OPPORTUNITY_FINANCE_REWORK_20260903.md).

## Opportunity linkage correction — 3 September 2026

Owner: “it should be opportunity and not deal..”. Opportunity is the authoritative finance parent;
no Deal prerequisite is acceptable. The current local receipt-posting dependency is an unresolved
implementation gap, not a completed requirement. No deployment or human acceptance. Previous local
tests do not demonstrate collection without a Deal. See [corrected scope](RECEIVABLES_SINGLE_ENTRY_PAYMENT_WORKFLOW.md).

## Single-entry receivables agreed and implemented locally — 3 September 2026

Owner asked whether this meant one invoice/one payment, then said “agree” after clarification:
each scheduled instalment gets its own invoice, and each invoice can have multiple partial payments.
Implemented one atomic gross collection + net Finance Receipt, exact VAT separation, linked corrections,
duplicate prevention and confirmation supersession. No automatic closure, credit or payout.
Migration115 applied only to the synthetic local fixture; CRM Test remains dev.178, unchanged.

Local results: ordinary1356/1293/63/0, enabled receivables14/14, proof6/6, outstanding-commission
Manager closure/Accountant collection2/2. Local browser shows AED105 payment becoming AED100
Finance Receipt plus AED5 VAT with invoice/Opportunity trace. No human receivables pass.
New posting requires one existing AED Deal linked to the Opportunity; legacy receipt reconciliation
is not automated. No new deployment, cumulative defect count change, production/R2/PF access or
personal-data use. Historical SHA/migration/worker/test evidence and exact Manager human closure
report are preserved. See [scope, safeguards, verification and rollback](RECEIVABLES_SINGLE_ENTRY_PAYMENT_WORKFLOW.md).

## Receivables resumed — 3 September 2026

Owner: “can u now work receivables part”. Local-only reconciliation of Accountant receivables
access, Opportunity commission/split context and K/M amounts completed. No new migration or
deployment; no human receivables pass. Duplicate receivables-versus-Finance-Receipts posting
needs an explicit single-entry workflow decision before completion. Ordinary suite1349/1291/58/0;
separate synthetic receivables9/9 and proof/receipt6/6. No cumulative defect count change.
See [current scope, backup and decision](RECEIVABLES_RESUMPTION_20260903.md).

## Human retest update — 3 September 2026

Owner reports after dev.178 deployment: “this is done, i was able to close the deal.”
Owner then explicitly clarifies: “manager closed the deal”.
**Human-confirmed result: Manager successfully closed the tested Deal.** The previously
reported inability to proceed with closure is cleared for this reported retest.
Linked item: SPEC-GAP-002. This report does not specify the receipt/confirmation state at
closure, commercial/residential type, exact record reference, or downstream pipeline/inventory
state; those are not inferred. Accountant screens and other defects are not accepted by this
statement. Full commission-independent closure acceptance remains limited to the evidence above.

Documentation-only update against recorded CRM Test dev.178 package SHA-256
`1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`, migration114/count113,
rollback `/home/nysareal/crm-backups/consolidated-crm-test-dev178-20260902T204149Z`.
No new tests, migrations, application/data changes, private data access or production/R2/PF action.
Historical package hashes, worker observations and automated totals are preserved.

## Current deployment update — 3 September 2026

**CRM Test dev.178 deployed; human retest pending.** This supersedes earlier local-only/
dev.176 status statements below, which remain historical evidence. User authorized “pl deploy
in crm, all the fixes”. The isolated package includes Accountant four-workspace access,
Opportunity-first Finance references, K/M amounts, receipt-only wording, managed-team Manager
commercial closure and receipt-independent closure at both API and database levels.
Migration114 removed the receipt closure trigger; no other closure gates or Director payout
approval were removed. Deferred receivables/invoicing/new payout-request workflow excluded.

Package SHA-256 `1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`;
latest migration114, 113 total (no113); one verified Test worker PID280206. Exact isolated suite
1,336 total /1,287 passed /49 protected skips /0 failed; 24 separately enabled synthetic DB
checks passed. Health/readiness and installed/served hashes verified. Fresh private application/
database backup verified. Production/R2/PF untouched; no new production personal data.

SPEC-GAP-002 and all previously user-failed items remain **deployed pending human retest**;
no inferred acceptance, original-record repair or cumulative count change (25 items).
Historical dev.174 SHA, migrations108–110, one-worker observation and 1,291/1,261/30/0 result
are unchanged. See [deployment evidence and rollback](CRM_TEST_DEV178_DEPLOYMENT_COMPLETION.md).

Date: 30 August 2026  
Candidate: dev.174  
Deployed baseline: `2.1.0-dev.174`

## Consolidated register

| Reference | Classification | Observation | Current state |
|---|---|---|---|
| DEF-104 | Defect; formerly unnumbered issue 1 | Area was maintained separately in Administration and Market Intelligence | Deployed; migration 108; UAT pending |
| DEF-105 | Defect; formerly unnumbered issue 2 | Listing Executive could not create a governed Developer | Deployed; UAT pending |
| DEF-106 | Defect; formerly unnumbered issue 3 | Manager approval access allowed operations on an active Agent-owned Lead | Deployed; UAT pending |
| DEF-097 | Defect | Financial Illustration still required sales narrative and recommended next steps | Deployed; migration 110; UAT pending |
| DEF-098 | Defect | Immutable proposal PDF review was too small | Deployed; full-screen review; UAT pending |
| DEF-099 | Defect | Creating or viewing a Value Brief exited the Lead | Deployed; Lead context retained; UAT pending |
| SPEC-GAP-001 | Specification gap; initially called DEF-100 | Saved Value Brief should add weight to the proposal | Deployed with governed immutable proposal evidence; UAT pending |
| DEF-101 | Defect | Create opportunity action was easily missed | Deployed; dedicated larger CTA; UAT pending |
| DEF-102 | Showstopper defect | Opportunity workflow page overlapped and jumbled the parent Opportunity | **Human UAT failed; Stage 1 lower content jumbled and Stage 6 top-left header overlap reported; remediation and retest required** |
| DEF-103 | Defect | Proposal showed Parking but Inventory had no authoritative Parking specification | Deployed; migration 109 and end-to-end field; UAT pending |
| DEF-107 | Reported error; triage pending | Internal server error displayed while Qualified leads contributing records was open | Open; exact triggering action, affected Lead, runtime version and severity pending confirmation |
| DEF-108 | User-reported workflow defect | Outcome button appears unresponsive; form appears after Back with black background; blank form after reported Save | Open; failed user workflow; persistence and relationship to DEF-102 unverified |
| DEF-109 | User-reported Inventory error | Inventory returns internal error after reported booking; user cannot verify booking | Open; booking verification blocked; booking persistence unknown |
| DEF-110 | User-reported checklist workflow defect | Checklist screen closes after each Mark complete | Open; context-retention failure reported; exact record pending |
| DEF-111 | Suspected governed Deal creation bypass | User could not create governed Deal beforehand and reports stage bypass while checklist is accessible | Open; priority governance investigation; actual bypass and Deal lineage unverified |
| DEF-112 | User-confirmed UAT blocker | Official document requirements errors; no usable final-document upload control in the observed flow | **Blocked: final-document upload unavailable; cause and capability-versus-loading failure unverified** |
| DEF-113 | Manager dashboard problem-detail defect | Initial recovery screen shows generic problem categories, not the specific overdue work | Open; user-reported lack of actionable detail |
| DEF-114 | Manager Open Lead navigation error | Open Lead from lead leakage recovery returns internal server error | Open; Manager role reported; clicked row and cause unverified |
| DEF-115 | Closure prerequisite discoverability / role-handoff defect | Agent-reported section shows MAINTAIN but no receipt controls or finance handoff guidance | Open; Agent cannot confirm receipts under approved policy; misleading presentation remains; live runtime not independently checked |
| DEF-116 | Stage draft-save failure | Save as draft in Stage 6 displays Draft not saved: Internal server error | Open; failed draft-save attempt; no acknowledged draft; cause and database persistence unverified |
| DEF-117 | Active pipeline / lifecycle representation defect | Agent reports Deal-stage mismatch and second Lead contacted, while pipeline remains Qualified 2 / Contacted 0 | Open; reconcile both journeys against current stage and contact history; no forced Contacted/Won transition |

The three formerly unnumbered observations above are the issues the user identified as having been noted at
approximately 22:49 GST on 30 August 2026. They receive the next available defect numbers to preserve every number
already used in the subsequent discussion.

## Status summary

- Total observations: 21 (original 10 plus DEF-107 through DEF-117 reported during continued UAT).
- Defects / suspected defects: 20 (including reported errors and suspected governance bypass awaiting triage).
- Specification gaps: 1.
- Corrected or implemented locally: 10.
- Open after human UAT: 12 (`DEF-102`, `DEF-107` through `DEF-117`).
- Active-stage dashboard inconsistency under triage: `DEF-117`; no Closed Won or other pass inferred.
- Additional closure-guidance issue: `DEF-115`; no receipt or Close Won pass inferred.
- User-confirmed final-document upload blocker: `DEF-112`; this escalation does not add a duplicate defect.
- Packaged: 10.
- Deployed after dev.173: 10.
- Human UAT passed: 0 inferred; human-reported workflow failures: 4 (`DEF-102`, `DEF-108`, `DEF-110`, `DEF-116`); additional errors/concerns under triage: `DEF-107`, `DEF-109` (booking verification blocked), `DEF-111` (suspected bypass), `DEF-112` (final-document upload blocker), `DEF-113` (Manager problem detail), `DEF-114` (Manager Open Lead error), `DEF-115` (receipt-step location/role guidance).

## Implemented correction — DEF-097

The current proposal contract supports full buyer proposals with mandatory match rationale and next steps. A saved
financial scenario adds governed calculation evidence but does not change that proposal type. The user approved the
customer-facing term `Financial Illustration`. It is calculation-led and indicative; `Investment Proposal` remains
recommendation-led. Migration 110 and the application now provide an explicit Financial Illustration type with its
own mandatory contract: one applicable Inventory record, a saved immutable financial scenario, calculation/rule and
as-of evidence, customer-facing assumptions, approved disclaimer, immutable PDF and Manager review. Sales
recommendations, viewing actions, Value Brief, match narrative and next steps do not block or appear in that specific
document type. Existing Quick, Investment and Comparison contracts remain unchanged.

## Verification evidence

- Focused post-dev.173 correction tests: 47 passed, 0 failed.
- Full ordinary regression: 1,289 tests; 1,259 passed, 30 protected skips, 0 failed.
- These automated results verify the local candidate only and do not establish human UAT passage.

## Deployment boundary

The checksum-bound cumulative package was deployed to CRM Test as `2.1.0-dev.174`. Production, R2 and Property
Finder were excluded. Every correction remains pending direct human UAT; deployment does not infer a pass.

## Direct CRM Test observation — DEF-102 — 31 August 2026, 00:05–00:07 GST

- Role: Sales Agent `ajitr`.
- Existing record: Opportunity `NYSA-OP-202608-000001`, customer `uat173round1`, Sale, `2 bedroom in Business Bay`,
  status `Matching`, source Lead history `Qualified`.
- All six workflow stages were opened one at a time from the existing Opportunity: Inventory selection; Viewing and
  customer feedback; Offer and commercial terms; Negotiation; Booking and reservation; Deal and completion.
- Each stage rendered as a clean top-level focused/full-viewport page. No Opportunity-parent headings, controls or
  Inventory content overlapped or jumbled the stage surface.
- Each `Back to Opportunity` action restored the same Opportunity. The status remained `Matching`, stage 1 remained
  completed, stages 2–6 remained not completed, and the source/customer/title evidence remained unchanged.
- No business record was created or replaced, and no draft or governed Save action was used.
- Result boundary: the reported `DEF-102` failure was not reproduced in this direct agent-operated browser run.
  This does not change `Human UAT passed: 0 inferred`; user direct observation and confirmation are still required
  before the case can be marked passed.

## Direct user CRM Test observation — DEF-102 failed — 1 September 2026, 02:53 GST

- Environment: CRM Test only, deployed `2.1.0-dev.174`. Production, R2/Production clone and Property Finder remained
  excluded.
- Preserved release identity: package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`; migrations 108–110; one-worker deployment
  observation; automated result 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
- Role / record: Sales Agent `ajitr`; existing Opportunity `NYSA-OP-202608-000001`, `uat173round1`, Sale,
  `2 bedroom in Business Bay`, status `Matching`, source Lead history `Qualified`.
- Action: Opened Stage 1, `Inventory selection`, from the existing Opportunity. No Save, draft, Delink, creation or
  other governed mutation was performed.
- Expected: A clean focused/full-viewport stage surface with no parent Opportunity content overlapping or visible
  as jumbled content below it.
- Exact user observation: `stage 1 is clear but then below it is jumbled`.
- Screenshot:
  `uat-evidence\2026-09-01-dev174-def102-stage1-jumbled.png`.
- Result: **Human UAT FAILED; DEF-102 reproduced.** The showstopper remains open for remediation and retest. The
  earlier agent-operated non-reproduction is retained as historical evidence but does not override the user's direct
  observation. No pass is inferred for stages 2–6 or any other dev.174 item.
- Data/security impact: Synthetic CRM Test record only; no production data used and no CRM business record changed.

## DEF-107 — Internal server error on Qualified leads contributing-records surface — 2 September 2026

- Exact user report: `internal server error`. The supplied screenshot displays `Internal server error` above
  `Qualified leads · contributing records` with two Lead rows and a `Schedule viewing` action for each.
- Visible synthetic references: `NYSA-LD-202608-000002` (DSO) and `NYSA-LD-202608-000001` (Business Bay).
  Neither is asserted to be the failing record. The signed-in role is not shown in the screenshot; the earlier
  session used a Sales Agent, but that is not fresh role evidence for this report.
- The page says `data as of 2 Sept 2026, 20:22`; this is a data timestamp, not a verified error-event timestamp.
- Triggering action: pending user confirmation. Do not infer that either Schedule viewing button was clicked.
- Expected: A supported dashboard drill-down/action should display its intended result or an actionable governed
  validation message, not an unexplained internal error.
- Result: Error directly evidenced by the user-supplied screenshot. HTTP status, failing request, cause,
  reproducibility and blocker severity remain unverified. No remediation or UAT pass is claimed.
- Evidence: [Original supplied screenshot](uat-evidence/2026-09-02-def107/user-supplied-internal-server-error.png),
  SHA-256 `e7aa8fd5427688c1da2b5da7d60df60358bbdb00193ddbf87f38f750e3314567`.
- Scope: Recorded in this CRM Test-only UAT lane. The screenshot does not expose its hostname or version;
  the report-time deployment identity is not independently verified. The retained baseline is `2.1.0-dev.174`,
  package SHA-256 `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  one-worker deployment observation and 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  These historical observations are preserved, not represented as freshly rerun checks.
- Changes: Documentation and evidence retention only; no code, schema, configuration, deployment or business-record
  changes. Production, R2/Production clone and Property Finder were not accessed.
- Evidence-record rollback: Both documents were copied before editing to
  `uat-evidence\def107-pre-record-20260902-202409`.
  Local HEAD was `1af87ba994599d8de1bab6d37b2005e609d449fe`; both documents already had user-owned changes.
  Retained application/database rollback reference:
  `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`; not exercised or freshly verified.

## DEF-108 — Viewing outcome form appears only after Back; blank form after reported Save — 2 September 2026

- **Exact user report:** "no response to this button for recording the viweing outcome. then i click to back to
  opportunity, then  i get screen to record outcome. with black background. save the outcome, the screen did not
  close, it opened another blank record".
- **Reported sequence:** (1) Clicked `Record viewing outcome and feedback` with no visible response;
  (2) clicked `Back to Opportunity`, after which the outcome form appeared with a black background;
  (3) used `Save outcome`, after which the screen did not close and another blank form/record appeared.
  These are user-observed steps, not an independently replayed test.
- **Visible context:** Stage 2, `VIEWING AND CUSTOMER FEEDBACK (1)`; synthetic customer `uat173round1`,
  Executive Tower, Business Bay. Screenshot 1 shows a confirmed physical-property appointment with
  `Viewing status: Scheduled - outcome pending` and feedback not yet recorded. The displayed
  `3 Sept 2026, 20:24` is the appointment date/time, not the error-event time.
  The viewing ID and Opportunity ID are not visible in these images. The earlier matching customer context was
  Opportunity `NYSA-OP-202608-000001`, but that linkage is not freshly verified here. The organizer is not proof
  of the currently signed-in role.
- **Screenshot boundary:** Images 2 and 3 show the outcome form with status `Completed`, attendance selections
  `Attended`, and empty Outcome/reason, Customer feedback, Follow-up action and Follow-up due fields.
  Image 3 shows `Please fill out this field.` on Outcome/reason. This is a required-field validation prompt;
  it does not prove that the earlier save succeeded, failed at the server, or created a duplicate database row.
  The black-background behavior is the user's report; these cropped form images do not establish the whole
  background state or the exact moment at which the form became blank.
- **Expected:** The outcome action should immediately present one usable foreground form in the current Stage 2
  context. Valid successful submission should clearly acknowledge the saved outcome and return to or refresh the
  originating viewing context without an unexplained blank replacement form. Invalid submission should explain
  required fields without losing entered values. Back must not unexpectedly reveal a previously hidden form.
- **Result:** Human-reported workflow failure; open for investigation. Modal layering/lifecycle may be related to
  DEF-102, but that is a hypothesis, not an established common cause. Save persistence, duplicate creation, entered
  values before Save, success acknowledgement and overall blocker severity remain unverified.
  No human pass is inferred. This report does not resolve DEF-107's still-unknown triggering action.
- **Evidence (original supplied images, copied without edits):**
  - [1 — Outcome button](uat-evidence/2026-09-02-def108/01-viewing-outcome-button.png);
    SHA-256 `eff125a90f5429641305592fee69032735d645e7a357ed79850eb9c9554a3c28`.
  - [2 — Outcome form](uat-evidence/2026-09-02-def108/02-outcome-form.png);
    SHA-256 `bb57f45bf77092fc6cef92db44f214c0f63c5f9fcd46a218c3297047ceaacebe`.
  - [3 — Blank form and validation](uat-evidence/2026-09-02-def108/03-blank-form-validation.png);
    SHA-256 `535a87193983542aa5c22a0ab55b224b8ba260a9399a371b4e5bba0debbde7ff`.
- **Environment / baseline:** CRM Test-only UAT scope. Hostname and runtime version are not visible in these
  screenshots. Retained baseline: `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  one-worker deployment observation and 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  No fresh deployment, process, migration or automated verification is claimed.
- **Preservation / changes:** Evidence and documentation only. The assistant did not retry Save, create replacement
  records, change code/configuration/schema, or access remote environments. The user's reported Save may have
  changed test data; its persistence is unknown. Production, R2/Production clone and Property Finder remain
  excluded. No new production personal data was obtained.
- **Rollback:** Pre-edit copies of both cumulative documents:
  `uat-evidence\def108-pre-record-20260902-202826`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior document edits preserved. Historical application/
  database backup reference remains `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`;
  not accessed or exercised.

## DEF-109 — Inventory internal error blocks verification of reported booking — 2 September 2026

- **Exact user report:** "did the booking, cant confirm whether the booking has been done, as inventory returns
  internal error".
- **Sequence / impact:** User reports performing the booking, then trying to verify it through Inventory and
  encountering an internal error. Booking verification is blocked for the user. The submission result and
  persisted booking/reservation state are unknown; neither success nor failure is inferred.
- **Visible evidence:** Inventory is selected. The supplied screenshot shows the filter form, Status set to
  `Available`, and no Inventory rows in the captured area. No error toast, HTTP status, booking reference,
  property reference, signed-in identity, hostname or application version is visible. The internal error is
  user-reported, not independently visible in this image. An Available-filtered view is not evidence that a
  booking is missing or that it succeeded.
- **Record / action details pending:** Exact Opportunity, Inventory and booking/reservation references; whether
  Inventory failed on opening, filtering or another action; any booking acknowledgement. Earlier
  `uat173round1` context must not be assumed to identify this booking without confirmation.
- **Expected:** A submitted booking should have an explicit result and be verifiable through its authoritative
  Opportunity/booking record. Inventory should load its governed filtered state or an actionable error.
- **Status:** Open reported Inventory error; booking verification blocked, persistence unknown. No duplicate,
  reservation transition or data loss is asserted. Keep separate from DEF-107 until a common cause is established.
  Do not repeat booking, release/cancel reservations or create replacement records to work around the uncertainty.
- **Evidence:** [User-supplied Inventory view](uat-evidence/2026-09-02-def109/01-inventory-after-reported-booking.png),
  SHA-256 `638482466258378b5758e6cd9128c8a7635541f6bd3f387a04c57ad5c023d2de`.
- **Baseline / scope:** This remains the CRM Test-only UAT lane. Report-time runtime identity is unverified.
  Retained release `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and automated result 1,291 total / 1,261 passed / 30 protected skips / 0 failed
  remain unchanged. No fresh execution or human pass is claimed.
- **Changes / privacy:** Documentation and evidence preservation only; no assistant booking submission,
  code/configuration/schema change, deployment, test execution or remote data access. The user's booking action
  may have changed test data; that is unverified. Production, R2/Production clone and Property Finder remain
  excluded; no new production personal data was obtained.
- **Rollback:** Pre-edit document copies:
  `uat-evidence\def109-pre-record-20260902-203124`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; existing document changes preserved. Historical
  application/database rollback reference remains
  `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`; not accessed or exercised.

## DEF-110 / DEF-111 — Checklist exits and reported governed Deal creation bypass — 2 September 2026

- **Exact combined user report:** "while doing check list...after each mark complete screen got closed. and then
  also i could not create any governed deal before, the stage was bypassed".
- **DEF-110 — Checklist workspace closes after each completion:** User reports clicking Mark complete during
  checklist work and the screen closing after every completion. Expected: completing an individual checklist
  item should refresh that item and retain the working checklist context, without an unexpected workspace exit.
  Status: open user-reported workflow failure; exact checklist/Deal reference and destination after closure are
  not yet supplied. The screenshot is a static state, not independent proof of the closing transition.
- **DEF-111 — Reported bypass of governed Deal creation:** User reports not being able to create a governed Deal
  beforehand and that the stage was bypassed, yet a Sale completion checklist is now shown. Expected: Deal
  progression must preserve its governed creation prerequisites and auditable linkage to the exact originating
  Opportunity, accepted Offer revision and Booking/reservation. A checklist view must not be treated as proof
  that this creation path succeeded. Status: open suspected governance/workflow defect requiring priority
  investigation. Actual bypass, automatic or pre-existing Deal creation, missing creation UI and broken navigation
  have not been distinguished. This is not a confirmed authorization or database-integrity bypass.
- **Direct screenshot evidence:** `Sale completion checklist · Template version 1`; item 1,
  `Buyer and seller details verified`, shows `completed` / `Evidence: ok`; item 2,
  `Accepted terms and completion date confirmed`, shows `completed` / `Evidence: ok`; item 3,
  `Manager completion review`, shows `pending` / `Awaiting manager`.
  These displayed states do not verify the underlying evidence, a human UAT pass, Manager approval, or Deal closure.
- **Unknown identity / causality:** No Deal, Opportunity, Booking or Inventory reference, signed-in identity,
  hostname or version is visible in the crop. Do not assume the record from prior reports. Screenshot and report
  alone do not resolve DEF-109's booking-persistence uncertainty or prove a common cause with DEF-102/108.
- **Safety recommendation:** Pause Deal approval/closure pending read-only verification of the exact record's
  creation history and prerequisite links. Do not create a replacement Deal, repeat booking, change approvals,
  or bypass a gate as a workaround. No system hold or permission change was imposed by the assistant.
- **Evidence:** [Supplied checklist screenshot](uat-evidence/2026-09-02-def110-111/01-sale-completion-checklist.png),
  SHA-256 `5cecc830ea5b4ed1edc15fa8e95cee45902baf810bdff3138e5a9e662688a11c`.
- **Preserved baseline:** CRM Test-only UAT scope; report-time hostname/version unverified.
  Retain `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation, and 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  No live verification, automated rerun or human pass is inferred.
- **Changes / privacy:** Documentation and original screenshot retention only. No code, database, configuration,
  deployment, approval or business-record changes were made by the assistant. User-reported checklist actions
  may have changed test data; the displayed state is recorded without database verification. Production,
  R2/Production clone and Property Finder remain excluded. No new production personal data was accessed.
- **Rollback:** Both documents copied before editing to
  `uat-evidence\def110-111-pre-record-20260902-203354`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior edits preserved. Retained application/database
  backup reference `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` was not accessed
  or exercised.

## DEF-112 — Official document requirements returns internal server error — 2 September 2026

- **Exact user report:** "one more internal server errror".
- **Direct evidence:** The supplied screenshot shows `Official document requirements` under
  `Controlled external evidence`, workflow step `Complete sale agreement` selected, a `Review requirements`
  button, and an inline `Internal server error` instead of a requirements result.
- **Trigger / record:** The selected workflow step is visible, but the user has not specified whether the error
  followed opening the section, changing the selection or clicking Review requirements. No Deal/Opportunity ID,
  signed-in role, hostname or runtime version is visible. These must not be inferred from earlier reports.
- **Expected:** Reviewing requirements should display the applicable governed requirements or an actionable
  prerequisite/permission message. The error must not be treated as no documents required, document verification,
  completion of the sale agreement, or permission to bypass compliance.
- **Status / impact:** Open defect; displayed error directly evidenced. Requirements review is obstructed on the
  captured surface. Exact HTTP status, cause, reproducibility, impact on other workflow steps and relationship to
  DEF-107/109 are unverified. No fix or human UAT pass is claimed.
- **Evidence:** [Original supplied screenshot](uat-evidence/2026-09-02-def112/01-official-document-requirements-error.png),
  SHA-256 `5432e961ea5c4fcbf017d599bffb531f4add2fdf62b95a1f2318b0ce1dd37c2e`.
  The original image includes an unrelated browser thumbnail; it was retained without edits, not investigated
  or used as authority to access an external site.
- **Baseline / scope:** CRM Test-only lane; report-time hostname/version not independently verified.
  Retain `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  These remain historical release evidence, not fresh runtime checks.
- **Changes / privacy:** Documentation and screenshot preservation only. No application/schema/configuration
  changes, tests, remote access, document upload, approval or business-data mutations were performed.
  Production, R2/Production clone and Property Finder remain excluded. No new production personal data was obtained.
- **Rollback:** Pre-edit copies of both documents:
  `uat-evidence\def112-pre-record-20260902-203455`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; existing changes preserved. Historical application/
  database backup reference `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`
  remains unchanged and was not accessed or exercised.

## DEF-113 / DEF-114 — Manager recovery problem detail and Open Lead error — 2 September 2026

- **Exact user report:** "this is manager dashboard, the problem is not specifiied at first screen. open lead does
  not work, internal server error".
- **Role / surface:** Manager, explicitly identified by the user; signed-in account not independently observed.
  Screenshot shows `Manager recovery · Authoritative exceptions` / `Lead leakage recovery`, with `3 OPEN`.
- **DEF-113 — Initial exception presentation lacks specific problem detail:** The user reports the problem is not
  specified on the first screen. The screenshot does contain a Problem column with generic categories
  `overdue task` and `overdue next action`, so the record does not claim the column is absent. It does not show
  the underlying task description/reference or the substantive next action. Recovery instructions are generic.
  Expected: the Manager should be able to identify the particular overdue work and what needs attention from
  the initial exception presentation, within authorized scope. Exact additional presentation requirements and
  root cause remain to be investigated; no business-rule change is approved by this report.
- **DEF-114 — Open Lead returns internal server error:** User explicitly reports the Open Lead action does not
  work and produces an internal server error. The screenshot shows the buttons, but no error message. Which
  of the three rows was clicked, the HTTP response/status and reproducibility across the other rows are unknown.
  Expected: open the exact associated Lead in the Manager's authorized review context, or explain a valid access
  restriction rather than return an internal error. Status: open user-reported navigation failure.
- **Visible rows:** `NYSA-LD-202608-000001` / `uat173round1` — overdue task, due 31 Aug 2026 13:00;
  `NYSA-LD-202608-000002` / `uat173round2` — overdue next action, due 31 Aug 2026 18:00; same second Lead —
  overdue task, due 31 Aug 2026 18:00. These are two categories on one Lead, not proof of duplicate error records.
  All three show `First detected 2 Sept 2026, 20:34`; this is exception-detection time, not a verified error time.
  Their `HIGH` badges describe application exceptions, not assigned software-defect severity.
- **Access / acceptance boundary:** Fixing Manager visibility/navigation must not grant operational authority over
  an active Agent-owned Lead. Preserve DEF-106's oversight, review, approval and governed reassignment boundaries.
  No human UAT pass or DEF-106 failure is inferred from this navigation error. Common cause with DEF-107 or
  other internal errors remains unverified.
- **Evidence:** [Supplied Manager dashboard screenshot](uat-evidence/2026-09-02-def113-114/01-manager-lead-leakage-recovery.png),
  SHA-256 `607641cad5fdd9f1b9f5bcb3d48512cf6ee9b886a6fb5112f75e491b6492e1ea`.
- **Baseline:** CRM Test-only UAT scope; report-time hostname/version not visible or freshly verified.
  Retain `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  No new test execution or runtime verification is claimed.
- **Changes / privacy:** Documentation and original screenshot retention only. No code, schema, configuration,
  permissions, deployment or business-data changes, and no remote access by the assistant. Production,
  R2/Production clone and Property Finder remain excluded. No new production personal data was obtained.
- **Rollback:** Both documents copied before editing to
  `uat-evidence\def113-114-pre-record-20260902-203634`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior edits preserved. Historical application/database
  backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` remains unchanged;
  not accessed or exercised.

## DEF-102 additional human evidence — Stage 6 top-left header overlap — 2 September 2026

- **Exact user report:** "the alignment is not correct,, there is an overlap on top left."
- **Observed surface:** Stage 6, Deal & completion. The stage title/progress text overlaps the Deal reference,
  customer and header content at the top left. The Back to Opportunity control is also partially cut off at the
  left edge of the supplied image; whether that clipping is from the UI or image crop is not established.
- **Expected / result:** A clean focused stage header with separately readable navigation, title, progress and
  Deal identity. **Failed layout observation; DEF-102 remains open.** This extends its Stage 1 evidence to
  Stage 6; it is not a new numbered defect or a confirmed shared technical root cause. The earlier agent-only
  six-stage non-reproduction does not override these user observations.
- **Record evidence now visible:** Customer `uat173round1`; Booking `NYSA-BK-202609-000001`; exact Offer
  Revision 1. The partly obscured Deal reference appears to read `NYSA-DL-202609-000001` and should be
  verified against an unobscured authoritative record before use in diagnostics. No Opportunity reference is
  visible. The screenshot displays AED 2,000,000 and `completion in progress`.
- **Acceptance / lineage boundary:** The screen displays four completed readiness checks, but closure approval
  and Authoritative Closed Won each explicitly show `Blocks closure`. The overlap includes similarly worded
  header text; do not read that header text as evidence that approval or Closed Won occurred.
  The management-decision form is visible, with reason and evidence-reference fields empty. No approval/closure
  action is authorized or performed by this report. Visible Booking/Deal labels provide investigation pointers,
  but do not establish the creation audit trail, which earlier submission produced them, or a resolution of
  DEF-109/111. Those items remain open.
- **Role / scope:** Management decision UI is shown; the preceding user report identified a Manager session,
  but the current crop does not independently identify the signed-in role. CRM Test-only UAT scope;
  hostname/runtime version not visible.
- **Evidence:** [Original Stage 6 screenshot](uat-evidence/2026-09-02-def102-stage6/01-deal-header-overlap.png),
  SHA-256 `346c063fe0a02cff746266547c158b57f503a611d47b828520f9789ac8813302`.
- **Baseline preserved:** `2.1.0-dev.174`; package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`; migrations 108–110;
  historical one-worker observation; automated 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  No fresh runtime checks or human passes are inferred.
- **Changes / rollback:** Documentation and supplied evidence only, no code/schema/configuration changes,
  migrations, tests, approval, closure or remote business-data actions. Both documents backed up before editing:
  `uat-evidence\def102-stage6-pre-record-20260902-203740`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior edits preserved. Historical application/database
  backup remains `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`, not accessed.
  Production, R2/Production clone and Property Finder remain excluded; no new production personal data obtained.

## DEF-112 escalation — Final-document upload is a user-confirmed blocker — 2 September 2026

- **Exact user report:** "there is no facility to upload final document and this is a blocker".
- **Severity / status:** **User-confirmed UAT blocker — final-document upload unavailable in the observed flow.**
  This extends DEF-112's existing Official document requirements error; no duplicate defect number is allocated.
  The blocker classification supersedes the earlier unassessed business impact, not the unresolved cause.
- **Visible evidence:** `Official document requirements`, `Complete sale agreement` selected,
  `Review requirements` and `Internal server error`. No upload/file-selection control is visible in this
  section. The page says to upload and verify the official PDF here, but the observed surface provides no usable
  upload action. The collapsed `Transaction will not complete` section is not treated as an upload control,
  an actual failed transaction, or authorization to cancel/close the Deal.
- **Expected:** The authorized final-document workflow must provide a usable governed upload and verification
  path bound to the correct transaction, with an explicit outcome. The required document must not be bypassed,
  falsely marked verified or substituted with invented evidence to unblock closure.
- **Causality boundary:** It is not yet established whether the upload capability is absent, inaccessible to this
  role, or suppressed because requirements failed to load. The screenshot establishes the visible error and lack
  of upload control in this section, not absence throughout the application. Exact final-document type, Deal/
  Opportunity reference, current role and triggering action remain unconfirmed for this report.
- **Acceptance:** No upload, document verification, sale-agreement completion, approval, closure or human pass
  is inferred. Recommend pausing this document-completion lane until the blocker is resolved; no system state
  or permission change was imposed.
- **Evidence:** [Supplied final-document upload blocker screenshot](uat-evidence/2026-09-02-def112/02-final-document-upload-blocker.png),
  SHA-256 `f46a4494ae49cff8412e838c1eda16ec103c5cf521bdd708f5ab3b1423f19989`.
- **Preserved baseline / scope:** CRM Test-only UAT lane; screenshot hostname/version not visible.
  Retained `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and 1,291 total / 1,261 passed / 30 protected skips / 0 failed are unchanged;
  no fresh runtime checks or automated rerun is claimed.
- **Changes / privacy / rollback:** Only documentation and screenshot retention. No application, schema,
  configuration, deployment, permissions, approval or business-data changes; no actual final document was
  requested, accessed or uploaded. Production, R2/Production clone and Property Finder remain excluded.
  Pre-edit copies of both documents:
  `uat-evidence\def112-blocker-pre-record-20260902-203856`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior edits preserved. Historical application/database
  rollback reference `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` remains
  unchanged and was not accessed or exercised. No new production personal data obtained.

## DEF-115 — Close Won receipt prerequisite does not identify location or responsible role — 2 September 2026

- **Exact user report:** "not evident where is this step to be done.."
- **Screenshot:** Close Deal as Won form and message `Confirmed actual commission receipt is required before
  Close Won`. `Authoritative Closed Won recorded` still shows `Blocks closure`. The screen does not give
  a navigation action or name the role responsible for receipt confirmation. Stage 6 header overlap remains
  visible and is already covered by DEF-102. Synthetic customer `uat173round1` is visible; exact Deal ID,
  current role and runtime version are not shown. The populated completion date is form data, not event time.
- **Status / expectation:** Open discoverability and recovery-guidance defect. The Close Won prerequisite should
  identify where to perform the outstanding step and which authorized role must do it. Preserve the actual
  commission receipt gate; a blocked closure does not by itself mean the rule is faulty. No successful Close Won,
  receipt recording/confirmation or human acceptance is inferred.
- **Read-only local source finding (not live verification):** `public/deal-ui.js:75` mounts
  `dealCommissionWorkspaceHTML` after the checklist and document-compliance area in the Deal detail,
  before Official document requirements. `public/commission-payout-ui.js:13-14` labels it
  `Commission and receipt` and provides `Prepare and freeze expected commission` for a writable Deal,
  `Record immutable receipt`, and then `Confirm actual receipt for Close Won` once expected commission is
  frozen, receipts exist and no current confirmation exists. The UI exposes receipt forms for full Administrator,
  Director or Accountant, not Manager alone. `src/routes/commission-payout.js:9,84,87` applies the corresponding
  receipt authority and requires frozen expected commission before confirmation. `src/routes/opportunities.js:1426`
  contains the displayed closure gate message. These source observations neither establish deployed behavior nor
  authorize a permission change or fake receipt. Whether the section is loaded, off-screen or failing on CRM Test
  is still unverified.
- **Evidence:** [Supplied receipt-prerequisite screenshot](uat-evidence/2026-09-02-def115/01-close-won-receipt-prerequisite.png),
  SHA-256 `dc849abe6014af4db2573b5ccdc9e4d21e3f68ca85327f22586a68bf92551fcd`.
- **Baseline / boundaries:** CRM Test-only UAT context. Preserve `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and automated 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  Local source was inspected; no deployment identity or running worker was freshly checked.
- **Changes / privacy:** Documentation and screenshot preservation only. No code, schema, configuration,
  access-control changes, test execution, receipt submission, closure or remote business-data actions. No real
  financial evidence requested or uploaded. Production, R2/Production clone and Property Finder remain excluded.
- **Rollback:** Pre-edit copies of both documents:
  `uat-evidence\def115-pre-record-20260902-204045`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior edits preserved. Retained application/database
  backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` not accessed or exercised.

## DEF-115 role clarification — Agent receipt view and approved finance handoff — 2 September 2026

- **Exact user report:** "this is from agent login.. still same.. what is the expected functionaloty".
- **Role clarification:** Agent is now explicitly identified by the user for this report. This does not establish
  the role used for earlier reports. The supplied image has the same SHA-256 as the preceding commission-section
  screenshot; retain it as supplied, but do not count it as independent evidence of a separate executed role test.
  The new evidence is the user's role identification and report that the same presentation remains.
- **Visible state:** `MAINTAIN`; expected receipt AED 100,000.00; actual receipt `Not confirmed`;
  `Close Won blocked`; no receipt-entry or confirmation controls or named responsible-role handoff.
- **Approved expected functionality:** The owner-approved
  `RELEASE_5_COMMISSION_RECEIPT_REALTIME_PAYOUT_GATE_2_MIGRATION_API_CONTRACT.md`, permission matrix
  at lines 280–298, allows an Agent to view scoped Deal commission and prepare an expectation, but does not
  allow Agent or Manager to record/confirm a standard company-account receipt. Accountant, Director and full
  Administrator have receipt authority. Existing Deal closure authority remains unchanged and is additionally
  subject to receipt readiness. The approved Deal Commission workflow is described at lines 256–267.
- **Implementation distinction:** Earlier local code inspection shows Prepare/freeze only while no frozen
  expectation exists and the Deal is writable, and receipt controls only for finance-authorized roles. Once an
  expectation is frozen, an Agent may have no further receipt action; they must not confirm company funds merely
  to progress closure. A displayed expected amount is not proof actual money was received. The screenshot does
  not independently verify the stored expectation or receipt state.
- **DEF-115 remains open:** Missing receipt buttons for an Agent are consistent with the approved role boundary.
  The defect is misleading `MAINTAIN`/generic freeze guidance and failure to identify the required finance
  handoff or provide an appropriate next step. A clearer message should distinguish expected commission prepared
  from actual receipt awaiting authorized confirmation. This is a UI clarification expectation, not authorization
  to change access controls, implement a new task workflow, or weaken the receipt gate.
- **Evidence:** [Agent-reported commission view](uat-evidence/2026-09-02-def115/03-agent-commission-no-controls.png),
  SHA-256 `8d01f44b2e70e37252c3227f18718a5c219fc6eef77b77b77d42ce44d6726276`.
- **Baseline / scope:** CRM Test-only lane, report-time runtime version not freshly verified. Retain
  `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and automated 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  No new human pass or automated run is inferred.
- **Changes / rollback:** Documentation, read-only contract inspection and screenshot retention only. No code,
  schema, configuration, permission, receipt, approval, closure or production changes. Production,
  R2/Production clone and Property Finder remain excluded; no new production personal data obtained.
  Pre-edit copies: `uat-evidence\def115-agent-pre-record-20260902-204423`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior changes preserved. Retained application/database
  backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` not accessed or exercised.


## DEF-115 follow-up — Commission section visible but no receipt controls or role handoff — 2 September 2026

- **User evidence:** A screenshot supplied without accompanying text, following the DEF-115 location guidance.
  No additional user quote or confirmation is invented.
- **Direct visual state:** `Commission and receipt` is rendered with a `MAINTAIN` badge. It displays
  Deal value AED 2,000,000.00, originating split 25.0000%, servicing split 75.0000%, expected receipt
  AED 100,000.00, and actual receipt `Not confirmed` / `Blocks Close Won`.
  The footer says `Freeze expected commission and confirm actual company-account receipt.`
  No preparation, receipt-entry or confirmation controls, nor a responsible-role explanation, are visible
  within the captured section. No internal server error is displayed in this image.
- **Update to prior uncertainty:** The section is demonstrably rendered in this screenshot; it is no longer only
  a local-source location suggestion. This is not an independent live replay, role check, database verification
  or confirmation of receipt persistence. Expected receipt is displayed as an amount; its stored frozen state
  is not independently verified.
- **Role boundary / hypothesis:** Previously inspected local code separates the generic Deal `writable`
  badge from finance-receipt authority. If the user is still Manager, receipt controls being hidden is consistent
  with that code, while the badge and generic instruction fail to explain the handoff. Current role is absent
  from the screenshot and remains to be confirmed. Do not infer an authorization defect or broaden access.
  No new numbered defect: extend DEF-115 with missing-action/role-handoff evidence.
- **Acceptance:** Close Won remains blocked in the visible UI. No actual receipt, confirmation, valid financial
  reconciliation or UAT pass is claimed. No amounts are to be submitted merely to clear this gate.
- **Evidence:** [Supplied commission section](uat-evidence/2026-09-02-def115/02-commission-section-no-controls.png),
  SHA-256 `8d01f44b2e70e37252c3227f18718a5c219fc6eef77b77b77d42ce44d6726276`.
- **Baseline / scope:** CRM Test-only UAT; report-time hostname/version not visible. Retain `2.1.0-dev.174`,
  package SHA-256 `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`,
  migrations 108–110, historical one-worker observation and automated 1,291 total / 1,261 passed /
  30 protected skips / 0 failed. No fresh runtime check or automated rerun.
- **Changes / rollback:** Documentation and supplied screenshot only. No application/schema/configuration,
  receipt, approval, permissions or production changes. No remote data access or new production personal data.
  Production, R2/Production clone and Property Finder remain excluded. Pre-edit document copies:
  `uat-evidence\def115-controls-pre-record-20260902-204143`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; previous edits retained. Historical application/database
  backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` not accessed or exercised.

## DEF-116 — Stage 6 Save as draft returns internal server error — 2 September 2026

- **Exact user report:** "i clciked save as draft, internal error message".
- **Action / direct evidence:** User explicitly clicked `Save as draft` in Stage 6, Deal & completion.
  Screenshot displays `Draft not saved: Internal server error`, `No current draft` and `Draft history (0)`.
  Record as a failed draft-save attempt, not as a click on generic Save or Close Deal as Won.
- **Visible record:** Deal `NYSA-DL-202609-000001`, synthetic customer `uat173round1`, Booking
  `NYSA-BK-202609-000001`, exact Offer Revision 1, displayed amount AED 2,000,000 and status `approved`.
  These labels are now readable in this screenshot; the earlier partly obscured Deal reference has supporting
  UI evidence. No exact Opportunity reference, signed-in identity or runtime version is shown.
- **State boundary:** Management closure approval is displayed as Completed, while
  `Authoritative Closed Won recorded` shows `Blocks closure`. The header also contains that latter label,
  but it is not evidence of a completed closure. Stage 6 remains In progress. No approval action is attributed
  to Save as draft; the chronology and audit trail are unverified. Visible completion inputs remain populated
  in this frame, but their reload persistence is not established.
- **Expected / result:** Save as draft should preserve current stage inputs as a numbered draft without executing
  approval or closure, and clearly acknowledge the draft version. **Human-observed draft-save failure; open.**
  There is no acknowledged successful draft. Stored database state, partial writes, HTTP status, root cause
  and relation to other internal errors remain unverified. Do not infer a duplicate draft or confirmed data loss.
- **Impact / safety:** The user cannot rely on this failed draft attempt to retain unfinished work. Do not use
  generic Save or Close Deal as Won as a substitute for draft storage; those can perform business actions.
  No retry, closure, data replacement or remote mutation was performed by the assistant.
- **Evidence:** [Supplied failed-draft screenshot](uat-evidence/2026-09-02-def116/01-stage6-draft-not-saved.png),
  SHA-256 `dd80cc458368ecae9215f1b94753a78558ba25cc46f3216f8c0cd22704d99977`.
- **Baseline / acceptance:** CRM Test-only UAT lane; report-time hostname/version not independently verified.
  Preserve `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  No fresh automated/runtime checks, human passes, booking-lineage acceptance or closure acceptance inferred.
- **Changes / rollback:** Documentation and original screenshot only. No code, schema, configuration, migrations,
  tests, permissions, approval or deployment changes. Production, R2/Production clone and Property Finder
  remain excluded; no new production personal data obtained. Both pre-edit documents retained at
  `uat-evidence\def116-pre-record-20260902-204309`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior edits preserved. Historical application/database
  backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` not accessed or exercised.

## DEF-117 — Agent active pipeline remains Qualified after reported Deal progression — 2 September 2026

- **Exact user report:** "this is a problem. this is same agent login, we were in deal closure stage. however,
  the status is not updated in pipeline at a glance.."
- **Role / sequence:** User explicitly identifies the same Agent login and reports returning to the dashboard
  after reaching Deal closure. The previous screenshot identified Deal `NYSA-DL-202609-000001`,
  Booking `NYSA-BK-202609-000001`, customer `uat173round1`, Deal status `approved`, and
  Authoritative Closed Won still blocking closure. No successful closure was confirmed.
- **Direct screenshot evidence:** `Pipeline at a glance`, described as `Where your active work is now`,
  shows Customer 2, Lead 0, Contacted 0, Qualified 2, Viewing 0, Negotiation 0, Won 0 and Lost 0.
  It states two customers across two leads created in the selected period. Qualified carries
  `Schedule viewing` guidance. There is no explicit Deal/closure-stage category in the pictured sequence.
  Selected date filters, refresh timestamp and contributing-record identities are not included in this crop.
- **Expected:** An active-work pipeline must represent the governing Opportunity/Deal state and relevant next
  action after conversion, while preserving the source Lead's historical qualification. It should distinguish
  Deal completion/awaiting receipt or closure from a pre-viewing Qualified Lead, within the selected scope.
  Exact bucket mapping requires investigation; do not silently rewrite Lead history or move records into an
  arbitrary category to make the display agree.
- **Not expected:** Reaching a closure page or obtaining Deal approval is not Closed Won. The displayed Won 0
  is not itself a defect while actual receipt/final closure is outstanding. Do not mark the Deal Won or infer
  earlier stages failed solely because their current-work counts are zero.
- **Status / impact:** Open user-reported active-stage/dashboard inconsistency. The overview appears to direct
  the user back to scheduling a viewing after progression to Deal closure. Source-stage selection, propagation,
  refresh/cache, filters and aggregation semantics remain unverified; the screenshot alone does not distinguish
  them. No backend status mutation or lost transition is asserted, and no human pass is inferred.
- **Evidence:** [Supplied Agent pipeline screenshot](uat-evidence/2026-09-02-def117/01-agent-pipeline-qualified-after-deal-stage.png),
  SHA-256 `3e7d77c915ea44709a2d04bf0cac1a99c4b31a7c8246b71aca5a9e0a2a48c0d7`.
- **Baseline / scope:** CRM Test-only lane; report-time hostname/runtime identity not shown or freshly verified.
  Preserve `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  No fresh automated or live check is claimed.
- **Changes / rollback:** Only documentation and original screenshot retention. No code/schema/configuration,
  status, ownership, approval, closure, tests or deployment changes; no remote data access. Production,
  R2/Production clone and Property Finder remain excluded; no new production personal data obtained.
  Both documents backed up before editing to
  `uat-evidence\def117-pre-record-20260902-204609`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; prior edits preserved. Historical application/database
  backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` not accessed or exercised.

## DEF-117 follow-up — Second Lead contacted but pipeline reported unchanged — 2 September 2026

- **Exact user report:** "second lead is also contacted, which is also not updated, the pipeline is not being updated".
- **Scope extension:** DEF-117 now includes the user's second-Lead contact-status observation as well as the
  first journey's Deal-stage mismatch. The user describes the second Lead as contacted. No new screenshot or
  exact record ID accompanied this message; earlier context suggests `NYSA-LD-202608-000002` /
  `uat173round2`, but that association is not independently confirmed by this message.
- **Existing evidence:** The preceding Agent dashboard screenshot shows Contacted 0 and Qualified 2.
  See [pipeline screenshot](uat-evidence/2026-09-02-def117/01-agent-pipeline-qualified-after-deal-stage.png),
  SHA-256 `3e7d77c915ea44709a2d04bf0cac1a99c4b31a7c8246b71aca5a9e0a2a48c0d7`.
  The contact event, saved lifecycle stage and dashboard refresh/filter state have not been inspected live.
- **Interpretation boundary:** Record the reported non-update, not a proven database failure or a required
  Contacted count of 1. Contact activity is distinct from the current lifecycle stage: an already-qualified
  Lead may correctly remain Qualified after further contact. Reconcile the second Lead's contact evidence,
  qualification/current stage and selected-period scope before deciding the correct bucket. Do not downgrade
  qualification, alter business rules, double-count historical stages or change status as a workaround.
- **Result:** Additional user-reported evidence on the existing open DEF-117; no new defect number or human pass.
  Root cause and correct counts remain unverified. The total open issue count remains 12.
- **Baseline / changes:** Retain CRM Test `2.1.0-dev.174`, package SHA-256
  `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`, migrations 108–110,
  historical one-worker observation and automated 1,291 total / 1,261 passed / 30 protected skips / 0 failed.
  Documentation only; no live checks, tests, migrations, code/configuration or business-data changes.
  Production, R2/Production clone and Property Finder remain excluded; no new production personal data obtained.
- **Rollback:** Both pre-edit documents copied to
  `uat-evidence\def117-second-lead-pre-record-20260902-204736`.
  Local HEAD `1af87ba994599d8de1bab6d37b2005e609d449fe`; earlier edits retained. Historical application/database
  backup `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z` not accessed or exercised.

## 2 September 2026 — local remediation after “pl fix... all these”

The owner authorized implementation for DEF-102 and DEF-107 through DEF-117. Exact prior human
observations, screenshots and open statuses are retained. No human UAT pass or repaired production/Test
record is inferred from the following local work.

- Local correction map and reproducible evidence: [dev.175 remediation record](CRM_TEST_DEV175_UAT_REMEDIATION.md).
- Implemented: Inventory/Lead-opening runtime fix; stage layout and nested-dialog ordering; outcome/checklist
  refresh without leaving the stage; explicit named actions instead of generic Save; document context and
  pending-review fixes; exact recovery evidence; commission handoff guidance; audit-compatible draft saving;
  shared scoped active-pipeline projection and linked-Opportunity navigation.
- Local ordinary suite: **1,305 total / 1,264 passed / 41 protected skips / 0 failed**.
- Separate enabled synthetic HTTP/PostgreSQL checks: **11 passed / 0 failed**; separate governed
  acceptance → reservation → Deal-lineage journey: **1 passed / 0 failed**, including duplicate-Deal rejection.
- Browser skill verification on a loopback synthetic fixture: outcome dialog opens immediately and closes on
  successful save; saved feedback appears in Stage 2; checklist completion stays in Stage 6; draft v2 saves;
  final-PDF upload controls are visible; desktop/mobile stage chrome does not overlap content.
  These are agent-observed local results, not human CRM Test UAT.
- Migration 111 applied only locally: preserve the prior audit entity constraint and add OpportunityStageDraft.
  No remote schema change. No permission, finance, compliance, closure or reservation gate bypass.
- **Still open for human retest:** all 12 issues. DEF-111 remains a suspected original-record bypass, not a proven
  database bypass. DEF-117's second Lead must be reconciled with its actual qualification/contact history; do not
  downgrade Qualified merely because further contact occurred. No actual CRM Test booking/closure was asserted.
- CRM Test remains recorded at **2.1.0-dev.174**,
  SHA-256 **30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71**,
  migrations **108–110**, historical **one-worker observation** and
  **1,291 total / 1,261 passed / 30 protected skips / 0 failed**. These historical figures are unchanged.
- Planned dev.175 corrections are local only; no package/deployment or new release SHA claimed. Before a new
  Test candidate, retain the dev.174 package and take a fresh paired Test file/database backup. Human UAT remains
  pinned to dev.174 until authorized to move. Production, R2/Production clone and Property Finder were not touched;
  no new production personal data was used.
- Recoverable pre-edit archive:
  `remediation-baselines\dev174-before-uat-fixes-20260902-205015\source-and-evidence.zip`,
  SHA-256 `4fc64d638e27456d70443da37c2fb4315168a8f74a0d7cb8ac27925225cd0d54`.
  Historical remote rollback remains `/home/nysareal/crm-backups/consolidated-crm-test-dev162-20260830T193536Z`,
  not accessed or restored. Migration rollback must preserve all newly recorded audit evidence.

### 2 September 2026 — dev.175 deployment authorized; sign-in pending

Owner: “ok pl deploy”. Built the separate dev.175 archive, SHA-256
`80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b`.
Release rerun: **1,307 total / 1,266 passed / 41 protected skips / 0 failed**;
enabled database regression **11/11**, separate governed journey **1/1**.
All 110 prior migration bytes match dev.174; migration 111 is the sole new schema step.

cPanel requires manual owner sign-in. **No remote upload/install/migration/restart has occurred; no fresh
remote backup has yet been created.** The historical dev.174 package SHA, migrations 108–110, one-worker
observation and 1,291/1,261/30/0 automated result remain retained; none is replaced by a claimed live dev.175 result.
All 12 issues remain open for deployed human retest. Production, R2/Production clone and Property Finder untouched.
See [deployment status and guarded backup/rollback plan](CRM_TEST_DEV175_DEPLOYMENT_STATUS.md).

### 2 September 2026 — dev.175 deployed after owner sign-in

Owner reported “done” after sign-in, continuing the recorded Test deployment authorization.
This entry supersedes the preceding sign-in-pending status, without changing historical evidence.

- **CRM Test only:** https://crm-test.nysarealty.com/ now serves **2.1.0-dev.175**.
  Health and database readiness both returned ready with that version.
- Installed archive SHA-256:
  `80f8773151a40b8516a1db09d871087b23eb0a926bd606141ad069ce4d48039b`.
  Exact runtime manifest verified; migration **111** applied, with all prior 110 migration bytes preserved.
- The initial guarded attempt stopped before backup/install after finding two existing Test workers.
  The revised installer verified their exact Test process labels and sockets before restarting them.
  Final and separate post-install checks confirmed **one Test worker, PID 4184054**.
  No cause for the earlier two-worker state is inferred.
- Fresh paired rollback backup:
  `/home/nysareal/crm-backups/consolidated-crm-test-dev175-20260902T180327Z`.
  Database archive and application archive readability were verified before replacement; checksums retained.
  Rollback must preserve audit evidence and account for intervening user writes.
- Automated release evidence remains **1,307 total / 1,266 passed / 41 protected skips / 0 failed**,
  plus enabled database regression **11/11** and separate governed journey **1/1**.
  **All 12 reported issues remain open for deployed human retest. No human UAT pass is inferred.**
  No original business record was manually repaired or declared successfully booked/closed.
- Historical dev.174 SHA-256 `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`,
  migrations **108–110**, its one-worker observation, and **1,291/1,261/30/0** automated result remain unchanged.
- Production, R2/Production clone and Property Finder remain excluded. Protected-root package hashes were
  unchanged; integration switches stayed disabled. No new production personal data was used.
  Existing permissions, finance/compliance/closure gates and private storage were preserved.

See [deployment completion and rollback evidence](CRM_TEST_DEV175_DEPLOYMENT_COMPLETION.md).

### 2 September 2026 — commission-proof gap acknowledged; dev.176 local remediation

Exact subsequent owner observations/questions:
- “where should i upload proof of commission” (attachment `codex-clipboard-393a93fe-df29-4f09-97ab-b144425effb5.png`).
- “u fixed it and tested right?” and “u are wasting my time... u confirmed everything fixed. and then it fails”.
- Owner authorized “pl do” after the incomplete coverage was acknowledged.
- “accountant role - is it available in the application and what are workflow steps for him, what menu options he will see”.

The earlier claim of complete functional coverage was incorrect. dev.175 had text evidence references, not
commission-proof file upload. No user has reported a successful proof upload or accepted the dev.176 candidate.

| Item | Evidence and local correction | Acceptance status |
| --- | --- | --- |
| DEF-118 — missing commission-proof upload | User could not identify where to upload proof; source confirms no upload control in dev.175. Added private PDF/PNG/JPEG upload, same-Deal receipt attachment, persisted list/download and receipt history. | Locally verified; not deployed or human accepted. |
| DEF-119 — Accountant finance entry point missing | User asked about role/workflow. Agent inspection confirmed assignable Accountant and receipt authority, but no finance menu and no Opportunity access. Added restricted Finance Receipts search/open workflow. | Agent-discovered navigation gap; local Accountant browser/API checks pass, no human UAT claim. |
| DEF-120 — receipt confirmation date causes 500 | New synthetic database test returned 500 because a pg DATE became `Wed Sep 02`. Corrected calendar-date normalization and date-only serialization. | Agent-discovered local defect; receipt confirmation and actual Closed Won integration now pass. |

Local candidate is **2.1.0-dev.176** with additive migration **112** applied only to the restricted loopback
synthetic database. CRM Test remains **dev.175 / migration 111**; no new deployment, remote restart or user-record
repair was performed. All earlier user-failed issues remain open for deployed human retest.

Verification: ordinary **1,315 total / 1,268 passed / 47 protected skips / 0 failed**; separately enabled
commission proof/finance **5/5**, prior dev.175 runtime regressions **11/11**, and governed journey plus
full approved-Deal/receipt/Closed-Won reconciliation **2/2**. These results are machine verification, not human UAT.
Browser checks: agent upload stays in Stage 6; Accountant Finance Receipts reaches proof, receipt recording and
confirmation; uploaded file/download and recorded receipt remain visible; date is 2026-09-02; viewing save closes
only the outcome form and retains Stage 2; checklist save retains Stage 6; draft history advances to v2;
Stage 1 desktop header/body/footer do not overlap. The fixture's artificially seeded stage state is not evidence
about the user's suspected original-record bypass. The separate governed journey checks explicit creation and
closure; no historical Lead is downgraded to infer a pipeline pass.

Finance/closure/Director-payout permissions remain separate. Text-reference support is retained; mandating file
uploads for every receipt was not silently added as a business rule. Production, R2/Production clone and
Property Finder remain untouched. Only synthetic data used; historical dev.174/175 checksums, migrations,
worker observations and automated results are retained unchanged.

See [dev.176 remediation and rollback record](CRM_TEST_DEV176_COMMISSION_PROOF_REMEDIATION.md) and
[Accountant workflow: deployed state versus candidate](ACCOUNTANT_RECEIPT_WORKFLOW.md).

## 2026-09-02 — Receivables extension, not a defect-closure claim

User requested an Opportunity-wise commission receivables module and clarified: “yes separate invoice per payin”. Added local dev.177 Receivables for Accountant/Director/full Administrator, with separate instalment invoices, requested 5% VAT, collections and balance/status tracking. Migration 113 is local-only; remote Test remains last verified dev.175. No existing defect is marked human-passed by this extension.

Final machine checks: ordinary 1,326 total / 1,271 passed / 55 protected skips / 0 failed; separate DB suites 8 new receivables + 5 proof/finance + 2 governed closure + 11 prior-remediation checks passed. Local browser verification created distinct invoice references and observed partial payment → full payment on invoice 1 without paying invoice 2. No real bank transaction or original user record was modified. Initial development-only due-date SQL ambiguity was fixed before the final green run; it was not a user-reported defect.

Explicitly separate: VAT-inclusive receivables tracking versus the existing net-commission Finance Receipts confirmation and governed Close Won gate. Statutory invoice generation, automatic accounting/receipt allocation and credit-note issuance are not claimed. See [dev.177 scope, evidence, privacy and rollback](CRM_TEST_DEV177_RECEIVABLES.md). Preserve all prior package/migration/worker/test evidence and all pending human retests. Production, R2/Production clone and Property Finder remain untouched.

## 2 September 2026 — dev.176-only deployment completed

Owner requested “yes pl only 176”, reconfirmed “ok pl deploy”, and explicitly answered “ok” to
the four-file staging upload into `/home/nysareal`. This is deployment authorization, not human UAT.
The cumulative count is **24 observations: 23 defects/suspected defects plus SPEC-GAP-001**.
The earlier 21-item summary is historical; DEF-118–120 add three distinct items. Repeated screenshots
are not counted again. Nine runtime changes from dev.175 do not mean nine defects.

CRM Test now serves **2.1.0-dev.176**, package SHA
`5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`.
Installer exit 0; health and database readiness ready; **112 migrations**, newest
`112_dev176_commission_proof.sql`; one verified worker **2851276**.
Fresh paired rollback: `/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.
Installed runtime manifest, served finance asset hash, proof schema and excluded-receivables checks passed.

DEF-118–120 are now deployed, not human accepted. All prior human failures remain pending retest;
no original-record booking, bypass, receipt, closure or pipeline pass is inferred. Isolated machine
results remain **1,315 total / 1,268 passed / 47 protected skips / 0 failed**, with separate
**5 proof/finance + 11 prior regressions + 2 governed closure** checks passed; package/installer **2/2**.

Local dev.177 and subsequent receivables/access/payout/closure scope were excluded. Existing receipt
closure gate and Director-only payout remain unchanged. Production/R2 fingerprints unchanged;
Property Finder/M365/Calendly disabled. No production personal data copied or business-record repair.
Historical dev.174/175 SHA, migrations, worker observations and tests preserved.
See [dev.176 deployment and rollback evidence](CRM_TEST_DEV176_DEPLOYMENT_COMPLETION.md).

## 3 September 2026 — proof uploaded; agreed commission-independent closure still missing

Exact owner report: “first screen of agent - he uploaded payment proof, then second screen is of manager,
he is tring to close the opportunity, and the error message, what is expected behavior here. i tht we
agreed that commission receipt is not mandatory for closre”.

- DEF-118: owner reports Agent uploaded proof; screenshot `codex-clipboard-cb669a84-bc78-4c7e-8e7e-54c4068cd70b.png`
  shows an uploaded proof row and Download proof action. Record this narrow user-observed upload result.
  Download, persistence after a fresh login, finance reconciliation and overall defect acceptance were not reported.
- SPEC-GAP-002: agreed commission-independent Deal/Opportunity closure is not implemented in dev.176.
  Screenshot `codex-clipboard-1f861948-c7ee-4711-bd9a-19d542b66df1.png` shows
  “Confirmed actual commission receipt is required before Close Won”. Source inspection of the isolated,
  deployed-hash-matched dev.176 `src/routes/opportunities.js:1426` confirms an explicit 409 guard.
  This is retained old policy, not an upload failure or a new unexplained server error.
- Agreed target: authorized management closes when transaction completion, document/compliance,
  approval and record-alignment requirements are satisfied; commission collection remains independently
  outstanding until Finance records/confirms it. Closure must not fabricate a receipt or release payout.
- Deployment scope had expressly deferred this change alongside subsequent finance work. The agreed target
  remains valid; source changes, tests and a later approved deployment are still required. No new deployment,
  migration, receipt confirmation, closure, data repair or production action occurred in this observation turn.

Count is now **25 cumulative items: 23 defects/suspected defects and 2 specification gaps**. This new
scope gap is distinct from DEF-115 receipt-step discoverability. Historical evidence remains unchanged.

### 3 September 2026 — Accountant follow-up and approved local corrections

Exact owner reports: “i am in accountantscreen now\.. it has un necessary tabs: it oinly should have
dasboard, opportunity, my leave, finance receipts for now, subsequently we would add for payout
calculation, invoicing and payment confirmaion.”; “here upload commission proof is added, whihc is
still ok, so he can upload here as well.”; “in amount fild, allow input like K, M for 000 and millions.”;
“the reference here is wrong, here reference is deal, while it should be opportunity, as opportunity
is the transaction satge”. Screenshots: `codex-clipboard-d8f199ab-6a42-4837-ad38-d1969d3adbfc.png`
and `codex-clipboard-8a18c922-d132-4ea0-b833-fc2e1c237f36.png`.

These extend the Accountant/Finance follow-up, not new human passes or closure of DEF-119. Proof
upload availability is approved; no Accountant upload/download success is inferred. Local changes:
four tabs plus server access restrictions, read-only Opportunity finance view, Opportunity-primary
receipt reference, and exact K/M amount input. Bank/payment reference remains separate; Deal linkage
is retained. See [scope and machine verification](ACCOUNTANT_FOUR_WORKSPACES_AND_RECEIPT_INPUT.md).
Ordinary 1,334 / 1,278 passed / 56 protected skips / 0 failed; focused units 5/5; enabled synthetic
finance/access 6/6 and prior runtime 11/11. Browser verified local rendering/navigation/previews only.
No deployment, migration, human acceptance or change to SPEC-GAP-002's closure gate. Cumulative
25-item count and all prior failures remain unchanged; these are recorded follow-up requirements.

### Preserved dev.176 baseline

SPEC-GAP-002 update — actual closure correction now implemented LOCALLY. Owner confirms the
independent Manager-closure/Accountant-collection flow (“yes”) and emphasizes this was the original
blocking issue. Removed receipt gating from Close Won API and added migration 114 removing its DB
trigger. Required transaction/compliance/approval/alignment checks and Director payout rules remain.
Unpaid sale and partially collected commercial sale/rental synthetic flows close first and collect
afterward (2/2 each), without fabricated receipt/credit/payout; Finance still finds the same closed
Opportunity. Existing finance regression 6/6, prior runtime 11/11, rollback check 1/1.
NOT deployed/human accepted; original live failure remains pending approved deployment and human
retest, and cumulative count is unchanged. See [actual correction and rollback](COMMISSION_INDEPENDENT_CLOSURE_CORRECTION.md).

Manager commercial closure follow-up: owner states Manager closure need not require MD approval,
then explicitly confirms extending it to commercial sales/rentals: “yes pl, MD should not doing
operational stuf”. Implemented locally: managed-team Manager approval/closure, and Manager delegation
for the standard commercial DIRECTOR_REVIEW checklist item with original template/audit identity
preserved. Other-team/Agent/Accountant authority is unchanged. No additional MD decision is required;
Director remains an optional authorized approver. Custom Director-only review items are not rewritten.
Focused policy/UI 15/15; synthetic commercial sale and rental closure API fixtures 2/2 each.
Not deployed or human accepted; no new defect acceptance/count change. SPEC-GAP-002 remains open.
See [decision, scope and rollback](MANAGER_COMMERCIAL_CLOSURE_AUTHORITY.md).

Accountant wording follow-up: screenshot `codex-clipboard-1eca5180-c780-48ee-b00f-f7e4a3d17e1f.png`
shows “Close Won blocked”. Owner: “what is the line, this screen does not have this required to be
shown for accountant”, then “ok confirmed do it”. Receipt-only wording implemented locally after
confirmation: Not recorded / Awaiting confirmation / Confirmed; Confirm actual receipt action.
Accountant closure/payout commentary removed, other roles and server rules preserved. Six new
synthetic rendering checks and five existing focused checks passed. No deployment, new human pass,
or resolution of SPEC-GAP-002; cumulative item count remains unchanged. Details and rollback are in
[Accountant correction record](ACCOUNTANT_FOUR_WORKSPACES_AND_RECEIPT_INPUT.md).

Baseline: dev.176 package `5684fe7adec79173054a088e52d395465d66a01316b13fd49f22234b2c987560`,
migration 112, worker 2851276 at deployment observation, paired rollback
`/home/nysareal/crm-backups/consolidated-crm-test-dev176-20260902T194125Z`.
