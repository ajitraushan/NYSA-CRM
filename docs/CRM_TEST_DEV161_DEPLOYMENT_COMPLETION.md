# CRM Test dev.161 deployment completion

Deployment date: 25 August 2026  
Scope: UAT-079 browser-wiring hotfix  
Target: CRM Test only

- Installed/served version: `2.1.0-dev.161`
- Package SHA-256: `94243945f6883fcf108a70e366d6eb9af1e272ec9acbe92ebd98289e24736b36`
- Latest migration: `104_dev160_uat070_079_journey_unblock.sql` (104 total; no new migration)
- Worker: PID `2558515`; exactly one verified CRM Test LiteSpeed listener
- Health: `ok=true`, `process=ready`, version `2.1.0-dev.161`
- Readiness: `ok=true`, `database=ready`, version `2.1.0-dev.161`
- Backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev161-20260825T100110Z`
- Integration switches: disabled
- Production and R2 clone snapshots: unchanged
- Human UAT-079 retest: pending; not passed automatically

The correction replaces the CSP-blocked inline retirement handler with a scoped `addEventListener` binding. A runtime UI-wiring test proves the click reaches the governed retirement action with the exact model ID. The existing real HTTP/database test continues to prove transactional retirement and audit evidence.
