# Release 3B — Property Finder Enterprise API 1.0.1 Mapping

Source reviewed: the authenticated PF Expert **API Documentation** screen on 4 August 2026. This mapping is based on Property Finder Enterprise API version `1.0.1`.

No API key or secret was read, copied, generated or stored during the review.

## Connection contract

- Base gateway: `https://atlas.propertyfinder.com`
- Token: `POST /v1/auth/token`
- Authentication: OAuth 2.0 API key and API secret exchanged for a Bearer JWT
- Token lifetime: 30 minutes; no refresh-token flow
- API keys: scope-bound, immutable after creation, and valid for no more than 365 days
- Listing write scope: `listings:full_access`
- Listing read scope: `listings:read`
- Server-to-server use only; credentials must never be exposed to the browser
- Default limits: 60 token requests/minute and 650 other requests/minute, per client/IP, with incremental backoff and jitter after `429`

## Required UAE publication fields

| PF target | Rule | CORE source |
|---|---|---|
| `compliance` | Required for Dubai and Abu Dhabi | Portal preparation plus Internal Inventory permit |
| `compliance.listingAdvertisementNumber` | Required for Dubai and Abu Dhabi | `listings.permit_number` |
| `compliance.type` | Required for Dubai and Abu Dhabi | `portal_fields.complianceType` |
| `category` | Always; `residential` or `commercial` | `portal_fields.propertyCategory` |
| `type` | Always | governed `listings.property_type` mapping |
| `furnishingType` | Always | `portal_fields.furnishingType` |
| `media.images.original` | Always | approved, rights-cleared Property Media HTTPS URLs |
| `price` | Always | constructed price object |
| `price.type` | Always | `portal_fields.offeringType`; Sale maps to `sale`, Rent needs the governed rental frequency |
| `price.amounts.<type>` | Always for the selected price type | `portal_fields.publicationPrice` |
| `downPayment` | Required for Sale | `portal_fields.downPayment` |
| `location.id` | Always | PF location ID resolved through `GET /v1/locations` |
| `uaeEmirate` | Always | `portal_fields.uaeEmirate` |
| `reference` | Always and unique | immutable CORE Inventory reference plus governed publication revision where needed |
| `bathrooms` | Required except Land or Farm | Inventory/portal preparation governed value |
| `title.en` | Always | `portal_fields.publicationTitle` |
| `description.en` | Always | `portal_fields.publicationDescription` |
| `size` | Always | `listings.size_sqft`; for UAE Villa/Townhouse/Bungalow it represents plot size |
| `builtUpArea` | UAE Villa/Townhouse/Bungalow interior area | separate governed built-up-area mapping when available |
| `hasParkingSpace` | Required for co-working-space | governed portal preparation when applicable |

Property Finder treats Land and Farm as listing `type` values, not a third `category`.

## Agent and location identities

- `assignedTo.id` and `createdBy.id` are Property Finder public-profile IDs, not email addresses or CORE broker UUIDs.
- CORE must resolve and retain these through the PF Users API before transmission.
- `location.id` is a Property Finder location identifier. A free-text area path is preparation evidence only and cannot be sent as the authoritative ID.
- PF project identifiers should be resolved with `GET /v1/projects/{id}` where applicable.

## Media contract

- Types: JPEG/JPG, PNG or WebP
- Size: 5 KB to 15 MB per image
- Colour: RGB/sRGB/Adobe RGB; CMYK is unsupported
- Recommended landscape ratio: 16:9 or 4:3
- Maximum resolution: 1920×1080; larger images are resized
- Source must be an HTTPS public or signed URL available for at least seven days
- Production delivery should use durable object storage/CDN and allow the PF egress addresses maintained in the official specification

CORE must generate connector URLs only at transmission time. Permanent public media URLs are not stored as Internal Inventory evidence.

## Governed connector sequence

1. Obtain a server-side token.
2. Resolve PF public-profile IDs for the responsible publishing agent.
3. Resolve the PF location and optional project identifiers.
4. Validate permit/compliance using `GET /v1/compliances/{permitNumber}/{licenseNumber}`.
5. Revalidate current Inventory, verification, authority, permit and media rights.
6. Build and hash the exact payload from the approved preparation and active mapping version.
7. Create the remote draft with `POST /v1/listings`.
8. Persist the PF listing ID and full response evidence.
9. Run listing eligibility/verification where required.
10. Obtain the publish price, request explicit governed approval for credit use, then call `POST /v1/listings/{id}/publish`.
11. Reconcile `listing.published`, `listing.unpublished`, `listing.action` and `listing.publishFailed` webhooks.

Creating a PF draft and publishing it are deliberately separate controlled actions.

## Supported lifecycle endpoints

- Create: `POST /v1/listings`
- Search: `GET /v1/listings`
- Replace/update: `PUT /v1/listings/{id}`
- Delete: `DELETE /v1/listings/{id}`
- Publish: `POST /v1/listings/{id}/publish`
- Unpublish: `POST /v1/listings/{id}/unpublish`
- Publish-price check: `GET /v1/listings/{id}/publish/prices`
- Eligibility check: `POST /v1/listing-verifications/eligibility-check`
- Verification submission/resubmission: `/v1/listing-verifications`
- Webhooks: `/v1/webhooks`

## dev.138 preflight boundary

CRM Test can now resolve an explicitly selected PF public profile, manually selected location, optional project and Dubai compliance record through the sandbox read allowlist. It then revalidates one visibly tagged test Inventory and its current immutable preparation, permit reconciliation, marketing authority and selected media before building the exact in-memory payload under mapping `property-finder-enterprise-api-1.0.1-dev.138`.

The response is a no-send dry-run with deterministic SHA-256 hash. No payload or upstream record is persisted, and no listing, publication, webhook or credit operation exists in the connector.

## dev.139 listing-import boundary

With a separately approved `listings:read` scope, CRM Test can discover a bounded page of agency-owned PF sandbox listings. CORE sanitizes the response, withholds owner/contact data and media URLs, compares external IDs and references with Internal Inventory, and issues a short-lived signed review token only for an unmatched candidate.

An explicitly confirmed selected import uses the existing provider-neutral intake to create one blocked Internal Inventory Draft. The external ID and mapping version are retained as provenance. Existing or possible duplicate records are reconciled/reviewed and never overwritten. No PF write occurs during import.

## Still intentionally not implemented

- credential creation or storage in source or the database
- Production token requests
- user/location/project synchronization or persistence (dev.138 resolves only operator-selected sandbox records for one confirmed dry run)
- scheduled or bidirectional listing synchronization, bulk import, media copying and deletion propagation (dev.139 is bounded discovery plus selected Draft import only)
- payload transmission
- publish-credit approval and charging

The CRM-Test-only safe authentication, credit-balance read and minimal users-read probe are documented in `RELEASE_3B_PROPERTY_FINDER_SANDBOX_CONNECTOR.md`. They are disabled by default and expose no write or publication operation.
- webhook endpoint and signature verification
- automatic retries or remote deletion

Those require a separately authorised connector increment and isolated sandbox UAT.
