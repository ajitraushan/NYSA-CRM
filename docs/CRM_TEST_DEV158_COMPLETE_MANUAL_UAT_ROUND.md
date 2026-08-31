# NYSA CORE dev.158 — Complete Human UAT Round

> **Actual-record mapping:** use `CRM_TEST_DEV158_ACTUAL_RECORD_CROSS_REFERENCE.md`. Sales Agent A means `UAT158 Agent Alpha One`, Sales Agent B means `UAT158 Agent Alpha Two`, Team A means `UAT158 Dubai Secondary Sales`, and Team B means `UAT158 Dubai Rentals`.

Date prepared: 18 August 2026  
Environment: CRM Test only  
Overall status: manual execution not started/completed by this checklist  
Excluded: Property Finder and every disabled external integration

## 1. Purpose and pass rule

This is one complete human round covering the normal customer-to-Deal journey and its important
exceptions: rerouting, reassignment, return, rejection, withdrawal, cancellation, expiry, delink,
replacement, administrative closure and governed maintenance.

A scenario passes only when the tester observes the expected screen behavior in CRM Test. Automated,
API or database evidence may support a result but does not replace the human observation requested here.
Record a defect rather than improvising data repairs when a step fails.

For each result capture: tester role, workspace, synthetic record reference, prerequisites, exact actions,
expected result, actual result, pass/fail/block, screenshot, workaround and any linked UAT defect ID.

## 2. Safety and evidence rules

- Use synthetic names, phone numbers, email addresses, owners, authorities and documents only.
- Do not capture credentials, session tokens, private files or real owner/customer data in screenshots.
- Do not enable or exercise Property Finder, native WhatsApp, Microsoft 365 Email or Calendly.
- Do not test Production or the R2 clone.
- Preserve identifiers and history. Do not delete/recreate a failed record merely to continue.
- Use a separate synthetic record when a terminal result would prevent later exception testing.
- “Fixed locally,” “API passed” and “automated test passed” are not human UAT passes.

## 3. Roles and minimum synthetic dataset

Use the companion [dev.158 test-data and Administrator setup plan](CRM_TEST_DEV158_MANUAL_UAT_DATA_AND_ADMIN_SETUP.md)
for recommended record counts, exact synthetic examples and creation order.

Prepare these authorized CRM Test identities without writing their private details in evidence:

- full Administrator;
- `UAT158 Agent Alpha One` and `UAT158 Agent Alpha Two` in `UAT158 Dubai Secondary Sales`;
- `UAT158 Manager Alpha` responsible for `UAT158 Dubai Secondary Sales`;
- `UAT158 Agent Beta One` and `UAT158 Manager Beta` in `UAT158 Dubai Rentals` for cross-team tests;
- `UAT158 Listing Executive` responsible for Inventory;
- Director; and
- Accountant/finance role if enabled for the tested finance and commission steps.

Prepare five reusable lanes:

| Lane | Purpose | Minimum records |
| --- | --- | --- |
| A — successful Sale | Full happy path through Closed Won | Customer, Lead, requirement, eligible Inventory, Opportunity, Viewing, Offer, Booking and Deal |
| B — recovery and loss | Returns, rejections, rescheduling, withdrawal and Closed Lost | Separate Customer/Lead, two Inventory options and one Opportunity |
| C — routing and ownership | Queue, rejection, rerouting and coordinated reassignment | External-source Lead routed to `UAT158 Dubai Secondary Sales`, then moved within/cross-team |
| D — Inventory exceptions | Verification, expiry, ineligibility, closure and delink | Draft, returned, rejected, expired and active-assignment Inventory records |
| E — governance | Administrator maintenance and versioning | Test team, area, routing rule, SLA/value/model/policy drafts and Developer company |

## 4. Execution order

Run the sections in this order so prerequisites exist when reversals are tested:

1. baseline and permissions;
2. Administrator maintenance;
3. customer/company and consent;
4. Lead capture, routing and reassignment;
5. activities, tasks, qualification and requirements;
6. Inventory creation, owner authority and verification;
7. Opportunity, matching and assignment;
8. Viewing, Offer, Booking and Deal;
9. closure, delink, expiry and replacement exceptions;
10. proposals, documents, finance and commission;
11. dashboards, queues, leave and reporting;
12. audit/history reconciliation and final status.

## 5. Baseline, access and role boundaries

- [ ] **BASE-01** Confirm CRM Test displays `2.1.0-dev.158`, health/readiness are available and the latest migration is 100.
- [ ] **BASE-02** Confirm each role lands on the correct role dashboard and can open only its permitted navigation.
- [ ] **BASE-03** Confirm an unauthenticated browser cannot open CRM/API records and returns to login safely.
- [ ] **BASE-04** As `UAT158 Agent Alpha One`, confirm records belonging to `UAT158 Dubai Rentals` are outside Customer, Lead, Opportunity and restricted-document scope.
- [ ] **BASE-05** Confirm Listing Executive has Inventory authority but does not gain general unrelated-customer access.
- [ ] **BASE-06** Confirm Director receives company oversight/read access but cannot silently perform ordinary Agent maintenance.
- [ ] **BASE-07** Confirm Accountant sees only the permitted Deal/finance subset and not general Lead communications.
- [ ] **BASE-08** Confirm hidden controls are also rejected when an unauthorized user attempts the equivalent action through normal UI navigation.
- [ ] **BASE-09** Confirm logout/session expiry removes access and browser Back does not reveal usable private content.

## 6. Administrator maintenance and governance

### 6.1 Users, teams and access

- [ ] **ADM-01** Create a synthetic test user with the intended role/team; confirm it appears once and can sign in only after activation.
- [ ] **ADM-02** Attempt a duplicate/invalid user; confirm a clear rejection and no partial user/team membership.
- [ ] **ADM-03** Add and end a team membership; confirm effective role/team scope changes without rewriting history.
- [ ] **ADM-04** Suspend/revoke the test user with a reason; confirm active sessions are invalidated and an audit event is visible.
- [ ] **ADM-05** Reactivate only through the permitted action; confirm old audit history remains.
- [ ] **ADM-06** Create, edit and deactivate a synthetic team; confirm a team still referenced by active work cannot disappear silently.
- [ ] **ADM-07** Confirm Administrator maintenance does not grant business approval authority where Manager/Director approval is required.

### 6.2 Areas, routing and SLA policies

- [ ] **ADM-08** Create and edit a synthetic Area; confirm stable code, label, emirate and order render correctly.
- [ ] **ADM-09** Preview an Area workbook containing valid, duplicate and invalid rows; confirm nothing commits during preview.
- [ ] **ADM-10** Commit the reviewed valid rows; retry the same data and confirm duplicates are skipped/rejected without duplication.
- [ ] **ADM-11** Attempt to retire an Area used by an active routing rule; confirm the dependency blocks retirement.
- [ ] **ADM-12** Create routing rules with different priorities, source, business line and Area; confirm the highest applicable active rule wins.
- [ ] **ADM-13** Edit and retire a routing rule with a reason; confirm new Leads use the new rule while earlier routing history remains unchanged.
- [ ] **ADM-14** Confirm a Lead with no specific match reaches the company fallback/unassigned queue rather than disappearing.
- [ ] **ADM-15** Draft and activate a new SLA policy; confirm new assignments use it and historical due times retain their original policy evidence.
- [ ] **ADM-16** Attempt invalid/overlapping SLA or routing configuration; confirm a clear validation error and no partial activation.

### 6.3 Controlled values, qualification and company settings

- [ ] **ADM-17** Create a draft controlled-value set/definition, activate it and confirm it appears in the consuming form.
- [ ] **ADM-18** Rename a used display label; confirm the stable code and historical report meaning do not change.
- [ ] **ADM-19** Attempt to delete a used/active value; confirm hard deletion is blocked and retirement/replacement is required.
- [ ] **ADM-20** Draft, test, approve and activate a qualification model; confirm an active version cannot be edited in place.
- [ ] **ADM-21** Retire/supersede a model and confirm earlier assessments retain their exact model version and contributions.
- [ ] **ADM-22** Draft, approve and activate Organization Settings/branding; confirm only the new active version is used and prior versions remain visible.
- [ ] **ADM-23** Attempt activation before approval or deletion after use; confirm the governed sequence is enforced.

### 6.4 Developer, Inventory and document policies

- [ ] **ADM-24** Create a Developer company without creating a Customer or personal legal owner.
- [ ] **ADM-25** Create a governed Developer version for each applicable legal structure; confirm the system derives evidence digest metadata.
- [ ] **ADM-26** As Manager/Director/Administrator, create an authorized non-duplicate Developer version and confirm the intended audited activation behavior.
- [ ] **ADM-27** Exercise suspected-duplicate Developer handling; confirm it does not silently create two active identities.
- [ ] **ADM-28** Retire/supersede a Developer version and confirm linked Inventory retains historical provenance.
- [ ] **ADM-29** Change listing/media approval policies; confirm only future workflow is affected and existing pending work remains explainable.
- [ ] **ADM-30** Create/version/retire a document rule or template; confirm used versions cannot be overwritten.
- [ ] **ADM-31** Maintain a fee/financial assumption version and confirm calculated scenarios retain the exact version used.
- [ ] **ADM-32** Maintain commission, employment/leave and compliance policies; confirm policy maintenance does not itself approve business transactions.
- [ ] **ADM-33** Open Operations/Audit and confirm every material maintenance action above records actor, time, target and reason.

## 7. Customer, contact, company and consent exceptions

- [ ] **CRM-01** Create a synthetic Customer with valid channels; confirm normalized phone/email and preserved display input.
- [ ] **CRM-02** Enter an exact phone/email duplicate; confirm a review warning and no silent duplicate Customer.
- [ ] **CRM-03** Create an external Company and assign multiple business roles; confirm no login or duplicate company is created.
- [ ] **CRM-04** Merge two permitted duplicate Contacts with a reason; confirm relationships/history move and the source record remains auditable.
- [ ] **CRM-05** Attempt an unauthorized or unsafe merge; confirm it is blocked without partial relationship changes.
- [ ] **CRM-06** Record valid marketing consent only against the required approved agreement version.
- [ ] **CRM-07** Attempt consent without valid evidence; confirm Granted cannot be selected or saved.
- [ ] **CRM-08** Withdraw/expire/supersede consent; confirm marketing outreach is suppressed while ordinary service/customer discussion remains possible.
- [ ] **CRM-09** Create a transaction-only counterparty; confirm it does not create a Customer unless explicitly promoted later.

## 8. Lead capture, queue, rerouting and ownership

- [ ] **LEAD-01** Create a manual Agent-owned Lead; confirm it is assigned to the creator when policy permits and does not falsely claim it entered a Manager queue.
- [ ] **LEAD-02** Create an external/company-owned Lead; confirm received source/time and routing to the expected team queue.
- [ ] **LEAD-03** As `UAT158 Manager Alpha`, assign it to `UAT158 Agent Alpha One`; confirm the queue stays stable and the card/count refresh correctly.
- [ ] **LEAD-04** As `UAT158 Agent Alpha One`, accept; confirm acceptance time, SLA and assignment history.
- [ ] **LEAD-05** On a separate Lead, reject with a reason; confirm the reason is visible and the Lead returns to the correct managed queue.
- [ ] **LEAD-06** Attempt rejection without a reason; confirm it is blocked.
- [ ] **LEAD-07** Claim an eligible queued Lead; confirm concurrent/second claim cannot create two owners.
- [ ] **LEAD-08** Let an assignment reach its expiry/timeout condition where practical; confirm it returns/reassigns according to policy and is audited.
- [ ] **LEAD-09** Reassign `UAT158 Agent Alpha One` → `UAT158 Agent Alpha Two` within `UAT158 Dubai Secondary Sales`; confirm creator, prior owner, original SLA and assignment history remain intact.
- [ ] **LEAD-10** Perform coordinated cross-team reassignment to `UAT158 Dubai Rentals` with selected Lead/Opportunity scope; confirm only selected records move atomically.
- [ ] **LEAD-11** Leave one linked record unselected during coordinated reassignment; confirm it remains with its prior owner and no mixed hidden update occurs.
- [ ] **LEAD-12** Attempt cross-team reassignment as an unauthorized Agent; confirm rejection.
- [ ] **LEAD-13** Change ownership after an Offer exists; confirm the Offer creator remains immutable while servicing authority moves correctly.
- [ ] **LEAD-14** Confirm rerouting/reassignment never changes source, campaign, original creator or immutable attribution.
- [ ] **LEAD-15** Search the Lead by reference/name beyond the first page and confirm it is discoverable in its new scope.

## 9. Activities, tasks, qualification and requirements

- [ ] **WORK-01** Record a completed inbound and outbound customer discussion; confirm direction/outcome labels are business-readable.
- [ ] **WORK-02** Record an internal note and a planned follow-up; confirm they are distinct from completed contact.
- [ ] **WORK-03** Save an activity with optional document version blank; confirm no runtime error.
- [ ] **WORK-04** Attempt ordinary customer service contact after marketing withdrawal; confirm it is allowed while prohibited marketing remains blocked.
- [ ] **WORK-05** Create, reassign, complete and reopen/correct a task where permitted; confirm due/status history and actor are retained.
- [ ] **WORK-06** Attempt to leave an active Lead without a next action; confirm approved holding/terminal logic is required.
- [ ] **QUAL-01** Calculate qualification at cold/warm/hot threshold boundaries and confirm factor contributions.
- [ ] **QUAL-02** Submit missing required answers; confirm calculation is blocked or follows the configured missing-answer rule.
- [ ] **QUAL-03** As Manager, override with a reason; confirm the calculated result remains visible and the override is a separate audited record.
- [ ] **QUAL-04** Recalculate after model/version change; confirm prior assessment is not overwritten.
- [ ] **REQ-01** Save complete structured requirements and confirm the version becomes current.
- [ ] **REQ-02** Change budget/area/property constraints; confirm a new version and exact history.
- [ ] **REQ-03** Create/resolve a requirement conflict; confirm confirmation is blocked until resolution.
- [ ] **REQ-04** Attempt Opportunity creation before qualification/requirements are ready; confirm a clear block without partial Opportunity.

## 10. Inventory creation, owner authority and verification

- [ ] **INV-01** Create a draft Inventory with valid governed Area and required core facts.
- [ ] **INV-02** Attempt duplicate/invalid Inventory; confirm warning/block and no partial duplicate.
- [ ] **INV-03** Save owner/represented-party identity, source and internal-use authority evidence first in Step 2.
- [ ] **INV-04** Confirm Inventory party creation does not create a Customer/Contact automatically.
- [ ] **INV-05** Submit verification without owner/authority evidence; confirm it is blocked.
- [ ] **INV-06** Submit valid verification and confirm it appears in the responsible Manager queue.
- [ ] **INV-07** As the submitter, attempt to decide the same request; confirm self-decision is blocked.
- [ ] **INV-08** As Manager, use `Review Inventory`; confirm the exact submitted Inventory opens before a decision.
- [ ] **INV-09** Return for correction with a reason; confirm draft/correction state, reason visibility and resubmission path.
- [ ] **INV-10** Reject a separate request; confirm it does not become operationally available and history remains.
- [ ] **INV-11** Verify/exempt through an authorized decision; confirm approved/effective status and audit evidence.
- [ ] **INV-12** Attempt an unauthorized/out-of-team decision; confirm scope rejection.
- [ ] **INV-13** Link/unlink Developer/agency provenance; confirm price, availability and verification do not change as a side effect.
- [ ] **INV-14** Map Community/comparable evidence; confirm advisory wording and no valuation/lifecycle mutation.
- [ ] **INV-15** Reassign responsible `UAT158 Listing Executive`; confirm originating agent and full responsibility history remain.
- [ ] **INV-16** Exercise reopen request/decision after a terminal administrative state where permitted.
- [ ] **INV-17** Confirm UAT-049: Developer selector should show the company name without appending `Developer Master v1`.
- [ ] **INV-18** Confirm UAT-050 separately: ordinary Inventory maintenance must expose expiry alongside `Availability checked on`.
- [ ] **INV-19** Test the separate dashboard/card `Update availability` action: valid period saves; missing, reversed, past-expiry and future-confirmation values fail clearly.
- [ ] **INV-20** Confirm availability quick action and ordinary form do not create inconsistent values or overwrite unrelated Inventory fields.

## 11. Opportunity, matching and assignment exceptions

- [ ] **OPP-01** Create buyer-side Opportunity from qualified Lead; confirm Customer, requirement and attribution inherit without retyping.
- [ ] **OPP-02** Create seller/inventory-side and dual-representation variants; confirm exact party/authority/disclosure requirements.
- [ ] **OPP-03** Attempt duplicate Opportunity creation from the same context; confirm existing Opportunity is surfaced.
- [ ] **OPP-04** Confirm newly created Opportunity is immediately searchable and visible in the correct pipeline.
- [ ] **OPP-05** Update next action and move through valid stages; confirm invalid/skipped/backward movement is rejected unless a governed recovery path exists.
- [ ] **MATCH-01** Rank operationally usable Inventory across budget, Area/Community, property type, bedrooms, size, funding/payment, timing and customer-declaration fit; confirm customer-fit variances remain selectable and explainable.
- [ ] **MATCH-02** Confirm 520 sqft passes a 500 sqft minimum and exact-boundary values behave correctly.
- [ ] **MATCH-03** Confirm missing, failed or unassessed must-have/exclusion evidence affects ranking and the visible exception explanation but does not make operationally usable Inventory ineligible.
- [ ] **MATCH-04** Confirm Sold, Rented, administratively Closed, unverified and verification-expired Inventory cannot be assigned.
- [ ] **MATCH-05** Confirm explicitly expired availability blocks eligibility, while missing/old legacy confirmation is visibly advisory according to approved policy.
- [ ] **MATCH-06** Confirm an operationally blocked record shows readable reasons and `Correct Inventory and return` restores the same Opportunity context; customer-fit variances must remain selectable.
- [ ] **MATCH-07** Add multiple eligible Inventory options; confirm each creates a separate seven-day Assignment and immutable acknowledgement.
- [ ] **MATCH-08** Attempt duplicate active assignment; confirm no second active link.
- [ ] **MATCH-09** Shortlist, reject and reconsider a match; confirm every decision remains in history.
- [ ] **MATCH-10** Confirm matching never edits price, Inventory status, verification or owner evidence.

## 12. Viewing lifecycle and recovery

- [ ] **VIEW-01** Schedule a Viewing from the exact active Opportunity/Inventory assignment.
- [ ] **VIEW-02** Attempt Viewing with excluded/terminal/expired Inventory; confirm a block without partial Viewing.
- [ ] **VIEW-03** Confirm, reschedule and then complete a Viewing; verify old and new schedule history.
- [ ] **VIEW-04** Record attended outcome and customer feedback; confirm next action updates appropriately.
- [ ] **VIEW-05** Record cancelled, declined and no-show variants on separate Viewings with mandatory reasons.
- [ ] **VIEW-06** Recover from declined/no-show to rescheduling or matching without losing prior events.
- [ ] **VIEW-07** Attempt invalid status reversal or update with stale version; confirm rejection and reload guidance.

## 13. Offer, negotiation and return-to-matching

- [ ] **OFF-01** Create an Offer only from eligible assigned Inventory and the exact Opportunity context.
- [ ] **OFF-02** Create/send a revision; confirm the exact pending revision, amount, terms, actor and status are visible.
- [ ] **OFF-03** Record counter, under-review, approved, rejected and withdrawn events with correct prompts/reasons.
- [ ] **OFF-04** Confirm rejected Offer wording describes what was rejected, not ambiguous “confirmed” text.
- [ ] **OFF-05** Use `Customer wants more options`/return to matching; confirm the display label is translated to a valid governed reason and the same Opportunity reopens.
- [ ] **OFF-06** Accept one exact revision; confirm the accepted revision becomes immutable.
- [ ] **OFF-07** Attempt acceptance of two competing Offers/reservations; confirm exactly one succeeds and the loser remains consistent.
- [ ] **OFF-08** Withdraw an unaccepted Offer; confirm assignment/Inventory consequences are explicit and historical Offer remains.
- [ ] **OFF-09** Attempt to withdraw or detach accepted Offer Inventory after Deal creation; confirm the unsafe reversal is blocked.
- [ ] **OFF-10** Confirm servicing reassignment preserves external Offer identity and original creator while moving operating authority.

## 14. Booking, reservation, expiry and cancellation

- [ ] **BOOK-01** Create Booking only from the exact accepted Offer/revision.
- [ ] **BOOK-02** Confirm deposit, reservation start/expiry and Inventory effective `Reserved` status.
- [ ] **BOOK-03** Attempt another exclusive reservation for the same Inventory; confirm one winner and no phantom accepted loser.
- [ ] **BOOK-04** Attempt Booking after assignment/Offer expiry or ineligible Inventory; confirm block without partial records.
- [ ] **BOOK-05** As non-Manager, attempt expiry extension; confirm rejection.
- [ ] **BOOK-06** As responsible Manager, extend with exact future expiry and reason; confirm before/after audit evidence.
- [ ] **BOOK-07** Attempt invalid/past expiry or extension without reason; confirm rejection.
- [ ] **BOOK-08** Cancel/release a Booking before Deal creation; confirm Inventory effective status derives from remaining active links.
- [ ] **BOOK-09** Expire a Booking; confirm reservation history, assignment consequences and dashboard queues update.
- [ ] **BOOK-10** Attempt cancellation/release after governed Deal linkage where unsafe; confirm authoritative-link protection.

## 15. Deal, compliance, receipt and closure

- [ ] **DEAL-01** Create Deal from accepted Offer and Booking; confirm Customer, Inventory, Offer revision and Booking inherit without retyping.
- [ ] **DEAL-02** Confirm Opportunity ID and Deal ID remain stable through later permitted servicing changes.
- [ ] **DEAL-03** Attempt Deal creation from wrong/unaccepted/expired context; confirm no partial Deal.
- [ ] **DEAL-04** Add/review required transaction parties and documents; confirm inherited parties cannot be silently replaced.
- [ ] **DEAL-05** Complete checklist items and submit for approval; confirm missing required evidence blocks approval/closure only where intended.
- [ ] **DEAL-06** Return/reject approval with reason; correct and resubmit while preserving both decisions.
- [ ] **DEAL-07** Record commission receipt/readiness; confirm Closed Won is blocked before required receipt confirmation.
- [ ] **DEAL-08** Close Won with authoritative confirmation; confirm Inventory becomes Sold/Rented as appropriate and audit/history reconcile.
- [ ] **DEAL-09** Close Lost with approved reason; confirm reservation release and safe derived Inventory status.
- [ ] **DEAL-10** Attempt unsafe reversal after Closed Won/Closed Lost; confirm terminal history cannot be silently rewritten.
- [ ] **DEAL-11** Where replacement is permitted, select new Inventory through a new Assignment → Offer → Booking; confirm Deal/Opportunity identity remains and prior linkage becomes history.

## 16. Administrative closure, delink and detached history

- [ ] **LINK-01** As non-Manager, attempt administrative Inventory closure; confirm rejection.
- [ ] **LINK-02** Attempt closure without a valid reason; confirm rejection.
- [ ] **LINK-03** Attempt closure with active Assignment or Reservation; confirm it is blocked until governed release/delink.
- [ ] **LINK-04** As responsible Manager, close eligible Inventory with reason `Withdrawn`; confirm `Available → Closed`, actor/reason/time and history.
- [ ] **LINK-05** Delink an active Assignment with a meaningful reason; confirm effective Inventory status derives safely.
- [ ] **LINK-06** Confirm delink retains both original `created` and later `delinked` events; nothing is erased.
- [ ] **LINK-07** Attempt delink while reserved or tied to an accepted Offer; confirm it is blocked.
- [ ] **LINK-08** Delink Inventory with a non-accepted active Offer; confirm the Offer withdrawal and Assignment delink happen consistently.
- [ ] **LINK-09** Re-add previously delinked Inventory; confirm a new Assignment references its predecessor and earlier history remains immutable.
- [ ] **LINK-10** As Manager, change Assignment expiry; confirm non-Manager block, exact before/after values and mandatory reason.

## 17. Documents, proposals, finance and commission

- [ ] **DOC-01** Upload a supported private document and open it only with an authorized related role.
- [ ] **DOC-02** Attempt unsupported, oversized or unauthorized upload; confirm no partial document/version.
- [ ] **DOC-03** Upload a revision; confirm prior file/hash/status cannot be overwritten.
- [ ] **DOC-04** Attempt restricted download outside scope; confirm rejection and audit where applicable.
- [ ] **PROP-01** Build Quick, Investment and Comparison proposals using one to three eligible properties.
- [ ] **PROP-02** Confirm authoritative Customer, requirement, Developer, Inventory, media and financial values are inherited.
- [ ] **PROP-03** Generate/review PDF and verify branding, disclaimer, date, agent, version and selected media.
- [ ] **PROP-04** Return/reject/approve through the Manager workflow; correct and create a new version without overwriting the rejected one.
- [ ] **PROP-05** Mark/send the approved exact version; confirm recipient/version/hash and delivery history.
- [ ] **FIN-01** Calculate mortgage/ROI boundary examples, invalid inputs and DBR; confirm assumptions/version/disclaimer.
- [ ] **FIN-02** Save a scenario and change policy later; confirm the saved snapshot reproduces the earlier exact figures.
- [ ] **COMM-01** Confirm commission calculation/split links to the exact Deal, receipt and policy/slab version.
- [ ] **COMM-02** Attempt unauthorized adjustment/approval; confirm role block and no partial payout change.
- [ ] **COMM-03** As Director/authorized finance role, review/approve/reject with reason and verify immutable history.

## 18. Dashboards, queues, reports and leave

- [ ] **DASH-01** Agent dashboard counts reconcile to the controlled synthetic records and open the exact underlying item.
- [ ] **DASH-02** `UAT158 Manager Alpha` dashboard scopes `UAT158 Dubai Secondary Sales` only; `UAT158 Director` sees company view; `UAT158 Listing Executive` sees Inventory work.
- [ ] **DASH-03** Confirm organization hierarchy is only in `My Team`, not consuming the operating dashboard.
- [ ] **DASH-04** Confirm `My Team` membership/reporting lines reflect effective reassignment without losing historical ownership.
- [ ] **DASH-05** Confirm Manager verification queue `Review Inventory` opens the exact record and returns to the queue context.
- [ ] **DASH-06** Confirm ageing displays minutes, hours, days and weeks at boundaries, with the exact timestamp available.
- [ ] **DASH-07** Confirm overdue/due-today/upcoming/completed task buckets and queue counts refresh after action.
- [ ] **DASH-08** Apply filters and drill down; confirm all cards/tables use the same period/scope and show data-as-of context.
- [ ] **DASH-09** Attempt report/export outside role scope; confirm rejection. Authorized export must be scoped and audited.
- [ ] **LEAVE-01** Agent submits synthetic leave with type/reason; confirm assigned Manager receives it.
- [ ] **LEAVE-02** Manager approves, returns and rejects separate requests with visible reasons.
- [ ] **LEAVE-03** Confirm self-approval is blocked and Administrator policy maintenance does not create approval authority.
- [ ] **LEAVE-04** Confirm Director authority only where approved and all decisions retain history.

## 19. Disabled integrations and failure behavior

- [ ] **EXT-01** Confirm Property Finder controls remain absent/disabled and no outward request is triggered.
- [ ] **EXT-02** Confirm Microsoft 365 Email, Calendly and native WhatsApp remain disabled unless separately approved.
- [ ] **EXT-03** Confirm disabled integration status is clear and does not block unrelated CRM work.
- [ ] **EXT-04** Exercise a safe local validation/network-failure path where available; confirm readable error, retry behavior and no duplicate business record.
- [ ] **EXT-05** Confirm no credential, token, private payload or raw technical stack trace appears in browser messages/screenshots.

## 20. Final reconciliation and completion gate

- [ ] **FINAL-01** Reconcile every synthetic Customer, Lead, Opportunity, Inventory, Assignment, Viewing, Offer, Booking and Deal reference.
- [ ] **FINAL-02** Confirm original creator/source/attribution and every ownership change are still visible.
- [ ] **FINAL-03** Confirm every return, rejection, withdrawal, cancellation, expiry, delink, closure and replacement has actor/time/reason history.
- [ ] **FINAL-04** Confirm no duplicate active assignment, accepted Offer, reservation, current Deal linkage or active governed version exists.
- [ ] **FINAL-05** Confirm role dashboards and queues now reconcile to final record states.
- [ ] **FINAL-06** Confirm disabled integrations remained disabled for the entire round.
- [ ] **FINAL-07** Review UAT-049 and UAT-050 explicitly; neither can be closed without observed corrected behavior.
- [ ] **FINAL-08** List every failed/blocked/not-run item with defect ID and evidence; do not convert “not run” into pass.
- [ ] **FINAL-09** Repeat each corrected defect on the deployed correction build and record the new version.
- [ ] **FINAL-10** Declare final UAT acceptance only when all mandatory items pass or the business owner explicitly accepts documented residual risk.

## 21. Suggested result summary

| Status | Count | Meaning |
| --- | ---: | --- |
| Passed | 0 | Expected behavior observed by the tester |
| Failed | 0 | Actual behavior differed; defect recorded |
| Blocked | 0 | Could not continue because of a documented blocker |
| Not run | 0 | Still pending; never treat as pass |
| Not applicable | 0 | Excluded with an explicit approved reason |

Final business-owner decision: **Pending**
