# Release 3B — External Portal Preparation and ETL Mapping

Requirement IDs:

- `R3B-PORTAL-POSTING-75` — start from the Portal Posting workspace, select approved Internal Inventory, and prepare a separate external-listing record.
- `R3B-PORTAL-ETL-MAPPING-76` — maintain versioned, testable source-to-target mappings without embedding portal-specific connector assumptions in Internal Inventory.

## Business boundary

Internal Inventory remains the governed record of the property, its NYSA custodian, owner-side evidence, verification and operational availability. External Portal Listing is a child record used only when NYSA intends to advertise that Inventory.

Creating or revising a portal preparation does not transmit, publish, reserve or guarantee the property. A connector may be enabled only after NYSA has the official partner specification, credentials, sandbox evidence and an approved active mapping version.

## Portal Posting flow

1. Open **External Portal Listings**.
2. Select approved and verified Internal Inventory.
3. Choose the target portal and complete the common advertising fields.
4. Record marketing-publication authority and the applicable RERA, Trakheesi or Madhmoun permit.
5. CORE freezes the source Inventory snapshot, entered portal fields, readiness results, mapping version and SHA-256 payload hash.
6. A Manager reviews the preparation. No outbound action exists in this increment.
7. When an official connector is supplied, Administrators create, test, approve and activate its ETL mapping version before any transmission capability is built.

## Field ownership

Inherited from Internal Inventory:

- CORE Inventory reference
- property type, project/developer and maintained location facts
- bedrooms, size and handover/project status
- current Inventory status and verification status
- owner-side marketing authority evidence
- rights-cleared, approved property media
- permit number and expiry

Entered in Portal Posting:

- target portal, Sale/Rent price type and UAE emirate
- residential/commercial category; Land and Farm remain property types
- furnishing type and bathrooms where applicable
- portal asking price and currency
- sale down-payment and compliance type where applicable
- portal-recognised location ID or maintained location path
- portal-recognised publishing-agent reference
- advertising title and description
- conditional Bayut off-plan New/Resale values
- preparation evidence reference and business reason

At least one approved, rights-cleared photograph is required by the Property Finder Enterprise API payload. A higher photo-count target may still be maintained separately as a NYSA quality policy; it must not be misrepresented as the connector's universal technical minimum.

## ETL mapping governance

Each mapping version records:

- portal and version code
- official specification reference
- CORE source field
- connector target field or path
- required, conditional or optional classification
- transformation and condition rules
- Draft, Tested, Approved, Active and Retired evidence

Only one mapping version may be Active for a portal. Existing immutable preparations retain the mapping version and payload hash they used.

## Connector gaps intentionally left open

- exact outbound Property Finder endpoint/schema and authentication contract
- exact Bayut/Dubizzle outbound XML/API schema and authentication contract
- portal enumerations and location/project identifiers
- media upload order, limits and image transformation rules
- permit-validation response handling
- publish/update/unpublish callbacks, retries and reconciliation
- rate limits, idempotency keys, error codes and webhook signatures

These are configuration and connector-contract gaps, not reasons to mix portal fields back into Internal Inventory.

## UAT

1. Open Portal Posting and verify only approved, verified Inventory in scope is selectable.
2. Select Inventory and confirm inherited facts and readiness are shown.
3. Complete the mandatory portal fields and create a preparation.
4. Confirm the revision, readiness checks and SHA-256 hash are retained.
5. Confirm missing authority, permit, five approved rights-cleared photos, or an unavailable Inventory blocks submission.
6. Confirm no action contacts Property Finder, Bayut or Dubizzle.
7. As Administrator, create a Draft mapping, add source-to-target entries and verify lifecycle evidence is required.
8. Confirm a mapping cannot become Tested, Approved or Active without mappings and evidence.
