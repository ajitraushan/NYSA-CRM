# DEV269 acceptance record

- Accepted by: Ajit
- Acceptance date: 11 November 2026
- Environment: CRM Test only
- Application root: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`
- Database: `nysareal_nysa_dev247_smoke`
- Version: `2.1.0-dev.269`
- Candidate commit: `e5db302e12a21d2597ecab0dc340fa2eae534381`
- Package SHA-256: `05b27a47641b430e991238673f531e91b2843b644ee3fb7a9473bb313e1a6a64`
- Manifest SHA-256: `683543c64a27effd1a827f8f1f448a5098ddf7fe1446018ed9c9f3c345d0aa1e`
- Deployment config SHA-256: `beafa2c490ee6da3063f82883a86632704dd4604ef302366ae2e6279a5aea430`
- Migration ledger: 170; DEV269 added no migration
- Public tables: 306
- Governed triggers: 111 enabled triggers across 95 tables
- Canonical schema manifest SHA-256: `59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944`
- Trigger-contract file SHA-256: `70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf`

## Accepted scope

DEV269 is accepted on CRM Test with the following scope:

- audited Prospect edit with duplicate/suppression re-checks and converted
  records remaining read-only;
- neutral, readable Prospect Diary list and record headings;
- corrected Today and Upcoming tiles;
- live status refresh after manual DNCR actions;
- readable warnings that retain the Agent's reason;
- Manager override register and stronger "previously declined" wording;
- outside-hours soft warning with the approved message, mandatory
  acknowledgement/reason, visible Task and call-record evidence, and Manager
  override/audit evidence;
- campaign retirement;
- prospect-local time in the reply-lock pill;
- consistent out-of-scope 404 responses; and
- removal of the material storage key from list responses.

`PROSPECT_OUTSIDE_CALLING_HOURS_MODE` was not configured on hosting. The
application therefore uses its approved default value, `warning`.

Ajit performed authenticated Sales Agent and Manager browser UAT on
11 November 2026 and reported it passed. The accepted sequence included creating
Ahmed without an email address, adding the email later, and then converting the
prospect. The same UAT confirmed the readable record heading, outside-hours
warning, saved Task/call note and Manager register entry, campaign retirement,
and the governed 404 behavior. This authenticated owner-supplied UAT is separate
from the operator's unauthenticated Phase D evidence.

## Four-phase deployment evidence

Phases A through D each ran once under separate written approval through the
canonical operator. Phase A staged and verified the exact GitHub-origin package;
Phase B created and verified the scoped application/database rollback point;
Phase C installed the migration-neutral candidate and returned readiness green;
Phase D completed the read-only settled smoke.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md` and mandatory exact-root
worker verification in `AGENTS.md` remained acceptance criteria. At Phase C and
Phase D completion, exactly one command/CWD-verified worker served the expected
application root:

- PID: `1052848`
- command: `lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/`
- cwd: `/home/nysareal/nysa-core-dashboard-dd6262a-stage`

Phase D retained eight passing response attempts. `/`, `/api/health` and
`/api/readiness` returned their expected 200 responses; protected application
and simulated-provider endpoints returned their expected 401 responses. The
receipt records every attempt's timestamp, status, LiteSpeed server header, safe
body snippet and body SHA-256.

## Script-generated receipt hashes

A Node.js verification command read each retained receipt byte-for-byte,
calculated SHA-256, asserted the regular expression `^[0-9a-f]{64}$`, parsed the
JSON, and checked the expected phase and result. It completed with
`ALL_HASHES_64_HEX=true`. The values below are its output values, not hashes
calculated from manually copied receipt text.

| Evidence | Result | SHA-256 |
|---|---|---|
| `STAGE_RESULT.json` | `STAGED_AND_VERIFIED` | `881d9bc50925540e86db6a8e92c235abe11277e412c6bb60074223395a673cd8` |
| `BACKUP_RESULT.json` | `SCOPED_BACKUP_VERIFIED` | `441f150401a81ab82fea40fcd9eb475209433ddbfb3e959067f2419fc41d86bc` |
| `SCOPED_BACKUP_VERIFIED.json` | verified scoped backup contents | `01d49a2c0289f711f6e410b1a6d1a8795ed9f877805d570bbeba3b0171f46403` |
| `INSTALL_RESULT.json` | `INSTALLED_STARTED_AND_READY` | `4a4ad11f98a68773164bd2511b2a6fe1f5b44b3d78f2f3a1f2653c16fc5b9fff` |
| `SMOKE_RESULT.json` | `SETTLED_SMOKE_PASSED` | `e947e126b9c7cf484407e1fe309119d6eae9b34dd8d91ae0f7aa493319355eca` |

## Rollback, integrity and environment boundary

The verified CRM Test rollback point is:

`/home/nysareal/crm-release-preparation/20261111-dev269/scoped-backup-dev269-phased-run1-63ad3c5`

- application archive SHA-256:
  `c04046a4ae2474a01cf2557a210e654041efda351fe6a8771b02712b165363a7`;
- PostgreSQL custom dump SHA-256:
  `307478393e8520c2a835f452e1df791f724e4bb6443433368df856d42af9d67a`;
- PostgreSQL dump/restore tools: 13.23;
- verified database contents: the exact 306-table set, 111-trigger contract,
  complete baseline schema contract, safe lead counters and all 15 governed
  drift-data checks.

No automatic application rollback and no database restore were performed.
Production, website, REM and unrelated integrations were unchanged. This record
does not authorize production deployment or another CRM Test operation.

## Known minor items carried forward

The following are accepted as deferred minor items for a later release, not as
part of the delivered DEV269 behavior:

1. Converting a Prospect closes its open Prospect follow-ups instead of carrying
   those follow-ups into the resulting Customer/Lead workflow.
2. The "Record call or note" form remains visible on converted Prospect records,
   although server-side saves are correctly refused.
