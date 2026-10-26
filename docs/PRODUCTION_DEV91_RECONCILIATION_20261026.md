# Production DEV91 source reconciliation

Observed production https://crm.nysarealty.com on 26 October 2026: version 2.1.0-dev.91, 61 applied migrations through 061_dev90_reference_and_status_governance.sql. Production has no embedded Git provenance, so this commit is a retrospective byte-for-byte recovery, not a claim that this commit was originally deployed.

The 129 governed production source/static files were captured read-only from /home/nysareal/nysa-crm. Archive SHA-256: 0ee1fd83d10a3ae2f0c1ea05983d2afc004b489931429678362d8b5c1c10b8bf. The JSON manifest records every file hash and a schema column-contract hash. Credentials, .env, node_modules, uploads, private/customer documents and database rows are excluded. No production files, configuration or database records were changed.

GitHub main was DEV79; this recovery branch preserves the deployed DEV91 runtime independently before preparing the cumulative DEV239 release. Existing non-runtime repository documentation/tests are historical and are not claims about DEV91 acceptance. .env.example remains a repository template, outside the observed production source scope. Runtime paths absent from production were removed from this recovery branch: 0.

This branch is a historical baseline only, not the cumulative upgrade candidate or permission to deploy. Do not overwrite current CRM Test with this recovery source. Production deployment requires the exact cumulative commit, backup, migration rehearsal and separate approval.
