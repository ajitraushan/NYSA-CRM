# DEF-133 — Document viewing incorrectly restricted by role

The user explicitly instructed: “there should not be any restriction to view document for any role”. This supersedes the earlier Director-only document visibility requirement.

## Implemented scope

Every active, authenticated account role may read document metadata, preview supported files and download documents, including restricted KYC files and retained versions. This includes Admin, Sales Agent, Listing Agent, Manager, Director, Accountant, Partner Broker and Viewer. Role, team, ownership and review-assignment restrictions no longer deny these document reads.

Read-only endpoint exceptions are exact-path and GET-only. They cover generic document metadata/view/download, Customer/Lead document lists, exact review-request files, mandate versions, permit evidence, property media, payout advice, issued invoices, commission proofs and payout statement documents. Existing business-workspace access, document writes, uploads, replacement, approvals, financial posting and review decisions retain their prior rules. No anonymous/public-file access was added.

Private storage, authentication, suspended-account denial, private/no-store file responses and file-read audit records remain in place. This intentionally broadens access to sensitive KYC and financial documents, as requested; it does not remove encryption or publish files publicly.

## Baseline and rollback

- Application candidate: `2.1.0-dev.227`; existing UAT work remains uncommitted on `codex/uat-20261012-fixes`.
- Source baseline: `9db8387b8bdbd66087414ec62adf387c82172e79` plus the pre-existing local UAT candidate.
- Dated local snapshot: `uat-evidence/document-view-access-20261023/`, including copied read-policy/gate/route files and baseline metadata before this change.
- No schema migration or real-data mutation is required by the document-read change. Local API testing used a disposable synthetic schema and removed its private test files and schema afterward.
- Rollback restores the prior source read policy and endpoint gates from the dated snapshot/reviewed source diff; no document history needs deletion.
- Production and hosted CRM Test were not changed by this work. No release package was created or deployment claimed.

## Verification

- Full regression: **1,694 tests; 1,607 passed; 87 skipped; zero failures**. Skips are not claimed as executed checks.
- All-role HTTP matrix: **64 successful read requests** across eight signed-in roles, covering metadata/lists, restricted KYC preview/download, mandate files and permit files. The KYC PDF is valid, synthetic, restricted and linked to a synthetic Customer identity record.
- Each role's KYC preview/download remains audited. Returned PDF bytes match the retained original.
- Anonymous request: 401; suspended account: 403.
- Admin, Accountant, Partner Broker and Viewer do not gain document-upload authority. Director mandate-upload denial and original review-decision exclusions remain checked.
- Nineteen synthetic review-source examples pass exact-link, role-decision exclusion, duplicate-free refresh and source-decision synchronization checks. Document reading is now independent of those decision permissions.
- Policy tests cover every active account-role class, suspended/unknown/anonymous denial, exact GET-only exceptions and rejection of writes and unrelated workspace access.
- Evidence: ignored `uat-evidence/document-view-access-20261023/api.log` and `regression.log`.

The full hosted UAT deployment remains a separate outstanding release step. These results establish the local candidate, not a live hosted change.
