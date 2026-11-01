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

## Remaining before a CRM Test candidate

- User-facing upload, segment, template and campaign-approval workspace.
- Authenticated APIs and team-scope integration around the tested domain.
- Meta verification of the virtual number under `Nysa Realty Test` and a
  protected 360dialog live-test connection.
- NYSA template set and Meta approval evidence.
- Final opt-in sources, AED cap and live Meta-tier controls.

Any CRM Test installation still requires a committed and GitHub-advertised
candidate, mandatory origin-only package, verified provenance, fresh paired
recovery and exact deployment approval. Sending remains disabled.
