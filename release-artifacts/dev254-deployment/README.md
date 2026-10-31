# DEV254 CRM Test verification

Exact source: `42b25cb4d84d93a33336a2c49149759d4b2ca9b6`.
Archive SHA-256: `abea1c4167cc2080defd78b982231fc1b7eefdafaf911cf1cdc71d02297f541b`.
Manifest SHA-256: `ccbcda5871c4b74013fcf325eadd3c7ce28ad63de59549c77a89762cb9cffb6f`.

- `TECHNICAL_CHECKS.json`: installed file hashes, ten PDF formats, access/static responses, database readiness and exactly one exact-root worker. Its role-UAT field predates the live checks in the separate evidence file.
- `ALL_CARD_CHECKS.json`: read-only synthetic actual-frontend desktop/mobile audit, 174 cases. The corrected runtime was rechecked before the version-only DEV254 bump. This is source evidence, not live authentication.
- `dev253-db-final.log`: restricted local synthetic PostgreSQL count/pagination/scope checks. No customer fixture copied; test records cleaned.
- `DEV254_LIVE_CHECKS.json`: authenticated live role checks; aggregate counts only. No customer identity exported.
- `DEV254_LIVE_TASK_COUNT.png`: cropped live caption excluding customer rows.
- `dev253-recovery-verification.json`: authenticated seven-component encrypted recovery receipt, no private keys, credentials or plaintext backup content.

The initial DEV253 candidate exposed null API fields serialized as `null`; API-shaped test coverage and filtering corrected that. The browser retained immutable version253 assets, so final release254 invalidates them. Intermediate runtimes were quarantined and all455 original DEV252 files restored/verified before the final installation. Original quiesced, same-window DEV252 paired recovery remains the rollback point; no operational data mutation or migration occurred during these dashboard checks.

Final install: 31 October 2026, 16:44:30 UTC (20:44:30 Dubai). Migration159 unchanged. Existing registered environment unchanged. Production/main/website remain on HOLD and unchanged. No workflow, compliance, ownership or access-policy change was made. Optional live integrations remain untouched.

GitHub CI succeeded for exact source:
https://github.com/ajitraushan/NYSA-CRM/actions/runs/41220943512
https://github.com/ajitraushan/NYSA-CRM/actions/runs/41220938988
