# DEV273 D-2 review packet

Date: 13 November 2026 (Dubai)

Release: `2.1.0-dev.273`

Application candidate: `12d2ffd3acd257dda955e6a16e78bdcc56441235`

Operator/config evidence commit: `8144ae8b` (CRM Test operator itself is pinned separately at `12d924f8564bf38b91b90fcd186336b213f742a2`)

This packet requests review only. No CRM Test or Production command was run. Every hosted phase remains separately subject to Ajit's written go under AGENTS.md mandatory hosted-worker verification and CRM_CHANGE_POLICY.md hosted-deployment controls.

## 1. Baseline and change boundary

Both environments are planned as DEV272 → DEV273. Accepted Production is `2.1.0-dev.272`, commit `54421912fc1496a1066814cd8b665c19c7e8fd45`, package `fae91377…`, at 172 migrations, 313 tables and 113 triggers. `BASELINE.md` records Production install `f2428ae8…`, smoke `8dd82c03…`, green database readiness and one verified exact-root worker. The handoff identifies CRM Test as DEV272 at the same database contract.

DEV273 is application-only. Migration 172 is unchanged and there is no migration 173. The Production preflight expects 172/313/113, the full approved schema/runtime contracts, and all four Customer/Lead owner/team counts at zero. The earlier Production count receipt `8b7d24d3…` reported zero for all four; the fresh preflight must recheck and stop on any non-zero result.

Security/privacy impact: Customer and Lead authorization is now applied consistently to linked surfaces. Manager and Director contact details are masked until Reveal; Reveal logs actor, time, entity and field names only. Cross-scope duplicate warnings contain no identifying values. In-scope generated PDFs remain original and unmasked; out-of-scope preview/download returns 404, and Manager/Director PDF access is audited without document contents.

## 2. Exact artifacts and hashes

| Artifact | Commit/pin | SHA-256 |
|---|---|---|
| Candidate ZIP | `12d2ffd3acd257dda955e6a16e78bdcc56441235` | `b8e53f48d953cc29163b43bca570ca6e2bd279983a8ee2b6fe53f99b7aad025e` |
| Origin manifest | same | `a5dd49ece1d13c71a4ad17d155b2c9519be7b4f5220ac74043e6b7899aa778ee` |
| Candidate runtime manifest | same | `7594105b4a47864ffe9d9a9323a3b3b000b26904d49c13ab324f9c2bdb4b1297` |
| CRM Test operator | `12d924f8564bf38b91b90fcd186336b213f742a2` | `0d66f2617c5ff5fc8fb01cd808dc3df46999d19d6432979685f1bc772515d34e` |
| CRM Test DEV273 install config | `8144ae8b` | `84de5156f14c35c8983c7dc3d2570a51cfe567fb52b956a2e1eef33fea745816` |
| CRM Test DEV272 reverse config | `8144ae8b` | `0562d6c81c3ffc9f3a93fb4dc18f5f08841e17787e7bf0395d14a57237e9970e` |
| CRM Test DEV273 reinstall config | `8144ae8b` | `6de52f7c71827b41336f441dd15c943f7e4104ff8e2d2751959afcb0eec3cc69` |
| Production read-only preflight config | `8144ae8b` | `f05bf7ed926b66a3b8178665f22ebc68adfcd626a612a9465de196e77ccf0d0d` |
| Production read-only preflight tool | application candidate | `8b1900098902724c846624848d22cb836dc2bdb77d673dd835a4720c7e5559a0` |
| Production release operator | application candidate | `68b3049d5f5629e931dba59642c3312357e279e0d92e142d4f780497838dc430` |

The canonical builder was invoked only as `npm run release:package -- --commit <full-origin-SHA>`. The mandatory provenance verifier passed against GitHub origin. Package entry count is 510 (509 runtime-manifest entries plus the manifest checksum file). Config/tool hashes above were calculated from committed Git blobs. Config LF and Windows working-file hashes are identical and are the hashes checked by the operators.

## 3. Test evidence

The final governed run used a detached checkout of the exact pushed candidate with `NYSA_DEV273_SCOPE_FIXTURE=local-synthetic` and PostgreSQL 13.23:

- **1,633 passed, 0 failed, 109 skipped**;
- full log committed at `6d1b8431`;
- committed LF log SHA-256 `45413acf5bcf55e5eaad252e423c52dc6fd51236447571975744358f0363cd1b`;
- Windows CRLF working-file SHA-256 `855e90ff30c4a6db0803ab6776a21d0c0462dd54734de8bc4057439bdace29fd`; the committed LF form is authoritative.

Fresh exact-candidate PostgreSQL 13.23 reruns also passed:

| Check | Result | Receipt SHA-256 |
|---|---|---|
| Today/first-call-overdue ordering and override integration | 1 pass, 0 fail, 0 skip | `8a3ffe6b0bc0dde3dab9f4d51be894ac534f1bdc37ed89018fb81a2d9b59917f` |
| Two-process digest schedule and claim | 1 pass, 0 fail, 0 skip; synthetic send only, no SMTP | `31522197c47aeeab8fb76d5912d4615f64f0772a4d768be300351dce4605a379` |
| Exact DEV272/DEV273 archive source swap and restore | 406 source files and 509 runtime files verified | `44c89333b5ba9e768999ffc7df66f5c2219c69e950a6ed4dfd5a0da71ae64d43` |

The source-swap receipt used a Windows copy adapter and therefore did not claim CloudLinux selector, dependency, worker or readiness coverage. Those are acceptance conditions of the separately approved CRM Test phases. The earlier Production-shaped PostgreSQL rehearsal verified DEV272 → DEV273 → DEV272 on one database at 172/313/113; its DEV273 application step predated the final package. The exact-package hosted install/reverse/reinstall sequence below replaces that limitation before Production.

Local list/search benchmarks used 2,000 Customers and 2,000 Leads, two warmups and 20 timed requests per case. All p95 values were below 23 ms (Agent, Manager and Director list/search), far inside the 2-second target. This is local single-team evidence, not hosted latency.

## 4. Cross-surface authorization evidence

| Surface | Exact passing test | Result |
|---|---|---|
| Customer and Lead lists/search | `Role defaults, Owning Agent filters, unassigned WEB and Meta queues and open offers enforce scope` | Pass |
| Customer 360 | `DEV273 Customer and Lead HTTP scope across linked surfaces` | Pass |
| Lead queues/detail | `Role defaults, Owning Agent filters, unassigned WEB and Meta queues and open offers enforce scope` | Pass |
| Documents/proposals/PDF | `Scoped generated PDF preview and download preserve original bytes and audit access`; parent scope test | Pass |
| Opportunities | `Opportunity list and detail mask Director contact details and enforce Agent scope` | Pass |
| Linked tasks | `DEV273 Customer and Lead HTTP scope across linked surfaces` | Pass |
| Dashboards | same parent scope test | Pass |
| Exports/CSV | same parent scope test | Pass |
| AI assistant | `AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary` | Pass |
| Duplicate warnings | same AI/duplicate/Reveal test | Pass |
| Reveal and log | same AI/duplicate/Reveal test plus parent Customer Reveal checks | Pass |

Detailed assertions are in `DEV273_D2_VISIBILITY_AND_PINS.md`. All requested rows pass; there is no remaining item-2 gap.

## 5. Earlier failures and skip accounting

No test was deleted or skipped to obtain green. The 23 tests from the first in-progress run are listed by exact name and disposition in `docs/change-requests/DEV273-D2-LOCAL-EVIDENCE.md`: 17 stale-version or fixture assertions were fixed and six authorization assertions were rewritten to the approved DEV273 scope while retaining their underlying behavior checks.

The earlier 109 → 110 skip was `DEV273 Customer and Lead HTTP scope across linked surfaces`; it skipped only when `NYSA_DEV273_SCOPE_FIXTURE` was absent. The final governed command supplied `local-synthetic`, that test ran and passed, and the total returned to 109. The 109 remaining skips are named with reasons in the full governed log; they are historical/dedicated-fixture tests and are not counted as passes.

## 6. Operator parity and hosted sequence

DEV271 → DEV272 passed at migration 172 because operator `9d29f0cf` selected the canonical contract for a migration-neutral 172 → 172 transition and verified the installed runtime manifest. The initial DEV273 operator revision omitted that neutral-contract selection and runtime-manifest guard. Operator commit `12d924f8` restores the established DEV272 approach and preserves the newer exact-root multi-worker controls; 13 focused operator/worker tests passed.

Pre-install, the operators accept one or more workers only when every worker is command/CWD verified for the exact application root and record PID/start time. Install stops all verified exact-root workers, requires zero, starts once, requests readiness, then requires green expected-version/database readiness and exactly one new verified worker. A stale, foreign, unverified or duplicate post-readiness worker fails acceptance.

Request written approval separately for every row:

1. CRM Test DEV273 stage, backup, install, smoke (four approvals).
2. CRM Test normal reverse deployment to DEV272: stage, backup, install, smoke (four approvals).
3. CRM Test DEV273 reinstall: stage, backup, install, smoke (four approvals).
4. UAT after the final DEV273 smoke.
5. Production read-only preflight only. It must freshly verify DEV272 provenance/runtime, 172/313/113 full contract, workers, configuration gates, quota and all four ownership counts at zero.
6. Build the final Production backup/install/smoke config bound to that approved preflight receipt; then request backup, install and smoke separately.

Production digest email remains off. Production WhatsApp, sandbox and simulator routes remain off. No Production rollback or recovery runs without Ajit's written approval. The final Production deployment config is intentionally not fabricated before the fresh preflight receipt exists.

## 7. Review conclusion

Local D-2 evidence is complete for review. The remaining work is deliberately hosted and approval-gated: CRM Test install/reverse/reinstall, UAT, fresh Production preflight, then separately approved Production phases. No hosted state changed while preparing this packet.
