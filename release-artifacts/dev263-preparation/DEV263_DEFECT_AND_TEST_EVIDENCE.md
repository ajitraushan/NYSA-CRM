# DEV263 WhatsApp Simulator Defect and Test Evidence

Date: 4 November 2026

Target: CRM Test only

Baseline: 2.1.0-dev.262, migration 166, 303 tables

## Confirmed defect

Read-only inspection of the hosted CRM Test application error log found three
matching failures in the reported window. Each was:

```text
TypeError: fetch failed
cause: Error: connect ECONNREFUSED 127.0.0.1:3000
code: ECONNREFUSED
address: 127.0.0.1
port: 3000
```

This confirms that the two reported HTTP 500 responses were caused by the
server-to-self loopback request. They were not caused by template data,
authentication or the synthetic-recipient guard. No hosted state was changed
while collecting this evidence.

## Correction

1. Internal simulator submissions now call a shared in-process simulator
   service. They no longer use `fetch()` or depend on a loopback listener.
2. The guarded HTTP simulator endpoints remain and invoke the same service for
   explicit external test harness calls.
3. Scope, token, CRM Test environment and synthetic-recipient protections are
   unchanged. Live WhatsApp provider code is untouched.
4. Synthetic CTWA events use the migration-approved `ctwa` source value.
5. Template, campaign and inbox simulator failures render a persistent
   `role="alert"` message in the workspace as well as the existing toast.

## Verification

- JavaScript syntax checks passed for the changed route, UI and browser tool.
- Focused simulator and workspace-loader unit tests passed.
- The actual packaged UI source was loaded in a real Chromium browser. All six
  Agent workspace sections opened, and a synthetic provider rejection rendered
  the persistent accessible error alert.
- A full authenticated integration flow passed against a temporary PostgreSQL
  16 database with all 167 migrations. The configured provider URL was the
  deliberately unreachable `http://127.0.0.1:9/...`, proving that internal
  simulator behavior is in process. Coverage included inbound creation,
  template status callbacks, reply, delivered/read events, STOP suppression,
  duplicate protection, all six fault modes, 24/72-hour boundaries and cleanup.
- The governed release suite passed: 1,547 passed, 98 skipped and zero failed.
  It included 305 current test files and excluded 93 explicitly identified
  historical local-artifact test files.
- Real-browser evidence is retained under `full-flow-browser/`, including six
  section screenshots and a JSON receipt binding them to the tracked release
  file SHA-256.

## Deployment constraints

- No hosted deployment is authorized by this document.
- Package only from an origin-advertised commit with the mandatory detached
  GitHub-origin builder and verify its manifest before approval.
- Deploy only through the canonical four phases, each separately approved:
  stage, scoped backup, install/start, and settled smoke/report.
- Require readiness green and exactly one command/CWD-verified worker for the
  exact CRM Test application root. Do not retry a failed phase without new
  approval.
- Keep the simulator paused unless a later exact test authorizes otherwise.

## Origin candidate

- Version: `2.1.0-dev.263`
- GitHub-advertised app commit:
  `4eb1758c98ed1822ea451de7c90b4266a96a64d0`
- Source tree: `a604512a754dfb1cef379059fba70197a54defbe`
- Package SHA-256:
  `4bc5781e59e45313aaf703bd6316ee572758a7e322dbe08268b57ab3bf67b855`
- Manifest SHA-256:
  `02184870d529c65116dc405b4c87f75f13f922a70441bd700c3d975f688c8a2e`
- Mandatory provenance verification: passed.
- Canonical operator commit:
  `6256d8a7349e8fa758a9692aba1b1409962f3bef`
- Canonical operator SHA-256:
  `3ffdb5cd00eb21820ca474b214e6847b584e46b0e588ef2a8e2dde8e6aee2a3b`
