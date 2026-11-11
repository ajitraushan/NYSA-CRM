# DEV267 and DEV268 acceptance record

- Accepted by: Ajit
- Acceptance date: 11 November 2026
- Environment: CRM Test only
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_dev247_smoke`
- Final installed version: `2.1.0-dev.268`
- Final installed commit: `b6272e9c9f2a17a2c082324ec8810391de7bdf01`
- Migration ledger: 170
- Public tables: 306
- Governed triggers: 111 enabled triggers across 95 tables
- Canonical schema manifest SHA-256: `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`
- Trigger-contract file SHA-256: `70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf`

## Acceptance scope

DEV267 delivered Prospect Diary, shared suppression enforcement, governed cold-call
controls and the approved manual-DNCR evidence foundation. DEV268 corrected the
hosted Prospect Diary bootstrap recursion, validated malformed company-calling-number
identifiers before the PostgreSQL query and exposed the approved Manager/Director
manual-DNCR controls in Prospect Diary and the WhatsApp suppression workspace.

Ajit separately performed authenticated Prospect Diary and DNCR browser UAT on
11 November 2026 and reported it passed. That browser UAT is owner-supplied evidence,
not part of the unauthenticated Phase D receipt. The remaining display and workflow
observations—including the non-standard dark Prospect Diary banner, near-invisible
prospect name, stale Today/Upcoming counts, DNCR refresh, warning wording/reasons and
duplicate action wording—are explicitly carried into DEV269.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md` and mandatory exact-root
worker verification in `AGENTS.md` remain acceptance criteria. This record does not
authorize another CRM Test operation or any production change.

## Candidate identities

| Release | Version | Candidate commit | Package SHA-256 | Manifest SHA-256 | Config SHA-256 |
|---|---|---|---|---|---|
| DEV267 | `2.1.0-dev.267` | `d9133a980390fe375af36ef415b84e2f4f4fda4e` | `62b8f0c6d1c96224e134b5764b66d5010128614a670e593eeef47b228af20ccc` | `dac329aefa0e0749e4567ec16b84fbc8b53b9b1ea8837b3baa411250a3c5a15f` | `809e4d84168f39bc43613f5ca28ce15b4fbc6893cba30d18fd397464ba9829b9` |
| DEV268 | `2.1.0-dev.268` | `b6272e9c9f2a17a2c082324ec8810391de7bdf01` | `6ebacdb5f19e7c65b5a99e31cbf62d88e7a0b737d736a96367f382b463c43b3c` | `447f6a655219c4d108e2cb164d0520bc502cefac2ee55d40b180bece81ca5b5d` | `3a1fa077651a99e036658d99787fe5627e5da391484f65f98b95300fa4baf74d` |

- Canonical operator commit: `63ad3c5595d7e7d58296641351b47ac623ef8071`
- Canonical operator LF SHA-256: `5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911`

## Script-generated deployment receipt hashes

The generator read each retained receipt byte-for-byte, computed SHA-256, asserted
that every receipt hash is exactly 64 lowercase hexadecimal characters and verified
the expected phase, result, version, commit and configuration identity. The structured
index is `DEV267_DEV268_ACCEPTANCE_RECEIPT_HASHES.json`, SHA-256
`9a7cfc5cc4143ead130ae72dca1e1b2b2e9748b9786c744dca9184432895dd42`. No receipt hash in the tables below was manually transcribed.

### DEV267 receipts

| Evidence | Result | SHA-256 |
|---|---|---|
| `STAGE_RESULT.json` | `STAGED_AND_VERIFIED` | `52e619634cfeda73abe2686e612c01365870ed4cf7cbaa8bde36c913f59ef1c0` |
| `BACKUP_RESULT.json` | `SCOPED_BACKUP_VERIFIED` | `26405a16143392611978a0823629c7b1c7d6f6d74cf38d9a17879d7572c7848b` |
| `SCOPED_BACKUP_VERIFIED.json` | `verified scoped backup contents` | `6e4ef977f77583cb786fe9332356ba75b6e7e2b67207d9989a952965830308a6` |
| `INSTALL_RESULT.json` | `INSTALLED_STARTED_AND_READY` | `eff118efca8fa8e0236c75a11ea541849d85caf3f68619083838c05218fe3c4b` |
| `SMOKE_RESULT.json` | `SETTLED_SMOKE_PASSED` | `0e5e142b0affd1e5aab08125bf0bdd8d2461d6100b765eabb1a78d0e0469b74f` |

### DEV268 receipts

| Evidence | Result | SHA-256 |
|---|---|---|
| `STAGE_RESULT.json` | `STAGED_AND_VERIFIED` | `1b72246d0f7f35fe968b3cbcecc5d5b42634976c0dd0279fa38115bd2b5b200c` |
| `BACKUP_RESULT.json` | `SCOPED_BACKUP_VERIFIED` | `5fc69528af95b9214111308d682800c4bbabfab7c0af5d4c34859972b3a2196d` |
| `SCOPED_BACKUP_VERIFIED.json` | `verified scoped backup contents` | `820dc04bb1bb7aa8e62d300dea3e91523b23db81f20263aac44641e29f5400e4` |
| `INSTALL_RESULT.json` | `INSTALLED_STARTED_AND_READY` | `9999a053c86b994ef2ff7c94261dc85a3e3cec4bbe101a30eef024783b642f01` |
| `SMOKE_RESULT.json` | `SETTLED_SMOKE_PASSED` | `b196a7a0c38bab0d83eeb9ee906f58b77ac70861ecf012c7ca56f7c1580cc6f0` |

## Database, rollback and continuity evidence

Both releases completed the four separately approved canonical phases. DEV268 Phase D
recorded eight passing HTTP attempts, database readiness green and exactly one
command/CWD-verified exact-root worker: PID 1576558, command
`lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`, cwd
`/home/nysareal/nysa-core-dashboard-dd6262a-stage`.

Verified scoped rollback points:

- DEV267: `/home/nysareal/crm-release-preparation/20261110-dev267-run2/scoped-backup-dev267-phased-run2-63ad3c5`
- DEV268: `/home/nysareal/crm-release-preparation/20261111-dev268/scoped-backup-dev268-phased-run1-63ad3c5`

No database restore was run. Production, website, REM and unrelated integrations were
unchanged by both deployments.

## Evidence boundaries and DEV269 carry-forward

Phase D covered `/`, health, readiness and protected unauthenticated endpoints. It
did not itself exercise authenticated Prospect Diary editing, DNCR actions, campaign
retirement or the remaining visual corrections. Ajit's separate authenticated browser
UAT covers the deployed Prospect Diary/DNCR path; its display defects are not accepted
as correct behavior and move to DEV269.
