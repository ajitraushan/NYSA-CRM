# CRM Test dev.170 — DEF-093 Opportunity Inventory stage binding hotfix

Target: **CRM Test only**. Production, R2 and Property Finder are excluded.

Dev.170 is migration-neutral and accepts only the deployed dev.169/migration-107 baseline or an exact dev.170 rerun.
It binds the Inventory stage to the rendered Inventory section reference instead of rediscovering it from obsolete
heading text. No API, schema, matching, assignment, Viewing, Offer, Booking or Deal rule changes.

Automated verification: focused Opportunity lifecycle 26/26 passed. Full ordinary regression: 1,243 total; 1,213
passed; 30 protected skips; 0 failed. Human UAT remains pending and no pass is inferred from deployment.
