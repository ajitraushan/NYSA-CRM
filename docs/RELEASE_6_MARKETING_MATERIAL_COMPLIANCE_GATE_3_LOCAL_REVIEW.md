# Release 6 - Marketing Material Compliance - Gate 3 Local Review

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** Gate 3 owner-approved; Gate 4 local completion authorized  
**Review URL:** `http://127.0.0.1:3239/`  
**Migration:** `091_release6_marketing_material_compliance.sql` - created locally and unapplied

## Implemented package

- Versioned material types and channel/region rules maintained directly by full Admin without
  maker-checker.
- No active legal, RERA, permit or disclosure policy is seeded by migration.
- One stable Marketing Material with immutable submitted versions and frozen Inventory, Campaign,
  final Document Version, copy, disclosures, dates and dependency fingerprints.
- Approved Property Media links retain exact rights and expiry evidence.
- Applicable Inventory permit snapshots and verified Release 4 official evidence can be reused
  without creating another permit or document register.
- Preflight blocks missing/inactive rules, mutable final files, missing listing/campaign, unapproved or
  expired media rights, missing configured disclosures and missing configured permit/evidence.
- Each requested channel has its own assigned Manager or Director, decision and current release
  eligibility.
- Manager approval is limited to the assigned managed team/listing. Director approval is
  organization-wide when assigned. Full Admin retains a separately audited direct exception.
- Manager/Director self-approval is prohibited.
- Submission creates a dedicated Task in the selected approver's existing My Task Queue without a
  synthetic Lead or Contact.
- Generic Task completion cannot approve or release marketing material.
- Approval, partial approval, return and rejection aggregate correctly across channels.
- Effective release end is the earliest applicable requested end, default validity, Campaign end,
  media-rights expiry, Inventory permit expiry or official-evidence expiry.
- Current dependency change produces `stale`; a future start produces `scheduled`; elapsed validity
  produces `expired`. Original approval evidence remains immutable.
- Staff UI includes Admin configuration, creation/upload, approved-media selection, channel/approver
  selection, preflight/submit, register, Task review and channel decision drill-down.
- Actual publishing, sending, portal synchronization and external verification do not exist in this
  package.

## Synthetic review journey

The loopback-only review presents five owner checkpoints:

1. **Create material:** Agent freezes one property social creative, its final file, media, disclosures,
   release window and separate Instagram/print approvers.
2. **Manager - My Task Queue:** team/listing-scoped channel approval with frozen content and current
   dependency evidence.
3. **Director - My Task Queue:** organization-wide channel approval through the same governed queue.
4. **Release register:** Manager-approved Instagram is released for use while Director-approved print
   can become stale without erasing its approval.
5. **Administration:** direct Admin type/rule activation with no assumed legal policy.

All displayed names, references, files, dates, properties and decisions are synthetic.

## Verification

- Focused Marketing Material Compliance tests: **33/33 passed**.
- Complete local repository suite: **949/949 passed**.
- JavaScript syntax checks passed for domain, routes, Task integration, server, bootstrap, staff UI
  and local review assets.
- Local HTTP smoke passed: GET `200`, mutation attempt `405`, synthetic marker present and CSP contains
  `connect-src 'none'`.
- `git diff --check` passed for modified tracked integration files.
- Migration `091` was not applied. No database, external API, external environment or private real
  record was accessed.

## Owner review points

1. Full Admin can define material types and channel rules directly.
2. The Agent creation form captures the complete marketing item rather than approving media again.
3. Both Manager and Director can be selected as approvers within their agreed scopes.
4. Each channel is independently approved, returned or rejected.
5. My Task Queue supplies the exact governed review action and cannot bypass it through generic Task
   completion.
6. The release register clearly separates historical approval from current release eligibility.
7. Earliest dependency expiry and stale-source handling are understandable.
8. No action claims to publish, send, verify externally or certify legal compliance.

The NYSA owner approved Gate 3 on 14 August 2026 by directing the work to proceed. This authorizes
Gate 4 local completion documentation only. It does not apply migration `091`, deploy, package,
restart a shared server, publish material, access an external service or begin any portal work.
