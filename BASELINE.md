# CRM Development Baseline

Version: `NYSA-CRM-GOV-1.0`
Effective date: 2026-09-01
Status: governance baseline established; application baseline is not yet
immutable because the current CRM workspace is not a Git repository.

Current application candidate: `nysa-pocket-ledger-fixed`.

Before the first modifying task, record and retain:

- a dated copy or archive of the application files;
- dependency/runtime versions and configuration names, excluding secrets;
- a database backup/export appropriate to the target environment;
- checksums or another immutable identifier for the approved source package; and
- the test and production deployment identifiers.

After source control is established, replace the application candidate with the
approved repository URL, branch and full commit hash. Never use “current” or
“latest” as the only baseline.
