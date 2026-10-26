# Release 6 - Marketing Material Compliance - Gate 2 Migration/API Contract

**Date:** 14 August 2026 (Asia/Dubai)  
**Status:** Gate 2 owner-approved; local Gate 3 implementation authorized but not started  
**Scope:** local/offline contract only; no implementation started  
**Proposed migration:** `091_release6_marketing_material_compliance.sql` (not created or applied)

## 1. Gate 2 outcome

Define the additive local schema, API, state transitions, approval authority, current release gate,
My Task Queue provenance and acceptance tests for Gate 1. Gate 2 approval will authorize local Gate 3
implementation with synthetic data only.

## 2. Additive schema contract

### 2.1 `marketing_material_types`

Stable identity only:

- `id UUID PRIMARY KEY`
- `stable_code TEXT UNIQUE`, lowercase snake case
- `created_by UUID REFERENCES brokers(id)`
- `created_at TIMESTAMPTZ`

No type is silently activated by migration.

### 2.2 `marketing_material_type_versions`

Immutable versioned Admin configuration:

- identity: `id`, `material_type_id`, `version_number`, `supersedes_version_id`
- presentation: `label`, `description`
- classification: `scope_type IN ('property','corporate','either')`
- state: `status IN ('draft','active','superseded','retired')`
- evidence: `created_by/at`, `activated_by/at`, `retired_by/at`, `retirement_reason`
- uniqueness: `(material_type_id, version_number)`; one active and one draft per type

Only a full Administrator may activate, supersede or retire a type version. Activation is direct and
does not create a maker-checker request.

### 2.3 `marketing_channel_rule_versions`

One immutable Admin rule version per material type, channel and region:

- identity: `id`, `material_type_id`, `material_type_version_id`, `version_number`,
  `supersedes_version_id`
- applicability: `channel_code`, `region_code`
- dependencies: `campaign_required`, `listing_required`, `approved_media_required`,
  `permit_requirement IN ('none','current_inventory_permit','verified_official_evidence','either')`
- disclosure contract: `required_disclosure_codes TEXT[]`
- review route: `approver_route IN ('manager','director','manager_or_director')`
- timing: `default_validity_days`, `expiry_reminder_days INTEGER[]`
- state/evidence: `status`, `created_by/at`, `activated_by/at`, `retired_by/at`,
  `retirement_reason`
- uniqueness: one active rule for `(material_type_id, channel_code, region_code)`

The migration seeds no active legal, RERA, permit or disclosure rule. Full Admin must deliberately
configure and activate applicable NYSA policy.

### 2.4 `marketing_materials`

Stable business identity:

- `id UUID PRIMARY KEY`
- `material_reference TEXT UNIQUE`
- `title TEXT`
- `listing_id UUID NULL REFERENCES listings(id)`
- `campaign_id UUID NULL REFERENCES marketing_campaigns(id)`
- `owner_id UUID REFERENCES brokers(id)`
- `created_by/at`, `updated_at`
- `lifecycle_status IN ('draft','in_review','approved','returned','rejected','withdrawn','retired')`

Property-scoped type rules require `listing_id`. Campaign remains optional unless the applicable
channel rule requires it.

### 2.5 `marketing_material_versions`

Frozen submitted version:

- identity: `id`, `material_id`, `version_number`, `supersedes_version_id`
- configuration: `material_type_version_id`
- frozen context: `listing_id UUID NULL REFERENCES listings(id)`,
  `campaign_id UUID NULL REFERENCES marketing_campaigns(id)`
- final file: `document_version_id UUID REFERENCES document_versions(id)`
- frozen content: `purpose`, `audience`, `region_code`, `headline_snapshot`, `body_copy_snapshot`,
  `disclosure_snapshot JSONB`
- requested window: `requested_release_from`, `requested_release_until`
- integrity: `content_hash CHAR(64)`, `source_context_hash CHAR(64)`, `request_fingerprint CHAR(64)`
- state: `status IN ('draft','submitted','partially_approved','approved','returned','rejected',
  'withdrawn')`
- evidence: `created_by/at`, `submitted_by/at`, `withdrawn_by/at`, `withdrawal_reason`
- uniqueness: `(material_id, version_number)` and submitted `request_fingerprint`

Once submitted, a database trigger rejects DELETE and any UPDATE to frozen content, context,
configuration, file, date or integrity fields. Only the governed lifecycle fields may change through
the transition service. Corrections create a new version.

### 2.6 Dependency links

All submitted dependency links are immutable:

- `marketing_material_media_links(version_id, property_media_id, source_fingerprint,
  captured_rights_expires_at)` with unique `(version_id, property_media_id)`;
- `marketing_material_official_evidence_links(version_id, official_evidence_id,
  requirement_code, source_fingerprint)`;
- `marketing_material_permit_snapshots(version_id, listing_id, permit_reference_hash,
  captured_expires_at, source_fingerprint)`; and
- the version itself contains the final Document Version and its source-context hash.

Permit references are stored as a one-way hash in this package. The current Inventory record remains
the authority for display and current eligibility.

### 2.7 `marketing_material_channel_requests`

One review/release state per requested channel:

- `id`, `version_id`, `rule_version_id`, `channel_code`, `region_code`
- `assigned_approver_role IN ('manager','director')`
- `assigned_approver_id UUID REFERENCES brokers(id)`
- `status IN ('pending','approved','returned','rejected','withdrawn')`
- `requested_release_from`, `requested_release_until`
- `approved_release_until` (calculated upper bound at decision time)
- `current_eligibility IN ('blocked','scheduled','released_for_use','stale','expired','withdrawn')`
- `eligibility_reason_code`, `eligibility_checked_at`
- unique `(version_id, channel_code, region_code)`

`status` records the latest governed review state. `current_eligibility` is separately recalculated
from current dependencies and can never convert a non-approved request into released-for-use.

### 2.8 `marketing_material_review_events`

Append-only decision evidence:

- `id`, `channel_request_id`, `decision IN ('approved','returned','rejected','withdrawn')`
- `reason`, `reviewer_id`, `reviewer_role IN ('manager','director','admin')`, `reviewed_at`
- `effective_release_until`, `dependency_context_hash`, `request_fingerprint`

Return, rejection and withdrawal require a meaningful reason. The submitter cannot review their own
version, except that a full Administrator may exercise the explicit direct-Admin exception; that
exception is written to the audit event.

### 2.9 Tasks and provenance

Migration `091` adds nullable `tasks.marketing_material_version_id` and task types:

- `marketing_material_review`
- `marketing_material_follow_up`

The task context constraint becomes exclusive:

- Leave task: Leave context only;
- Marketing Material task: `marketing_material_version_id` only, no synthetic Lead/Contact; or
- Existing customer task: existing Lead/Contact context.

`marketing_material_task_links` records `task_id`, `version_id`, optional `channel_request_id`,
`reason IN ('review','returned','approaching_expiry','stale')`, cycle, assignee, routing reason,
fingerprint and creation evidence. It is append-only. Completing a Task never records an approval.

### 2.10 Audit and grants

The audit allow-list adds:

- `MarketingMaterialType`
- `MarketingChannelRule`
- `MarketingMaterial`
- `MarketingMaterialVersion`
- `MarketingMaterialReview`
- `MarketingMaterialTaskProvenance`

The application role receives only the table privileges required by the route contract. Submitted
versions, dependency links, review events and task provenance are INSERT/SELECT only and protected by
immutable triggers.

## 3. Authority contract

| Action | Agent | Admin Assistant | Manager | Director | Full Admin |
| --- | --- | --- | --- | --- | --- |
| View material | Own/scoped | Assigned scope | Team/listing scope | Organization | Organization |
| Create/edit draft | Own/scoped | Assigned scope | Team/listing scope | Organization | Organization |
| Submit | Own/scoped | Assigned scope | Team/listing scope | Organization | Organization |
| Approve/return/reject | No | No | Team/listing scope | Organization | Direct organization-wide |
| Configure/activate rules | No | Draft assistance only | No | No | Direct |
| Withdraw approved release | No | No | Team/listing scope | Organization | Direct organization-wide |

Admin configuration selects `manager`, `director` or `manager_or_director` per channel rule. For
`manager_or_director`, submission assigns one named eligible approver; it does not require both
signatures. Reassignment is audited. No reviewer except the explicit full-Admin exception may decide
their own submitted version.

## 4. State and transition contract

### Material version

- `draft -> submitted`: preflight passes for every requested channel.
- `submitted -> partially_approved`: at least one channel approved and another remains pending,
  returned or rejected.
- `submitted/partially_approved -> approved`: every requested channel approved.
- `submitted/partially_approved -> returned|rejected`: derived when no approved channel remains and
  review outcomes require correction or end the request.
- any non-withdrawn submitted state `-> withdrawn`: authorized reasoned decision.
- an approved/submitted version is never edited; a correction starts the next draft version.

### Channel request

- `pending -> approved|returned|rejected|withdrawn`
- `returned -> pending` only through a newly submitted material version, not by mutating evidence
- `approved -> withdrawn` by authorized reasoned decision

An approved review state may have eligibility `scheduled`, `released_for_use`, `stale` or `expired`.
Eligibility changes do not erase or rewrite the original approval event.

## 5. Preflight and current release calculation

For each channel, submission preflight validates the active exact type/channel/region rule, authority,
final Document Version, listing/campaign requirements, approved Property Media with confirmed current
rights, configured permit/evidence requirement, disclosure codes and requested date range.

After approval, effective release-until is the earliest non-null value of:

- requested release end;
- rule-derived default validity end;
- linked campaign end;
- every attached media-rights expiry;
- Inventory permit expiry; and
- linked official-evidence expiry.

Current eligibility is `released_for_use` only when the channel is approved, the start has arrived,
the effective end has not passed and all current dependency fingerprints/statuses still pass. A
changed or invalid dependency produces `stale` with a safe reason code. It never silently substitutes
new media, evidence, permit, copy or file content.

## 6. Local API contract

All routes are under `/api/marketing-material-compliance` and use existing authentication, CSRF,
scope enforcement, idempotency and audit conventions.

### Configuration

- `GET /configuration`
- `POST /material-types` - full Admin creates stable type/draft version
- `POST /material-types/:id/versions` - full Admin or scoped Assistant drafts next version
- `POST /material-type-versions/:id/activate` - full Admin direct activation
- `POST /channel-rules` - full Admin or scoped Assistant drafts a rule
- `POST /channel-rules/:id/activate` - full Admin direct activation
- `POST /channel-rules/:id/retire` - full Admin, reason required

### Material and preflight

- `GET /materials` - scoped register with channel eligibility summary
- `POST /materials` - create stable material and initial draft
- `GET /materials/:id` - frozen versions, dependencies, decisions and safe audit timeline
- `POST /materials/:id/versions` - create next draft
- `PATCH /versions/:id` - draft only
- `POST /versions/:id/media` - draft-only approved-media link
- `POST /versions/:id/official-evidence` - draft-only evidence link
- `POST /versions/:id/preflight` - read-only channel result with blocker codes
- `POST /versions/:id/submit` - freeze, create channel requests and Manager/Director Tasks

### Decision and lifecycle

- `POST /channel-requests/:id/decision` - Manager, Director or full Admin; decision/reason
- `POST /channel-requests/:id/reassign` - authorized reassignment with reason
- `POST /channel-requests/:id/withdraw` - authorized withdrawal with reason
- `GET /channel-requests/:id/eligibility` - current calculation and dependency drill-down
- `POST /eligibility/recalculate` - local internal scheduler/admin operation; no external calls

No endpoint publishes, sends, verifies externally or contacts a portal/regulator.

## 7. Error contract

- `400` malformed values or incomplete draft
- `401` unauthenticated
- `403` role/scope/self-approval violation
- `404` inaccessible or absent record
- `409` stale version, inactive rule, duplicate fingerprint, invalid transition or failed dependency
- `422` structured preflight blockers by channel

Responses contain internal references and safe reason codes, never storage keys, credentials or
private owner/contact/authority details.

## 8. Gate 3 acceptance tests

Focused tests must prove at minimum:

1. no active legal/permit/disclosure rule is seeded;
2. Admin direct activation needs no maker-checker;
3. Assistant may draft but not activate or approve;
4. Manager can approve only inside team/listing scope;
5. Director can approve organization-wide;
6. configured `manager_or_director` requires one assigned eligible approver, not both;
7. self-approval is blocked except audited full-Admin direct exception;
8. Property Media approval, rights confirmation and expiry are enforced;
9. exact Document Version and dependency fingerprints are frozen;
10. campaign, permit, evidence and disclosure rules block correctly;
11. partial channel approval does not authorize another channel;
12. earliest dependency expiry determines release end;
13. later dependency change produces stale eligibility without altering approval history;
14. Marketing Material Tasks require no synthetic Lead/Contact and appear for the selected
    Manager/Director;
15. completing a Task does not approve a channel;
16. submitted versions, links, decisions and provenance reject mutation/deletion;
17. role-scoped list/detail and safe error payloads do not leak restricted information;
18. no route performs an outbound request; and
19. the full repository test suite remains green.

## 9. Gate boundary

Gate 2 approval authorizes creation of migration `091`, local domain/routes/UI integration and
synthetic offline tests for Gate 3. It does not authorize applying the migration to any shared
database, deployment, packaging, server restart, external publication, permit verification,
Property Finder work or access to private real-world data.

Owner approval was recorded on 14 August 2026. The owner then returned to review the completed Leave
Maintenance journey; Marketing Material Compliance Gate 3 implementation has not started.
