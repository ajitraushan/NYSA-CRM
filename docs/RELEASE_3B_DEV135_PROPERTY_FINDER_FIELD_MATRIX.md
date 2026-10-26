# Release 3B dev.135 — Property Finder preparation and privacy matrix

Contract evidence: authenticated Property Finder Enterprise API v1.0.1 `POST /v1/listings`, reviewed 4 August 2026. Property Finder quality guidance reviewed the same day states a 30–50 character title and 750–2,000 character description. CORE performs preparation only; this increment makes no API call and stores no portal credentials.

| CORE UI field | Source of truth | Classification | PF destination | Requirement / condition | Privacy rule |
|---|---|---|---|---|---|
| Approved Internal Inventory | CORE Inventory | Internal only | None | Required to establish posting context | Inventory selection is never transmitted as an internal database identifier |
| Portal / channel | User selection | Internal routing | Connector selection only | Required | No credential or call is created |
| Deal type | Posting preparation, reconciled to permit | Outbound | `price.type` and matching `price.amounts.*` | Required | No private data |
| UAE emirate | Posting preparation | Outbound | `uaeEmirate` | Required | No private data |
| Property category | Posting preparation | Outbound | `category` | Required | Residential or commercial only |
| Property type | Deterministic mapping from Internal Inventory | Outbound | `type` | Required; governed PF enum including apartment, villa and townhouse | Cannot be free text; readiness blocks a mismatch |
| Furnishing type | Posting preparation | Outbound | `furnishingType` | Required | Governed PF enum |
| Bathrooms | Posting preparation | Outbound | `bathrooms` | Required except Land or Farm | Governed PF value at connector stage |
| Asking price | Posting preparation, reconciled to permit | Outbound | `price.amounts.sale/yearly/...` | Required | Must reconcile with regulated evidence |
| Sale down-payment | Posting preparation | Outbound | `price.downpayment` | Required for Sale | No private data |
| Currency | Posting preparation, reconciled to permit | Outbound transform | Connector currency context | Required in CORE | Three-letter code |
| Portal location | Approved portal/DLD mapping | Outbound | `location.id` | Required | No owner address/contact |
| Property reference | Permit/property source | Outbound | `reference` | Required and unique in PF | Property reference only; never an owner identifier |
| Publishing agent reference | Governed portal public profile | Outbound | `assignedTo.id` / `createdBy.id` | Required by CORE mapping | Only portal-recognised professional/public profile identity |
| Advertising title | User enters once | Outbound | `title.en` | Required; 30–50 characters under current PF quality guidance | ASCII/no emoji/HTML validation for this English field |
| Advertising description | User enters once and it is frozen with permit evidence | Outbound | `description.en` | Required; 750–2,000 characters under current PF quality guidance | No phone numbers or owner contact; later edits require reconciliation |
| Compliance type | Posting/permit evidence | Outbound | `compliance.type` | Required for Dubai and Abu Dhabi | Governed enum |
| Permit number | Immutable permit evidence | Outbound | `compliance.listingAdvertisementNumber` | Required for Dubai and Abu Dhabi | Permit identifier only |
| Real Estate Company licence number | Immutable permit evidence | Outbound | `compliance.issuingClientLicenseNumber` | Used for DLD compliance lookup | Brokerage licence only, not owner identity |
| Permit PDF/JPG/PNG | Immutable private evidence | Internal only | None | Required by CORE governance | Private storage; never included in listing payload |
| Permit property type/location/price/purpose | User records governed permit facts; file retained | Internal reconciliation | Corresponding listing fields, not separate document fields | Required for pre-submission reconciliation | No private party data |
| Internal marketing authority | Existing active Inventory agreement | Internal only | None | Required by CORE governance before readiness | Auto-resolved; agreement and evidence are never transmitted |
| Owner / represented party | Internal Inventory | Internal only | None | Not requested on the portal-preparation screen | Name, contact and identity are never emitted in an outbound payload; optional PF `ownerName` is deliberately omitted |
| Authority evidence reference/document | Internal Inventory agreement | Internal only | None | Retained for audit | Never transmitted or exposed on the portal-preparation screen |
| Preparation evidence reference | Generated preparation UUID/hash | Internal only | None | Automatic | No manual entry and no outbound mapping |
| Business purpose/reason | Derived fixed audit statement | Internal only | None | Automatic | Never transmitted |
| Approved media | Rights-cleared CORE media | Future outbound | `media.images.original` | Required before publish readiness | Only approved property media; no private evidence documents |

## Business boundary

Trakheesi/RERA proves regulatory advertising permission; an active internal marketing-authority record proves NYSA's governed authority. They are separate controls. CORE auto-resolves the internal authority record without showing or transmitting the owner, agreement or authority evidence. The portal permit file remains private evidence. Only the permit number and company licence are potential compliance payload fields.
