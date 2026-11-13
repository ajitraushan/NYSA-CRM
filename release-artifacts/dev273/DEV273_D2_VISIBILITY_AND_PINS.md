# DEV273 visibility evidence and release pins

Scope and approval follow AGENTS.md mandatory hosted-worker verification and CRM_CHANGE_POLICY.md hosted-deployment controls. All evidence below is local. The integrated HTTP test ran inside the exact-candidate governed suite on PostgreSQL 13.23 with `NYSA_DEV273_SCOPE_FIXTURE=local-synthetic`.

| Surface | Passing test | Result |
|---|---|---|
| Customer and Lead lists and search | `Role defaults, Owning Agent filters, unassigned WEB and Meta queues and open offers enforce scope`; parent `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** Agent-own, Manager-team, Director-all defaults; owning-Agent and Unassigned filters; and out-of-scope search exclusion are asserted through HTTP. |
| Customer 360 | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** Director masking and outsider 404 are asserted. |
| Lead queues and detail | `Role defaults, Owning Agent filters, unassigned WEB and Meta queues and open offers enforce scope` | **Pass.** Manager/Director unassigned Website and Social-media/Meta visibility, Manager assignment queue coverage, offered-Agent masking and non-writable detail are asserted. |
| Documents and proposals, including PDF | `DEV273 Customer and Lead HTTP scope across linked surfaces`; `Scoped generated PDF preview and download preserve original bytes and audit access` | **Pass.** Linked routes enforce scope. Owner, Manager and Director receive the original PDF; outsider preview/download return 404; Manager/Director access is audited without contents. |
| Opportunities | `Opportunity list and detail mask Director contact details and enforce Agent scope` | **Pass.** Owner values, Director masking and outsider 404 are asserted for list and detail. |
| Linked tasks | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** A task linked to an out-of-scope Lead stays hidden even when assigned to the requesting Agent. |
| Dashboards | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** Out-of-scope Customer/Lead data is excluded. |
| Exports and CSV | `DEV273 Customer and Lead HTTP scope across linked surfaces` | **Pass.** The CRM customer/lead dashboard CSV excludes outsider rows and masks Director contact values. |
| AI assistant | `AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary` | **Pass.** Owner next-action retrieval succeeds; outsider next-action and suggestion-history requests return 404. |
| Duplicate warnings | `AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary` | **Pass.** Cross-scope duplicate matches return only `restricted:true`; record ID, name, email and phone are absent. |
| Reveal and its log | `AI retrieval, duplicate warnings and Lead Reveal preserve the same authorization boundary`; parent Customer Reveal checks | **Pass.** Manager/Director Lead Reveal and Director Customer Reveal succeed; outsider requests return 404; logs contain actor/time/entity plus field names only and responses are no-store. |

Every requested row is directly covered and passing. Item 2 is closed.

The exact-candidate governed log is committed at `6d1b8431` and covers application candidate `12d2ffd3acd257dda955e6a16e78bdcc56441235`: 1,633 passed, zero failed, 109 skipped. Its committed LF SHA-256 is `45413acf5bcf55e5eaad252e423c52dc6fd51236447571975744358f0363cd1b`; the Windows working-file CRLF SHA-256 is `855e90ff30c4a6db0803ab6776a21d0c0462dd54734de8bc4057439bdace29fd`. The committed LF form is authoritative.

| Artifact | Pin | SHA-256 |
|---|---|---|
| Application package | `12d2ffd3acd257dda955e6a16e78bdcc56441235` | `b8e53f48d953cc29163b43bca570ca6e2bd279983a8ee2b6fe53f99b7aad025e` |
| Package manifest | Same application pin | `a5dd49ece1d13c71a4ad17d155b2c9519be7b4f5220ac74043e6b7899aa778ee` |
| CRM Test operator | `12d924f8564bf38b91b90fcd186336b213f742a2` | `0d66f2617c5ff5fc8fb01cd808dc3df46999d19d6432979685f1bc772515d34e` |
| CRM Test install config | `8144ae8b` | `84de5156f14c35c8983c7dc3d2570a51cfe567fb52b956a2e1eef33fea745816` |
| CRM Test reverse config | `8144ae8b` | `0562d6c81c3ffc9f3a93fb4dc18f5f08841e17787e7bf0395d14a57237e9970e` |
| CRM Test reinstall config | `8144ae8b` | `6de52f7c71827b41336f441dd15c943f7e4104ff8e2d2751959afcb0eec3cc69` |
| Production preflight config | `8144ae8b` | `f05bf7ed926b66a3b8178665f22ebc68adfcd626a612a9465de196e77ccf0d0d` |
| Production preflight tool | Application pin | `8b1900098902724c846624848d22cb836dc2bdb77d673dd835a4720c7e5559a0` |
| Production deployment operator | Application pin | `68b3049d5f5629e931dba59642c3312357e279e0d92e142d4f780497838dc430` |

Tool and config hashes were calculated from committed Git blobs. Config LF and Windows working-file hashes are identical; the operator checks those exact hashes. The CRM Test configs bind 172 → 172, 313 tables and 113 triggers, equal canonical contract hashes and separate scoped backups. Production preflight binds accepted DEV272 and rechecks all four ownership counts at zero. The final Production deployment config must be bound to the separately approved fresh preflight receipt.
