# CRM Test DEV208 Git reconciliation

Date: 20 September 2026 (Asia/Dubai)

## Incident

CRM Test DEV208 was packaged and deployed from a checksum-controlled DEV207-R2 package baseline,
but the repository branch still ended at the DEV174 recovery commit. The runtime package was
reproducible from local source and its immutable baseline package, yet the intervening source,
migrations, tests, release tooling and governance records were not committed to GitHub before the
deployment. This did not meet `CRM_CHANGE_POLICY.md` or `BASELINE.md`.

## Authoritative deployment evidence

- Environment: CRM Test only
- Installed and served version: `2.1.0-dev.208`
- Source baseline: `2.1.0-dev.207`, package `nysa-core-consolidated-crm-test-dev207-r2.zip`
- DEV207 baseline SHA-256: `2fd2bfc33d4c753020f71a6f1500ae719a957bfe881d8f8fbd5d4f08b45e27db`
- Deployed DEV208 package SHA-256: `989d6b628ee3a06b744012a5cb6a59eddd2db1a37e84642cbb63bb938cad8aa2`
- Latest migration: `127_governed_purchased_data_intake.sql` (127 total)
- Server rollback backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev208-20260919T195106Z`
- Post-deployment health/readiness: HTTP 200/200
- Worker evidence: one `lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/` process
- Production and R2 clone: unchanged

## Recovery scope

The recovery branch contains the governed runtime source through DEV208, migrations 111–127,
Customer/Lead import templates, relevant tests, release builders/deployer generators, deployment and
defect documentation, and the updated governance baseline. Historical applied migration bytes are
preserved from the immutable DEV207-R2 package. Raw ZIP packages, runtime databases, credentials,
temporary renders, rollback copies and private UAT screenshots remain outside Git.

The branch records a recovered cumulative source state. It does not claim that each missing DEV175
through DEV207 state existed as a separate Git commit at the time it was deployed.

## Verification

- Full repository suite: 1,523 tests; 1,445 passed; 78 skipped; 0 failed.
- DEV208 package: 323 runtime files plus two manifests; SHA-256 recorded above.
- Historical migrations: migrations 1–126 are unchanged from the DEV207-R2 baseline package.
- Staged credential scan: no private key, cloud token or credential-bearing database URI detected.
- Personal data control: temporary evidence, screenshots, runtime data, local absolute paths and
  rollback copies are excluded; test identities and phone numbers are explicitly synthetic.
- GitHub file-size control: no staged file exceeds 10 MB.

## Prevention controls

Before any future deployment request is presented:

1. All governed runtime source, migrations, tests and release metadata must be committed.
2. The commit must be pushed and resolvable from the private GitHub remote.
3. The package manifest must identify the source commit and immutable baseline package hash.
4. The package runtime manifest must reconcile byte-for-byte to that source/baseline composition.
5. The full and focused suites must pass against the exact candidate.
6. The deployment gate must fail when governed files are dirty or the source commit is not remote.
7. Human CRM Test UAT and explicit version-specific approval remain separate production gates.
