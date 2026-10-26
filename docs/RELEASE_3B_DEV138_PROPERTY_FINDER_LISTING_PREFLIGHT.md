# Release 3B dev.138 — Property Finder listing preflight

## Scope and outcome

Version `2.1.0-dev.138` is a migration-neutral, CRM-Test-only, Property-Finder-sandbox-only dry-run increment. It does not deploy or package itself. Production and R2 are outside its code path.

The preflight builds an exact payload in memory and returns a deterministic hash plus a business-readable preview. It cannot create, change, delete, publish or unpublish a Property Finder listing; register a webhook; query a publication price; or spend credits.

## Preconditions

Keep `PROPERTY_FINDER_ALLOW_READS=0` except during an explicitly approved controlled sandbox read. Before temporarily enabling it, all status checks must be green and the sandbox credential must be unexpired.

The operator must explicitly provide:

- one Inventory UUID and its current immutable Property Finder preparation UUID;
- a visible, non-private UAT tag already present in the Inventory reference or headline;
- a PF public-profile ID;
- a PF location ID selected manually and the search text used to locate it;
- an optional PF project ID;
- one or more approved, rights-cleared Property Media UUIDs belonging to that Inventory;
- for each selected image, a temporary HTTPS delivery URL valid for at least seven days, verified dimensions no larger than 1920 × 1080, and RGB/sRGB/Adobe RGB colour space.

Dubai is the only compliance path enabled in dev.138. The current immutable internal permit evidence must reconcile before any PF read occurs.

## Controlled request

Authenticated full administrators may send `POST /api/integrations/property-finder/sandbox/listing-preflight` with the exact confirmation `PREFLIGHT_PROPERTY_FINDER_SANDBOX`. Use only dedicated tagged CRM-Test fixtures. Never copy real credentials, owner/contact data, authority documents, permit response bodies or signed media URLs into source control, screenshots, tickets or UAT evidence.

Illustrative shape only (all values below are non-live placeholders):

```json
{
  "confirmation": "PREFLIGHT_PROPERTY_FINDER_SANDBOX",
  "listingId": "00000000-0000-4000-8000-000000000001",
  "preparationVersionId": "00000000-0000-4000-8000-000000000002",
  "testRecordTag": "R3B-UAT-04",
  "publicProfileId": "selected-pf-public-profile-id",
  "locationId": "selected-pf-location-id",
  "locationQuery": "Dubai test location",
  "projectId": "selected-pf-project-id-or-null",
  "mediaSelections": [
    {
      "propertyMediaId": "00000000-0000-4000-8000-000000000003",
      "deliveryUrl": "https://media.example.test/test-image.jpg",
      "availableUntil": "2026-08-12T12:00:00.000Z",
      "width": 1920,
      "height": 1080,
      "colourSpace": "sRGB"
    }
  ]
}
```

The route reads the selected PF user collection and location search, the optional selected project, and the Dubai compliance endpoint. It returns only resolution booleans/selected IDs inside the constructed payload; it never returns PF user or compliance records.

## Interpreting the result

`READY FOR REVIEW — NO LISTING WAS SENT` means all automated checks passed and the payload/hash are reproducible. It does not authorize transmission. `BLOCKED — NO LISTING WAS SENT` lists the business checks that need correction in their ordinary governed workflow.

The audit event stores the internal selection IDs, readiness result, mapping version, media count and deterministic hash. It does not store the payload, delivery URLs, credentials or upstream responses.

Immediately restore `PROPERTY_FINDER_ALLOW_READS=0` after the controlled read and confirm `/api/integrations/property-finder/sandbox/status` reports `networkReady: false`.

## Remaining manual work

Before using credentials, run the complete synthetic outward rehearsal:

```powershell
npm.cmd run uat:property-finder:outward:pre
```

It verifies the independent default-off boundary, exact read allowlist, privacy minimization, visible tag, readiness gates, exact payload, deterministic hash and blocked no-payload path. It writes an append-only report under `outputs/property-finder-outward-pre-uat/` and makes zero external calls or writes.

- Confirm the PF sandbox supports the documented users and filtered locations pagination shapes for the selected fixtures.
- Select a dedicated, visibly tagged Dubai UAT Inventory and complete its immutable portal preparation and permit evidence.
- Prepare non-sensitive sandbox media delivery URLs and verify their lifetime, dimensions and colour space.
- Temporarily enable reads through the approved CRM-Test operations process, run one preflight, review the summary/payload/hash, and disable reads again.
- Confirm the credit balance remains unchanged and retain only privacy-minimised audit evidence.
- Obtain separate authorization before any future listing write, publication, credit, webhook, Production or R2 increment.
