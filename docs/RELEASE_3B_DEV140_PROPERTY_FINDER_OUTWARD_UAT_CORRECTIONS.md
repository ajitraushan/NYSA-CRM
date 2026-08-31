# Release 3B dev.140 — Property Finder outward UAT corrections

## Scope and safety boundary

This increment prepares Property Finder listing data for business review in CRM Test. It does not create, update, delete, publish, or unpublish a Property Finder listing. It does not register webhooks or spend Property Finder credits. Property Finder reads remain disabled by default and require the existing explicit sandbox-read confirmation.

Production and R2 are outside this increment.

## UAT corrections

- Retains the selected Inventory and portal after an immutable preparation draft is created.
- Explains that Dubai compliance is `RERA`; Trakheesi is the Dubai permit service, not the payload compliance value.
- Treats the visible CORE area/community as search context only. A valid Property Finder location must be selected from the Property Finder locations result before preflight.
- Requires the publishing agent to resolve to a Property Finder `publicProfile.id` from the Users read result.
- Keeps the property/permit reference synchronized between preparation and permit evidence instead of asking the operator to invent it twice.
- Adds the required Dubai permit category (`property` or `project`) to compliance reconciliation.
- Makes the regulatory advertised price optional. If the permit evidence does not state a price, the operator must leave it blank rather than infer one.
- After permit evidence is saved, creates a new immutable preparation revision so readiness is recalculated.
- Adds a direct path from the external-listing workspace to Inventory property media.
- Supports an optional HTTPS YouTube listing-video URL and an optional credential-free HTTPS 360-tour URL.

## Enforced Property Finder image preflight

Only approved Inventory media are eligible. The no-send preflight blocks unless every selected image satisfies:

- JPEG, PNG, or WebP;
- 5 KB through 15 MB;
- at least 800 × 600 pixels and no more than 1920 × 1080 pixels;
- landscape aspect ratio from 1.3 through 1.8;
- RGB, sRGB, or Adobe RGB colour space; CMYK is rejected;
- a unique file hash, so duplicate images are rejected;
- an HTTPS delivery URL that remains valid for at least seven days;
- no more than 30 images.

The minimum image count is property-specific. Residential requirements are 4 for studio, 5 for one bedroom, 6 for two bedrooms, 8 for three bedrooms, and 10 for four or more bedrooms. Commercial listings require 5 or 10 depending on type. Unknown residential bedroom counts are conservatively blocked unless 10 compliant images are present.

These are preflight gates, not an image-editing service: media must first be uploaded and approved in Inventory.

## Operator flow for the next CRM Test UAT

1. Open Inventory and add/approve compliant property media.
2. Open External portal listing and select the approved tagged test Inventory.
3. Enter the advertising fields; add YouTube/360 URLs only if available.
4. Create the immutable preparation draft.
5. Confirm internal authority and save permit evidence. Do not invent a permit price.
6. If controlled sandbox reads are enabled and explicitly confirmed, resolve the Property Finder public profile, location, optional project, and compliance record.
7. Build and review the no-send Property Finder preview, including the exact versioned payload and deterministic hash.

## Remaining manual work

- Repeat the outward UAT in CRM Test after dev.140 is separately approved for deployment.
- Confirm the selected sandbox user has the intended public profile and the selected location/project values are accepted by Property Finder reads.
- Use actual approved Inventory media to validate metadata and URL lifetime at runtime.
- Obtain and approve a separate write/publication design before any Property Finder listing write is enabled.

## Recorded next increment: in-CORE media preparation

Add an operator-controlled utility inside Inventory media that can create a portal-ready derivative without overwriting the original. The utility should resize and re-encode supported images, convert CMYK to sRGB, optimize file size, detect duplicates, report when a low-resolution source cannot be safely improved, and show a before/after preview.

The same utility should support an optional governed NYSA watermark. An authorized operator can choose the approved watermark asset, position, scale and opacity, preview the result, and apply it only to the new derivative. The original image must remain unchanged. Watermark settings and the source/derived file hashes should be retained as audit evidence. The utility must warn or block when watermark placement would obscure material property details or breach the active portal's media rules.

A derived image must remain unapproved until an authorized user accepts it; no automatic alteration, watermarking or portal publication is implied.
