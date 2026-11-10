# DEV267 D-1 — Prospect Diary and shared contact suppression

Status: **D-1 approved with the amendments recorded below; implementation authorized**  
Prepared: 10 November 2026  
Target after later approval: CRM Test only  
Accepted baseline: DEV266 `2.1.0-dev.266`, commit
`1abd17771a5dda3be4b5108a6453e70438ad3ed0`, migration ledger 169,
303 public tables, 108 enabled governed triggers and canonical schema manifest
`496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`.

This design incorporates the original Prospect Diary scope and
`DEV267_addendum_shared_suppression_1.md`. It moves round-two defect D-A into
DEV267. D-B through D-E remain DEV268 and are not implemented here.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md`, the mandatory
hosted-worker verification and the canonical four-phase operator controls in
`AGENTS.md` remain acceptance criteria. No package, upload, Phase A, hosted
query, configuration change or hosted mutation is authorized by this note.

## 1. Existing worktree assessment

Before the addendum, a partial DEV267 implementation had already been written:

- `src/migrations/170_prospect_diary.sql` creates `prospects`,
  `prospect_activities` and `prospect_follow_ups`, plus three triggers;
- `src/routes/prospects.js` implements create, timeline, local follow-ups,
  reassignment and Customer conversion;
- `public/prospect-diary-ui.js` and `public/prospect-diary.css` implement a
  responsive screen using the existing CORE shell and design tokens;
- `public/app.js`, `public/bootstrap.js` and `src/server.js` mount the workspace;
- focused integration and browser tests exist.

That implementation is not release-ready under the addendum. In particular:

1. `wa_contact_suppressions` is written but not read by imports or campaign
   eligibility. A later import can recreate an eligible row after STOP.
2. Prospect DNC is local to `prospects.status`; it does not write the shared
   suppression store.
3. Prospect follow-ups are in a separate table and do not appear as normal
   Tasks in My Tasks or My Diary.
4. a global prospect duplicate response can disclose the other prospect's ID,
   name and status outside the requesting Agent's scope;
5. purchased-data provenance, local-time calling control, governed company
   calling numbers and note version links are incomplete;
6. conversion retains Prospect history but does not transfer the complete
   source, notes and open-task context required by the addendum.

Earlier local PostgreSQL 13.23, UI and browser passes are retained only as
evidence for the superseded Prospect-only draft. They are not DEV267 D-2
evidence and do not cover shared suppression.

## 2. One suppression store and one reader

### 2.1 Store choice

DEV267 will **extend the existing physical `wa_contact_suppressions` table**.
Despite its historical name, it becomes CORE's canonical current contact
suppression store. This choice preserves DEV266 application-only rollback:
DEV266 can still execute its existing `INSERT ... ON CONFLICT(normalized_phone)`
statement if application files are rolled back before readiness.

Migration 170 will extend the table with:

- suppression types `opt_out`, `wrong_number`, `do_not_contact` and `dncr`;
- optional normalized email for secondary matching;
- source system and source entity type/ID;
- evidence reference, actor and recorded time;
- active/released state, release actor/time/reason; and
- evidence-review state.

The existing normalized-phone key remains the canonical identity. Prospect
Diary requires a phone, and Customer creation requires phone and email, so the
first release does not create an email-only suppression. Optional normalized
email is used as an additional match, never as a way to override the phone
decision.

The current row is the operational decision and contains a JSON restriction
state keyed by type. More than one restriction may be active for the same
phone. `suppression_type` remains a compatibility projection of the strongest
active restriction for DEV266 application rollback. `audit_log` retains every
set, refresh and release event. Updating the current row must not erase the
earlier audit event.

### 2.2 Shared module

New module `src/contact-suppression.js` will own:

- `getContactSuppression({ normalizedPhone, normalizedEmail }, client)` — the
  one operational answer used by every read path;
- `recordContactSuppression(...)` — the only write implementation; and
- `releaseContactSuppression(...)` — Manager/Director-only governed release
  with reason and audit.

The answer includes `suppressed`, type, source, evidence reference, recorded
by/at, evidence-review due state and a safe display reason. Routes do not
reimplement type precedence or expiry logic. Batch callers may pass several
identities, but they use the same module and the same decision semantics.

Precedence is `wrong_number` > `dncr` > `do_not_contact` > `opt_out`. A stronger
active restriction is never weakened by a later lower-precedence write. Each
type has its own active/released state and evidence. Releasing a stronger type
recomputes the compatibility projection from the remaining active types, so a
weaker active restriction survives. Example: `opt_out` remains active after a
later `wrong_number` restriction is released. A PostgreSQL 13.23 integration
test must prove this exact sequence and resulting action-time decisions.

### 2.3 Write paths

All of these call `recordContactSuppression` in the same transaction as their
business action:

- manual WhatsApp STOP/wrong-number recording;
- simulated or real inbound STOP, UNSUBSCRIBE, maintained Arabic opt-out words
  and wrong-number responses;
- Prospect Diary DNC;
- Customer/contact DNC and restricted phone-channel maintenance.

Prospect DNC cancels open Prospect tasks and records the suppression source as
`prospect_diary`. Contact DNC records the Customer/contact source. Existing
recipient rows and approved snapshots are updated for display and frozen-list
removal, but those denormalized flags are not the source of truth.

### 2.4 Action-time read paths

The shared reader runs at the time of every action:

- recipient import preview;
- recipient import commit, rechecked under the transaction/advisory lock;
- campaign preview;
- campaign approval/freeze;
- campaign launch/send;
- one-to-one WhatsApp reply policy;
- Prospect create;
- Prospect call/WhatsApp/email follow-up creation;
- Prospect conversion; and
- Customer/Lead handoff checks.

File consent `verified` never overrides an active suppression. Import preview
shows the safe suppression reason; commit stores the row as suppressed/excluded;
campaign eligibility remains false.

### 2.5 One-to-one reply policy proposed for approval

- `wrong_number`, `dncr` and `do_not_contact` block all outbound WhatsApp.
- `opt_out` blocks campaigns, proactive templates and proactive free-form
  messages.
- A human may send a service reply only when the customer sent a new inbound
  message **after** the opt-out was recorded and the ordinary 24-hour reply
  window is still open. That reply does not release the marketing opt-out.
- Outside that narrow service case, the send returns 409 with a visible safe
  reason.

This is the proposed first-release policy and needs Ajit's approval at D-1.

### 2.6 Suppression lifetime

`audit_expires_at` is treated as an evidence-review date, not the end of the
restriction. Nothing deletes, expires or ignores a suppression automatically
after 12 months. A past date displays `evidence review due`; suppression remains
active until its governed release condition is met. An `opt_out` can be released
only by a Manager/Director with new customer-consent evidence captured after the
opt-out, including evidence reference, capture time and actor. `wrong_number`,
`do_not_contact` and `dncr` may be released by a Manager/Director with a
meaningful reason and audit. No retention scheduler is introduced in DEV267.

## 3. Prospect Diary design

### 3.1 Quick record and source provenance

Phone is mandatory and normalized to E.164. Name and email are optional. Source
values remain cold call, referral, event, personal network, purchased data or
other. Purchased data additionally requires:

- supplier name;
- supplier batch reference;
- acquisition date; and
- evidence reference.

These fields use the same meaning as WhatsApp purchased-list import metadata.
They are retained on conversion and shown to authorized users.

If the shared reader finds `wrong_number`, creation is rejected. For opt-out,
DNC or DNCR, CORE may retain an internal Prospect record only in DNC state, with
all outreach actions disabled and the suppression reason shown. It is never
created as outreach-ready.

### 3.2 DNCR

CORE has no UAE DNCR dataset or registry integration. DEV267 therefore supports
a manually recorded `dncr` suppression only. Setting or releasing it requires
Manager/Director authority, an evidence reference and reason. The UI says
`Manual DNCR evidence`; it never claims that CORE queried a registry. A future
registry integration is outside DEV267.

### 3.3 Duplicate checks and scope safety

The normalized phone remains globally unique across Prospects. Creation checks
Customers, Leads and Prospects before insert:

- an in-scope match returns the record type, safe summary and Open/Link action;
- an out-of-scope Prospect or Customer returns only
  `A matching record exists outside your scope; request Manager review`;
- no out-of-scope ID, name, owner, status, phone or email is returned;
- a race is still closed by the unique index and transaction;
- a global match prevents silent duplicate creation even when its details are
  hidden.

For these checks, **in scope** follows CORE's current 1=1 Lead visibility:

- Agent: a Lead assigned directly to that Agent; a Customer/Prospect owned by
  that Agent;
- Manager: own records plus records assigned to active Agents in a team the
  Manager currently manages; and
- Director: company scope.

Creation/duplicate detection still searches globally to prevent a duplicate,
but only the scope rules above determine whether identity and record details
may be returned. A Lead created by an Agent but assigned to someone else is not
in that Agent's scope merely because they created it.

Conversion repeats all checks under row/advisory locks. It first offers an
in-scope existing Customer, otherwise requires Manager handling for an
out-of-scope match, or explicit confirmation to create only when no match
exists.

### 3.4 Visibility and reassignment

- Agent: own Prospects and own Prospect Tasks.
- Manager: own plus active managed-team Prospects/Tasks.
- Director: company scope.
- other roles: no Prospect Diary access in DEV267.

Reassignment is Manager/Director-only, limited to an authorized active Agent,
and writes before/after owner/team evidence to `audit_log`. It reassigns open
Prospect Tasks in the same transaction. Cross-agent duplicate detection uses
the global key but never broadens record visibility.

### 3.5 Normal Tasks and My Diary

The unreleased `prospect_follow_ups` table will be removed from migration 170.
Prospect follow-ups become normal `tasks` rows:

- add `tasks.prospect_id` referencing `prospects`;
- add task type `prospect_follow_up`;
- extend `tasks_context_check` so Prospect Tasks have `prospect_id`, no Lead,
  no Customer and no unrelated governed context;
- use existing `is_primary_next_action` for the one open next action;
- store channel `call`, `whatsapp` or `email` in controlled task context;
- shared suppression is checked before creating or rescheduling an outreach
  task; and
- completing/cancelling through My Tasks is reflected directly because there
  is only one task row, not a copied diary row.

`src/routes/diary.js` will include Prospect Tasks with left joins instead of
requiring Customer/Lead joins. My Diary displays the Prospect name/phone only
within the same owner/team scope and opens the Prospect record. My Tasks uses
the existing task lifecycle and completion controls.

### 3.6 Local calling hours, repeat limits and timezone

First-release calling hours are **09:00–18:00 in the Prospect's maintained local
timezone**. The active organization settings hold the start/end minutes. They
may be narrowed but cannot be configured outside the 09:00–18:00 regulatory
boundary. This follows the UAE Ministry of Economy summary of Cabinet
Resolution No. 56 of 2024:
https://www.moec.gov.ae/en/-/ministry-of-economy-and-telecommunications-and-digital-government-regulatory-authority-review-regulatory-legislations-in-organizing-operational-mechanisms-for-telemarketing-companies-in-the-uae-and-enhancing-consumer-protection-in-line-with-best-practices

The timezone fields record both value and source:

- `phone_inferred` — initial suggestion from country calling code;
- `agent_confirmed` — Agent confirmed with the person/source; or
- `manager_override` — Manager/Director changed it with reason.

Phone-country inference is visibly marked as a guess. The Agent can correct it;
a Manager override is audited. Outbound call follow-ups outside the maintained
window are rejected with the next valid local time.

The same governed settings include warning thresholds:

- calls after an explicit product/service decline: default warning threshold
  `0`;
- maximum unanswered/consumer-terminated attempts per Prospect-local calendar
  day: default warning threshold `1`; and
- maximum unanswered/consumer-terminated attempts in a rolling seven-day
  period: default warning threshold `2`.

These thresholds are **soft compliance warnings, not hard call bounds**.
Outcomes `not_interested`/`declined` record the first-decline time.
`no_answer`, `voicemail` and `consumer_ended` record an attempt and contribute
to the daily/weekly counts. When a threshold is reached, CORE shows the rule,
the observed count and next preferred local time. The Agent may still record or
schedule the call after acknowledging the warning and entering a reason; the
acknowledgement, threshold, count and reason are audited. `invalid_number`
records a `wrong_number` suppression and remains a hard block. DNC, DNCR,
wrong-number and opt-out controls are also hard blocks under their channel
policy; only repeat-call thresholds are advisory.

Completed call evidence is never discarded. An already-completed call outside
the window or beyond a warning threshold is retained with a mandatory
compliance-exception reason and audit.

CORE does not prevent a human from making a call outside the system; these are
system scheduling and evidence controls, not a claim that CORE controls a
telephone handset.

### 3.7 Company calling numbers

DEV267 does not include a dialer and cannot inspect which physical handset was
actually used. It enforces the part CORE can prove:

- new governed table `company_calling_numbers` holds approved active NYSA
  calling identities with label, normalized number, effective dates, TDRA
  registration reference, registered legal entity, registration/verification
  dates, TDRA evidence reference and status;
- only Admin/Director can maintain/retire entries;
- every logged outbound Prospect call must select an active company number;
- a personal/free-text calling number is not accepted; and
- the selected company-number ID is retained on the call evidence and audit.

This is record-level enforcement, not a claim that CORE controlled an external
phone call. A future integrated dialer can enforce the originating line.

### 3.8 Versioned notes

Calls and notes remain append-only. A note correction creates a new activity
version linked by `corrects_activity_id`; the prior row is never updated or
deleted. The timeline shows the latest version with an expandable version
history, actor, time and correction reason. Call evidence is corrected the same
way rather than overwritten.

### 3.9 Conversion and transfer

Conversion locks the Prospect and rechecks suppression and duplicates.

1. Show existing Customer/Lead matches first, within scope-safe disclosure.
2. Link an explicitly selected existing Customer, or create a new Customer only
   after no global match and explicit confirmation.
3. Carry active suppression into the Customer/contact fields and channels in
   the same transaction. Conversion never clears it.
4. Carry source/provenance and latest note summary into the Customer; retain
   the complete Prospect timeline as immutable history.
5. Re-link open Prospect Tasks to the new Customer where the governed Task
   context permits, or close them with a conversion outcome and create the
   explicit governed Lead next action. No task is silently discarded.
6. Continue to Lead remains a separate explicit action. A Lead may be retained
   for recordkeeping, but shared suppression blocks outbound activity and
   outreach tasks until governed release.
7. Repeating conversion returns the prior result and creates nothing.

### 3.10 Worked example

Ahmed is entered with `+971 50 123 4567`, source `purchased_data`, supplier,
batch, acquisition date and evidence reference. CORE normalizes the phone,
checks the shared suppression store and global Customer/Lead/Prospect matches,
and suggests `Asia/Dubai` as `phone_inferred`. The Agent confirms the timezone,
selects an active company calling number and records a completed cold call.
Ahmed asks for a callback tomorrow at 11:00. CORE creates one
`prospect_follow_up` Task due at 11:00 Dubai time, visible in My Tasks and My
Diary, and records the call note/version evidence. Further calls and follow-ups
remain on the same Prospect. On explicit conversion, CORE rechecks duplicates,
links or creates the Customer, carries purchased-data provenance and any active
suppression, preserves the Prospect timeline and does not silently create a
second Customer or Lead.

## 4. Existing-data assessment — pending hosted approval

No hosted read has been run. The approved D-A synthetic CRM Test records must
remain intact for reproduction and retest.

The exact proposed script is
`release-artifacts/dev267-preparation/DEV267_DA_COUNTS_READONLY.sql`. It returns
no phone, email, ID or customer row, begins a read-only transaction and always
ends with `ROLLBACK`. SHA-256:
`4aea4a888ae1ae746071c10660c1d16113aff869bccb156b4863c4aea3ddd59c`.
It may run once only after Ajit's separate approval.

Core query:

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';

WITH recipient_gaps AS (
  SELECT COUNT(*)::int AS count
    FROM wa_campaign_recipients r
    JOIN wa_contact_suppressions s
      ON s.normalized_phone = r.normalized_phone
   WHERE r.suppression_status <> 'suppressed'
), contact_gaps AS (
  SELECT COUNT(DISTINCT c.id)::int AS count
    FROM contacts c
    JOIN contact_channels cc
      ON cc.contact_id = c.id AND cc.channel_kind = 'Phone'
    JOIN wa_contact_suppressions s
      ON s.normalized_phone = cc.normalized_value
   WHERE c.do_not_contact = 0
      OR cc.restriction_status <> 'do_not_contact'
)
SELECT
  (SELECT count FROM recipient_gaps) AS recipient_rows_not_marked_suppressed,
  (SELECT count FROM contact_gaps) AS contacts_not_marked_do_not_contact;

ROLLBACK;
```

Any non-zero correction needs separate approval. The release will not silently
rewrite existing rows merely because a count is non-zero.

## 5. Migration and schema contract

Because migration 170 is not deployed anywhere, DEV267 will revise that single
forward migration; it will not add a migration 171 merely to repair an
unreleased draft.

Final migration 170 will:

1. extend `wa_contact_suppressions` and its allowed types/lifecycle fields;
2. create `prospects` and `prospect_activities`;
3. create `company_calling_numbers`;
4. add Prospect context and controlled type/channel fields to `tasks`;
5. extend `tasks_context_check` and task-type contract;
6. add the global Prospect phone uniqueness and scoped lookup indexes;
7. add the Prospect outreach guard and status-effect triggers;
8. extend active organization settings with bounded calling-window and repeat
   limit fields;
9. extend allowed audit entity types; and
10. remain transactional and idempotent on PostgreSQL 13.23.

The post-migration design is **306 public tables and 111 enabled user triggers**:
three new tables and three new triggers above DEV266's 303/108. The obsolete
draft-only `prospect_follow_ups` table is not part of the final contract.

DEV266's six `src/database-schema-baseline/*` files remain byte-identical to the
accepted DEV266 canonical state. After implementation, the committed generator
will regenerate only the DEV267 post-migration files under
`src/database-schema-contract/*` and `src/database-trigger-contract.json`.
Exact hashes are D-2 outputs, not invented at D-1.

## 6. Exact proposed file scope

### Existing partial files to revise

- `docs/change-requests/NYSA-CRM-20261110-PROSPECT-DIARY-001.md`
- `src/migrations/170_prospect_diary.sql`
- `src/routes/prospects.js`
- `public/prospect-diary-ui.js`
- `public/prospect-diary.css`
- `public/app.js`
- `public/bootstrap.js`
- `src/server.js`
- `test/dev267-prospect-diary.test.js`
- `test/dev267-prospect-diary.integration.test.js`
- `test/dev267-prospect-diary-browser.test.js`
- `tools/dev267-prospect-diary-pg13-check.mjs`
- `tools/dev267-prospect-diary-browser-check.mjs`

### Shared suppression and CORE integration

- new `src/contact-suppression.js`
- `src/routes/whatsapp-workspace.js`
- `src/routes/whatsapp-simulated-provider.js`
- `src/whatsapp-simulated-provider-store.js`
- `src/whatsapp-campaign-domain.js`
- `src/routes/crm.js`
- `src/routes/governance.js`
- `src/routes/lead-operations.js`
- `src/routes/diary.js`
- new `test/dev267-shared-suppression.integration.test.js`
- new `test/dev267-suppression-path-contract.test.js`
- new `test/dev267-whatsapp-da-regression.integration.test.js`

### Contract, release and generation files

- `src/database-schema-contract/columns.json`
- `src/database-schema-contract/constraints.json`
- `src/database-schema-contract/functions.json`
- `src/database-schema-contract/indexes.json`
- `src/database-schema-contract/sequences-views.json`
- `src/database-schema-contract/manifest.json`
- `src/database-trigger-contract.json`
- `tools/generate-schema-contract.mjs`
- `tools/generate-trigger-contract.mjs`
- `tools/schema-contract-export.sql`
- new committed/tested `tools/generate-crm-test-deploy-config.mjs`
- `package.json` and `package-lock.json`
- DEV267 D-2 package, manifest, config and receipt artifacts, only after D-1
  approval and implementation.

The canonical deployment operator and its four hosted helpers are not changed
by this design. Any later need to change them requires its own commit, tests and
separate approval.

## 7. Required tests before D-2

All database receipts must print PostgreSQL 13.23 and the effective policy
settings used.

1. STOP first, then import: preview excluded, commit suppressed, campaign
   preview excluded. Repeat for wrong number and Prospect DNC.
2. Import first, STOP later: campaign preview excludes.
3. Approved campaign, STOP later: launch skips (WN-08 regression).
4. File consent `verified` cannot override suppression.
5. Prospect DNC blocks call/WhatsApp/email Tasks, excludes WhatsApp import and
   campaigns, and carries to Customer conversion.
6. Static/path-contract test proves every listed action imports/calls the shared
   module and contains no independent suppression-type rule.
7. One-to-one policy tests for service reply after customer inbound, proactive
   template denial and all-outbound denial for wrong-number/DNC/DNCR.
8. Layered restriction test: opt-out, then wrong-number, release wrong-number;
   opt-out remains active and still blocks campaigns/proactive sends.
9. Opt-out release fails without new post-opt-out consent evidence and succeeds
   only with authorized evidence; other types require authorized reason.
10. Calling policy tests: local 09:00/18:00 boundary; decline, once-daily and
    twice-weekly warning thresholds; configured threshold changes; warning
    acknowledgement/reason; permitted scheduling after acknowledgement; and
    immutable evidence for the exception. These tests must prove that repeat
    thresholds warn rather than hard-block.
11. Quick Prospect entry, phone normalization, multiple calls, multiple Tasks,
   My Tasks/My Diary visibility, versioned notes, local calling window, approved
   company number, duplicate scope safety, reassignment and all conversion modes.
12. Ahmed worked example end to end.
13. Migration 170 clean build, hosted-shape fixture, idempotent second apply,
    306 exact tables, 111 exact triggers and complete contract equality.
14. Governed suite with every skipped test listed by name/reason.
15. Full app/router and real-browser Agent, Manager, Director and mobile checks
    against the actual files extracted from the origin package.

## 8. DEV268 boundary

The reattached `DEV268_campaign_retire_and_small_fixes.md` is recorded but not
implemented. DEV268 starts only from an accepted DEV267 candidate and contains:

- campaign retirement route/UI/audit and terminal-state enforcement;
- local reply-lock pill time formatting;
- consistent 404 for out-of-scope conversation view/send/lock; and
- omission of `storageKey` from material list responses.

## D-1 approval record

Ajit approved D-1 on 10 November 2026 with the amendments now incorporated:
09:00–18:00 setting, TDRA evidence, evidence-governed release, layered
restrictions, configured repeat-call limits, explicit 1=1 scope semantics and
the transaction-wrapped counts script. Ajit subsequently clarified that repeat
call limits are soft warnings requiring acknowledgement/reason, not hard call
bounds. Implementation may proceed to D-2.
Packaging/upload/Phase A and the single hosted counts run remain separately
controlled.
