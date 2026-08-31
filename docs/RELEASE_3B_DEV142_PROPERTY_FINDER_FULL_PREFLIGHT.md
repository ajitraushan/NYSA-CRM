# Release 3B dev.142 — governed Property Finder full preflight correction

dev.142 remains CRM-Test-only, Property-Finder-sandbox-only and no-send. It does not add a listing create, update, delete, submit, publish or unpublish operation.

The increment fixes the two blockers found against `NYSA-INV-000018`:

- the exact payload is bound to the code-locked mapping `property-finder-enterprise-api-1.0.1-dev.142`, even when the older immutable preparation predates an active ETL mapping record;
- an administrator can verify approved, rights-cleared Inventory images directly from private storage and create opaque, expiring CRM-Test delivery URLs. Originals remain private and unchanged. Only approved bytes whose dimensions, aspect ratio and RGB colour model pass the PF policy receive a URL.

PF public profiles are now read as identifiers only for explicit selection; names, email addresses, phone numbers and other user details are withheld. Location remains a separately confirmed search followed by exact manual selection.

If a PF read fails, the connector retains a safe diagnostic object containing method, exact endpoint, UTC timestamp, HTTP status, content type and the upstream response body. Credential, token and private contact-like fields are redacted. Do not paste delivery URLs, bearer tokens, API secrets or private Inventory evidence into support tickets.

## Operator flow

1. Keep `PROPERTY_FINDER_ALLOW_READS=0` except for the explicitly approved UAT window.
2. Select the tagged test preparation.
3. Confirm the public-profile read and select the responsible profile.
4. Search locations and manually select the exact PF hierarchy record.
5. Verify photos and create temporary delivery URLs. Ineligible photos show their precise technical blocker.
6. Confirm the full no-send preflight. Review the business preview, exact versioned payload and SHA-256 hash.
7. Return both PF read flags to `0` and restart only the verified CRM-Test worker.

The delivery service requires a generated `PROPERTY_FINDER_MEDIA_DELIVERY_SECRET` of at least 32 characters in CRM Test and uses `NYSA_R3B_UAT_BASE_URL=https://crm-test.nysarealty.com`. This application secret is never placed in source control or UAT evidence.

Image resizing, re-encoding and watermark creation remain a separate governed media-derivative increment. dev.142 diagnoses a non-compliant source precisely and never silently alters an approved original.
