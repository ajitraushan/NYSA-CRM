# Property Finder listing import — controlled UAT checklist

## Completed before credentials

Run `npm.cmd run uat:property-finder:listing-import:pre`. This credential-free rehearsal verifies the default-off gate, separate `listings:read` requirement, bounded GET-only discovery, private-data filtering, duplicate blocking, signed review expiry, visible test tagging, and provider-neutral idempotent Draft intake.

The rehearsal uses synthetic data only. It does not connect to Property Finder or CORE, create Inventory, spend credits, or store credentials/private owner/contact data.

## What the business owner must prepare

1. Create a separate least-privilege sandbox credential with `users:read`, `listings:read`, `leads:read` and `credits:read`. Keep the existing export/preflight credential unchanged. Do not paste or send either key or secret in chat, email, screenshots or UAT evidence.
2. Create or identify at least three harmless sandbox listings with one visible non-private tag such as `R3B-UAT`:
   - one PF listing not represented in CORE;
   - one listing already linked to a test CORE Inventory record, if the sandbox allows this setup;
   - one listing whose maintained reference deliberately matches a test CORE Inventory reference for duplicate review.
3. Ensure the unmatched fixture has a clear project, PF location, supported property type, bedrooms where applicable, positive size, positive asking price and three-letter currency.
4. Decide which governed CORE Area should be selected for the unmatched fixture. No owner/contact or authority data is required for this import UAT.

## Controlled CRM-Test session

The engineer will privately configure the new credential through `PROPERTY_FINDER_LISTING_IMPORT_*` server settings and a separate random review-token secret, temporarily set only `PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS=1`, and confirm `listingImportReadReady=true` before discovery. The old `PROPERTY_FINDER_ALLOW_READS` switch remains `0`, and `leads:read` remains unused during listing UAT.

The Administrator will then:

1. Open **External Portal Listings** and explicitly confirm discovery.
2. Confirm only sanitized listing facts and media counts appear—never owner/contact details or media URLs.
3. Confirm linked and possible-duplicate results cannot be imported.
4. Review the unmatched tagged fixture and create exactly one blocked Internal Inventory Draft.
5. Confirm its source is Property Finder, its external PF ID is retained, and it is not verified, available, active or published.
6. Attempt the same import again and confirm no duplicate Inventory is created.

## Closure evidence

Before closing UAT, record only privacy-minimized results:

- PF sandbox remained unchanged;
- credits before and after are identical;
- exactly one tagged unmatched listing became a blocked CORE Draft;
- repeated import was harmless;
- no owner/contact details or media URLs entered CORE;
- `PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS` was restored to `0`;
- connector status returned `listingImportReadReady=false`.

Production and R2 remain out of scope throughout.
