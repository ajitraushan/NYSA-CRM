# WA-001 Stage B increment 1

## Scope

This increment starts only the decision-independent Stage B foundation. It adds
no provider dispatch path and changes no production, website, REM or live-number
configuration. The working Stage B baseline includes inbound enquiries from
CTWA ads, the website button and portals: create or match the Lead, preserve
source attribution and route it to an Agent.

Implemented source foundations:

- recipient staging for up to 5,000 uploaded rows, with name and E.164 phone as
  mandatory fields and optional email, tags and requirements;
- duplicate classification without automatic Customer creation or silent merge;
- explicit consent evidence and suppression eligibility checks;
- governed saved-audience filter definitions without arbitrary SQL;
- 360dialog template-catalogue normalization, provider approval status and
  five-minute freshness evaluation;
- Agent draft submission and team-scoped Manager or Director approval,
  including the D01 independent-review fallback; and
- migration 161 for import batches, staged recipients, segments, template
  catalogue, campaign drafts/revisions and a dedicated audit trail.

The approved recipient-import contract is maintained in
`RECIPIENT_UPLOAD_SPECIFICATION.md`. DEV259a implements it in source: recipient
source type is a controlled upload-level selection, purchased lists are
explicitly identified without automatic rejection, and provenance remains
separate from consent eligibility. The candidate is not yet deployed.

## Verification

- Focused domain tests: 7 passed, 0 failed.
- Governed regression: 1,624 total; 1,529 passed; 95 intentionally skipped;
  0 failed. The first restricted run failed only because the sandbox blocked
  loopback test servers; the permitted rerun passed without code changes.
- Complete migrations 001 through 161 applied successfully to a clean isolated
  PostgreSQL fixture: 295 public tables, 11 `wa_` tables and 0 staged recipient
  rows. The fixture was stopped and removed.
- Stage A durable PostgreSQL integration: 9 passed, 0 failed, including
  encryption, concurrency, idempotency, receipt ordering, quota, unknown
  outcomes and STOP pause behavior.
- The one-page addendum rendered as exactly one page and was visually reviewed.

## Working-baseline controls

- `WHATSAPP_SANDBOX_CALLBACK_APPROVED=false` and
  `WHATSAPP_SANDBOX_ENABLED=false`; sandbox sending remains paused.
- The test connection is the Meta-provided virtual number under
  `Nysa Realty Test`, pending Meta verification; the approved test customer is
  `056 106 6469`.
- The 23-27 November canary is subject to Meta verification and the remaining
  opt-in and sending-limit approvals.
- CRM Test review deployments are planned every 2-3 days and remain subject to
  exact-candidate approval and governed release controls.

## Connected-number Stage B boundary

- After internal approval and a separate connected-number activation approval,
  CORE will submit templates through the 360dialog Templates API and reconcile
  Meta status from the API and template-status webhooks. Manual Hub submission
  remains a recovery option, not the only operating path.
- Agents will manually reply from the CORE inbox. Free-form messages are allowed
  only inside the active 24-hour customer service window; outside that window,
  CORE must require a currently Meta-approved template.
- Automated follow-ups and AI-generated or AI-directed conversation are Stage C
  and are excluded from the number-independent DEV258 review candidate.

## DEV258 number-independent review candidate

- User-facing template library, Manager/Director review queue, recipient CSV
  import, reusable segments, draft-only campaign composer and materials
  catalogue are implemented behind authenticated team scope.
- Template and campaign records retain internal version/approval evidence while
  provider status remains `Not submitted`. No Meta submission or send endpoint
  is present in this candidate.
- Migrations 001-162 passed in a clean isolated restricted-role PostgreSQL
  fixture. The real route integration passed Agent creation, Manager review,
  Director visibility, recipient duplicate decisions, segment/material/campaign
  creation, team isolation and absence of a send route.
- Focused domain tests: 12 passed, zero failed. Responsive browser checks passed
  at 1280, 768 and 390 pixels. Governed regression: 1,534 passed, 96
  intentionally skipped and zero failed.

## Remaining after the DEV258 source candidate

- Commit and advertise the exact source through GitHub, build and verify the
  mandatory origin package, refresh paired CRM Test recovery evidence and
  obtain exact-candidate deployment approval.
- Meta verification of the virtual number under `Nysa Realty Test` and a
  protected 360dialog live-test connection.
- NYSA template set and Meta approval evidence.
- Final opt-in sources, AED cap and live Meta-tier controls.

Any CRM Test installation still requires a committed and GitHub-advertised
candidate, mandatory origin-only package, verified provenance, fresh paired
recovery and exact deployment approval. Sending remains disabled.

## DEV259a approved extension

- CSV and XLSX imports share the same contract. XLSX reads only `Recipients`;
  the downloadable template also carries `Instructions` and maintained
  dropdown values.
- Consent states are `verified`, `evidence_pending`, `withdrawn` and `denied`.
  Source provenance, including purchased-list acquisition evidence, is stored
  separately and never manufactures recipient consent.
- Template names are normalized to Meta's lowercase underscore format. Agent
  work is submitted for internal review; Manager/Director-created versions are
  internally auto-approved while Meta remains `Not submitted`.
- The number-independent inbox is owner-scoped for Agents and team/company
  scoped for Managers/Directors. It displays separate 24-hour reply and
  72-hour CTWA pricing indicators, unread notifications and governed
  reassignment/takeover controls; sending is unavailable.
- Migration 164 adds provenance, suppression and 12-month-retention fields plus
  conversation, message, notification and assignment-history records. It adds
  no provider submission or dispatch table.

## DEV259a Addendum 2 correction boundary

DEV259a is the WhatsApp-workspace release only. It includes the template
library, internal review, recipient CSV/XLSX import and mapping, reusable
segments, draft campaigns, materials catalogue, number-independent inbox and
opt-out/suppression controls. Website and CTWA are separate maintained source
values. The inbox presents the 24-hour customer-service reply window separately
from the CTWA 72-hour pricing window.

Manager- or Director-authored templates and campaigns may be internally
self-approved, with the self-approval recorded in the immutable audit. Internal
approval and Meta status remain separate; an internally approved template stays
`Meta: Not submitted` and is not sendable in DEV259a. Campaign approval freezes
the current revision, schedule, AED budget, segment definition, template data,
materials and the exact unique-phone recipient/message snapshot. Later opt-out
or wrong-number evidence may only remove recipients from that snapshot.

The recipient import accepts CSV and the explicit `Recipients` sheet of XLSX.
Required columns are name and phone; arbitrary layouts can be mapped before
preview. The approved workbook lists all maintained field and dropdown values.
The raw upload is not retained, and committing a batch neither creates a
Customer nor a Lead. Reconciliation, inclusion/exclusion and source/consent
evidence are retained in the governed audit.

Migration 165 adds the approval-snapshot, suppression, campaign schedule/budget
and inbox lock fields. The complete 001-165 migration chain and authenticated
DEV259a lifecycle passed in the restricted synthetic PostgreSQL fixture. No
Meta submission, provider send, external message dispatch or live receiver is
introduced.

## DEV259b is a separate release

Simulated calling is not part of DEV259a. DEV259b will have its own source
change, migrations, test evidence, release package and exact-candidate approval.
That later scope includes CAL01-CAL04, company-number enforcement, lead-local
calling hours, DNCR/repeat-call controls and the agreed call placements. None of
those calling behaviours or screens may be inferred from or deployed with
DEV259a.
