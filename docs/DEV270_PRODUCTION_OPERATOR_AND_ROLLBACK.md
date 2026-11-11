# DEV270 Production operator and rollback review

Candidate `5c1c350151d6ace33377b33526e2bfedf4ae8f6b`. Production RC1 remains `b6e013c51f46be482858e733160fa7e675ff3106`, migration 140. The Production script is `tools/production-prospect-release-operator.mjs`. CRM Test retains its canonical operator unchanged.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md` and mandatory exact-root worker verification in `AGENTS.md` govern this plan. This is a source review. The Linux selector, exact-root workers, Production credentials and installed runtime have not been exercised by these tests.

## Inputs and approvals

- Obtain separate exact approvals for the Production read-only preflight, backup, install and settled smoke. Complete CRM Test UAT before starting Production. No Production phase starts after 18:00 Dubai on 12 November.
- Download every script and its imported helper files from the approved exact origin commit to a new path. Check each SHA-256 on hosting and execute the main file by absolute path outside the app root. The preflight records RC1 catalog, effective legacy role CONNECT and table privileges, public table owners, disk usage and worker evidence. It makes no grants.
- Before backup approval, bind a new config to the approved preflight config and receipt, verified candidate package and manifest, complete RC1 schema expectation, and the accepted 392-file runtime manifest extracted from the original RC1 origin archive. The approved read-only preflight must compare every installed file to it and record the same SHA-256. Stop and report exact missing or changed paths on any mismatch.
- The Production operator also needs the registered Node.js 24 executable, its SHA-256, and the absolute registered npm CLI path and SHA-256, and explicit confirmation that locked dependency staging from the npm registry is included in the backup approval. RC1 and DEV270 dependency sets differ. Review the npm and dependency path against the live selector registration.
- Review all configured input locations, new phase workspace and absence of all output paths. The configured filenames and full hashes are inputs to review. The operator approval argument is the candidate SHA, phase and exact config SHA-256.

## Backup, install and smoke

- **Backup** rechecks RC1 runtime hashes, read-only catalog, configuration, worker inventory and disk below 90%. It validates the candidate archive outside the app, stages dependencies with locked npm integrity and scripts disabled, creates the scoped application archive and PostgreSQL 13.23 custom dump, checks the archive member list and the dump table set with `pg_restore --list`, and records hashes. The backup also makes a separate `cp -a` copy of the complete RC1 Node.js 24 nodevenv and compares its file hashes, modes and symlink targets with the original before and after the copy.
- **Install** requires fresh backup evidence bound to the exact config and candidate. It rechecks the original application and database, hashes the candidate runtime and dependency tree, and verifies rollback copies for each overwritten file before stopping the exact verified worker. It prepares a same-parent source-directory swap before quiescing, retaining the original read-only source directory and its modes. It installs only manifest-governed runtime changes, installs the verified dependency tree at the unchanged selector nodevenv path, starts once and checks database readiness and exactly one command/CWD-verified worker. It compares the exact post-install migration ledger, table names and full schema contract. Production Campaign governance remains available. WhatsApp and simulator routes stay disabled.
- **Settled smoke** is read-only and requires the successful install receipt. It retains every attempt during the bounded 45-second window with timestamp, status, server header, safe body indicator and body hash. Verify the exact worker again. The separately approved authenticated Agent and Manager browser checks remain required for acceptance.

## Rollback

- Before green readiness with one verified worker, the operator can restore the original source directory by rename, restore other changed application files from verified recovery copies, remove only candidate files that were absent before install, and restore the parked RC1 modules under the unchanged selector nodevenv link. Verify the restored modules against the backed-up fingerprint. The operator does not change the selector environment.
- The application rollback checks RC1 database contract before restarting. If a migration changed the ledger or schema, keep the app stopped and preserve evidence. An RC1 database restore requires a separate approval with the exact backup hash and a decision about writes since backup. Reverify the restored RC1 runtime and catalog, then confirm the domain serves NYSA CORE at the root, health/readiness are green, and exactly one command/CWD-verified worker is present.
- A failure after green readiness leaves the running candidate and evidence in place. Stop and report the failed check. Any later rollback is a separately approved operation. There is no automatic database restore.

After every hosted phase, stop and send its receipt. Continue only when Ajit explicitly writes "go" for the named next phase. On any failure, stop and report the receipt without retrying.

## Selector nodevenv method and commands

Production uses option B. The application link must resolve to `/home/nysareal/nodevenv/nysa-crm/24/lib/node_modules`. Backup copies the complete selector-managed `/home/nysareal/nodevenv/nysa-crm/24` tree to the approved workspace as `rc1-nodevenv` and verifies its fingerprint. The lockfile dependencies are staged outside the live app. Install prepares a sibling module directory inside the selector nodevenv, compares its fingerprint, then renames the original module directory aside and renames the verified DEV270 module directory into its place while the verified worker is stopped. The link itself is unchanged. Install and smoke verify the link and module fingerprint again after readiness.

Use the approved Node.js 24 executable, the new directory holding the SHA-256-checked operator and helpers, and the exact config and config hash from Ajit's written approval. The DEV270 application commit is fixed in these invocations. Every line is a separate phase invocation after its written go.

```sh
"$NODE" "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase backup --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-backup:$APPROVED_PROD_CONFIG_SHA"
"$NODE" "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase install --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-install:$APPROVED_PROD_CONFIG_SHA"
"$NODE" "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase smoke --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-smoke:$APPROVED_PROD_CONFIG_SHA"
```

Before approving backup, a separately approved read-only check must confirm the current link and exact Node/npm evidence. The existing Production preflight approval binds the already-reviewed script and config. A new read-only check needs its own approval. The backup phase also fails closed if the link resolves outside the selector path. The operator manages any permitted in-phase application rollback. Any later manual dependency restore is a separately approved recovery operation using the verified RC1 nodevenv copy.
