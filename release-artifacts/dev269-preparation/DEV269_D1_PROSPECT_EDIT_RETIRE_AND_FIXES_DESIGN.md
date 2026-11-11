# DEV269 D-1 — Prospect editing, campaign retirement and working-screen corrections

**Status:** proposed for owner review. Build, packaging, upload and hosted changes
are not authorized by this note.

**Prepared:** 11 November 2026.

**Target after later approval:** CRM Test first. Production requires a separate
reconciliation, package, backup and exact-candidate approval.

## 1. Evidence-based baseline

The accepted CRM Test source of truth is DEV268 `2.1.0-dev.268`, commit
`b6272e9c9f2a17a2c082324ec8810391de7bdf01`. The acceptance record is
`release-artifacts/dev267a-preparation/DEV267_DEV268_ACCEPTANCE.md` and its
script-generated receipt index verifies all ten DEV267/DEV268 phase receipts.
DEV268 Phase D records readiness green, database ready and exactly one
command/CWD-verified worker.

The database is `nysareal_nysa_dev247_smoke`, migration ledger 170, 306 public
tables and 111 enabled governed triggers across 95 tables. The accepted full
schema manifest is
`59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944` and
the trigger-contract file SHA-256 is
`70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf`.

DEV269 is designed as a code-only release. The existing `audit_log`, Prospect,
Task, suppression, WhatsApp campaign and material tables can represent the
approved behavior, so no migration is proposed. At D-2 the baseline and
canonical schema folders must be byte-identical and the expected state must
remain 170 migrations, 306 tables and 111 triggers before and after install.

The retained DEV268 rollback evidence is under
`/home/nysareal/crm-release-preparation/20261111-dev268/scoped-backup-dev268-phased-run1-63ad3c5`.
A future DEV269 Phase B still requires a fresh scoped backup; the retained path
is continuity evidence, not authority to reuse an expired backup.

## 2. P-1 — Governed Prospect editing

### 2.1 Route and concurrency

Add one transactional `PATCH /api/crm/prospects/:id` endpoint. It will select
the visible Prospect `FOR UPDATE`, apply role and state rules, validate only the
fields supplied and return the refreshed Prospect plus duplicate, suppression
and timezone results. A Prospect already converted to a Customer is read-only
and returns HTTP 409.

### 2.2 Field rules

| Field | Who may change it | Required controls |
| --- | --- | --- |
| Display name | owner or in-scope Manager/Director | non-empty normalized text; duplicate review rerun |
| Email | owner or in-scope Manager/Director | optional but, when supplied, normalized and format-valid; duplicate review rerun |
| Phone | owner or in-scope Manager/Director | meaningful reason; E.164 normalization; duplicate and shared-suppression checks rerun; active `wrong_number` blocks the change |
| Brief notes | owner or in-scope Manager/Director | previous value retained in the immutable audit event |
| Source details | in-scope Manager/Director only | meaningful reason and the existing purchased-data provenance completeness rules |

The edit transaction writes one `Prospect` audit event containing the actor,
reason, changed field names and exact before/after values. Full values remain
inside the governed database audit record; operational logs and browser-test
artifacts must not print phone, email or notes. The detail API will expose a
role-scoped edit-history summary so the previous notes version can be reviewed.

An edit never releases or clears any shared suppression and never changes an
existing `do_not_contact` status to a weaker status. For a phone change, CORE
checks the proposed phone before saving. An active wrong-number restriction on
that phone blocks the change. Other active restrictions remain visible and the
Prospect stays effectively do-not-contact. A phone change updates the phone-
derived timezone suggestion. It may automatically replace the stored timezone
only when `timezone_source='phone_inferred'`; an Agent-confirmed or Manager-
overridden timezone is retained and the new suggestion is shown for review.

Duplicate checks use the same privacy boundary as Prospect creation and
conversion: the owner sees permitted Customer/Lead/Prospect matches; a match
outside scope is reported only as existing outside scope, without record ID,
name, owner or contact details. Editing never creates, links or converts a
Customer implicitly.

### 2.3 Required acceptance journey

The PostgreSQL 13.23 and packaged-browser tests must include the named synthetic
journey: create **Ahmed** without email, add a valid email through Prospect edit,
re-run duplicate/suppression checks, then convert successfully. Tests also
cover invalid email, missing phone-change reason, wrong-number rejection,
suppressed-phone preservation, source authorization, converted read-only state,
notes history and exact audit before/after values.

## 3. P-2 — Prospect Diary screen and workflow corrections

### 3.1 Standard CORE page header; no black banner

The observed black banner is a real markup defect. Prospect Diary renders
`<header class="dashboard-head">`, while standard CORE working pages render a
`<section class="dashboard-head">`. The generic shell `header` rule therefore
styles the Prospect title as an application header and produces the dark band.

DEV269 will use the normal CORE page-head structure (`section.dashboard-head`,
enhanced by `ui-page-head`) with the existing CORE typography, text colors,
spacing and neutral page background. It will not introduce a Prospect-specific
dark theme or banner. A packaged real-browser test must assert the element tag,
computed background and text colors and compare Agent/Manager screenshots at
desktop and mobile widths. The black full-width band in the owner screenshot is
the regression reference and must be absent.

### 3.2 Other display and behavior fixes

1. Prospect names receive an explicit standard CORE ink color and readable
   contrast in list cards and the detail header.
2. `Today` and `Upcoming` are calculated by the API, not defaulted to zero.
   `Today`, `Upcoming` and `Overdue` tiles and their filters use the identical
   predicate. Each task is classified against the Prospect's recorded timezone
   so the count and filtered rows cannot disagree at a date boundary.
3. After manual DNCR record/release, the full detail header, body, list row and
   summary are refreshed. Status and suppression pills must change without
   closing and reopening the record.
4. Activity/follow-up warnings map internal codes to plain-language labels and
   display the Agent's recorded reason. Raw codes remain available only in
   governed audit evidence.
5. Recorded calls and proposed call follow-ups outside 09:00–18:00
   Prospect-local time produce a **soft warning**, not a hard limit. Copy will
   say that the action is outside the maintained prospect-local calling window
   and requires acknowledgement plus a reason. Repeat-call limits remain soft
   warnings as already decided.
6. Duplicate handling will not offer **Open existing prospect** unless that
   exact Prospect is inside the actor's permitted scope. Outside-scope matches
   show only the privacy-safe Manager-review instruction.

## 4. P-3 — Manager override register and declined wording

Add a Manager/Director-only team-scoped override register derived from existing
Prospect activity and follow-up warning evidence. It lists Prospect reference,
owner, activity/task, warning category, acknowledged reason, actor and time.
Agents cannot enumerate team overrides. No new storage table is required.

The `repeat_after_decline` label will state: **Customer previously declined.
Confirm a renewed customer request or record the specific business reason
before further outreach.** It remains a soft warning; the action is retained
with acknowledgement and reason rather than silently blocked.

## 5. WhatsApp workspace corrections

### 5.1 Campaign retirement

Expose the existing `campaignCommand(..., 'retire')` transition through an API
and UI action with a mandatory reason. An Agent may retire only a campaign they
prepared while it is `draft` or `returned`. An in-scope Manager/Director may
retire `draft`, `returned`, `pending_approval` or `approved` campaigns. Retired
campaigns are immutable, cannot be submitted, approved, edited, frozen or sent,
and remain visible in history. The decision is audited with actor, prior state,
revision and reason.

### 5.2 Reply-lock local time and privacy-safe 404s

The reply-lock pill and held-lock error will format expiry in the signed-in
user's local browser timezone using the same date formatter; raw UTC strings
will not be shown as user-facing time. Conversation detail, send and reply-lock
operations for a record outside the actor's scope all return the same HTTP 404
shape, preventing record-existence disclosure. Authorized conflicts remain
HTTP 409.

### 5.3 Material response minimization

Material catalogue JSON must never expose `storageKey`. The private key remains
server-only and the existing authorized file endpoint continues to stream the
file after team-scope checks. Tests inspect list, detail, create and update
responses as well as the file endpoint.

## 6. Access, privacy and security impact

- No role receives broader Customer, Lead or Prospect visibility.
- Manager/Director authority is limited to their existing managed scope.
- Duplicate responses remain privacy-minimized for outside-scope records.
- Suppression is fail-closed and edits cannot weaken it.
- Phone, email, notes and source history are audited in CORE but excluded from
  logs, screenshots and test reports.
- No connector, provider, production, website or REM change is in scope.

## 7. D-2 test and evidence contract

Before any upload or Phase A request, D-2 must provide:

1. focused unit/API tests for every rule in sections 2–5;
2. PostgreSQL 13.23 integration coverage, including concurrent edits and the
   Ahmed create/edit/convert journey;
3. Agent, Manager and Director authorization tests, including outside-scope
   non-disclosure;
4. count/filter parity tests across timezone boundaries;
5. suppression tests proving edits never clear DNC and wrong-number blocks a
   phone change;
6. campaign-retirement state/role/immutability/audit tests;
7. material-response tests proving `storageKey` is absent everywhere public;
8. a real browser loading the exact packaged app through `bootstrap.js`, with
   Agent and Manager screenshots at desktop and mobile sizes, zero console/page
   errors, no black Prospect header, visible names, live DNCR refresh, correct
   tile counts and warning reasons;
9. governed regression results with every skip named and explained;
10. exact-package reruns against the GitHub-origin archive, not a copied UI;
11. script proof that baseline and canonical schema folders are byte-identical,
    with ledger 170, 306 tables, 111 triggers and unchanged contract hashes;
12. a cross-artifact identity table for version, origin commit, package,
    manifest, config, baseline commit, database and schema contracts; and
13. a GitHub-advertised candidate packaged only with
    `npm run release:package -- --commit <full-origin-SHA>` and verified with the
    mandatory package verifier.

Every pass claim must cite its raw evidence and state whether it was verified
locally, against PostgreSQL 13.23, against the exact package or on hosting. A
skip is not a pass.

## 8. Future deployment and rollback controls — not yet authorized

Any later DEV269 deployment remains subject to `CRM_CHANGE_POLICY.md` and the
mandatory operator/worker controls in `AGENTS.md`:

- canonical GitHub-origin operator only, with exact hosted commit/hash checks;
- candidate, evidence and scoped-backup output paths verified absent before
  every run;
- four separately approved phases: A stage, B scoped backup, C install/start,
  D settled read-only smoke;
- full baseline and post-install schema-contract checks, not counts alone;
- application-only automatic recovery before readiness, never automatic
  database restore;
- readiness green on the exact version and exactly one command/CWD-verified
  exact-root worker after the readiness request; and
- remote authenticated browser verification before acceptance.

No implementation, package, upload, hosted query, Phase A or production action
is authorized by D-1.
