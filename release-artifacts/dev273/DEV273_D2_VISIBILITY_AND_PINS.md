# DEV273 visibility evidence and release pins

Scope and approval follow AGENTS.md mandatory hosted-worker verification and CRM_CHANGE_POLICY.md hosted-deployment controls. All evidence below is local. The integrated HTTP test ran inside the exact-candidate governed suite on PostgreSQL 13.23 with `NYSA_DEV273_SCOPE_FIXTURE=local-synthetic`.

| Surface | Passing test | Result |
|---|---|---|
| Customer and Lead lists and search | `Role defaults, Owning Agent filters, approved-only WEB and Meta queues and open offers enforce scope`; parent `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** Agent-own, Manager-team, Director-all defaults; owning-Agent and Unassigned filters; and out-of-scope search exclusion are asserted through HTTP. |
| Customer 360 | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** Director masking and outsider 404 are asserted. |
| Lead queues and detail | `Role defaults, Owning Agent filters, approved-only WEB and Meta queues and open offers enforce scope` | **Pass.** The Manager queue includes accepted `approve_email_only` Website intake and unassigned Social-media rows, excludes pending/rejected Website intake, and retains offered-Agent masking and non-writable detail. |
| Documents and proposals, including PDF | `DEV273 Customer and Lead HTTP scope across linked surfaces`; `Scoped generated PDF preview and download preserve original bytes and audit access` | **Pass.** Linked routes enforce scope. Owner, Manager and Director receive the original PDF; outsider preview/download return 404; Manager/Director access is audited without contents. |
| Opportunities | `Opportunity list and detail mask Director contact details and enforce Agent scope` | **Pass.** Owner values, Director masking and outsider 404 are asserted for list and detail. |
| Linked tasks | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** A task linked to an out-of-scope Lead stays hidden even when assigned to the requesting Agent. |
| Dashboards | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** Out-of-scope Customer/Lead data is excluded. |
| Exports and CSV | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** The CRM customer/lead dashboard CSV excludes outsider rows and masks Director contact values. |
| AI assistant | `AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary` | **Pass.** Owner next-action retrieval succeeds; outsider next-action and suggestion-history requests return 404. |
| Duplicate warnings | `AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary` | **Pass.** Cross-scope duplicate matches return only `restricted:true`; record ID, name, email and phone are absent. |
| Reveal and its log | `AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary`; parent Customer Reveal checks | **Pass.** Manager/Director Lead Reveal and Director Customer Reveal succeed; outsider requests return 404; logs contain actor/time/entity plus field names only and responses are no-store. |

Every requested row is directly covered and passing. Item 2 is closed.

The exact-candidate governed log is committed at `c87c6844` and covers application candidate `aab0ea5d0a8496940e05179f9f3bb753b92d0521`: 1,633 passed, zero failed, 109 skipped. Its committed LF SHA-256 is `b8be29739e20132f89b4654f0113b6667ed93c160a8c54ad27f2cdae3221fcaf`; the Windows working-file CRLF SHA-256 is `4ffa35e64ec5098439767722d69397b7885d6325193399bcac32d805ac8ba179`. The committed LF form is authoritative.

| Artifact | Pin | SHA-256 |
|---|---|---|
| Application package | `aab0ea5d0a8496940e05179f9f3bb753b92d0521` | `359245bfec120d3c0e1c3743851fd6daa7ac439168f1989f4792f9388d3b51ba` |
| Package manifest | Same application pin | `35f1a8eee5a7490ec055da26be8490065d9603012ecb023237b955b7edc8125f` |
| CRM Test operator | `12d924f8564bf38b91b90fcd186336b213f742a2` | `0d66f2617c5ff5fc8fb01cd808dc3df46999d19d6432979685f1bc772515d34e` |
| CRM Test install config | `fde21724` | `6b1be76a05647fb82189d4921cef8cc6e5f72d0b3b9e0c08050835fc8cacb353` |
| CRM Test reverse config | `fde21724` | `0d58cc34116e2a6179e1a13c18291d063a9880d0cf9130c65194371fc18a31ba` |
| CRM Test reinstall config | `fde21724` | `50a57b7caf890b08a123080713f4eb6564729f3f70091a12c3e7b6e9fa1ea664` |
| Production preflight config | `fde21724` | `c915e8ebe4c1d06c902fef9bb366312b419eb7ea9bd4bf4842601280454dc759` |
| Production preflight tool | Application pin | `8b1900098902724c846624848d22cb836dc2bdb77d673dd835a4720c7e5559a0` |
| Production deployment operator | Application pin | `68b3049d5f5629e931dba59642c3312357e279e0d92e142d4f780497838dc430` |

Tool and config hashes were calculated from committed Git blobs. Config LF and Windows working-file hashes are identical; the operator checks those exact hashes. The CRM Test configs bind 172 → 172, 313 tables and 113 triggers, equal canonical contract hashes and separate scoped backups. Production preflight binds accepted DEV272 and rechecks all four ownership counts at zero. The final Production deployment config must be bound to the separately approved fresh preflight receipt.
