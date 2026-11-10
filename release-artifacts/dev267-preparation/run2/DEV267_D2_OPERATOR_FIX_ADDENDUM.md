# DEV267 D-2 addendum — baseline trigger contract and PG13 rehearsal

Date: 11 November 2026

Status: **prepared locally and in GitHub; not uploaded or deployed**

Target if separately approved: **CRM Test only**

## 1. Run-1 failure and mutation boundary

DEV267 Phase A run 1 failed safely with receipt prefix `f0536616…` because the
operator used the candidate's post-migration 111-trigger contract when checking
the installed DEV266 baseline, which has 108 triggers. Phase A stopped before
backup, install, migration, restart or application mutation. The run-1 hosted
candidate/evidence paths remain evidence and must not be reused, renamed or
deleted without separate approval.

This addendum uses the new preparation root
`/home/nysareal/crm-release-preparation/20261110-dev267-run2`. Its candidate,
evidence and scoped-backup paths must be proved absent again on hosting before
requesting a new Phase A. That hosted absence has **not** been claimed by this
local build.

## 2. Fixed contract boundary

The candidate now contains a distinct accepted-baseline trigger contract:

- `src/database-schema-baseline/database-trigger-contract.json`;
- 108 enabled triggers, byte-identical to the accepted DEV266 trigger contract;
- raw file SHA-256
  `2c5ccb6df5a24e6b3040e56b02965de0c06874451b988cf7a014daf17aef38f4`;
- normalized trigger-array SHA-256 remains the accepted DEV266 value
  `a270024b7f86cb4506fdcec33c19b14589ef3302d9cb5c2e29a0f1248b9cb073`.

The operator uses that baseline copy for Phase A, Phase B and the Phase C
pre-install gate. The post-install gate continues to use
`src/database-trigger-contract.json`, requiring all 111 DEV267 triggers.
Full-schema manifests remain DEV266 baseline
`496377945ba34038c39c20026c6972a5bc400a37efa9e2f22e7f5e813d8e3daa`
and DEV267 canonical
`59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`.

## 3. Exact identities

| Item | Exact value | Evidence scope |
| --- | --- | --- |
| Candidate version | `2.1.0-dev.267` | origin manifest/config |
| Candidate commit | `d9133a980390fe375af36ef415b84e2f4f4fda4e` | advertised branch `origin/codex/dev267-run2-candidate` |
| Candidate commit adding baseline contract | `d9133a980390fe375af36ef415b84e2f4f4fda4e` | GitHub |
| Operator commit | `63ad3c5595d7e7d58296641351b47ac623ef8071` | separate GitHub commit |
| Operator LF SHA-256 | `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911` | exact operator used by rehearsal |
| Package SHA-256 | `62b8f0c6d1c96224e134b5764b66d5010128614a670e593eeef47b228af20ccc` | canonical origin builder and verifier |
| Manifest SHA-256 | `dac329aefa0e0749e4567ec16b84fbc8b53b9b1ea8837b3baa411250a3c5a15f` | origin artifact |
| Run-2 config SHA-256 | `809e4d84168f39bc43613f5ca28ce15b4fbc6893cba30d18fd397464ba9829b9` | script-generated verification |
| Worker helper | `6bbb2833fbafcaf4f78d7a0f1269b4c0062c022c4292d594bcd40a7f61dae785` | unchanged |
| Backup helper | `b682d446d3a422d1c325eb5a6e2bcfd749f3b396ffd58e0df77fef2f862bf215` | unchanged |
| Trigger helper | `b95c369e7f8ba2a199aaa5de3b2fe7e1592ca7b52b6d4fc9dddfd02caebd2fcd` | unchanged |
| Schema helper | `8a31f43ddfbaa4832804a4aa428892fb03eb40368622131a06d35b488ffb219c` | unchanged |

The package was rebuilt only because the baseline trigger file is governed
package content. The application feature implementation is otherwise the
reviewed DEV267 scope. Packaging used only
`npm run release:package -- --commit <origin SHA>` and the mandatory package
verifier passed.

## 4. Operator tests

Focused command:

```text
node --test test/dev267-operator-trigger-baseline.test.js test/dev267-deploy-config-generator.test.js test/dev265-hosted-schema-layout.test.js test/dev265-full-schema-operator.test.js test/dev261-direct-node-operator.test.js
```

Result: **23 passed, 0 failed, 0 skipped**. The new cases prove:

1. a release adding triggers passes Phase A against migration 169 and the
   accepted 108-trigger baseline;
2. removing one baseline trigger fails Phase A;
3. the post-install comparison still fails unless all 111 canonical triggers
   exist; and
4. baseline contracts are selected only for baseline phases.

The mandatory exact-package governed suite also passed: 1,683 tests total,
1,578 passed, 0 failed and 105 skipped. Its raw output SHA-256 is
`d51dc60f21d6bffc8bc2f6c9cb4047d22147c453952c5c733ea3ab8fe2bd0947`.
Skipped tests remain skips, not passes, and are listed in the existing DEV267
skip receipt.

## 5. PostgreSQL 13.23 Phase A/B/C rehearsal

GitHub Actions run `42899318590` completed successfully on PostgreSQL
`13.23 (Debian 13.23-1.pgdg13+1)`. It used:

- the exact origin zip and manifest identified above;
- an isolated synthetic database built to DEV266's exact state: migration 169,
  303 tables and 108 triggers;
- the canonical operator at commit `63ad3c5…`, invoked as the same `nysareal`
  account that owned and served the isolated app root;
- a CloudLinux-shaped exact-root worker lifecycle and isolated TLS front door;
- no CRM Test or Production data.

Results:

| Phase | Result | Duration | Contract result |
| --- | --- | --- | --- |
| A | `STAGED_AND_VERIFIED` | 15 s | migration 169; 303 tables; baseline full-schema match; 108/108 triggers |
| B | `SCOPED_BACKUP_VERIFIED` | 12 s | app archive opened; custom PostgreSQL dump verified; 303/303 tables and 108/108 triggers |
| C | `INSTALLED_STARTED_AND_READY` | 16 s | migration 170; 306/306 tables; canonical full-schema match; 111/111 triggers; database ready; one command/CWD-verified worker |

The Phase C receipt also records one verified baseline worker stopped, one
controlled start, and readiness for `2.1.0-dev.267` with exactly one worker.
The rehearsal's scoped backup was local CI evidence only and is not a CRM Test
rollback point.

### Evidence integrity

The downloaded artifact's `SHA256SUMS.txt` has SHA-256
`60df052efe118ff97eba884e1511d160be43492890bb9f208cd0f20470b7b9ef`.
All 16 listed artifact hashes were recomputed locally and matched. Principal
receipt hashes from that file are:

| Receipt | SHA-256 |
| --- | --- |
| `STAGE_RESULT.json` | `b253e633c43f99eaf84d9c548b7a87ec575c35096f8987c1742fb58688ebb113` |
| `BACKUP_RESULT.json` | `f1f97f696cec63510a4d230aea94c549e5d2d7c8ef38de30eab0877d5b1ec331` |
| `SCOPED_BACKUP_VERIFIED.json` | `e7cf72bc856326ac4f954fb1ec48a5e4ed67f9084c08efbbe30aaec677b19735` |
| `INSTALL_RESULT.json` | `16f044aaa9cbbf4817e0eaf487f22c2eb28bddf32ca968ec7497137c563e8a4f` |
| `PHASE_AB_BASELINE_PG13.json` | `4bb7fae13ce3b852e4e6fb974a475faeeaf2d37c6c7962d08094670e8dc7e0bd` |
| `PHASE_C_POSTINSTALL_PG13.json` | `86ee262e408f4d0c64f28356fab85a294fe6f95f3899e4c681cce83429befb36` |

All raw operator output, worker/selector/proxy output, identity receipt and
hash list are retained under `run2/pg13-rehearsal-final/`.

## 6. Rehearsal failure disclosure

Before the successful run, the harness stopped on multiple fixture-parity
issues. None was a hosted run and none changed the operator, package or config
identities reported above. The failures included fixture credential scope,
package timestamp identity, schema ownership, self-registering historical
migration handling, empty process inventory, worker accessibility, and finally
running the operator as `root` rather than the app owner. Each failed run
stopped at its first failing phase. The final app-owner parity correction was
limited to the CI harness; successful run `42899318590` then passed A, B and C.

This history is retained in GitHub Actions rather than being represented as a
first-attempt pass. It does not establish hosted success; only a separately
approved four-phase CRM Test deployment can do that.

## 7. Coverage boundary and next approvals

Verified locally/CI:

- operator baseline/post-install contract selection;
- exact origin package integrity;
- Phase A, Phase B and Phase C behavior on PostgreSQL 13.23 with DEV266's exact
  schema shape;
- migration 170's post-state and exact worker lifecycle.

Not verified by this rehearsal:

- current hosted CRM Test provenance or schema after the failed run-1 Phase A;
- hosted path absence for run 2;
- hosted backup freshness or cPanel selector behavior;
- hosted Phase D, browser acceptance or Production.

Next approval must be only for placement of operator SHA-256 `5af8bbc8…9911`
from commit `63ad3c5…` and its required run-2 artifacts, with before/after hashes
and helper import checks. A new Phase A requires its own later written approval
after hosted identities, DEV266 health and all run-2 output-path absences are
reverified. Phase B, Phase C, Phase D and Production remain separately approved.

