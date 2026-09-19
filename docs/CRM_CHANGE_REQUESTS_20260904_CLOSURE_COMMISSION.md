# CRM change requests — closure documents and commission clarity

Date: 4 September 2026. Status: implemented and automated verification passed in the isolated CRM Test dev.182 candidate; deployment and human UAT pending.

These are two change requests linked to earlier document/finance observations. The dev.182 candidate implements them together with DEF-117 and DEF-121. No CRM Test or production deployment is claimed by this record.

## CR-20260904-01 — Transaction Documents and closure checklist

Related history: DEF-112 (final-document workflow). Implementation is automated-test complete; human acceptance remains pending.

### User evidence and decision

Screenshot `codex-clipboard-de82d5d1-8246-40e9-9802-1e3d89d1e6b5.png` shows “Current party documents ready”, zero requirements and “Governed seller required” together. Owner: “the wordngs are not clear, what are u asking here”; “i will not have seller record”; “my ask to name the fields as commonly understood in real estate parlance”.

Owner assigned document configuration to Admin and initially mentioned government transaction documents and commission proof. When asked about the previously agreed commission-independent closure, owner clarified “yeah i remember...so only first”. Only the applicable government-issued transaction document is mandatory for this closure-document step.

### In scope

- Admin configures required government transaction documents by transaction type. Named examples: Sale Deed, Title Deed / Transfer Deed, Ejari Certificate and Oqood Certificate. Do not require every example for every transaction or invent a fixed statutory mapping.
- Display the exact Admin-configured document names, missing/uploaded status, and upload/view actions against the transaction, linked to its Opportunity.
- Use plain labels: Transaction Documents, Required Documents, Upload Document, Document Number, Issue Date, View Document and Refresh Document Checklist.
- Show Required Documents Uploaded only when all applicable configured requirements have evidence. Show Document Checklist Not Configured when configuration is absent; zero configured requirements must not imply completion.
- Remove the separate seller-Customer creation prerequisite and its warning from this closure-document step. Reuse existing property/transaction context; do not require users to create the seller as their Customer to upload transaction completion evidence.
- Missing configured mandatory completion documents prevent closure with a specific document name and an actionable message.
- Commission payment proof can be supplied later and must not block transaction closure. Manager closure authority remains unchanged; no additional MD approval.

### Exclusions and decisions not assumed

- No removal of unrelated identity, property authority or compliance checks elsewhere. This is the transaction-closure document step only.
- No new waiver power, Manager exception approval, mandatory metadata rule or legal document mapping is assumed. Admin configuration must define applicability. Handling closure where Admin has not configured the checklist must be made explicit before implementation; the owner has not authorized silently treating it as ready or introducing a blanket new block.
- Preserve existing private-document permissions, validation and audit history. No statutory document generation or external-government integration.

### Acceptance

1. Configured document names appear for the correct transaction type; unrelated types are not requested.
2. A user can attach and reopen valid completion evidence without creating a seller Customer record.
3. Missing required evidence is named; zero configuration is not labelled ready.
4. Eligible Manager closure succeeds with the required transaction document and no commission payment proof/collection, subject to existing non-finance closure conditions.
5. Cross-record evidence access is denied; earlier checks outside this step are preserved.

## CR-20260904-02 — Commission Details and Commission Payments

Related history: DEF-115 (finance-step clarity) and DEF-119 (Accountant workflow). Implementation is automated-test complete; human acceptance remains pending.

Post-approval UAT evidence: DEF-121 records that the Accountant Receivables list and Opportunity selector returned no Opportunity, including the newly closed September Opportunity. The August reference visible in the screenshot was manually entered by the owner and was not a system result. Dev.182 adds an automatic Closed Won queue and direct Opportunity carry-forward; human retest remains required.

### User evidence and decision

Screenshot `codex-clipboard-0b169b94-61e1-4a2e-91e7-eb7a796f3310.png` shows Recorded receipts above Referral amount / Settlement basis and a Prepare and freeze expected commission action. Owner: “this part of also not clear, what are we trying to do here”. Owner subsequently authorized the described correction and requested an ID and clear scope.

### In scope

- Separate Commission Details (agreed/expected figures) from Commission Payments (actual money received).
- Commission Details displays the existing agreed commission and originating/servicing agent split from the linked Opportunity. No duplicate entry of previously agreed amounts or splits.
- Show an external Referral Fee only when applicable, separate from the two agents' split. Explain existing settlement choices in plain language; preserve existing calculation rules rather than inventing deductions or payment terms.
- Replace user-facing “prepare and freeze” terminology with a clear confirmation/save action if an explicit confirmation is still necessary. Retain internal version history and auditability; do not equate saving expected figures with receiving money.
- Commission Payments shows recorded receipts and the applicable outstanding balance sourced from Finance Receipts/Receivables, with clear Opportunity reference and authorized Accountant actions.
- Distinguish agreed, invoiced, paid and outstanding values where those differ; do not add a receivable collection and its linked Finance Receipt twice. No fabricated balance if the necessary commission basis is absent.
- Explain that uploaded payment proof is evidence, not a recorded/confirmed receipt. Avoid presenting expectation setup under Recorded receipts.
- Neither expectation confirmation nor commission collection/payment proof blocks transaction closure.

### Exclusions

- No redesign of agent payout, payout approval, VAT, invoices or collection posting rules.
- No new finance permissions for Agents or Managers. Existing Accountant recording rights and Director payout approval remain unchanged.
- No change to agreed commission or split calculation without separate business approval.

### Acceptance

1. Opportunity commission and split display consistently without re-entry.
2. No-referral transactions do not require referral fee input; applicable referral values remain separate from agent splits.
3. Saving expected commission or uploading proof does not create a payment.
4. Recorded collections/reversals reconcile once to their authoritative source and balance.
5. A permitted Manager can close an otherwise eligible transaction while payment is outstanding and without completing an expected-commission confirmation action.
6. All relevant labels/actions use plain real-estate/finance language; unauthorized roles cannot record or confirm receipts.

## Baseline and implementation boundary

Authoritative candidate baseline is exact dev.179 package SHA-256 `e6b4d2d2dc734b03873aecb6c4e4a5d9d902c739ac70f0d9481d86c347306434`; recorded Test rollback `/home/nysareal/crm-backups/consolidated-crm-test-dev179-20260903T191641Z`. A recoverable pre-change source snapshot and verified restricted local database backup were recorded before implementation.

Target: CRM Test only. Dev.182 contains additive migration 117 for transaction-level completion documents; 117 migrations total. Production, R2/Production clone, Property Finder, Performance Management and Campaign Management are excluded. Synthetic local verification passed; no human pass or deployment is claimed. Full evidence and rollback boundary: [CRM Test dev.182 transaction-flow corrections](CRM_TEST_DEV182_TRANSACTION_FLOW_CORRECTIONS.md).

## Post-dev.182 confirmed additions

Dev.183 adds the three remaining confirmed workflows without another schema migration: current Opportunity actions in My Tasks (DEF-122), Accountant invoice-first commission work (CR-20260904-03), and an explicit priced-counteroffer revision plus NYSA/represented-party acceptance path (DEF-123). Performance Management and Campaign Management remain outside this candidate. Full scope and verification: [CRM Test dev.183 work queue, invoice and negotiation](CRM_TEST_DEV183_WORK_QUEUE_INVOICE_NEGOTIATION.md).
