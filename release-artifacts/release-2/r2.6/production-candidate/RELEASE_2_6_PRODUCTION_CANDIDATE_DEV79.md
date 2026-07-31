# NYSA CORE Release 2.6 production candidate

Status: **FROZEN — production-clone rehearsal required**

- Candidate version: `2.1.0-dev.79`
- Reconciled candidate source commit: `5669016`
- Development baseline before UAT remediation: `9073206`
- Branch: `agent/release-2-design`
- Package: `nysa-core-r2-6-production-candidate-dev79-9073206.zip`
- SHA-256: `689d089b357f8f9c956c329c44e592712e26becff10a9b0efbc77d8bc074836f`
- Clone rehearsal: `rehearse-production-db026-to-r2-6-dev79-clone-only.sh`
- Rehearsal SHA-256: `31c6d534ededbbc06134eda1dd1e21e400d3d69837ef8abfe0e12592f9ad1699`
- Accepted frozen-source baseline: Release 1.1 through `037_listing_mapping_governance.sql`
- Verified Production database baseline: `026_routing_rule_governance.sql`
- Cumulative rehearsal range: `027_inventory_commercial_readiness.sql` through
  `059_release26_inventory_owner_and_activation.sql` (33 migrations)
- Automated regression: 255/255 passed
- Inventory UAT: passed by the NYSA owner on CRM Test dev.79

The package is byte-for-byte identical to the dev.79 package accepted on CRM Test. Do not add
features or replace files inside this archive. Any source change requires a new version, regression
run, focused UAT and candidate hash.

The included rehearsal script refuses the known Production and CRM Test application roots and
requires an explicitly named clone database, clone worker and clone health URL. It must first be
used against an isolated restore of the current Production database.

## Verified current Production baseline

Read-only Production inspection on 2026-07-30 established that the installed application reports
version `1.1.0`, while `schema_migrations` contains exactly migrations `001` through
`026_routing_rule_governance.sql`. The isolated restore in
`nysareal_nysa_r2_prod_clone` confirmed the same database baseline.

The clone-only rehearsal therefore verifies application `1.1.0` plus database migration `026`, then
applies the complete cumulative chain in order:

- Release 1.1 migrations `027` through `037` (11 migrations).
- Release 2 migrations `038` through `059` (22 migrations).

It refuses Production, CRM Test, an unexpected database or user, any non-clone URL, an unexpected
application version, a database baseline other than `026`, or a candidate package with an unexpected
hash or incomplete migration chain. It accepts one or more isolated Passenger workers, terminates
every old clone worker after installation, and confirms that every resulting clone PID is new.

Production remains unauthorized. A separate production script may be prepared only after the
clone rehearsal evidence is reviewed and the NYSA owner explicitly authorizes Production.
