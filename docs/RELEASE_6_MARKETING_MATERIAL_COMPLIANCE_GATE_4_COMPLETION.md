# Release 6 - Marketing Material Compliance

**Gate:** 4 - local completion  
**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** locally complete; owner-approved; migration unapplied  
**Migration:** `091_release6_marketing_material_compliance.sql`

## Completion decision

The NYSA owner approved the Gate 3 local review and directed the work to proceed on 14 August 2026.
Marketing Material Compliance is therefore complete at its authorized local/offline boundary.

This record does not authorize migration application, packaging, deployment, restart, external
connection, publication, transmission or production use.

## Completed functional boundary

- A stable Marketing Material retains immutable submitted versions containing the exact Inventory,
  Campaign, final Document Version, copy, disclosures, dates and dependency fingerprints reviewed.
- Full Administrator directly maintains versioned material types and channel/region rules without
  maker-checker. No legal, RERA, permit or disclosure rule is seeded by assumption.
- Approved Property Media retains exact rights and expiry evidence. Applicable Inventory permit
  snapshots and verified Release 4 official evidence are reused rather than duplicated.
- Preflight fails closed for inactive or missing rules, mutable final files, missing Inventory or
  Campaign evidence, invalid media rights, configured disclosure gaps and configured permit/evidence
  gaps.
- Each requested channel has a separately assigned Manager or Director decision. Manager authority
  is limited to the managed team/listing; Director authority is organization-wide when assigned.
- Manager and Director self-approval is prohibited. A full Administrator retains a separately audited
  direct exception.
- Submission creates a dedicated review Task in the selected approver's existing My Task Queue.
  Generic Task completion cannot approve or release the material.
- Approval, partial approval, return and rejection aggregate across channels without erasing the
  underlying channel decisions.
- Current release eligibility distinguishes scheduled, released, stale and expired state while
  preserving immutable approval history.
- Effective release end uses the earliest configured/requested or dependency expiry.
- No publishing, sending, portal synchronization, external permit verification or legal certification
  is performed or claimed.

## Verification baseline

- Focused Marketing Material Compliance tests: **33/33 passed**.
- Complete local repository suite: **949/949 passed**.
- JavaScript syntax checks passed across domain, routes, Task integration, server, bootstrap, staff UI
  and local review assets.
- Synthetic owner-review surface passed HTTP smoke: GET `200`, mutation attempt `405`, synthetic
  marker present and outbound connections blocked by CSP.
- Migration `091` remains deliberately unapplied.

## Local artifacts

- Migration: `src/migrations/091_release6_marketing_material_compliance.sql`
- Domain: `src/marketing-material-compliance-domain.js`
- Authenticated routes: `src/routes/marketing-material-compliance.js`
- CRM UI: `public/marketing-material-compliance-ui.js`
- Synthetic review: `tools/marketing-material-compliance-local/`
- Tests:
  - `test/marketing-material-compliance-domain.test.js`
  - `test/marketing-material-compliance-integration.test.js`

## Promotion boundary

A future promotion requires separate authorization, environment-specific migration review,
backup/rollback planning, approved legal/compliance configuration, deployment packaging, CRM Test
verification and user acceptance. None of those actions is included in this completion record.

No CRM Test, Production, R2, cPanel, Property Finder or external service was accessed or changed.
No credential or private owner/contact/authority information was requested, stored or displayed.
