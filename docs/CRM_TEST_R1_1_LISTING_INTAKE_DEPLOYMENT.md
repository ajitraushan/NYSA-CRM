# Release 1.1 Provider-Neutral Listing Intake — CRM Test Deployment

Target: `https://crm-test.nysarealty.com/` only. Production deployment is not
authorized.

## Correction record

- Amendment ID: R1.1-AMD-013
- Related UAT finding: R1.1-UAT-027
- Agreed requirement: authenticated, provider-neutral and idempotent listing/import
  events create reviewable Draft inventory only; invalid/unmapped and possible-
  duplicate events remain controlled review items and never partially create or
  overwrite approved inventory.
- Status: implemented and automatically tested locally; CRM Test deployment, retest
  and explicit user confirmation remain pending.
- Retest condition: complete every case in the CRM Test checklist below. Do not close
  the finding until the NYSA owner explicitly confirms it.

## New CRM Test environment settings

In cPanel **Setup Node.js App → CRM Test → Environment variables**, configure a test
provider. Never place either value in Git, browser code, a screenshot, or a command
that will remain in shared shell history.

- `LISTING_INTAKE_PROVIDER_SECRETS`: JSON object mapping provider code to a random
  secret of at least 32 characters, for example `{"crm_test_feed":"<secret>"}`.
- `LISTING_INTAKE_PROVIDER_ACTORS`: JSON object mapping the same provider code to the
  UUID of an active CRM Test Listing Executive, for example
  `{"crm_test_feed":"<listing-executive-uuid>"}`.

The singular `LISTING_INTAKE_SECRET` and `LISTING_INTAKE_ACTOR_ID` settings are
supported only as a single-provider fallback. The provider maps are preferred.

## cPanel deployment sequence

1. Confirm the target is CRM Test, application root is
   `/home/nysareal/nysa-core-dashboard-dd6262a-stage`, and the database is
   `nysareal_nysacrm_r1test`. Stop if any production hostname, root, or database is
   shown.
2. Upload the supplied ZIP to `/home/nysareal/`, verify its supplied SHA-256, and
   create a PostgreSQL custom-format backup of the CRM Test database.
3. Extract the ZIP into a new staging directory. Run the included JavaScript syntax
   and automated tests from that directory. If dependencies are not present in the
   staging directory, link the CRM Test application's existing `node_modules` for the
   test only; do not install or upgrade packages during this correction.
4. Stop the CRM Test Node.js application in cPanel. Copy the staged tracked files over
   the CRM Test application root. Preserve `.env`, `storage/`, logs, `node_modules` and
   all other runtime-only content.
5. Add the two CRM Test-only provider environment settings above and restart the CRM
   Test application. Startup applies migration
   `036_provider_neutral_listing_intake.sql` once.
6. Require `https://crm-test.nysarealty.com/api/health` to return HTTP 200 and
   `{"ok":true,"database":"ready"}`. Confirm migration 036 is recorded exactly once.
7. Hard-refresh the CRM Test browser and complete the retest below. Never use
   production as a test, fallback, or comparison target.

## CRM Test retest

1. Submit one valid, correctly signed `crm_test_feed` event. Confirm HTTP 201, one
   listing ID, `workflow_status=draft`, `portal_status=blocked`, the configured Listing
   Executive as owner, and all source identifiers preserved.
2. Sign in as that Listing Executive. Open **My listing workspace → Integration /
   import intake**, open the Draft, complete it and confirm the ordinary submit/review
   lifecycle applies.
3. Submit the exact same signed body with the same event ID. Confirm an idempotent
   response and no second event/listing.
4. Reuse the event ID with changed data. Confirm HTTP 409 and no change to the Draft.
5. Submit a new event ID using the same provider/external-record pair. Confirm a
   duplicate-review queue item, a link to the existing listing, and no overwrite or
   second inventory row.
6. Submit an unmapped Area code and an invalid governed property type. Confirm each
   produces a controlled queue item and no listing. Correct the Area mapping or replay
   payload, use **Retry after correction**, and confirm exactly one Draft is created.
7. Submit an invalid signature, expired timestamp and body over 512 KiB. Confirm safe
   rejection and no listing or partial related records.
8. Sign in as another Listing Executive and an unrelated Manager. Confirm they cannot
   see events outside their own/managed scope. Confirm an Administrator can inspect
   safe metadata but no browser response exposes signing credentials or full payload.

## Rollback

If migration, health, scope, duplicate protection or Draft-only behavior fails, stop
the CRM Test worker, restore the prior CRM Test application package and restore the
verified pre-deployment CRM Test database backup, then restart and verify health. Do
not roll back or test against production.
