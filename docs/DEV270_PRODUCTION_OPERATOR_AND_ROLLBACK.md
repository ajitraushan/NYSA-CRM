# DEV270 Production operator and rollback review

Candidate `5c1c350151d6ace33377b33526e2bfedf4ae8f6b`. Production RC1 remains `b6e013c51f46be482858e733160fa7e675ff3106`, migration 140. The Production script is `tools/production-prospect-release-operator.mjs`. CRM Test retains its canonical operator unchanged.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md` and mandatory exact-root worker verification in `AGENTS.md` govern this plan. This is a source review. The Linux selector, exact-root workers, Production credentials and installed runtime have not been exercised by these tests.

## Inputs and approvals

- Obtain separate exact approvals for the Production read-only preflight, backup, install and settled smoke. Complete CRM Test UAT before starting Production. No Production phase starts after 18:00 Dubai on 12 November.
- Download every script and its imported helper files from the approved exact origin commit to a new path. Check each SHA-256 on hosting and execute the main file by absolute path outside the app root. The preflight records RC1 catalog, effective legacy role CONNECT and table privileges, public table owners, disk usage and worker evidence. It makes no grants.
- Before backup approval, bind a new config to the approved preflight config and receipt, verified candidate package and manifest, complete RC1 schema expectation, and the independently accepted RC1 runtime-file manifest. The recorded RC1 code commit and schema alone do not establish installed runtime bytes. Confirm the accepted baseline runtime manifest is available before approval.
- The Production operator also needs the registered Node.js 24 executable, an absolute npm CLI path and its SHA-256, and explicit confirmation that locked dependency staging from the npm registry is included in the backup approval. RC1 and DEV270 dependency sets differ. Review the npm and dependency path against the live selector registration.
- Review all configured input locations, new phase workspace and absence of all output paths. The configured filenames and full hashes are inputs to review. The operator approval argument is the candidate SHA, phase and exact config SHA-256.

## Backup, install and smoke

- **Backup** rechecks RC1 runtime hashes, read-only catalog, configuration, worker inventory and disk below 90%. It validates the candidate archive outside the app, stages dependencies with locked npm integrity and scripts disabled, creates the scoped application archive and PostgreSQL 13.23 custom dump, checks the archive member list and the dump table set with `pg_restore --list`, and records hashes. Keep the staged dependency directory and the original dependency target for the lifetime of the release and rollback period.
- **Install** requires fresh backup evidence bound to the exact config and candidate. It rechecks the original application and database, hashes the candidate runtime and dependency tree, and verifies rollback copies for each overwritten file before stopping the exact verified worker. It installs only manifest-governed runtime files, switches the dependency symlink, starts once and checks database readiness and exactly one command/CWD-verified worker. It compares the exact post-install migration ledger, table names and full schema contract. Production Campaign governance remains available. WhatsApp and simulator routes stay disabled.
- **Settled smoke** is read-only and requires the successful install receipt. It retains every attempt during the bounded 45-second window with timestamp, status, server header, safe body indicator and body hash. Verify the exact worker again. The separately approved authenticated Agent and Manager browser checks remain required for acceptance.

## Rollback

- Before green readiness with one verified worker, the operator can restore changed application files from the already verified recovery copies, remove only candidate files that were absent before install, and restore the original dependency symlink. The operator does not change the selector environment.
- The application rollback checks RC1 database contract before restarting. If a migration changed the ledger or schema, keep the app stopped and preserve evidence. An RC1 database restore requires a separate approval with the exact backup hash and a decision about writes since backup. Reverify the restored RC1 runtime and catalog, then confirm the domain serves NYSA CORE at the root, health/readiness are green, and exactly one command/CWD-verified worker is present.
- A failure after green readiness leaves the running candidate and evidence in place. Stop and report the failed check. Any later rollback is a separately approved operation. There is no automatic database restore.
