# NYSA CORE dev.158 — Manual UAT Data and Administrator Setup

Date prepared: 18 August 2026  
Environment: CRM Test only  
Companion checklist: `CRM_TEST_DEV158_COMPLETE_MANUAL_UAT_ROUND.md`

Authoritative mapping to records actually created in CRM Test: `CRM_TEST_DEV158_ACTUAL_RECORD_CROSS_REFERENCE.md`. Where this planning document still uses Alpha/Bravo, `L-01`, `I-01`, Team A or similar shorthand, use the actual display name/reference from that cross-reference.

Provisioning option: the reusable synthetic Companies, Customers, Leads, draft Inventory and transaction counterparties in this plan can now be prepared with `scripts/dev158-manual-uat-provisioner.mjs`. Run `npm run uat:dev158:data:plan` for the offline plan and follow `CRM_TEST_DEV158_UAT_DATA_PROVISIONING_RUNBOOK.md`. Applying it to CRM Test remains a separately approved action; workflow decisions and admin-maintenance exercises stay manual.

## 1. Recommended volume for one complete round

These are recommended counts, not application limits. They provide enough independent records for terminal
states and reversals without repeatedly destroying the prerequisite for another test.

| Record type | Absolute minimum | Recommended full round | Reason |
| --- | ---: | ---: | --- |
| Test users | 7 | 9 | Every role plus a revocation user and an out-of-scope Agent |
| Teams | 2 | 4 | Two operating teams, one off-plan/routing team and one disposable UAT team |
| Areas | 3 | 5 | Routing priority, edit/retire and import/duplicate cases |
| Customers | 8 | 12 | Happy path, recovery, rental, consent, duplicate/merge and access-scope isolation |
| Additional Contacts | 2 | 4 | Duplicate-channel, merge and non-Customer Contact cases |
| External Companies | 3 | 5 | Developer, agency, co-broker, corporate counterparty and multi-role company |
| Transaction-only counterparties | 2 | 4 | Seller, landlord, external agent and referral cases without Customer creation |
| Leads | 12 | 16 | Accept, reject, claim, timeout, reroute, lost, duplicate and transaction lanes |
| Requirement versions | 10 | 16–20 | Current versions plus changed/conflicted/historical versions |
| Inventory records | 12 | 16 | Eligible, boundary, rejected, expired, closed, assigned, reserved and replacement cases |
| Opportunities | 6 | 9 | Sale, rental, recovery, cross-team, dual-side, seller-side, concurrency and replacement |
| Viewings | 6 | 10 | Confirmed, completed, rescheduled, cancelled, declined, no-show and invalid reversal |
| Offers | 8 | 12 | Draft, sent, countered, rejected, withdrawn, accepted and competing acceptance |
| Offer revisions | 10 | 18 | Exact-version and immutable-history checks |
| Bookings | 4 | 6 | Active, cancelled, expired, extended, competing and Deal-linked cases |
| Deals | 3 | 5 | Closed Won, Closed Lost, returned compliance, replacement and in-progress controls |
| Proposals | 4 | 7 | Quick, Investment, Comparison, returned/rejected and revised/sent versions |
| Private documents | 6 | 10 | Customer, Inventory, Offer/Deal, restricted and revised-file cases |
| Activities/tasks | 12 | 20 | Direction/outcome, overdue buckets, reassignment and completion/reopen cases |
| Leave requests | 3 | 5 | Approved, returned, rejected, self-approval block and Director path |

Recommended starting point: **12 Customers, 16 Leads, 16 Inventory records, 9 Opportunities, 12 Offers,
6 Bookings and 5 Deals**. Most exception states should be produced from these records during the round,
not preloaded as unexplained database states.

## 2. Naming and privacy convention

- Prefix every test object with `UAT158`.
- Use `example.invalid` for email addresses, for example `uat158.alpha@example.invalid`.
- For mandatory phone fields, use only an internally approved, non-routable CRM Test E.164 range. Record it
  in the private tester worksheet as `<APPROVED_TEST_E164_01>` etc.; do not invent or contact a real number.
- Use evidence references such as `UAT158-EVID-001`; never upload real licences, IDs or authority documents.
- Use plain text/PDF fixtures containing `SYNTHETIC CRM TEST DATA — NOT A REAL DOCUMENT`.
- Do not reuse any real owner, landlord, seller, customer, company authority or contact details.

## 3. User and team setup

### 3.1 Users

| Code | Display name | Role/job role | Team | Main tests |
| --- | --- | --- | --- | --- |
| U-ADM | UAT158 Full Administrator | Administrator | Company | Governance, users, policy and audit |
| U-DIR | UAT158 Director | Director | Company | Oversight and approved interventions |
| U-MA | UAT158 Manager Alpha | Manager | Team Alpha | Assignment, verification and expiry approval |
| U-A1 | UAT158 Agent Alpha One | Sales Agent | Team Alpha | Happy path and own-scope work |
| U-A2 | UAT158 Agent Alpha Two | Sales Agent | Team Alpha | Reassignment and competing ownership |
| U-MB | UAT158 Manager Beta | Manager | Team Beta | Cross-team boundary and destination approval |
| U-B1 | UAT158 Agent Beta One | Sales Agent | Team Beta | Cross-team destination and out-of-scope checks |
| U-LX | UAT158 Listing Executive | Listing Executive | Inventory team/approved scope | Inventory maintenance |
| U-ACC | UAT158 Accountant | Accountant | Finance | Deal/commission limited scope |

If nine users are too many, U-ADM may use the existing authorized Administrator and U-ACC may be omitted
when the Accountant role is not enabled. Do not combine Manager and Agent identities; self-approval tests
require separate users.

### 3.2 Teams

| Code | Suggested name | Manager | Purpose |
| --- | --- | --- | --- |
| T-A | UAT158 Dubai Secondary Sales | U-MA | Sale happy path and within-team reassignment |
| T-B | UAT158 Dubai Rentals | U-MB | Rental and cross-team boundary |
| T-C | UAT158 Dubai Off-plan | U-MA or separate approved manager | Developer/off-plan routing |
| T-X | UAT158 Temporary Governance Team | U-MA | Create/edit/deactivate and dependency tests |

Do not deactivate a shared existing team. Use T-X for destructive-looking retirement/deactivation checks.

## 4. Area, routing and SLA sample values

### 4.1 Areas

| Stable code | Business label | Emirate | Display order | Test use |
| --- | --- | --- | ---: | --- |
| `uat158_downtown` | UAT158 Downtown | Dubai | 910 | Sale routing |
| `uat158_marina` | UAT158 Marina | Dubai | 920 | Rental routing |
| `uat158_business_bay` | UAT158 Business Bay | Dubai | 930 | Off-plan/routing priority |
| `uat158_jvc` | UAT158 JVC | Dubai | 940 | Area edit and label-history test |
| `uat158_retire_me` | UAT158 Temporary Area | Dubai | 990 | Routing dependency and retirement test |

Area import workbook rows should include:

- one new valid row: `uat158_import_green`, `UAT158 Import Green`, `Dubai`, order 950;
- one exact duplicate of a row already created;
- one invalid stable code such as `UAT 158 Invalid`;
- one duplicate business label with a different code; and
- one valid row that is changed after preview to test stale-preview protection.

### 4.2 Routing rules

| Priority | Suggested rule name | Match | Destination |
| ---: | --- | --- | --- |
| 10 | UAT158 Downtown Sale | Sale + UAT158 Downtown | T-A |
| 20 | UAT158 Marina Rental | Rental + UAT158 Marina | T-B |
| 30 | UAT158 Off-plan | Off-plan + UAT158 Business Bay | T-C |
| 50 | UAT158 Website Sale fallback | approved synthetic external source + Sale | T-A |
| 9999 | UAT158 Company fallback | no source/business/Area match | Company unassigned queue |

Test priority by temporarily creating a second matching rule at priority 15. Confirm priority 10 wins, then
retire the test rule with reason `UAT158 routing priority test complete`.

### 4.3 SLA policy

Suggested test-only version:

- policy name: `UAT158 Standard Lead SLA`;
- assignment acceptance: 30 minutes;
- first customer contact: 2 hours;
- next-action follow-up: 1 business day;
- high-priority Lead: 1 hour first-contact target;
- business timezone: Asia/Dubai;
- activation reason: `UAT158 governed SLA version test`.

Do not activate a global test SLA during concurrent business testing. Use a coordinated CRM Test window,
record the prior active version and restore/supersede only through the governed version workflow.

## 5. Customer and company dataset

### 5.1 Customers

| Code | Synthetic name | Email | Purpose |
| --- | --- | --- | --- |
| C-01 | UAT158 Customer Alpha | `uat158.alpha@example.invalid` | Successful Sale lane |
| C-02 | UAT158 Customer Bravo | `uat158.bravo@example.invalid` | Recovery, rejected Offer and Closed Lost |
| C-03 | UAT158 Customer Charlie | `uat158.charlie@example.invalid` | Rental lane |
| C-04 | UAT158 Customer Delta | `uat158.delta@example.invalid` | Queue accept and within-team reassignment |
| C-05 | UAT158 Customer Echo | `uat158.echo@example.invalid` | Assignment rejection and rerouting |
| C-06 | UAT158 Customer Foxtrot | `uat158.foxtrot@example.invalid` | Cross-team coordinated reassignment |
| C-07 | UAT158 Customer Golf | `uat158.golf@example.invalid` | Consent grant/withdrawal/service-contact distinction |
| C-08 | UAT158 Customer Hotel | `uat158.hotel@example.invalid` | Proposal and finance |
| C-09 | UAT158 Customer India | `uat158.india@example.invalid` | Duplicate/merge source record |
| C-10 | UAT158 Customer India Duplicate | same approved test channel as C-09 | Duplicate warning and governed merge |
| C-11 | UAT158 Customer Juliet | `uat158.juliet@example.invalid` | Team B scope-isolation record |
| C-12 | UAT158 Customer Kilo | `uat158.kilo@example.invalid` | Spare terminal/retest record |

Use only C-09/C-10 for merge testing. Do not merge a Customer already used in the main Sale/Deal lane.

### 5.2 Companies and counterparties

| Code | Suggested name/type | Purpose |
| --- | --- | --- |
| CO-01 | UAT158 Atlas Developments — private company | Developer Master and Inventory Developer link |
| CO-02 | UAT158 Horizon Agency — external agency | Organization provenance and co-broker relationship |
| CO-03 | UAT158 Corporate Buyer — external company | Company party without authentication access |
| CO-04 | UAT158 Multi-role Holdings | Multiple company roles without duplication |
| CO-05 | UAT158 Duplicate Developer Candidate | Developer duplicate-review path |
| TP-01 | UAT158 Seller Alpha — inventory owner | Sale counterparty without Customer creation |
| TP-02 | UAT158 Landlord Bravo — inventory owner | Rental counterparty without Customer creation |
| TP-03 | UAT158 External Buyer Agent | External-agent representation path |
| TP-04 | UAT158 Referrer | Referral/commission attribution |

Developer sample values:

- legal structure: `private_company`;
- legal name: `UAT158 Atlas Developments LLC`;
- licence/registry reference: `UAT158-LIC-DEV-001`;
- source evidence reference: `UAT158-EVID-DEV-001`;
- licensing authority label: `Synthetic CRM Test Authority`;
- evidence file: `UAT158-DEVELOPER-EVIDENCE-001.pdf` containing synthetic-data wording;
- activation/review reason: `UAT158 Developer governance verification`.

## 6. Lead and requirement dataset

| Lead | Customer | Business/Area | Initial exception purpose |
| --- | --- | --- | --- |
| L-01 | C-01 | Sale / UAT158 Downtown | Happy path to Closed Won |
| L-02 | C-02 | Sale / UAT158 Downtown | Viewing recovery, rejected Offer and Closed Lost |
| L-03 | C-03 | Rental / UAT158 Marina | Rental path and Booking expiry |
| L-04 | C-04 | Sale / UAT158 Downtown | Queue assignment, accept, Agent A1 → A2 reassignment |
| L-05 | C-05 | Sale / UAT158 Downtown | Agent rejection and return to queue |
| L-06 | C-06 | Sale / UAT158 JVC | Coordinated Team A → Team B reassignment |
| L-07 | C-07 | Sale / UAT158 Business Bay | Consent withdrawal versus service contact |
| L-08 | C-08 | Sale / UAT158 Downtown | Finance and proposal variants |
| L-09 | C-09 | Sale / UAT158 Downtown | Duplicate/merge lineage |
| L-10 | C-11 | Rental / UAT158 Marina | Team B scope-isolation control |
| L-11 | C-12 | Off-plan / UAT158 Business Bay | Developer/seller-side representation |
| L-12 | C-12 or spare | Sale / unmatched Area | Company fallback queue |
| L-13 | new synthetic Customer | Sale | Assignment timeout/expiry |
| L-14 | new synthetic Customer | Sale | Lost/unqualified terminal reason |
| L-15 | new synthetic Customer | Rental | Duplicate outcome and no Opportunity |
| L-16 | new synthetic Customer | Sale | Spare retest after a defect correction |

Primary Sale requirement for C-01/L-01:

- business line: Sale;
- budget minimum: AED 450,000;
- budget maximum: AED 650,000;
- minimum size: 500 sqft;
- Areas: UAT158 Downtown and UAT158 Business Bay;
- property type: Apartment;
- bedrooms: 1–2;
- funding: Mortgage;
- purpose: Investment;
- timeline: within three months;
- hard exclusion: no explicitly expired availability;
- next action: `Send property details and seek feedback` due next business day.

Create a second version changing maximum budget to AED 700,000, then a third version returning to AED
650,000 with a documented reason. Use a separate requirement to create and resolve a conflict; do not
damage L-01's accepted current requirement.

## 7. Inventory dataset

All amounts and facts below are synthetic CRM Test values.

| Inventory | Suggested facts | Intended test state/use |
| --- | --- | --- |
| I-01 | UAT158 Alpha Residence; Sale; AED 600,000; 520 sqft; 1BR | Happy path and 500 sqft regression boundary |
| I-02 | UAT158 Bravo Residence; Sale; AED 640,000; 700 sqft; 2BR | Alternative match and competing Offer |
| I-03 | UAT158 Small Boundary; Sale; AED 500,000; 499 sqft; 1BR | Minimum-size rejection |
| I-04 | UAT158 Over Budget; Sale; AED 900,000; 900 sqft; 2BR | Budget rejection |
| I-05 | UAT158 Marina Rental; Rental; AED 90,000/year; 650 sqft; 1BR | Rental happy/recovery lane |
| I-06 | UAT158 Unverified; Sale; AED 550,000; 550 sqft | Unverified selection block |
| I-07 | UAT158 Returned Verification; Sale; AED 560,000; 560 sqft | Manager return/correction/resubmit |
| I-08 | UAT158 Rejected Verification; Sale; AED 570,000; 570 sqft | Verification rejection and terminal visibility |
| I-09 | UAT158 Availability Expired; Sale; AED 580,000; 580 sqft | Explicit availability-expiry block |
| I-10 | UAT158 Verification Expired; Sale; AED 590,000; 590 sqft | Verification-expiry block |
| I-11 | UAT158 Legacy Availability; Sale; AED 610,000; 610 sqft | Missing/old availability advisory behavior |
| I-12 | UAT158 Administrative Closure; Sale; AED 620,000; 620 sqft | Available → Closed with reason `Withdrawn` |
| I-13 | UAT158 Active Assignment; Sale; AED 630,000; 630 sqft | Closure block, expiry extension and delink history |
| I-14 | UAT158 Reserved Exclusive; Sale; AED 645,000; 645 sqft | Competing reservation and unsafe delink block |
| I-15 | UAT158 Atlas Off-plan; Sale; AED 650,000; 680 sqft | Developer/community/provenance and seller-side path |
| I-16 | UAT158 Replacement Residence; Sale; AED 625,000; 660 sqft | Governed post-release replacement path |

For I-01, I-02, I-05, I-13–I-16 complete owner/authority and verification normally. Use TP-01 as seller
and TP-02 as landlord. Link CO-01 only where a governed Developer is genuinely applicable; test the
`Developer not selected` path on an unrelated resale Inventory.

Evidence references:

- owner identity/source: `UAT158-OWNER-SOURCE-Ixx`;
- internal-use authority: `UAT158-AUTH-Ixx`;
- verification: `UAT158-VERIFY-Ixx`;
- community mapping reason: `UAT158 governed Community mapping`;
- organization link reason: `UAT158 confirmed Developer/source relationship`.

## 8. Opportunity and transaction allocation

| Opportunity | Source | Inventory | Planned terminal/recovery result |
| --- | --- | --- | --- |
| O-01 | L-01 | I-01, then I-02 considered | Successful Sale → Closed Won |
| O-02 | L-02 | I-02/I-16 | Declined/no-show Viewing, return to matching, rejected Offer, Closed Lost |
| O-03 | L-03 | I-05 | Rental Booking expiry/cancellation |
| O-04 | L-04 | I-13 | Servicing reassignment and Assignment expiry governance |
| O-05 | L-06 | I-02 | Coordinated cross-team reassignment |
| O-06 | L-11 | I-15 | Seller/inventory-side representation |
| O-07 | L-07 | I-01 | Dual representation and disclosure evidence |
| O-08 | L-08 | I-01/I-02/I-16 | Comparison proposal and competing Offer acceptance |
| O-09 | spare/recovery Lead | I-14 then I-16 | Reservation release and governed Inventory replacement |

Suggested counts generated from these Opportunities:

- O-01: two Viewings if reschedule is tested, two Offer revisions, one Booking and one Closed Won Deal;
- O-02: three Viewings (declined/no-show/rescheduled), two Offers (rejected then replacement) and one
  Closed Lost Deal;
- O-03: one Viewing, one accepted Offer and two Booking states (active then expired/cancelled);
- O-04: one Assignment with Manager extension and later delink;
- O-08: three proposal properties and two competing Offers;
- O-09: one Booking release, new Assignment/Offer/Booking on I-16 and one in-progress replacement Deal.

## 9. Administrator governance sample pack

### 9.1 Controlled values

Create a disposable set only if the UI supports test-specific consumers without changing shared business
meaning:

- set stable code: `uat158_follow_up_outcome`;
- name: `UAT158 Follow-up Outcome`;
- definitions:
  - `uat_contacted` — UAT Contacted — order 10;
  - `uat_callback` — UAT Callback requested — order 20;
  - `uat_no_response` — UAT No response — order 30;
  - `uat_replaced` — UAT Replaced label — order 40;
- replacement mapping: retire `uat_callback` and map it to `uat_contacted` for the retirement test;
- reason: `UAT158 controlled-value lifecycle test`.

Do not modify core active lost/closure/status codes merely to test label editing.

### 9.2 Qualification model

Model name: `UAT158 Buyer Readiness v1`

| Factor | Code | Weight | Example scale |
| --- | --- | ---: | --- |
| Budget confirmed | `budget_confirmed` | 25% | 0–10 |
| Funding readiness | `funding_ready` | 25% | 0–10 |
| Timeline clarity | `timeline_clear` | 20% | 0–10 |
| Area/property clarity | `property_clear` | 15% | 0–10 |
| Decision readiness | `decision_ready` | 15% | 0–10 |

Suggested bands: Cold below 40, Warm 40–69.99, Hot 70 and above. Test scores immediately below, at and
above each boundary. Use reason `UAT158 qualification model lifecycle test` for approval/activation.

### 9.3 Organization Settings

- version label/purpose: `UAT158 branding governance test`;
- display name: `NYSA CORE — UAT158 TEST VERSION`;
- default currency: AED;
- timezone: Asia/Dubai;
- locale: approved English/UAE test locale;
- footer: `SYNTHETIC CRM TEST OUTPUT — NOT FOR CUSTOMER USE`;
- disclaimer: `Synthetic UAT assumptions only; no commercial or regulatory reliance.`;
- logo: approved non-private NYSA test asset already present in the application.

Activate only in a coordinated maintenance window. Record the prior active version and restore normal
branding through a governed version activation after screenshots are captured.

### 9.4 Listing, media and verification policies

Test these as versioned/reversible configurations where supported:

- Manager listing approval required: Yes;
- approved image types: JPEG, PNG and WEBP;
- synthetic maximum file size: use the current approved limit rather than inventing a lower shared limit;
- rights confirmation required: Yes;
- verification requires saved owner/authority evidence: Yes;
- reason: `UAT158 policy enforcement test`.

Run one submission under approval-required and one under the approved alternative only if changing the
shared policy is safe and coordinated. Existing pending submissions must remain explainable.

### 9.5 Document/compliance rules

- template name: `UAT158 Customer Confirmation`;
- template type: approved test operational category;
- version: 1;
- required evidence title: `UAT158 Synthetic Identity/Authority Evidence`;
- permitted file: small PDF containing synthetic-data wording;
- invalid fixtures: `.exe` filename, oversized file and mismatched declared type;
- access classification tests: internal, private and restricted;
- retirement reason: `UAT158 document rule superseded after lifecycle test`.

### 9.6 Finance, commission and payout samples

Use these only as synthetic calculation examples, not as approved NYSA commercial policy:

- property price: AED 600,000;
- down payment: 20%;
- loan term: 25 years;
- test interest rate: 4.50% annual;
- expected rent for ROI fixture: AED 60,000/year;
- annual synthetic costs: AED 12,000;
- vacancy assumption: 5%;
- commission receipt fixture: AED 12,000;
- internal split fixture: originating Agent 40%, servicing Agent 60%;
- payout approval reason: `UAT158 synthetic payout verification`.

Always retain the displayed policy/slab version and independently recalculate the expected result. Do not
replace an approved shared fee or commission policy unless the version workflow and test window are agreed.

### 9.7 Leave/employment samples

Create five separate requests rather than repeatedly rewriting one:

- annual leave: two future working days — Manager approves;
- sick leave: one day — Manager returns for evidence;
- unpaid leave: one day — Manager rejects with reason;
- overlapping annual leave — expected validation/policy response;
- Manager's own request — self-approval blocked, routed to approved higher authority.

Suggested reasons: `UAT158 approved leave path`, `UAT158 return for synthetic evidence`, and
`UAT158 rejection path`. Do not upload real medical or employment documents.

## 10. Safe creation sequence

1. Record baseline build and existing active global policy versions.
2. Create/confirm test users, teams and memberships.
3. Create UAT Areas, routing rules and the fallback rule.
4. Create Companies, Developer versions and transaction-only counterparties.
5. Create Customers/Contacts and the duplicate pair.
6. Create Leads through their intended sources; do not assign all manually.
7. Exercise queue claim/accept/reject/reroute before qualification.
8. Record activities, tasks, qualification and requirement versions.
9. Create Inventory drafts, owner/authority evidence and verification variants.
10. Create Opportunities and assignments only after each prerequisite is ready.
11. Run Viewing, Offer, Booking and Deal lanes; preserve each terminal record.
12. Run delink, closure, expiry and replacement using I-12–I-16.
13. Run proposals, documents, finance, commission, dashboards and leave.
14. Reconcile audit/history and retire only disposable UAT configurations through governed actions.

## 11. End-of-round record reconciliation

Expected approximate final totals for the recommended plan:

- 12–16 Customers depending on Lead-specific creation;
- 16 Leads with at least accepted, rejected, reassigned, timed-out, lost/unqualified and duplicate outcomes;
- 16 Inventory records spanning approved, returned, rejected, expired, Closed, Assigned and Reserved states;
- 9 Opportunities with at least one Closed Won, one Closed Lost and one governed recovery/replacement;
- 10 Viewings, 12 Offers/18 revisions, 6 Bookings and 5 Deals;
- five leave decisions/states and at least 20 activities/tasks;
- immutable histories showing every creation, assignment, reroute, return, rejection, withdrawal,
  cancellation, expiry, delink, closure, replacement and approval.

Do not force the numbers to match if a defect blocks creation. Record the intended reference as blocked,
capture evidence and preserve the failing state.

## 12. Global-maintenance caution

Some Administrator tests alter company-wide active configuration. Before changing one:

- confirm no other CRM Test user is relying on the current configuration;
- capture the active version/reference and a screenshot;
- create a new explicitly named `UAT158` version rather than editing an active version in place;
- activate it only for the required test window;
- restore/supersede through the normal governed workflow, never by database edits or deletion; and
- verify the audit trail contains both the test activation and the later restoration.

Final UAT acceptance remains pending until the human checklist is executed and all mandatory failures are
corrected/retested or explicitly accepted as residual risk by the business owner.
