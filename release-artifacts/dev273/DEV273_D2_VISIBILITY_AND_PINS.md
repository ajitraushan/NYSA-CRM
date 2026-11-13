# DEV273 visibility evidence and release pins

Scope and approval follow AGENTS.md mandatory hosted-worker verification and CRM_CHANGE_POLICY.md hosted-deployment controls. All evidence below is local.

| Surface | Test | Result |
|---|---|---|
| Customer and Lead lists and search | DEV273 Customer and Lead HTTP scope across linked surfaces | Pass for out-of-scope query exclusion. Manager team and Director all defaults and owner/Unassigned filters still need direct HTTP assertions. |
| Customer 360 | DEV273 Customer and Lead HTTP scope across linked surfaces | Pass for Director masking and out-of-scope 404. |
| Lead queues and detail | DEV273 Customer and Lead HTTP scope across linked surfaces; assignment queue supports scoped visibility atomic claim and repeat-cycle deadlines | Pass for out-of-scope detail 404 and existing queue contract. Direct offered-Agent masking and unassigned WEB/Meta visibility checks are missing. |
| Documents and proposals, including PDF | DEV273 Customer and Lead HTTP scope across linked surfaces; Scoped generated PDF preview and download preserve original bytes and audit access | Pass for tested linked lists, document detail and original PDF preview/download, including Manager and Director audit and outsider 404. |
| Opportunities | Opportunity list and detail mask Director contact details and enforce Agent scope | Pass for list and detail. |
| Linked tasks | DEV273 Customer and Lead HTTP scope across linked surfaces | Pass for exclusion of an out-of-scope linked task even when assigned to the requesting Agent. |
| Dashboards | DEV273 Customer and Lead HTTP scope across linked surfaces | Pass for tested outsider dashboard exclusion. |
| Exports and CSV | DEV273 Customer and Lead HTTP scope across linked surfaces | Pass for dashboard CSV scope and contact masking. Other export endpoints lack direct evidence. |
| AI assistant | DEV273 Customer and Lead HTTP scope across linked surfaces | Pass for out-of-scope Lead action-suggestions 404. General assistant retrieval still needs a seeded authorization test. |
| Duplicate warnings | duplicate customers become governed drafts with an explicit Manager resolution path | Pass for existing draft workflow. Missing a direct test that cross-scope warnings omit identifying data. |
| Reveal and its log | DEV273 Customer and Lead HTTP scope across linked surfaces | Pass for Customer Director Reveal, no-store, outsider 404 and field-name-only audit. Lead Reveal and Manager team boundaries still need direct assertions. |

The governed log at `8b7bb62a` covers application candidate `7039ed921841dd01d396f557041ca20217b8e845`. The PDF test is at `f3ac8b6d` and made no runtime changes. The rehearsal and test receipts are at `56b03559`.

| Artifact | Pin | SHA-256 |
|---|---|---|
| Application package | `7039ed921841dd01d396f557041ca20217b8e845` | `0c0f160f766a7dff5cd197a51380b432dbce0a1d92b46dda03559886a7806105` |
| Package manifest | Same application pin | `aefe0066ba9a118b6efa0a7d2e17637116bf5dbb2aca1777d0f4b95b33480201` |
| CRM Test operator | `12d924f8564bf38b91b90fcd186336b213f742a2` | `0d66f2617c5ff5fc8fb01cd808dc3df46999d19d6432979685f1bc772515d34e` |
| CRM Test install config | `4f6fef8f` | `da8866ab29c2398cbe24ac97ba544cad14d3740658526e2e3587f33d7fc6f7ff` |
| CRM Test reverse config | `4f6fef8f` | `beafaf9aec0488257305115ed6e9521db37550a35b4204c2f52aac2e22b15fff` |
| CRM Test reinstall config | `4f6fef8f` | `13cbb810f30f54649fe94e10b42c2a8f8c21c9db925bda97ab26d73d01d2c83c` |
| Production preflight config | `cd21a6a4` | `2f2d2acf4ad955badcd2f0e3637355a59080b614e919e34ea3bf0655a84c5f9f` |
| Production preflight tool | Application pin | `8b1900098902724c846624848d22cb836dc2bdb77d673dd835a4720c7e5559a0` |
| Production deployment operator | Application pin | `68b3049d5f5629e931dba59642c3312357e279e0d92e142d4f780497838dc430` |

Tool and config hashes were checked against Git blobs. The CRM Test configs bind 172 → 172, 313 tables and 113 triggers, equal canonical contract hashes and separate scoped backups. Production preflight config hashes match its committed runtime/schema inputs and all five tool blobs. The final Production deployment config will be bound to the separately approved preflight receipt.
