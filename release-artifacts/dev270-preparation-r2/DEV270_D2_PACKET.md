# DEV270 revised D-2 packet

This packet supersedes the draft for `15d1b7e7`. The exact application candidate `5c1c350151d6ace33377b33526e2bfedf4ae8f6b` is advertised by `origin/codex/prod-prospect-upload`. The separate Production operator and rollback source is commit `b71166b4de02384a927c3f10941629d06ba4b52f`. Neither CRM Test nor Production has been accessed for this revision. The package remains local.

## Identity and hashes

| Artifact | SHA-256 |
|---|---|
| Application package | `1aecf97244cb3b15b64bb0cc9a5f971ab3a66530cd0cea87a5aa2aa3d2c75c5c` |
| Origin package manifest | `7b64a94146f926293884c730dc28d853c545d40b778765ca6fae751a125aa211` |
| CRM Test config | `7edadb1331615b8081bb8be3ed9ce1296a18c07301da7be0918ba8696f6e3e62` |
| Canonical CRM Test operator | `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911` |
| Production preflight source | `103acbc56bfd4fd44cb6def8a4a773a3bcfda77ad3ae9eab6e692ba74565df1b` |
| Production preflight config | `f4ddd8d1cd661df6aa049b23bc925ee65c2246686b383ad2917bd4fdf1c4fc37` |
| Production RC1 schema expectation | `166c1dc1680ebf39197d69e5a379d8d0306eb75722dfab3fbc7d4243e43a9bf0` |
| Production backup, install and smoke source | `7f393c40ec4cb7e83b6e518a4f88e51d52e982fa23698f227be2f00df4877724` |
| Candidate schema manifest | `ecc526b734cb42116ec00cd5d55b4ade0916df2e02c5673f7be7ab37fbc92e8b` |

The committed config hashes refer to the exact LF bytes. `DEV270_SHA256SUMS.txt` binds the scripts, imported helpers, evidence and package files. The Production backup/install/smoke config hash is pending the approved live preflight receipt and accepted RC1 runtime manifest. It cannot be approved from this packet alone.

## Checks

- Excel numeric mobile, local 05x, 971 and 00971 inputs normalize to E.164. Excel column B is formatted as text. Fully blank rows are skipped with original row numbers retained. Blank Source is `other`. The result file identifies skipped rows by row number and includes status and reason.
- A Director regression covers existing Prospects across owners and the Customer or Lead match. Agent and Manager scope, suppression, idempotency and batch audit passed on PostgreSQL 13.23. See `PG13_INTEGRATION_RAW.txt`.
- A 2,000-row HTTP commit with 2,000 phone numbers and notes took **11.191 seconds**. Samples observed all four table locks across **11.044 seconds** with 10 ms polling. Preview took **5.876 seconds**. The fixture had no concurrent business traffic, so the observed lock span is a sampled lower bound and not a Production contention estimate. The 2,001-row HTTP request was refused. See `UPLOAD_2000_RAW.txt`.
- The Production-shaped rehearsal used database `nysareal_nysacrm` as `nysareal_nysacrmapp`, with the historical role absent. The real migration runner applied all 17 mapped grants in 142–165, moved the ledger from 140 to 171, matched the entire contract and recorded zero migration 169 cleanup events. See `PRODUCTION_PG13_RAW.txt`.
- The CRM Test rehearsal used `nysa_test_fixture` as `nysa_test_user`. It restored the exact historical drift state, deleted 12 synthetic messages and five notifications with one audit entry, and reached 171. See `CRM_TEST_PG13_RAW.txt`.
- Exact-package Agent and Manager Chrome checks passed through `index.html`. Authenticated `/crm/campaigns` returned 200 under Production settings. WhatsApp workspace and simulator health returned 404. The sandbox mounts are disabled by the same Production guard. See `EXACT_PACKAGE_BROWSER_RESULT.json`.
- Production preflight now reports the legacy role's effective database CONNECT, effective public table privileges and table owners. Assertion failures retain the assertion message. The local PostgreSQL 13.23 test exercised role-absent and role-present cases. Operator tests passed for runtime names, paths, phase binding, receipt freshness and environment gates. The hosted Linux workflow has not been rehearsed. See `PRODUCTION_OPERATOR_RAW.txt`.
- The origin build recorded 1,593 passes, 106 named skips and zero failures. The manifest and package passed provenance verification. The candidate has 171 migrations, 307 public tables and 111 triggers. Migration 171 is additive to existing data. RC1 and DEV269 use the same Lead visibility policy, so that work remains deferred.

## Dubai schedule on 12 November

| Time | Work |
|---|---|
| 10:00 | CRM Test A–D in order, and Production read-only preflight in parallel |
| 12:00 | CRM Test UAT |
| 13:30 | Production backup, conditional on accepted UAT and preflight |
| By 16:00 | Production install, then separately approved settled smoke and authenticated checks |

Each hosted operation requires its own exact approval. An overdue or failed gate stops the sequence. The 18:00 Dubai cutoff for starting a Production phase remains in force. No upload is authorized by this packet.

## Hosted commands for approval review

These are file invocations. Before each run, verify that the new output paths are absent, obtain the exact approval, download the committed sources to the new approved directory, and run `sha256sum -c` against the applicable approved checksums. Retain output by phase. `$NODE` is the approved absolute Node path. `$TEST_TOOLS` and `$PROD_TOOLS` are the approved absolute new download directories. Do not populate either from an earlier run.

```sh
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase stage --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:stage
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase backup --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:backup
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase install --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:install
"$NODE" "$TEST_TOOLS/crm-test-direct-node-release-operator.mjs" --config /home/nysareal/crm-release-preparation/20261112-dev270-r2/DEV270_DEPLOY_CONFIG.json --backup-path /home/nysareal/crm-release-preparation/20261112-dev270-r2/scoped-backup --phase smoke --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:smoke
"$NODE" "$PROD_TOOLS/production-prospect-readonly-preflight.mjs" --config "$PROD_TOOLS/PRODUCTION_PREFLIGHT_CONFIG.json" --schema "$PROD_TOOLS/PRODUCTION_RC1_SCHEMA_EXPECTATION.json" --evidence "$PROD_TOOLS/PRODUCTION_PREFLIGHT_RESULT.json" --approved 5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-readonly-preflight:f4ddd8d1cd661df6aa049b23bc925ee65c2246686b383ad2917bd4fdf1c4fc37
"$NODE" "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase backup --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-backup:$APPROVED_PROD_CONFIG_SHA"
"$NODE" "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase install --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-install:$APPROVED_PROD_CONFIG_SHA"
"$NODE" "$PROD_TOOLS/production-prospect-release-operator.mjs" --phase smoke --config "$PROD_CONFIG" --approved "5c1c350151d6ace33377b33526e2bfedf4ae8f6b:production-smoke:$APPROVED_PROD_CONFIG_SHA"
```

`$PROD_CONFIG` and `$APPROVED_PROD_CONFIG_SHA` must come from the written approval for the actual config after preflight. The Production backup command uses PostgreSQL 13.23 `pg_dump -Fc` and preserves owner and ACL records. The operator checks disk below 90%, and app rollback never restores the database automatically.

The mandatory hosted controls in `AGENTS.md` and `CRM_CHANGE_POLICY.md` apply, including fresh backup, exact command/CWD worker checks and one verified worker after readiness. See `docs/DEV270_PRODUCTION_OPERATOR_AND_ROLLBACK.md` at the separate operator commit. Neither hosted output paths nor live registration have been checked. WN-15 remains paused.
