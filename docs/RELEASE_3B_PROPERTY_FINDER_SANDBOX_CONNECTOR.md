# Release 3B — Property Finder CRM-Test Sandbox Connector

## Implemented boundary

This boundary provides a server-side, CRM-Test-only connectivity check and a dev.138 listing dry-run preflight for the Property Finder Enterprise API sandbox. It is disabled by default and contains no listing create, update, delete, publish, unpublish, webhook-management or credit-spending operation.

The only automated external operations are:

1. `POST /v1/auth/token`
2. `GET /v1/credits/balance`
3. `GET /v1/users?page=1&perPage=1`

After a separate exact preflight confirmation, dev.138 may additionally perform only:

1. `GET /v1/users?page=1&perPage=100`
2. `GET /v1/locations?page=1&perPage=100&search=<operator-supplied search>`
3. `GET /v1/projects/<operator-selected project ID>` when a project is selected
4. `GET /v1/compliances/<permit number>/<company licence number>`

After the dev.139 discovery confirmation, and only when the separate `listings:read` scope is present, the connector may additionally perform:

1. `GET /v1/listings?page=<bounded page>&perPage=<1 to 100>`

The PF listing response is sanitized before it reaches the browser. Owner/contact fields and media URLs are not returned. A separately confirmed import writes only to CORE through the existing Draft intake boundary and makes no PF request.

The selected user and location must appear in the returned read-only result. No user, permit, company or upstream response detail is returned or stored.

The CRM response reports the numeric total, remaining and used credit figures when Property Finder supplies them, and reports only the number of user rows returned. It never returns user records, access tokens, API credentials or upstream error bodies.

## CRM-Test environment variables

Store these values in the CRM-Test server environment. Do not place real values in `.env`, source control, screenshots, tickets, chat or deployment artifacts.

```text
NYSA_DEPLOYMENT_ENV=crm_test
PROPERTY_FINDER_ENVIRONMENT=sandbox
PROPERTY_FINDER_API_BASE_URL=https://sandbox.atlas.propertyfinder.com
PROPERTY_FINDER_SANDBOX_API_KEY=<40-character sandbox API key>
PROPERTY_FINDER_SANDBOX_API_SECRET=<32-character sandbox API secret>
PROPERTY_FINDER_SANDBOX_EXPIRES_AT=2026-09-03T11:25:00.000Z
PROPERTY_FINDER_API_SCOPES=users:read,listings:read,credits:read,compliances:read,listing_verification:full_access,locations:read,projects:read,webhooks:full_access
PROPERTY_FINDER_TIMEOUT_MS=15000
PROPERTY_FINDER_REQUESTS_PER_MINUTE=60
PROPERTY_FINDER_SANDBOX_ENABLED=1
PROPERTY_FINDER_ALLOW_READS=1
```

PF-to-CORE listing import uses a separate read-only sandbox credential so the existing export/preflight credential is not replaced:

```text
PROPERTY_FINDER_LISTING_IMPORT_API_KEY=<40-character sandbox API key>
PROPERTY_FINDER_LISTING_IMPORT_API_SECRET=<32-character sandbox API secret>
PROPERTY_FINDER_LISTING_IMPORT_EXPIRES_AT=<ISO-8601 expiry instant>
PROPERTY_FINDER_LISTING_IMPORT_API_SCOPES=users:read,listings:read,leads:read,credits:read
PROPERTY_FINDER_LISTING_IMPORT_ALLOW_READS=0
```

`leads:read` is reserved for the later governed PF-enquiry ingestion increment. dev.139 performs no Lead API call.

The expiry shown above corresponds to 3 September 2026 at 3:25 PM Asia/Dubai. Confirm the exact time shown in Property Finder before using it. Once expired, the connector refuses network access.

## Safe operating procedure

1. Add the variables only to the CRM-Test server's protected environment.
2. Restart CRM-Test through the ordinary approved operations process. This source increment does not deploy or restart it.
3. Sign in as a user whose `role` and `job_role` are both `admin`.
4. Read `GET /api/integrations/property-finder/sandbox/status`. Do not proceed unless `networkReady` is `true`.
5. When ready to make the external sandbox read, send:

```http
POST /api/integrations/property-finder/sandbox/verify
Content-Type: application/json

{"confirmation":"VERIFY_PROPERTY_FINDER_SANDBOX"}
```

The verification writes a privacy-minimised internal audit event against the initiating governed Broker record. It does not store the token, credentials, user details or Property Finder response body.

## Automated versus manual

Automated:

- exact-host rejection, including the production PF host and lookalike hosts;
- CRM-Test deployment identity and sandbox-environment enforcement;
- credential length, expiry, scope, timeout and 60-request/minute configuration checks;
- an in-process outbound request ceiling using the configured maximum;
- disabled-by-default and separate read-enable gates;
- token exchange, credit-balance read and minimal users read;
- token response validation and in-memory caching;
- response and upstream-error redaction;
- administrator and exact-confirmation route controls;
- proof that no external write/publication operation exists in this connector.
- an exact-confirmation, full-administrator-only Dubai listing preflight from one explicitly selected, visibly tagged test Inventory;
- revalidation of the current immutable portal preparation, internal permit reconciliation, active marketing authority and selected approved media;
- PF public-profile, manually selected location, optional project and compliance resolution through the sandbox read allowlist;
- exact in-memory payload construction under mapping `property-finder-enterprise-api-1.0.1-dev.138`, stable SHA-256 hashing and a business-readable no-send preview;
- privacy-minimised audit evidence containing IDs, readiness, mapping version and hash, but no payload, media URL, credential or PF response.
- read-only, bounded PF listing discovery with linked/possible-duplicate/unmatched preview;
- short-lived signed review tokens and explicit selected import into one blocked Internal Inventory Draft;
- commit-time duplicate revalidation with no silent overwrite, verification, activation, publication, owner/contact or media import.

Manual/operational:

- enter and protect the real sandbox key and secret in the CRM-Test environment;
- confirm the sandbox expiry instant and rotate the sandbox credentials before expiry;
- deploy/restart CRM-Test under the separate approved procedure;
- invoke the verification after reviewing the status response;
- visually compare the reported remaining credits with the Property Finder sandbox screen;
- confirm expected user visibility in the Property Finder sandbox without copying user details into evidence.
- choose a dedicated Inventory whose reference or headline contains a visible non-private UAT tag;
- select its current immutable Property Finder preparation and approved media UUIDs explicitly;
- create temporary HTTPS delivery URLs that remain usable for at least seven days, verify image dimensions and colour space, and do not paste those URLs into tickets or evidence;
- manually choose the PF public profile, location and optional project, then run the preflight with the exact `PREFLIGHT_PROPERTY_FINDER_SANDBOX` confirmation;
- review the dry-run summary and exact payload on screen. A ready result is not approval to create or publish a listing.

Still not implemented:

- listing draft creation, update, deletion, publication or unpublication;
- publication price lookup, credit approval or credit spending;
- listing-verification or webhook operations;
- scheduled synchronisation or retry;
- any Production or R2 integration.
