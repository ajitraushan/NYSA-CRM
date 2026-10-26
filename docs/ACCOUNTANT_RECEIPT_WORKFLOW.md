# Accountant receipt workflow — current versus dev.176 candidate

## Current deployment update — 3 September 2026

**CRM Test dev.178 deployed; human retest pending.** This supersedes earlier local-only/
dev.176 status statements below, which remain historical evidence. User authorized “pl deploy
in crm, all the fixes”. The isolated package includes Accountant four-workspace access,
Opportunity-first Finance references, K/M amounts, receipt-only wording, managed-team Manager
commercial closure and receipt-independent closure at both API and database levels.
Migration114 removed the receipt closure trigger; no other closure gates or Director payout
approval were removed. Deferred receivables/invoicing/new payout-request workflow excluded.

Package SHA-256 `1a0fc76b30df333bcfc0121cb0dae1711e884b2fb65604bc7d847080f0cc5218`;
latest migration114, 113 total (no113); one verified Test worker PID280206. Exact isolated suite
1,336 total /1,287 passed /49 protected skips /0 failed; 24 separately enabled synthetic DB
checks passed. Health/readiness and installed/served hashes verified. Fresh private application/
database backup verified. Production/R2/PF untouched; no new production personal data.

SPEC-GAP-002 and all previously user-failed items remain **deployed pending human retest**;
no inferred acceptance, original-record repair or cumulative count change (25 items).
Historical dev.174 SHA, migrations108–110, one-worker observation and 1,291/1,261/30/0 result
are unchanged. See [deployment evidence and rollback](CRM_TEST_DEV178_DEPLOYMENT_COMPLETION.md).

> Latest local correction: transaction closure is now independent of commission collection in code
> plus migration 114. Manager closes the completed transaction; Accountant records/confirms receipt
> independently afterward. Payout is not released automatically. This is not deployed yet; the older
> closure-gate descriptions below are historical. See [actual closure correction](COMMISSION_INDEPENDENT_CLOSURE_CORRECTION.md).

> Current-state correction, 3 September 2026: dev.176 has since been deployed. Historical descriptions
> below are retained. A newer LOCAL-ONLY correction limits Accountant to Dashboard, Opportunities
> (read-only finance view), My Leave and Finance Receipts, uses Opportunity reference first and supports
> K/M amounts. Receivables/payout remain deferred; the old receipt closure gate is unchanged.
> See [current scope and verification](ACCOUNTANT_FOUR_WORKSPACES_AND_RECEIPT_INPUT.md).

Accountant is an assignable internal job role in User maintenance. This does not establish that a particular
Accountant user account has been created, activated or tested on CRM Test.

## Deployed dev.175

Accountant receipt recording/confirmation authority exists, but no dedicated finance menu reaches it.
Opportunities is intentionally unavailable to Accountant. Commission evidence is text-reference-only.
For a standard internal Accountant login, the navigation code renders Dashboard, Customers, Leads, Inventory,
External Portal Listings, My Leave and Marketing Compliance. Menu visibility is not a grant of operational access;
lead/opportunity scope excludes Accountant. My Diary, Opportunities, Assignment Queue, Payout and Administration
are hidden. This explains why directing an Accountant into the same Opportunity was not a complete workflow.

## Local dev.176 candidate — not yet deployed

The additional **Finance Receipts** menu is for Accountant, Director or full Administrator. Other menus are
unchanged. No general CRM access is opened to Accountant.

1. Agent/Manager prepares and freezes expected commission from the Deal's maintained terms.
2. The scoped agent may upload bank proof under Deal & completion → Commission and receipt → Commission proof.
   Finance can also upload there through its receipt workspace. Supported: PDF, PNG, JPEG, maximum 5 MB.
3. Accountant opens Finance Receipts and searches by the Deal reference, then chooses Open receipts.
4. Review the expected amount and download the private proof. Uploading proof alone does not confirm payment.
5. Enter actual amount received, company-account date, payment method and finance reference. Select the uploaded
   proof (or use the pre-existing governed text-reference option), then Record immutable receipt.
6. Verify the saved receipt in Recorded receipts. Enter/confirm the evidence reference and reconciliation reason,
   then Confirm actual receipt for Close Won. This is a real assertion that the company received the money.
7. Manager/Director performs the separate authorized Deal closure after all other gates are satisfied. A variance
   is not silently waived. Accountant cannot approve/close the Deal or access Director-only Payout.

This is test-only verification with synthetic proof, not evidence of any actual bank payment. Production personal
documents must not be uploaded to CRM Test without explicit approval. Local machine verification is not human UAT.

## Local dev.177 extension — Receivables (not yet deployed)

Accountant, Director and full Administrator also see **Receivables**. Create an Opportunity-linked payment schedule, select a maintained Customer/Agency/Developer payer, allocate the net commission across dated instalments, then record a separate invoice date/reference for each instalment. The register adds 5% VAT, shows total/collected/balance, and supports Scheduled, Unpaid, Part paid, Paid, Cancelled and Overdue filtering.

Actual collections in this register include VAT and update invoice balances only. They do not automatically confirm the existing net-commission Deal receipt, close a Deal or trigger Director payout. Finance Receipts remains the separate proof and Deal-reconciliation workflow above. Invoice references come from the invoicing process; this module does not produce statutory tax invoices.

See [dev.177 scope, steps, tests and rollback](CRM_TEST_DEV177_RECEIVABLES.md). Last verified remote CRM Test is still dev.175; no new deployment or human UAT pass is claimed.
