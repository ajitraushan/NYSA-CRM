# UI-001 and DEV248 production blockers — working status

31 October 2026. **In progress; not a deployment approval or completion receipt.**

User-approved scope is UI-001 presentation plus DEV248 production readiness
blockers. Production application, database, configuration and workers have not
been changed. Optional providers, OTP, live outreach and unrelated workflow
corrections remain excluded. Existing users, assignments and team/manager
relationships must be preserved.

Development branch: `codex/dev251-ui001-release`, based on exact DEV248
`a6fafab35ef0042f0a5b1c31c5bd35dd33821590`. Candidate: `2.1.0-dev.251`.

## Implemented in the working source

- Shared authenticated-screen tokens, five text sizes, accessible colours,
  focus, spacing, responsive layout, page headers and compact state badges.
- Dubai date presenter, business labels that preserve option values, grouped
  filters, preserved form values, accessible record rows and status messages.
- Identity filters moved to Customers More filters; non-Customer searches keep
  their existing DOM IDs as empty hidden fields for handler compatibility.
- List-only Customer contact hints; authorized full record access remains
  governed by the existing server. This is not a new server security boundary.
- Intake source labels and compact summaries, queue requirement summary plus
  details, priority vocabulary and existing primary outcome workflow navigation.
- Three-step listing preparation presentation; original forms, values,
  validation, permit requirements and save handlers remain authoritative.
- Sales Agent payout breadcrumb; no finance access rule was changed.
- Additive read-only My Tasks source metadata and a masked provisional-name
  fallback; existing task scope and all write commands remain unchanged.
- Deterministic intake UI loading after legacy modules, and a null-safe
  read-only Lead interaction binding; neither grants additional access.
- Security dependency upgrade, explicitly verified with all ten PDF formats
  on the actual Linux hosting environment in an isolated private directory.

## Evidence so far

- Governed regression: 1,589 tests; 1,496 passed, 93 deliberately skipped,
  zero failures. The additional opt-in database test passed separately.
- Production dependency audit: zero advisories for the candidate lockfile.
- Synthetic component tests: Dubai date handling, priority labels, contact
  hints, contrast, preserved FormData, keyboard opening, secondary handlers,
  listing steps and 1280/768/390 width checks passed.
- Actual frontend against a read-only synthetic API: 111 views and 83 card
  drill-downs across Agent, Manager and Director, including all six Opportunity
  stages. Zero JavaScript, five-size, automated accessibility or responsive-width
  violations after corrections, at 1280/768/390 pixels.
- Restricted local PostgreSQL: all 159 migrations applied in a disposable
  synthetic schema; actual task API source projection, assignee scoping,
  provisional masking and Viewer denial passed. Schema removed afterward.
- Before/after review output is under `outputs/ui001`; it is synthetic local
  evidence, **not** a substitute for live CRM Test UAT.
- Hosted PDF evidence and limitations are recorded in
  `UI-001-PDF-RUNTIME-VERIFICATION.md`. Synthetic before/after layout comparison
  passed all ten formats with identical text/page counts and no reflow.

## Remaining before final approval packet

1. Preserve these source checks and run the mandatory isolated-origin regression
   again as part of packaging. Complete live CRM Test visual/interaction review.
2. Push the exact candidate to GitHub; use only the mandatory origin builder;
   verify provenance and runtime hashes. No working-tree archive is releasable.
3. Fresh CRM Test baseline/recovery, install the exact candidate, audit exact
   root/cwd workers before restart and after readiness, verify one worker,
   run live API/UI/PDF checks with optional integrations off.
4. Complete production configuration/website compatibility review and prepare
   the exact private key/service-actor operation and worker reconciliation for
   approval. Do not apply production changes during preparation.
5. Fresh private backup and verified encrypted off-server recovery copy. User
   explicitly approved `C:\Users\ajitr\NYSA-Recovery`; a fresh RSA-3072 key is
   protected with Windows DPAPI CurrentUser. Only encrypted backups may leave
   hosting. Preparation copies do not replace quiesced deployment-time backups.
6. Refresh the approval packet with exact GitHub SHA, package hashes, migration
   plan (141–159), rollback set, preserved assignments and maintenance window.
   Production deployment/main promotion require exact final approval.

The earlier successful DEV248 production-data rehearsal is reusable for the
unchanged 19 SQL migrations. New dependencies, UI and deployment operations
still require their own candidate-specific evidence. Do not describe the
makeover as deployed or complete until its remaining acceptance checks pass.
