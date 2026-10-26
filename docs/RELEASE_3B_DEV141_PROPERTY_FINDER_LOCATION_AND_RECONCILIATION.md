# Release 3B dev.141 — Property Finder location and listing reconciliation

## Purpose and boundary

This CRM-Test increment improves Property Finder outward-listing preparation without transmitting or changing a listing. It is restricted to the Property Finder sandbox and governed read-only operations.

- External reads remain disabled by default.
- Every controlled location or listing read requires explicit confirmation.
- No Property Finder create, update, delete, publish or unpublish operation exists in this increment.
- No webhook is registered or changed.
- No credits are spent.
- No ordinary CORE business record is changed by a read or comparison.
- Production and R2 are outside scope.

## PF location selection

The outward-listing form now searches the sandbox with `GET /v1/locations` under `locations:read`. The operator enters at least two characters, explicitly confirms the external read, and then selects the exact returned PF hierarchy from a dropdown.

The selected PF location ID is not trusted merely because it appeared in the browser. The existing preflight resolves it again against the sandbox before constructing the deterministic payload. A missing, changed or unrecognised location blocks readiness.

## PF versus CORE comparison

The governed listing-discovery preview continues to use `GET /v1/listings` under `listings:read`. If a PF listing is already linked to a CORE Inventory reference, the preview compares selected non-private business fields:

- project
- property type
- bedrooms
- size
- price and currency
- location/community label

The result is business-readable and includes a deterministic comparison hash. Differences require review; they are never silently accepted and do not overwrite either system. A no-change result is also explicit.

This is polling-based reconciliation. Although the sandbox currently exposes `webhooks:full_access`, dev.141 does not use it, and no webhook subscription is registered. The available webhook event set must be validated separately before it can be relied on for general PF listing-change detection.

## Least-privilege sandbox scopes

The connector readiness profile now reflects the confirmed read-oriented sandbox scopes: `users:read`, `listings:read`, `credits:read`, `compliances:read`, `listing_verification:full_access`, `locations:read`, `projects:read` and `webhooks:full_access`.

Possession of a powerful scope does not authorise CORE to exercise it. dev.141 uses location and listing reads only. Listing writes remain unavailable because `listings:full_access` is absent.

## Manual CRM-Test UAT still required

1. Configure the new sandbox credential securely in CRM Test without sending it through chat, logs or source control.
2. Confirm the configured scope list and expiry in the connector status screen.
3. Temporarily enable governed sandbox reads for the UAT window only.
4. Search a familiar Dubai location, select the exact PF hierarchy, and run outward preflight on tagged test Inventory.
5. Run governed listing discovery and review any linked PF-versus-CORE differences.
6. Confirm the audit evidence reports external reads only, zero credits and zero ordinary-record changes.
7. Disable sandbox reads immediately after evidence capture.

Deployment, credential configuration and live sandbox UAT are separate explicitly authorised steps. dev.141 is not a publication increment.
