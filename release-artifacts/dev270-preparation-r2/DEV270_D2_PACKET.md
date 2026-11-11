# DEV270 revised D-2 packet

This packet supersedes the draft for `15d1b7e7`. The exact application candidate `5c1c350151d6ace33377b33526e2bfedf4ae8f6b` is advertised by `origin/codex/prod-prospect-upload`. The Production operator and rollback plan are in `b71166b4de02384a927c3f10941629d06ba4b52f`, with the accepted RC1 runtime gate and read-only source layout follow-up in `bbb7ae23c72745846868f61f3b92bd2cf2ef2821`. Production option B is implemented in `2197f15a21aed31b24c6488013dc86d421edf021`. The CloudLinux wrapper correction is `9428b805c15123b98a79855639a0d0e09da13212`. Neither CRM Test nor Production has been accessed for this revision. The package remains local.

## Identity and hashes

| Artifact | SHA-256 |
|---|---|
| Application package | `1aecf97244cb3b15b64bb0cc9a5f971ab3a66530cd0cea87a5aa2aa3d2c75c5c` |
| Origin package manifest | `7b64a94146f926293884c730dc28d853c545d40b778765ca6fae751a125aa211` |
| CRM Test config | `7edadb1331615b8081bb8be3ed9ce1296a18c07301da7be0918ba8696f6e3e62` |
| Canonical CRM Test operator | `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911` |
| Production preflight source | `4d368dfe29adc0d0e91f2530b539578a0b847b0bfaf5804e4c00c05935c6984d` |
| Production preflight config | `919d4fdd44b30ce359bb0fa4b7c9d577f2a8ffab6789901c1a007623805d765f` |
| Production RC1 schema expectation | `166c1dc1680ebf39197d69e5a379d8d0306eb75722dfab3fbc7d4243e43a9bf0` |
| Production backup, install and smoke source | `697be930028a7af3430338b4afdbdc165f56a8177f593ed6d54829a07358f9aa` |
| Accepted RC1 runtime manifest, 392 files | `c039640677470acc156801f8542f022c2fdb21167051f201a42d808d234b7292` |
| Candidate schema manifest | `ecc526b734cb42116ec00cd5d55b4ade0916df2e02c5673f7be7ab37fbc92e8b` |

The committed config hashes refer to the exact LF bytes. `DEV270_SHA256SUMS.txt` binds the scripts, imported helpers, evidence and package files. The Production backup/install/smoke config hash is pending the approved live preflight receipt, registered Node/npm evidence and the phase workspace inputs. It cannot be approved from this packet alone.

## Checks

- Excel numeric mobile, local 05x, 971 and 00971 inputs normalize to E.164. Excel column B is formatted as text. Fully blank rows are skipped with original row numbers retained. Blank Source is `other`. The result file identifies skipped rows by row number and includes status and reason.
- A Director regression covers existing Prospects across owners and the Customer or Lead match. Agent and Manager scope, suppression, idempotency and batch audit passed on PostgreSQL 13.23. See `PG13_INTEGRATION_RAW.txt`.
- A 2,000-row HTTP commit with 2,000 phone numbers and notes took **11.191 seconds**. Samples observed all four table locks across **11.044 seconds** with 10 ms polling. Preview took **5.876 seconds**. The fixture had no concurrent business traffic, so the observed lock span is a sampled lower bound and not a Production contention estimate. The 2,001-row HTTP request was refused. See `UPLOAD_2000_RAW.txt`.
- The Production-shaped rehearsal used database `nysareal_nysacrm` as `nysareal_nysacrmapp`, with the historical role absent. The real migration runner applied all 17 mapped grants in 142–165, moved the ledger from 140 to 171, matched the entire contract and recorded zero migration 169 cleanup events. See `PRODUCTION_PG13_RAW.txt`.
- The CRM Test rehearsal used `nysa_test_fixture` as `nysa_test_user`. It restored the exact historical drift state, deleted 12 synthetic messages and five notifications with one audit entry, and reached 171. See `CRM_TEST_PG13_RAW.txt`.
- Exact-package Agent and Manager Chrome checks passed through `index.html`. Authenticated `/crm/campaigns` returned 200 under Production settings. WhatsApp workspace and simulator health returned 404. The sandbox mounts are disabled by the same Production guard. See `EXACT_PACKAGE_BROWSER_RESULT.json`.
- Production preflight now reports the legacy role's effective database CONNECT, effective public table privileges and table owners. Assertion failures retain the assertion message. The local PostgreSQL 13.23 test exercised role-absent and role-present cases. Operator tests passed for runtime names, paths, phase binding, receipt freshness and environment gates. The hosted Linux workflow has not been rehearsed. See `PRODUCTION_OPERATOR_RAW.txt`.
- The origin build recorded 1,593 passes, 106 named skips and zero failures. The manifest and package passed provenance verification. The candidate has 171 migrations, 307 public tables and 111 triggers. Migration 171 is additive to existing data. RC1 and DEV269 use the same Lead visibility policy, so that work remains deferred.

## Accepted RC1 runtime manifest

The original RC1 origin archive was found in the retained 26 October Production release evidence. Its package SHA-256 is `ebbf85112a340c92ac5e847a6bf5d383eb5a954416d8a96fd573892584a5937b`. The deployment receipt for `b6e013c51f46be482858e733160fa7e675ff3106` records that the runtime manifest passed verification. The manifest was extracted byte-for-byte, and all 392 entries matched the archive contents locally. See `PRODUCTION_RC1_RUNTIME_LOCAL_RECEIPT.json` and `PRODUCTION_RC1_RUNTIME_MANIFEST.sha256`.

The approved Production read-only preflight must hash those 392 installed paths under `/home/nysareal/nysa-crm` and record the matching manifest hash before backup is eligible. A missing file or mismatch stops preflight and reports the exact path and, for changed bytes, both hashes. The backup/install operator checks the same manifest and requires the successful receipt. Its same-parent source-directory swap preserves the original read-only `src` directory for application rollback. Local tests covered mismatch handling, swap and rollback. Actual Linux hosting checks remain pending.

## Production selector dependency path

Use option B. The live app link must resolve to `/home/nysareal/nodevenv/nysa-crm/24/lib/node_modules`. Backup copies the complete RC1 nodevenv to `rc1-nodevenv` in the approved backup workspace and verifies its content, modes and symlink targets. The approved install swaps the locked dependency directories inside the same selector nodevenv while the worker is stopped. The app symlink stays in place. Rollback restores the parked RC1 modules and verifies them against the backup fingerprint. A local filesystem test passed for both directions. See `NODEVENV_SWAP_RAW.txt`.

The existing 10:00 CRM Test Phase A and Production preflight commands, configs and source hashes are unchanged. The first selector evidence run confirmed the expected node_modules link and stopped on the distinction between CloudLinux's wrapper and the real interpreter. The revised selector script requires separate approval and a new origin download directory. It records `nodeWrapper`, `nodeWrapperSha256`, `nodeExecutable`, `nodeExecutableSha256`, `npmCli`, and `npmCliSha256`. The Production operator compares all six fields with the approved config. The real interpreter is pinned at `/opt/alt/alt-nodejs24/root/usr/bin/node`. The npm CLI must resolve within that ALT installation and is invoked directly with the pinned interpreter. Local tests reproduced the wrapper layout and rejected wrapper execution, the wrong Node major and altered approved hashes.

```sh
/opt/alt/alt-nodejs24/root/usr/bin/node "$PROD_TOOLS/production-selector-readonly-evidence.mjs" --evidence "$PROD_TOOLS/PRODUCTION_SELECTOR_RESULT.json" --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-selector-readonly
```

## Dubai schedule on 12 November

| Time | Work |
|---|---|
| 10:00 | CRM Test A–D in order, and Production read-only preflight in parallel |
| 12:00 | CRM Test UAT |
| 13:30 | Production backup, conditional on accepted UAT and preflight |
| By 16:00 | Production install, then separately approved settled smoke and authenticated checks |

After each hosted operation, stop and send its receipt. Start the named next phase only after Ajit writes "go" for it. Any failure stops the sequence and is reported without retry. CRM Test A and Production preflight may run in parallel only with separate approvals for both. The 18:00 Dubai cutoff for starting a Production phase remains in force. No upload is authorized by this packet.

## Hosted commands for approval review

These are file invocations. Before each run, verify that the new output paths are absent, obtain the exact approval, download the committed sources to the new approved directory, and run `sha256sum -c` against the applicable approved checksums. Retain output by phase. `$NODE` is the approved absolute Node path. `$TEST_TOOLS` and `$PROD_TOOLS` are the approved absolute new download directories. Do not populate either from an earlier run.

```sh
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase stage --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:stage
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase backup --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:backup
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase install --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:install
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase smoke --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:smoke
"$NODE" "$PROD_TOOLS/production-prospect-readonly-preflight.mjs" --config "$PROD_TOOLS/PRODUCTION_PREFLIGHT_CONFIG.json" --schema "$PROD_TOOLS/PRODUCTION_RC1_SCHEMA_EXPECTATION.json" --runtime "$PROD_TOOLS/PRODUCTION_RC1_RUNTIME_MANIFEST.sha256" --evidence "$PROD_TOOLS/PRODUCTION_PREFLIGHT_RESULT.json" --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-readonly-preflight:919d4fdd44b30ce359bb0fa4b7c9d577f2a8ffab6789901c1a007623805d765f
/opt/alt/alt-nodejs24/root/usr/bin/node "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase backup --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-backup:$APPROVED_PROD_CONFIG_SHA"
/opt/alt/alt-nodejs24/root/usr/bin/node "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase install --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-install:$APPROVED_PROD_CONFIG_SHA"
/opt/alt/alt-nodejs24/root/usr/bin/node "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase smoke --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-smoke:$APPROVED_PROD_CONFIG_SHA"
```

`$PROD_CONFIG` and `$APPROVED_PROD_CONFIG_SHA` must come from the written approval for the actual config after preflight. The Production backup command uses PostgreSQL 13.23 `pg_dump -Fc` and preserves owner and ACL records. The operator checks disk below 90%, and app rollback never restores the database automatically.

The mandatory hosted controls in `AGENTS.md` and `CRM_CHANGE_POLICY.md` apply, including fresh backup, exact command/CWD worker checks and one verified worker after readiness. See `docs/DEV270_PRODUCTION_OPERATOR_AND_ROLLBACK.md` at the separate operator commit. Neither hosted output paths nor live registration have been checked. WN-15 remains paused.
