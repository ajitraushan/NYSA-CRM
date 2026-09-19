# Opportunity finance rework — 3 September 2026

Deployment update: this work is now deployed to CRM Test as dev.179 at the owner's request.
See [verified deployment and rollback](CRM_TEST_DEV179_DEPLOYMENT_COMPLETION.md).
Human acceptance remains pending. The local implementation record below is preserved historically.

Implemented and verified locally; not packaged, deployed or human accepted. Owner explicitly requests rework of the previously documented
Opportunity-first requirement. A Deal must not be required for invoicing, payment, proof or
receipt reconciliation. Future Deal linkage must not require payment re-entry.

AGENTS.md, CRM_CHANGE_POLICY.md and BASELINE.md read completely. CORE remains authoritative;
synthetic local fixture only, preserve financial history, least privilege and Director payout approval.
Local provisional source dev.177 plus approved corrections; Git HEAD
`1af87ba994599d8de1bab6d37b2005e609d449fe`. Test deployment remains dev.178, SHA
`1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`, migration114/count113,
historical one-worker PID280206 and rollback
`/home/nysareal/crm-backups/consolidated-crm-test-dev178-20260902T204149Z`.

Before source changes: `remediation-baselines/opportunity-finance-rework-20260903/before-rework.zip`,
SHA-256 `d344313a5333c463f3324cfd12896cc1f63aced96f8609d4fbd75976ccc5f993`.
Local fixture starts through115/count115. Historical migrations will not be rewritten.
No production, R2/Production clone, Property Finder or production personal data in scope.

## Result

- Migration116 makes Opportunity the authoritative parent for receipt/proof/confirmation records.
  It keeps historical Deal IDs untouched and exposes their effective Opportunity through guarded
  read views. New records store Opportunity ID directly; a Deal is optional historical linkage.
- Receivables records gross payment including VAT and the net Finance Receipt in one transaction.
  Both proof and receipt use Opportunity scope. Reversal and receipt-confirmation lifecycle operate
  at Opportunity scope. Issuing/cancelling an invoice or adding/reversing a receipt invalidates an
  affected invoice-based confirmation. Payment re-entry remains prohibited.
- Finance Receipts searches Opportunities and works before Deal creation. It shows Opportunity stage,
  originating/servicing split, issued-invoice commission, proof, immutable receipt history and
  reconciliation. Accountant permissions remain Dashboard, Opportunities, My Leave, Finance Receipts
  and Receivables. No Leads/Inventory/admin/payout permission was added.
- A Deal created later reads the same immutable Opportunity receipts; the test proves record count and
  IDs are unchanged and no Deal receipt copies or automatic agent credit/payout appear. Existing Closed
  Won/frozen-expectation and Director payout controls remain. Closed Won remains commission-independent.

## Verification

- Additive migration116 applied only to guarded local `nysa_test_fixture`, now through116/count116.
  SHA-256 `80e528711f34f510190c47f65c4cab24bed148a73c2121d576dfa244813bca5e`.
- Guarded no-Deal plus existing receivables HTTP/PostgreSQL: **18/18**. The no-Deal journey creates a
  Viewing Opportunity, invoice and private proof; records AED525 gross as AED500 commission/AED25 VAT;
  reconciles, reverses and records the final AED1,050 gross; later Deal creation does not copy it.
  It also tests cross-Opportunity proof rejection, immutable evidence, duplicate normalized references,
  concurrent idempotent receipt/confirmation retries, K/M amounts and unauthorized Agent/Accountant payout.
- Proof/receipt compatibility: **6/6**. Independent Manager closure/then Accountant collection: **2/2**.
  Ordinary suite: **1,360 total /1,293 passed /67 protected skips /0 failed**. Syntax and scoped
  whitespace checks passed. Expected rejected-request stacks in enabled logs are negative-path evidence.
- Local browser using synthetic Accountant `AR-UAT-1788386206368-NO-DEAL`: exactly five permitted tabs;
  Finance searched/opened the Viewing Opportunity with no Deal, displayed AED1,000 expected and net
  receipt, one proof, 25/75 split, invoice references and confirmed reconciliation. Screenshot:
  `uat-evidence/2026-09-03-opportunity-finance/no-deal-confirmed.png`. This is agent-driven local evidence,
  not a human UAT pass.

Rollback: restore the scoped source archive and restore the paired guarded local fixture backup into a
separate recovery database first. Do not remove columns/views from a database containing later finance
history. Migration116 is additive; no existing financial rows were rewritten. No remote rollback needed.

Local fixture backup: `uat-evidence/fixture-backup-2026-09-02T21-49-27-797Z/before-commission-proof.dump`,
1,789,507 bytes, verified SHA-256
`1e683fc2e5de61f2f7c56b90a5e7d1453e6d33cb06622410decfceefb5a2c9dd`.

Historical dev.174 SHA `30ecf73113f5d6ed3b9ec325075fceffc854d5bbb08da8bd486fca9cab177a71`,
migrations108–110, one-worker observation and 1,291/1,261/30/0 result remain unchanged.
