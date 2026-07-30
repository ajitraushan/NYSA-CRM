# NYSA CORE Release 2.6 production candidate

Status: **FROZEN — production-clone rehearsal required**

- Candidate version: `2.1.0-dev.79`
- Reconciled candidate source commit: `5669016`
- Development baseline before UAT remediation: `9073206`
- Branch: `agent/release-2-design`
- Package: `nysa-core-r2-6-production-candidate-dev79-9073206.zip`
- SHA-256: `689d089b357f8f9c956c329c44e592712e26becff10a9b0efbc77d8bc074836f`
- Accepted baseline: Release 1.1 through `037_listing_mapping_governance.sql`
- Cumulative migration range: `038_release2_opportunity_foundation.sql` through
  `059_release26_inventory_owner_and_activation.sql` (22 migrations)
- Automated regression: 248/248 passed
- Inventory UAT: passed by the NYSA owner on CRM Test dev.79

The package is byte-for-byte identical to the dev.79 package accepted on CRM Test. Do not add
features or replace files inside this archive. Any source change requires a new version, regression
run, focused UAT and candidate hash.

The included rehearsal script refuses the known Production and CRM Test application roots and
requires an explicitly named clone database, clone worker and clone health URL. It must first be
used against an isolated restore of the current Production Release 1.1 database.

Production remains unauthorized. A separate production script may be prepared only after the
clone rehearsal evidence is reviewed and the NYSA owner explicitly authorizes Production.
