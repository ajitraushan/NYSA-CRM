# DEV273 hosting preparation for review

Production and CRM Test both start on DEV272, commit `54421912fc1496a1066814cd8b665c19c7e8fd45`. The Production acceptance receipts are in [BASELINE.md](../../BASELINE.md). DEV273 expects migration 172 before and after install. Follow AGENTS.md mandatory hosted-worker verification and CRM_CHANGE_POLICY.md hosted deployment controls at every hosted gate.

## Disk cleanup list

The DEV272 Production backup receipt recorded account usage at 89.17%, with approximately 849 MB of headroom below the 90% cutoff. Sizes below are pending a separately approved read-only inventory. Obtain apparent and allocated bytes for every immediate child of `crm-release-preparation` and the account backup roots, including the 31 October through DEV268 folders. Collect fresh account quota and size the exact WN-15 export. Size symlinks without following them. Keep DEV272 r1 pending inventory and review.

| Exact path or directory set | Review disposition | Size evidence |
| --- | --- | --- |
| `/home/nysareal/tmp/wn15-approval1-export-20261111` | Cleanup candidate after confirming retained evidence and hash | Pending |
| `/home/nysareal/crm-release-preparation/20261112-dev272-prod-r1` | Preserve failed-run evidence per Ajit's instruction | Pending |
| `/home/nysareal/crm-release-preparation/20261112-dev272-prod-r2` | Keep DEV272 rollback set | Backup archives total 122,098,405 bytes. Full directory size pending. |
| `/home/nysareal/crm-release-preparation/20261112-dev270-prod-r2` | Keep DEV270 rollback set | Pending |
| DEV269 recovery sets and 20261026 recovery sets | Keep. Resolve their exact hosted paths from the accepted recovery records before review. | Pending |
| Other immediate children under the release preparation and backup roots | Inventory for review. Protect active inputs, evidence and every rollback dependency. | Pending |

Review the exact allowlist, verified retained copies and expected reclaimed bytes after inventory. Any removal requires a separate written go for the named paths.

## WN-15 resume on CRM Test

Use the retained Run A packet at Git commit `edebd4e32784c747f6cd592ed5e1ca54f0e16490` and the Approval 1 evidence at `af5e814ac2c4300e3b17ed06cdf4a7f1173a951f`. Approval 1 stopped on a parser that expected boolean `f` for the integer team state. The assertion fix is at `caf0a62371c43d312f96240400b1d05129278f07`. The recorded attempt created neither a recovery dump nor an active test team. These are historical observations, pending fresh checks.

1. Complete the separately approved disk cleanup and confirm quota headroom. Rebind the WN-15 tools and approval arguments to the accepted DEV272 CRM Test runtime and schema. The earlier DEV269 pins cannot establish DEV272 parity. Recheck the simulator gates, target database and role, tagged synthetic users, integer inactive team state, unused test phone range, green readiness and one exact-root worker. Preserve the resource and website stop rules from the retained Run A packet.
2. Present the committed recovery script and SHA-256 for approval. Create the recovery parent, then take and verify a database-only custom-format backup with ownership and privileges preserved. Record its path, size, SHA-256, dump listing and baseline catalog. Stop if any output path already exists or any verification fails.
3. Present a separately committed team activation script and SHA-256. After written go, activate only the exact Run A synthetic teams from the retained packet and verify their state. Bind the receipt to the verified recovery dump.
4. Present the exact DEV272-compatible Run A command, its committed file and SHA-256. Schedule it outside working hours and run it once after written go. CRM Test and Production share an account. Capture Production root, health and readiness HTTP status and response time before Run A, every five seconds during it, and after it. Stop on a failed Production health, readiness or root probe, a response over three seconds once, or two consecutive samples each exceeding both twice the pre-run median and the pre-run median plus 500 ms. Retain the CRM Test, website and resource stop rules in the Run A packet. Keep the receipts. Any run cleanup and team deactivation need their own review and written go.
5. Verify the agreed clean endpoint before DEV273 is staged on CRM Test. Retain the recovery dump and the run evidence.

No hosting action was taken in preparing this review. Exact sizes, refreshed WN-15 script pins and hosted state remain pending.
