# CRM Test dev.179 deployment completion — 3 September 2026

Deployed at the owner's explicit request for testing. Human finance UAT is pending.
The CRM Test login page loads at `https://crm-test.nysarealty.com/?release=2.1.0-dev.179`.
No user credentials were requested/read and no new business records were created remotely.

## Verified deployed identity

- Version `2.1.0-dev.179`; `/api/health` returned ok/process ready and `/api/readiness`
  returned ok/database ready, both reporting179.
- Package SHA-256 `e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434`;
  9,719,897 bytes,306 entries,19 changed runtime files against exact178.
- Installer SHA-256 `bf0041a473e416ca1c90e61b407d5b6ecf5824c06068400c0f7db7a59dbdce04`;
  uploaded checksum and remote Bash syntax verified before execution.
- Newly applied migrations113,115,116; count116/latest`116_opportunity_finance_identity.sql`.
  Every historical applied migration retains exact178 bytes. Entire runtime manifest verified.
- Exactly one verified CRM Test LiteSpeed worker:PID3489464.
- Served Opportunity-finance JS SHA`5fbd8832cfd28e72ac813a7aa768a8632ad90213bb3a2d455865c3571365d676`;
  served receivables JS SHA`cc786d6436ecf7b42960043d2286bc64e07fed9ad0b8057a8f778bfa92c8c581`;
  both match the isolated candidate.
- Integration switches remain disabled. Production/R2 package fingerprints remained unchanged;
  neither environment was targeted. Property Finder excluded. Existing `.env` and private files retained.

## Backup and rollback

Verified fresh rollback directory:
`/home/nysareal/crm-backups/consolidated-crm-test-dev179-20260903T191641Z`.

- `pre-dev179.dump`:1,289,058 bytes;
  SHA`c6abf4d07722500b9f4a2ceefe6f1d46c1ce5891223ae05ece8261ffb659caa6`.
- `pre-dev179-app.tar.gz`:9,510,747 bytes;
  SHA`85702e1c8eb5c8a47d66a27e4ce9c25f0b10f932df133d4849611c71e31bfb26`.
- Both archives listed successfully before runtime mutation. Host deployment log:
  `/home/nysareal/dev179-deployment-20260903-approved.log`.

Recovery uses the paired Test app/database backup; validate a restored recovery database first.
After new finance activity, do not roll back app alone or drop columns/history. Preserve any later
evidence and obtain a coordinated recovery decision. No rollback was needed.

## Verification and human test scope

Exact isolated ordinary suite1360 total/1293 passed/67 protected skips/0 failed;
enabled synthetic receivables18/18, proof/access6/6, independent Manager closure2/2;
separate package/installer assertions2/2. Initial harness setup failures and resolved fixture-storage
path are disclosed in `CRM_TEST_DEV179_DEPLOYMENT_PLAN.md`. These are automated/local results,
not remote human UAT passes.

Accountant should see Dashboard, Opportunities, My Leave, Finance Receipts and Receivables.
Test an Opportunity with no Deal: create a payer-linked schedule, issue separate instalment invoices,
record a partial gross payment, verify 5% VAT/net commission/balance and same linked receipt in Finance
Receipts, then reconcile. Proof upload remains evidence rather than confirmation of collection.
Do not record the same invoice payment again in the direct receipt form. Later Deal linkage must
retain the same receipt without re-entry. Manager closure stays independent of collection;
Director payout approval is unchanged. Invoice PDF generation/new payout request workflow excluded.

The owner's earlier Manager-closure confirmation remains a178 human observation. No179 human
pass inferred. Historical174 package SHA`30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`,
migrations108–110,one-worker observation and1291/1261/30/0 results remain unchanged.
