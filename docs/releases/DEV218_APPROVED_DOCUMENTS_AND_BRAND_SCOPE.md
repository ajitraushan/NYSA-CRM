# DEV218 Approved Documents and CRM Brand Scope

Recorded: 2026-10-05 (Asia/Dubai)

## Governed baseline

- Application: NYSA CORE
- Baseline version: `2.1.0-dev.217`
- Baseline commit: `8068281473c6b10c1081b00eae5f5eb12b3b8679`
- Advertised baseline ref: `origin/codex/crm-dev217-post216-remediation`
- Development branch: `codex/crm-dev218-approved-documents-theme`
- Target environment: CRM TEST only
- Existing rollback backup: `/home/nysareal/crm-backups/consolidated-crm-test-dev217-20261004T202914Z`
- Deployment control: create and verify a new CRM TEST database/application backup immediately before deployment.
- Production and R2 clone: out of scope and must remain unchanged.

## Approved template authorities

The supplied HTML/PDF/XLSX files are visual and content authorities. CRM values replace sample values without redesigning the approved layouts.

1. Buyer Proposal HTML: Quick, Investment and Comparison; one summary page plus one property page per selected match.
2. Financial Illustration HTML: one selected property and the exact saved financial scenario.
3. Offer Letter HTML: replaces the current coded Offer PDF.
4. Viewing Confirmation HTML: user-selected completed viewings for one Customer, up to ten per issued document.
5. A2A Buyer HTML: NYSA represents the buyer/tenant.
6. A2A Seller HTML: NYSA represents the seller/landlord.
7. Marketing Agreement / Listing NOC HTML: owner authorization to list and market Inventory; it is not customer marketing consent.
8. Tax Invoice PDF/XLSX: the Excel workbook is the formula/layout authority.
9. Agent Payout Calculation Sheet HTML/PDF: the HTML is the rendering authority; no customer-payout document exists.

## Confirmed workflow rules

- A2A preparation occurs from the Opportunity after the property and both agencies/agents are identified, before Viewing or Offer. The representation side selects Buyer or Seller A2A.
- Listing NOC is prepared from Inventory/External Portal Listings before publication. The executed document is uploaded to the existing Listing NOC evidence workflow and independently verified by a Manager.
- Viewing Confirmation consolidates only the completed viewing records selected at issuance, all for the same Customer, with a maximum of ten. Later viewings require a new document.
- Previously issued immutable documents are never rewritten. Eligible historical/open cases may create a new immutable version with an approved template.
- Draft values remain editable only before issuance. Issuance freezes the exact data snapshot, template version, PDF hash, actor and timestamp.
- User Maintenance has optional BRN. When BRN is present, BRN issue date is mandatory.
- Assigned-agent details are used only when the assigned agent has a maintained BRN and BRN issue date. Otherwise the maintained Default Document Agent is used.
- Company Profile maintains the Default Document Agent. The user confirmed Sunita Sinha's approved BRN `58771` and BRN issue date `2026-01-09`; after migration 132, CRM TEST Admin must maintain those values in her unique User record and select that record as Default Document Agent. The runtime never resolves her by name or invents regulated identity evidence.

## Brand and rendering rules

- Apply the approved navy shell, light working surfaces, Inter typography, selective gold accents and semantic status colours to all authenticated CRM screens.
- Keep the existing login design unchanged.
- Self-host Inter and GFS Baskerville. CRM emails continue to use Arial.
- Render approved HTML through Chromium with CSS page size, print backgrounds and font readiness.
- Preserve inline SVG logos, exact A4 orientation, margins, page structure and approved footer treatment.
- Format dates, currency, enum values, references and missing-image states according to the supplied brand specification.

## Planned verification

- Migration apply and rollback rehearsal on the synthetic/local fixture.
- Unit tests for field mapping, formatting, formula consistency and conditional BRN validation.
- Authorization tests for draft, issue, review, download and evidence actions.
- Workflow integration tests for Proposal, Illustration, Offer, Viewing, A2A, Listing NOC, Tax Invoice and Agent Payout.
- Immutable version, audit, idempotency and concurrency tests for issuance.
- Chromium render tests for every approved template, long proposals (five or more matches), long payout statements (twenty or more rows), overflow, page numbering, repeated headers and print colours.
- Full regression suite and governed release test selection.
- Package creation is prohibited until the exact tested commit, scope, migrations, test results, security/privacy impact and rollback plan are presented to the user.

## Confirmed CRM TEST post-migration configuration

1. In User Maintenance, open the unique Sunita Sinha record and maintain BRN `58771` with issue date `2026-01-09`.
2. In Company Profile, maintain ORN `56017` from the approved templates and select that BRN-complete Sunita Sinha record as Default Document Agent.
3. Reopen Company Profile and User Maintenance to verify the persisted values before issuing any approved document.
4. Do not apply the configuration by name-matching SQL or to another environment without separate approval.
