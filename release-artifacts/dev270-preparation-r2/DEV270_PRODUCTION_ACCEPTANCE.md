# DEV270 Production acceptance

Ajit accepted DEV270 on Production on 12 November 2026 (Asia/Dubai).
The deployed version is `2.1.0-dev.270` from commit
`5c1c350151d6ace33377b33526e2bfedf4ae8f6b`. Package SHA-256
`1aecf97244cb3b15b64bb0cc9a5f971ab3a66530cd0cea87a5aa2aa3d2c75c5c`.

Production database `nysareal_nysacrm` had 171 migrations, 307 public tables
and 111 enabled triggers in the install receipt. The candidate schema contract
matched. Smoke recorded seven passed checks, green database readiness and one
verified exact-root worker (PID 3146336).

| Receipt | SHA-256 |
| --- | --- |
| Backup | `bc7934c35e2bfaef4879a88849baf2dcf5fa7ea6663072d3ce89f3c5513d2566` |
| Install | `fb147a792fd86a46906cf169513df4daf5a6b8041671638e1a3b624de5c0bbfc` |
| Smoke | `696d19fb2eb633607fb030f357295cc6a8030d35487e947093d4cb3ba511a274` |

Rollback evidence is under
`/home/nysareal/crm-release-preparation/20261112-dev270-prod-r2`.
Acceptance records the deployed release. The legacy role ACL inventory is a
separately approved operation.
