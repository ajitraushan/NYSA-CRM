# CRM Test dev.169 — DEF-092 focused Opportunity stage workspaces

Target: **CRM Test only**. Production, R2 and Property Finder are excluded.

Dev.169 deploys DEF/UAT-092 over the exact dev.168 and migration-106 baseline. It adds migration
`107_dev169_versioned_opportunity_stage_drafts.sql`, dedicated full-screen pages for all six Opportunity stages,
and immutable numbered draft versions with separate finalization evidence.

The guarded installer verifies the package checksum and embedded runtime manifest, captures application and
PostgreSQL backups, preserves disabled connector switches, replaces only verified CRM Test workers, checks health,
readiness, migration 107, exact installed files, and unchanged Production/R2 snapshots.

Automated verification: focused Opportunity lifecycle 25/25 passed. Full ordinary regression: 1,240 total; 1,210
passed; 30 protected skips; 0 failed. Human UAT remains pending and no pass is inferred from deployment.
