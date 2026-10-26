# Release 3B dev.120 — Inventory import blocker corrections

## Confirmed CRM Test defects

| Requirement ID | Confirmed dev.119 result | Corrected outcome |
|---|---|---|
| `R3B-INVENTORY-ID-56` | Excel-created Inventory did not expose its normal CORE business reference in the import result, register, detail or search. | Every accepted row must receive and return `NYSA-INV-######`; import is atomic and fails if the reference is blank. The reference is displayed and searchable. |
| `R3B-INVENTORY-CUSTODY-57` | Excel correctly recorded the originating and responsible agents, but Draft working authority remained with the technical uploader. Reassignment changed the label without transferring the ability to maintain or submit. | The current responsible agent may maintain the Draft and submit it for verification. Reassignment transfers that authority while preserving the immutable origin, uploader audit and assignment history. |
| `R3B-INVENTORY-VERIFY-SUBMIT-58` | The prompt-based submission gave no durable result. A later submission did become Pending, but was scoped to the technical Excel uploader's team and therefore remained absent from the responsible agent's Manager queue. | A visible form shows persistent success or exact failure. Pending queue, Immediate Attention and decision scope now follow the current responsible agent's maintained team. Availability remains outside this gate. |

## Preserved controls

- Excel import creates Draft Internal Inventory only.
- Owner or represented-party and internal-use authority evidence remain mandatory before verification submission.
- Availability confirmation and seven-day freshness are not required for Manager verification, but remain required for matching and downstream viewing/booking commitments.
- The current responsible agent may submit, but the submitter cannot decide the same request.
- Manager verification remains required; no upload or submission activates Inventory automatically.
- No Property Match, reservation, availability guarantee, customer message or external portal publication is created.
- External Portal Listings Manager field visibility remains a separately recorded, non-import correction.

## Focused UAT

1. Import a valid Excel row where Listing Exe uploads and ajitr is the originating/responsible agent.
2. Confirm the completion result lists the generated `NYSA-INV-######` and opens the exact Draft.
3. Confirm the same ID appears on the Inventory card and detail and can be found using Search.
4. As ajitr, maintain the Draft, save owner/source authority and submit the visible verification form without an availability date.
5. Confirm the form displays a Pending request ID, the Inventory becomes Pending and the submit action disappears.
6. As the responsible Manager, confirm the exact Inventory ID appears in the verification queue and complete the decision.
7. Confirm ajitr cannot decide the request they submitted.
8. Reassign a different Draft and confirm the new responsible agent gains maintenance/submission authority while the former responsible agent loses it.

## Dev.121 follow-up: R3B-INVENTORY-VERIFY-59

CRM Test dev.120 proved that a request could be Pending and still remain absent when the Manager relationship was maintained through an active `user_role_assignments` record. Manager dashboard hierarchy already recognized that authority source, but the verification queue and decision scope did not. Dev.121 aligns queue, Immediate Attention and decision authority with all three maintained Manager sources: team manager, active team membership and active Manager role assignment. An authorized Manager can also record the decision directly from a searched Pending Inventory detail; the server still enforces scope and prevents the submitter deciding their own request.
