# Production disk cleanup round 2

Prepared 13 Nov. Saved evidence only. Execution requires Ajit's written go for the exact script.

- Inventory: commit `9170d752`, `release-artifacts/dev272-production-preflight-review/PRODUCTION_DISK_INVENTORY.c0e63439.txt`, SHA-256 `2447f3eee042d3a8ad0f577998657b342808895656b51de6c8d5c2324bb2c381`. The allowlist uses apparent bytes.
- Checked saved snapshots at 62 local and origin-tracking tips and the WN-15 packet commit. Searched `BASELINE.md`, `docs/` and `release-artifacts/` for exact candidate names. Inventory and cleanup proposals were excluded as dependency evidence. Also checked the locally saved CRM Test DEV271/272 deployment artifacts. This review establishes recorded references and recorded worker roots, and does not establish present-day process state.
- WN-15: `edebd4e3:release-artifacts/wn15-preparation/WN15_RUN_A_APPROVAL_PACKET.md` uses the live CRM Test root and `20261111-wn15` for its recovery path, tools and receipts. Those are outside the allowlist.
- Production: `release-artifacts/dev272-production-preflight-review/PRODUCTION_RELEASE_CONFIG.prod-r2.review.json` (SHA-256 prefix `75375fd5`) and accepted install/smoke receipts `f2428ae8` / `8dd82c03` identify `/home/nysareal/nysa-crm` as the live root and `20261112-dev272-prod-r2` as the workspace. Neither is in the allowlist.
- CRM Test: locally saved `release-artifacts/dev272-d2/DEV272_DEPLOY_CONFIG.json` (SHA-256 prefix `39680750`), `INSTALL_RESULT.json` (receipt `7840165c`) and `SMOKE_RESULT.json` identify the live root `/home/nysareal/nysa-core-dashboard-dd6262a-stage` and workspace `20261112-dev272-r1`. No reviewed receipt identified an allowlisted path as a live worker root. All three old copies have distinct exact paths.
- The local November archive hash supplied by Ajit matches the server archive hash recorded at `f3eefdbe:release-artifacts/dev272-production-preflight-review/PRODUCTION_NOV01_ARCHIVE_HASH.bc58cc76.txt`. The archive stays outside this round pending separate confirmation.

## Excluded candidates and reference hits

The dated `crm-backups/crm-test-` group has 37 immediate entries in the inventory, including directories, archives and checksum files. The intended ten exact paths cannot be identified from that description, so the whole group stays out, including the explicitly named DEV244 application archive. DEV271 r1 and r2 are also excluded on the basis of the locally saved `release-artifacts/dev271-d2/DEV271_DEPLOY_CONFIG.json` and `release-artifacts/dev271-d2-revised/DEV271_DEPLOY_CONFIG.json` with their saved deployment receipts. `release-artifacts/dev272-d2/DEV272_D2_PACKET.md` names DEV271 r2 as its predecessor rollback source. These local files did not resolve to committed paths in the checked refs.

Each committed reference found is listed below with a commit snapshot and file. Some are historical receipts or configs. They are retained conservatively.

- `/home/nysareal/crm-backups/crm-test-dev241-20261027T072707Z`
  - `054e9562aaba:BASELINE.md`
- `/home/nysareal/crm-backups/crm-test-dev243-pre-20261027T193434Z`
  - `054e9562aaba:BASELINE.md`
  - `054e9562aaba:docs/change-requests/NYSA-CRM-20261027-LEAD-001-DEV244-UNASSIGNED-QUEUE.md`
- `/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z`
  - `054e9562aaba:BASELINE.md`
  - `054e9562aaba:docs/change-requests/NYSA-CRM-20261028-LEAD-002-DEV246-INCOMING-LEADS.md`
- `/home/nysareal/crm-release-preparation/20261031-dev248`
  - `054e9562aaba:BASELINE.md`
  - `054e9562aaba:docs/change-requests/UI-001-PDF-RUNTIME-VERIFICATION.md`
- `/home/nysareal/crm-release-preparation/20261031-ui001`
  - `054e9562aaba:release-artifacts/production/20261031-dev251/SAFE_FINAL_HOSTED_CHECKS.json`
- `/home/nysareal/crm-release-preparation/20261031-ui252`
  - `054e9562aaba:BASELINE.md`
- `/home/nysareal/crm-release-preparation/20261031-ui253`
  - `054e9562aaba:BASELINE.md`
- `/home/nysareal/crm-release-preparation/20261101-wa255`
  - `054e9562aaba:BASELINE.md`
  - `054e9562aaba:release-artifacts/dev255-preparation/DEPLOYMENT_PROGRESS.md`
  - `054e9562aaba:release-artifacts/dev255-preparation/DEPLOYMENT_VERIFIED.json`
- `/home/nysareal/crm-release-preparation/20261101-wa256`
  - `054e9562aaba:BASELINE.md`
  - `054e9562aaba:docs/change-requests/NYSA-CRM-20261101-WA-001/DEV256_CALLBACK_CORRECTION.md`
- `/home/nysareal/crm-release-preparation/20261101-wa257`
  - `054e9562aaba:docs/change-requests/NYSA-CRM-20261101-WA-001/DEV257_CALLBACK_RCA.md`
- `/home/nysareal/crm-release-preparation/20261103-dev262`
  - `054e9562aaba:release-artifacts/dev262-preparation/DEV262_DEPLOY_CONFIG.json`
- `/home/nysareal/crm-release-preparation/20261104-dev263`
  - `054e9562aaba:release-artifacts/dev263-preparation/DEV263_DEPLOY_CONFIG.json`
- `/home/nysareal/crm-release-preparation/20261104-dev264`
  - `054e9562aaba:release-artifacts/dev264-preparation/DEV264_DEPLOY_CONFIG.json`
- `/home/nysareal/crm-release-preparation/20261106-dev265-run2`
  - `054e9562aaba:BASELINE.md`
  - `054e9562aaba:release-artifacts/dev265-preparation/DEV265_ACCEPTANCE.md`
  - `054e9562aaba:release-artifacts/dev265-preparation/DEV265_DEPLOY_CONFIG.json`
  - `054e9562aaba:release-artifacts/dev266-preparation/DEV266_D1_REPLY_LOCK_DESIGN.md`
- `/home/nysareal/crm-release-preparation/20261110-dev266`
  - `054e9562aaba:release-artifacts/dev266-preparation/DEV266_ACCEPTANCE.md`
  - `054e9562aaba:release-artifacts/dev266-preparation/DEV266_ACCEPTANCE_RECEIPT_HASHES.json`
  - `054e9562aaba:release-artifacts/dev266-preparation/DEV266_D2_APPROVAL_PACKET.md`
  - `054e9562aaba:release-artifacts/dev266-preparation/DEV266_DEPLOY_CONFIG.json`
- `/home/nysareal/crm-release-preparation/20261110-dev267-run2`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/DEV267_CONFIG_SPEC.json`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/DEV267_D2_OPERATOR_FIX_ADDENDUM.md`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/DEV267_DEPLOY_CONFIG.json`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/evidence/BACKUP_RESULT.json`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/evidence/INSTALL_RESULT.json`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/evidence/SCOPED_BACKUP_VERIFIED.json`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/evidence/SMOKE_RESULT.json`
  - `054e9562aaba:release-artifacts/dev267-preparation/run2/evidence/STAGE_RESULT.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267A_D1_PROSPECT_DIARY_BOOTSTRAP_AND_API_DESIGN.md`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267A_D2_APPROVAL_PACKET.md`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267_DEV268_ACCEPTANCE.md`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267_DEV268_ACCEPTANCE_RECEIPT_HASHES.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/generate-dev267-dev268-acceptance-receipts.mjs`
- `/home/nysareal/crm-release-preparation/20261111-dev268`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267A_CONFIG_SPEC.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267A_DEPLOY_CONFIG.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267_DEV268_ACCEPTANCE.md`
  - `054e9562aaba:release-artifacts/dev267a-preparation/DEV267_DEV268_ACCEPTANCE_RECEIPT_HASHES.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/generate-dev267-dev268-acceptance-receipts.mjs`
  - `054e9562aaba:release-artifacts/dev267a-preparation/run1/evidence/BACKUP_RESULT.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/run1/evidence/INSTALL_RESULT.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/run1/evidence/SCOPED_BACKUP_VERIFIED.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/run1/evidence/SMOKE_RESULT.json`
  - `054e9562aaba:release-artifacts/dev267a-preparation/run1/evidence/STAGE_RESULT.json`
  - `054e9562aaba:release-artifacts/dev269-preparation/DEV269_D1_PROSPECT_EDIT_RETIRE_AND_FIXES_DESIGN.md`
- `/home/nysareal/crm-release-preparation/20261112-dev270-r2`
  - `054e9562aaba:BASELINE.md`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/DEV270_D2_PACKET.md`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/DEV270_DEPLOY_CONFIG.json`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-a/STAGE_COMMAND_OUTPUT.txt`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-a/STAGE_RESULT.json`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-b/BACKUP_COMMAND_OUTPUT.txt`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-b/BACKUP_RESULT.json`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-b/SCOPED_BACKUP_VERIFIED.json`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-c/INSTALL_COMMAND_OUTPUT.txt`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-c/INSTALL_RESULT.json`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-d/SMOKE_COMMAND_OUTPUT.txt`
  - `054e9562aaba:release-artifacts/dev270-preparation-r2/hosted-phase-d/SMOKE_RESULT.json`

## Proposed allowlist

The script includes 96 paths totaling **7,944,679,851 apparent bytes**. The physical space reclaimed can differ.

- `/home/nysareal/crm-release-preparation/20261101-dev260` (662,370,051 bytes)
- `/home/nysareal/crm-release-preparation/20261101-wa258` (1,473,923,517 bytes)
- `/home/nysareal/crm-release-preparation/20261101-wa259a` (1,513,829,711 bytes)
- `/home/nysareal/crm-release-preparation/20261102-dev261` (461,966,357 bytes)
- `/home/nysareal/nysa-core-dashboard-dd6262a-stage.dev244-mixed-20261028T055500Z` (1,970,964,084 bytes)
- `/home/nysareal/nysa-core-dashboard-dd6262a-stage.failed-1793734674548` (926,469,452 bytes)
- `/home/nysareal/nysa-core-dashboard-dd6262a-stage.pre-recovery-20261103T2340DUBAI` (926,419,624 bytes)

- All 89 explicitly enumerated regular files `.dev144s-000` through `.dev144s-088`, each checked against its individual inventory size.

The script checks all exact paths, types, canonical paths and sizes before the first deletion. A failed precheck exits without deleting anything. Once deletion begins, a later failure stops the script and may leave earlier deletions in place.

The npm cache stays out. Before proposing a separate `npm cache clean --force` run, confirm that no pending workflow requires offline installs or uses that cache as its dependency source. The WN-15 tmp export stays out until its retained evidence and matching hash are identified.
