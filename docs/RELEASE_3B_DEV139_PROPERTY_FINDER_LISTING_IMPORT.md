# Release 3B dev.139 — Property Finder listing import

## Scope and safety boundary

Version `2.1.0-dev.139` adds a migration-neutral, CRM-Test-only, Property-Finder-sandbox-only listing discovery and explicitly reviewed Draft-import workflow.

It does not deploy or package itself. It contains no PF listing create, update, delete, publish or unpublish operation, performs no webhook management and spends no credits. Production and R2 remain outside the code path.

## Separate read permission

PF listing discovery uses a separate least-privilege sandbox credential with exactly `users:read`, `listings:read`, `leads:read` and `credits:read`. The dev.137 export/preflight credential remains separate and unchanged. PF API-key scopes are immutable; never place either credential in source, chat, screenshots, tickets or test evidence.

The connector status exposes `listingReadScopeConfigured`, `leadReadScopeConfigured` and `listingImportReadReady` without returning credentials. `PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS=0` is the independent safe default; enabling it does not enable the older export/preflight credential. `leads:read` is reserved for the future governed PF-enquiry-to-CORE-Lead increment and is not called by dev.139.

The CRM-Test server also needs a separate random `PROPERTY_FINDER_IMPORT_REVIEW_SECRET` of at least 32 characters. It signs short-lived review tokens and is never sent to the browser.

## User workflow

Only a full Administrator can open the workflow in **External Portal Listings**:

1. Select **Discover PF sandbox listings** and confirm the controlled external read.
2. CORE calls only `GET /v1/listings` with bounded pagination.
3. CORE removes owner/contact data and media URLs, maps safe listing facts and compares PF listing IDs/references with existing Internal Inventory.
4. Linked listings are marked for reconciliation. Possible reference matches are blocked for duplicate review. Neither can be imported.
5. Select **Review Draft import** on an unmatched, visibly tagged sandbox fixture.
6. Confirm the governed CORE Area, project, community, property type, bedrooms, size, price, currency and handover state.
7. Enter the visible non-private sandbox tag and confirm creation of one Internal Inventory Draft.

The review token expires after ten minutes and cryptographically binds the sanitized discovery snapshot. The server checks duplicates again at commit time.

## Import effect

An accepted import uses the existing provider-neutral listing-intake transaction and records:

- `source_provider=property_finder`;
- the PF listing ID as the immutable external record ID;
- mapping version `property-finder-enterprise-api-1.0.1-dev.139`;
- source kind `import`;
- one blocked, Draft Internal Inventory record;
- initial responsibility assigned to the authenticated full Administrator unless a separately governed NYSA user is explicitly selected in the API request;
- immutable intake, assignment and Draft-creation audit evidence.

It never imports or infers an owner, owner/contact details, authority, approved media, verification, availability, activation, portal preparation or publication status. PF media count is preview information only; URLs and media files are withheld.

## Confirmations

- Discovery: `DISCOVER_PROPERTY_FINDER_SANDBOX_LISTINGS`
- Draft import: `IMPORT_PROPERTY_FINDER_SANDBOX_LISTING_AS_DRAFT`

Both actions also require an explicit UI confirmation. Import additionally requires a visible test tag in the PF reference, title or project.

## Remaining controlled UAT

Before credentials are changed, run the credential-free offline rehearsal:

```powershell
npm.cmd run uat:property-finder:listing-import:pre
```

It uses synthetic PF responses and a mock transport. It makes zero external calls and zero CORE/PF writes, spends no credits, and writes an append-only privacy-minimized JSON and Markdown report under `outputs/property-finder-listing-import-pre-uat/`.

- Privately configure the separately created PF sandbox key with `users:read`, `listings:read`, `leads:read` and `credits:read`; do not alter or expose the existing export/preflight credential.
- Configure a protected review-token secret only in CRM Test.
- Create or identify dedicated PF sandbox listing fixtures with a visible non-private UAT tag.
- Temporarily set only `PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS=1`, verify `listingImportReadReady=true`, discover one bounded page and confirm no private fields or media URLs are displayed.
- Validate the authenticated PF response/pagination shape against the adapter and adjust only from documented evidence if needed.
- Review linked, possible-duplicate and unmatched results.
- Import one selected unmatched fixture, confirm it is a blocked Draft with correct provenance, and confirm a repeated import is harmless.
- Verify PF remains unchanged and credits remain unchanged.
- Restore `PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS=0` and confirm `listingImportReadReady=false`.

No Production/R2 enablement, bulk import, scheduled synchronization, media copy, deletion reconciliation or PF lead ingestion is part of dev.139.
