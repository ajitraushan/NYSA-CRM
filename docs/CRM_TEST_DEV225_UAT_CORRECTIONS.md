# CRM Test DEV225 — DEV224 UAT corrections

Target: CRM Test only. User authorized deployment of all round fixes on 2026-10-10.
Baseline: DEV224, 7ee2d19beec023a1a96fa2082e140ea8a1731827; migrations unchanged at 134.

- UAT-224-01/02: usable document date/expiry pickers, explicit non-expiring policy, clear future-date validation.
- UAT-224-03/04: reusable review panels across 15 review form groups; existing handlers and permissions retained.
- UAT-224-05/06: refresh closure readiness after document decisions and when reopening Closure Steps.
- UAT-224-07: document register uses the authoritative combined gate result and displays hidden party blockers.
- UAT-224-08: scope new instance fingerprints to the snapshot; preserve historical snapshots/evidence and idempotent resolution. No implicit acceptance or transfer of previous evidence to changed snapshots.
- UAT-224-09: Accountant dashboard navigation, preserved commission context handler and readable light Receivables styling.

No migrations or access-control changes. No external integration activation. No automatic invoice/payment/closure operations.

Validation: full local suite, origin-isolated package suite, targeted UI tests, synthetic browser preview, real dedicated fixture snapshot rebuild in rollback-only transaction, accepted evidence repeated all-gate checks.

Release must be built from advertised origin commit using the canonical builder and verified before deployment. Guarded installer scripts/deploy-crm-test-dev225.sh requires DEV224 baseline or exact DEV225 rerun, verifies provenance, protects production/R2, makes fresh readable application/database backups and restores application if deployment fails. No schema changes in this release.
