# Release 3B — Governed Inventory intake traceability

Status: CRM Test `2.1.0-dev.118` is deployed with `inventory-import-v1.3`, the progressive Inventory boundary and migration `078_release3b_inventory_progressive_governance.sql`. A post-deployment attribution correction is verified locally and still requires a new CRM-Test-only package. Production and R2 remain untouched.

## Dev.118 UAT attribution correction pending packaging

- UAT row `_EXT_INV_011` proved that active maintained Sales Agent `ajit@nysarealty.com` was rejected when a Listing Executive performed the import, while the uploader's own `listing@nysarealty.com` identity was accepted.
- There was no hardcoded Listing Executive email. The shared Inventory-agent scope treated every non-manager/non-admin role as self-only, so the central Listing Executive could resolve only their own login and the validator collapsed unknown, inactive, ambiguous and out-of-scope results into one message.
- The correction makes the Listing Executive a company-scoped Inventory attribution operator, while Sales Agents remain self-only, Managers remain maintained-team scoped, and Admin Assistant/Administrator scope remains unchanged. Every resolved target must still be active and have a current Sales Agent or Listing Executive role.
- Preview and commit now query only the supplied/defaulted login references, re-resolve them at commit, and distinguish unknown, inactive, ambiguous, ineligible and outside-scope causes. Blank responsible agent still defaults only to the resolved originating agent; screen defaults remain explicit.
- This source correction is not part of the deployed dev.118 checksum. It requires a new CRM-Test-only package/version before UAT retest; no migration is required.
- The same pending package removes the misplaced availability-confirmation and seven-day-freshness prerequisites from Manager-verification submission. Owner/represented-party and internal-use authority evidence remain mandatory. Matching, customer-viewing scheduling and reservation now enforce a recorded availability confirmation no older than seven days.

## Current local v1.3 contract

- Adds `originating_agent_reference` and `responsible_agent_reference`; maintained login email is the human-facing key and CORE stores the resolved broker IDs.
- Supports explicit screen defaults while refusing missing, inactive, ambiguous or out-of-scope attribution. Commit re-resolves the current directory so a stale preview cannot bypass scope.
- Keeps the uploader as audit actor, separate from the immutable originating agent and current responsible agent.
- Makes the owner group optional at Draft creation. When any owner field is supplied, the complete governed owner group is required and saved atomically; otherwise verification remains blocked until owner/source authority is added.
- Excludes marketing agreement, portal permit, channel and publication fields. Those belong to the separate External Portal Listings workspace.
- The reusable presentation template is v1.4 and retains the 31 exact v1.3 contract columns for later current-CRM migration mapping. Red columns are mandatory, amber columns are co-mandatory when their stated condition applies, and neutral columns are optional or defaulted.

## Local v1.2 owner prerequisite after business UAT

Release 3B matching UAT cannot proceed from Excel-created Inventory until each Draft has a usable
owner-side party and can be submitted through the existing Manager verification workflow. The local,
unpackaged `inventory-import-v1.2` correction therefore adds only:

- `owner_role`: Seller, Landlord or Developer;
- `owner_type`: Person or Company;
- required `owner_name`, `owner_source` and `owner_authority_evidence`; and
- optional `owner_phone` and `owner_email`.

An accepted row creates the Draft and its `inventory_counterparties` owner record in the same
transaction. Any row or database failure rolls back both. The import does not create a Customer,
agreement, publication, match, reservation, verification decision or availability guarantee.
Agreement/mandate and external-publication evidence remain separate progressive steps under
`R3B-INVENTORY-BOUNDARY-52`.

## Dev.117 UAT corrections

- Imported Draft Inventory explicitly assigns the governed importing reviewer as both responsible and originating agent.
- Runtime query-contract coverage exercises the complete accepted intake path and verifies both mandatory values reach the Listing INSERT.
- Review feedback always reports Ready, Skipped and Invalid counts; a failed commit states that zero Drafts were created.
- The reusable contract advances to `inventory-import-v1.1`.
- Cash and Mortgage remain customer requirement/funding evidence and are rejected as Inventory payment plans.
- Inventory payment terms are optional and limited to Developer plan and Post-handover property terms.
- The corrected workbook was regenerated through the governed spreadsheet builder and visually verified across Inventory Upload, Instructions and Reference Values.
- Migrations 075–077 remain byte-for-byte identical to the dev.116 package.
- A disposable isolated PostgreSQL-compatible rehearsal applied migrations 001–077, confirmed `77|077_release3b_requirement_confirmation.sql`, executed the real `processEventWithClient` path, generated `NYSA-INV-000001`, persisted blocked Draft status, retained the external source ID, populated both mandatory agent identities and wrote both audit records.

## Business outcome

NYSA users can download an approved Excel template, review up to 1,000 Inventory rows, correct row-level errors, and atomically create governed Draft Inventory. The same `inventory-import-v1.1` field contract extends the provider-neutral Listing Intake boundary for later external CRM migrations or interfaces.

## Approved open gaps after business UAT

- `R3B-INVENTORY-BOUNDARY-52`: the initial manual Inventory form currently requires owner,
  authority, agreement and representation evidence too early even though external publications are
  already stored separately. Inventory Draft, verified internal use and external Listing must
  become progressive stages. Full specification:
  `docs/RELEASE_3B_INVENTORY_BOUNDARY_AND_AGENT_ATTRIBUTION_GAPS.md`.
- `R3B-IMPORT-ATTRIBUTION-53`: dev.117 assigns the uploader as both originating and responsible
  agent because the v1.1 workbook has no governed agent mapping. This is valid only for self-upload
  UAT and is not approved for administrator-led or multi-agent bulk migration. Full specification:
  `docs/RELEASE_3B_INVENTORY_BOUNDARY_AND_AGENT_ATTRIBUTION_GAPS.md`.
- `R3B-INVENTORY-OWNER-54`: dev.116/dev.117 imported Drafts initially have no owner-side party, while the detail
  UI claimed an owner already existed and the API rejected the Seller/Landlord/Developer roles
  offered by that UI. The preserved local correction enables governed post-import enrichment and
  advances the workbook to v1.2 so new imports atomically capture the basic owner; CRM Test
  verification remains pending. Full specification is in the same gap document.

The next general-use Inventory candidate must close both requirements. Dev.117 remains a narrowly
scoped upload-transaction hotfix and must not be represented as completion of these gaps.

## Controls

- Listing Executive, Manager, Admin Assistant or Administrator access only.
- Exact template headers, typed amounts/dates and controlled property values.
- Active Area-code validation and visible maintained Area codes in the UI.
- Stable source-system code plus external record ID; existing Inventory is never overwritten.
- Exact duplicates skip safely; conflicting reuse is blocked.
- Session-bound HMAC review token prevents changed rows being committed without a new preview.
- File-level advisory lock and one database transaction make commit all-or-none.
- Existing Listing Intake events and audit records retain source, contract version, file hash, row, reason and resulting Draft ID.
- Draft, blocked portal and unverified behavior remain intact. No automatic activation, matching, reservation, publication or communication.

## Reusable artifacts

- Application template: `public/templates/inventory-import-template.xlsx`
- Current local user output copy: `outputs/019fc2f9_inventory_import/nysa-core-inventory-import-template-v1.4.xlsx`
- Contract/parser: `src/inventory-import.js`
- Preview/commit API: `src/routes/inventory-import.js`
- Shared provider processing: `src/routes/listing-intake.js`
- Business UI: `public/app.js`

## Verification on 2026-08-02

- Focused Inventory/import/package checks: 11/11 passed.
- Final complete npm suite: 419/419 passed.
- JavaScript syntax and `git diff --check` passed.
- Deployer Bash syntax passed.
- Workbook inspected with 22 exact columns, no formula errors, and all three sheets visually reviewed.
- Package contains 158 portable forward-slash entries with internal/external SHA-256 verification.
- Package SHA-256: `314b55583a134a80b789dac099e663108c5c32e5edd5d39dbe39dd4536fa4fa5`.

No CRM Test deployment or database action was performed for dev.116. Production and R2 remain untouched and prohibited targets.

## Local progressive-governance verification on 2026-08-03

- Focused Inventory, matching and manager-queue validation: 63/63 passed.
- Complete application suite: 433/433 passed.
- Isolated PostgreSQL/WASM rehearsal applied migrations 001–078 and confirmed `78|078_release3b_inventory_progressive_governance.sql`.
- Database contract checks confirmed the assignment-history table, immutable update/delete trigger, originating-agent column and responsible-agent column.
- JavaScript syntax and `git diff --check` passed.
- The application template and user output v1.4 workbook are byte-identical; their current SHA-256 is recorded during package verification.
- Workbook presentation v1.4 retains the v1.3 upload contract's 31 exact columns, adds a mandatory/co-mandatory/optional colour legend, contains no formula errors, and its Inventory Upload, Instructions and Reference Values sheets were visually reviewed.
- Dev.118 package, checksum, JSON manifest, CRM-Test-only deployer and consolidated deployment/UAT guide were subsequently created. No environment was deployed; Production and R2 were untouched.
