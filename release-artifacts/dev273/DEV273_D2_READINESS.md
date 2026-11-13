# DEV273 D-2 readiness

Candidate `7039ed921841dd01d396f557041ca20217b8e845`. Local evidence only. The CRM Test rehearsal and Production remain subject to separate written approvals under AGENTS.md mandatory hosted-worker verification and CRM_CHANGE_POLICY.md hosted deployment controls.

## Verified artifacts

| Input | SHA-256 |
|---|---|
| DEV273 package | `0c0f160f766a7dff5cd197a51380b432dbce0a1d92b46dda03559886a7806105` |
| DEV273 package manifest | `aefe0066ba9a118b6efa0a7d2e17637116bf5dbb2aca1777d0f4b95b33480201` |
| Corrected CRM Test operator at `12d924f8` | `0d66f2617c5ff5fc8fb01cd808dc3df46999d19d6432979685f1bc772515d34e` |
| Production operator at candidate commit | `68b3049d5f5629e931dba59642c3312357e279e0d92e142d4f780497838dc430` |
| Production read-only preflight at candidate commit | `8b1900098902724c846624848d22cb836dc2bdb77d673dd835a4720c7e5559a0` |

The governed scope-fixture suite recorded 1,630 passes, zero failures and 109 skips. The fresh PostgreSQL tests passed overdue ordering and concurrent digest scheduling/claim with synthetic delivery. The first digest attempt omitted the active cadence seed and failed with zero sends. The successful rerun restored the migration 172 seed on another fresh database. The local source-swap rehearsal verified 406 source files at each step using both exact archives and the pinned operator's source-swap helper. The earlier Production-shaped PostgreSQL rehearsal reported green application readiness at DEV272, DEV273 and restored DEV272, with the contract unchanged at 172 migrations, 313 tables and 113 triggers. The DEV273 step in that earlier run used the working tree.

## Visibility evidence

| Surface | Passing evidence or gap |
|---|---|
| Customers, Leads and search | `DEV273 Customer and Lead HTTP scope across linked surfaces` verifies out-of-scope detail and empty search results. |
| Customer 360 and Reveal | Same test verifies Director masking, successful Reveal, no-store, field-name-only audit and an out-of-scope Reveal refusal. |
| Documents and proposals | Same test verifies out-of-scope linked lists and document detail, and owning Agent access to linked lists.  |
| Generated PDFs | Render checks cover output generation. DEV273 still needs direct verification of scoped PDF access and of masking inside generated PDF bytes. |
| Opportunities | `Opportunity list and detail mask Director contact details and enforce Agent scope` verifies Director masking, owner values and an out-of-scope 404. |
| Linked tasks | Cross-surface test verifies a task linked to an out-of-scope lead stays hidden even from its assignee. |
| Dashboard and CSV export | Cross-surface test verifies out-of-scope exclusion and no raw contact values in the Director export. |
| AI retrieval | Cross-surface test verifies the out-of-scope lead action-suggestions request returns 404. Broader retrieval paths still need direct evidence. |
| Other alternate surfaces | Separate passing evidence still needs mapping for each remaining screen and export. |

## CRM Test sequencing and current blocker

The DEV272 stage receipt proves operator 9d29f0cf selected the canonical 172 contract for the migration-neutral pre-install comparison. DEV273 accidentally omitted that selection and the installed runtime manifest guard. Operator commit 12d924f8 restores both and preserves the new worker checks. The 13 focused operator and worker tests passed. Install, reverse deployment and reinstall configs bind the canonical 172 contract on both sides and use fresh workspaces. See DEV273_CRM_TEST_HASHES.json.

Request each step separately: DEV273 stage, backup, install and smoke; DEV272 reverse stage, backup, install and smoke, with green DEV272 readiness; DEV273 reinstall stage, backup, install and smoke. Use fresh workspaces and the verified recovery point for each transition. After the reinstall, run UAT. Production review follows passing CRM Test install, rollback, reinstall and UAT. The CRM Test configs are prepared for review. The final Production config is pending. This readiness note is not the approval packet.
