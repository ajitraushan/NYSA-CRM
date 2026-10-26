# Release 3B — Inventory boundary and import-attribution gaps

Status: **All four UAT-derived requirements implemented locally; verification and a new CRM Test candidate remain pending**  
Recorded: 2026-08-03  
Source: CRM Test dev.116 Inventory upload UAT and business review of the manual Inventory form  
Related candidate: dev.117 corrects the upload transaction failure but is not approved for administrator-led bulk migration

These requirements extend Release 3B without changing or renumbering the frozen requirements
`R3B-REQUIREMENT-47` through `R3B-FEEDBACK-51`.

## Requirement register

| Requirement ID | Business outcome | Current status |
|---|---|---|
| `R3B-INVENTORY-BOUNDARY-52` | Maintain one simple internal Inventory record, progressively collect authority for internal use, and require publication-specific evidence only when creating an external Listing. | Implemented locally: separate Internal Inventory and External Portal Listings workspaces; CRM Test verification pending. |
| `R3B-IMPORT-ATTRIBUTION-53` | Resolve the genuine originating and responsible NYSA agents during Excel/external intake instead of silently attributing every property to the uploader. | Implemented locally in contract v1.3 with scoped resolution, commit revalidation and immutable assignment history; CRM Test verification pending. |
| `R3B-INVENTORY-OWNER-54` | Let Excel/external intake capture and save the first actual owner-side party atomically with its Draft, with a governed post-import correction path and without forcing a Customer or external Listing. | Implemented locally: owner is an optional complete Excel group and remains mandatory before verification; CRM Test verification pending. |
| `R3B-INVENTORY-VERIFY-55` | Surface pending Inventory verification in Manager Immediate attention, link it to the governed decision queue, and keep that queue visibly accessible above the long priority workspace; personal Saved views are not a substitute for operating navigation. | UAT defect confirmed; local priority/navigation correction implemented; CRM Test verification pending. |

## Local implementation boundary

- Internal Inventory Draft creation now collects property facts, source reference and governed NYSA agent attribution without creating a Customer, owner party, agreement or external publication.
- Owner/source authority can be supplied as one complete group in Excel or added to the saved Draft. Manager-verification submission refuses Inventory with no owner-side party, but does not require availability confirmation. Current availability is reconfirmed downstream before matching, customer viewing and reservation, where a missing or older-than-seven-days confirmation blocks the customer-facing action.
- External portal channel, agreement, marketing authorization, permit and publication status are maintained in the separate **External Portal Listings** workspace.
- `inventory-import-v1.3` resolves originating and responsible agents from maintained login emails or explicit screen defaults. The uploader remains the audit actor and is never silently substituted.
- Migration `078_release3b_inventory_progressive_governance.sql` adds immutable assignment history and backfills retained attribution without rewriting migrations 001–077.
- Portal connectors and automatic publication remain intentionally unimplemented.

## R3B-INVENTORY-BOUNDARY-52 — Internal Inventory versus external Listing

### Business intent

NYSA CORE must use **Inventory** for the internal property master. A property may be recorded as a
Draft before NYSA has completed every owner, mandate, marketing and portal field. **Listing** means
an optional, governed external publication created from an Inventory record for a specific channel.

The system must remain simple without allowing an internal Draft to be presented as verified,
authorized, available or publishable before the applicable evidence exists.

### Confirmed current gap

The application already stores external publications separately, but the initial Inventory form
requires all of the following before a Draft can be created:

- owner role and owner type;
- owner or represented-party name;
- source of owner details;
- authority or mandate evidence;
- agreement type;
- representation type; and
- agreement evidence reference.

This mixes raw Inventory capture, owner/source verification, NYSA representation and portal
publication in one form. Selecting an external broker or agency as an “owner type” also conflates
the actual owner with the party that supplied or represents the property.

### Approved progressive workflow

#### Stage 1 — Inventory Draft

Purpose: record a property internally without claiming authority, availability or publication
readiness.

Minimum fields:

- CORE-generated Inventory ID;
- inventory headline/project;
- Area/community and property type;
- bedrooms where applicable, size, price and currency;
- handover/readiness facts when known;
- source type and source reference;
- originating and responsible NYSA agents under `R3B-IMPORT-ATTRIBUTION-53`; and
- creation actor/time and immutable intake evidence.

An Inventory Draft:

- is not externally published;
- is not eligible for governed matching;
- carries no reservation or availability guarantee;
- does not claim an owner mandate or NYSA representation; and
- may be enriched later without losing the original source evidence.

#### Stage 2 — Verified Internal Inventory

Purpose: establish that NYSA has a legitimate, current source and sufficient authority to use the
property in controlled internal matching.

Required before activation/matching:

- current availability confirmation and checked time;
- actual owner/landlord/developer when known, kept separate from a broker/agency source;
- source party and represented party where an intermediary is involved;
- evidence that the source is authorized to provide the property;
- verification decision, reviewer and expiry/reconfirmation boundary; and
- any mandatory ownership/KYC review required by NYSA policy.

An internal authority reference may be a verified owner instruction, developer authorization,
co-broker instruction or other approved evidence. A complete portal-marketing package is not
required merely to retain the internal property master.

#### Stage 3 — External Listing / publication

Purpose: create a channel-specific advertisement or publication from verified Inventory.

Required progressively before submission/publishing:

- marketing/listing agreement type;
- exclusive/non-exclusive/co-broker representation where applicable;
- agreement evidence and effective dates;
- explicit marketing authorization;
- current verification and availability;
- approved media and media-usage rights;
- permit/Trakheesi/Madmoun reference and QR evidence when required;
- portal-specific required facts; and
- channel, external reference, URL, publication status and immutable status history.

Every portal/channel publication remains a child of one Inventory record. Publication status must
never rewrite internal Inventory history or silently activate the property.

### Field-placement decision

| Current field | Approved placement |
|---|---|
| Owner role/type | Stage 2; conditional and separate from source-party type. |
| Owner/represented-party name | Stage 2; represented party appears only when the source is an intermediary. |
| Owner phone/email | Stage 2 restricted party record; optional at Draft. |
| Owner address | Restricted owner/KYC record, not the basic Inventory form. |
| Source of owner details | Replace at Stage 1 with simple source type/reference; retain provenance. |
| Authority/mandate evidence | Stage 2 before activation/matching; stronger marketing authority is Stage 3. |
| Agreement type/representation | Stage 3, or Stage 2 only when an actual representation agreement already exists. |
| Agreement evidence/effective dates | Stored with the agreement, not required to save a Draft. |
| Permit, QR and portal references | Stage 3 only. |

### Legal and governance boundary

The simplification must not remove the gate before NYSA markets a property. Dubai Land Department
guidance requires advertising permits and states that a broker must provide the marketing contract
with the property owner for relevant advertising permits. DLD also requires the applicable permit
number/QR on advertisements. Sources:

- https://dubailand.gov.ae/en/eservices/real-estate-ad-permit/
- https://dubailand.gov.ae/media/i31iv1n0/real-estate-brokerage-practice-guide_en.pdf

Whether a privately presented/off-market property requires the same document set is an operating
and legal-policy decision. CORE must therefore make the internal-use authority gate configurable
but may never treat a raw Draft as authorized.

### Data and API implications

- Keep one `listings`/Inventory master; do not create a competing property table.
- Preserve existing `inventory_counterparties`, `inventory_agreements` and
  `external_listing_publications` histories.
- Separate source party, actual owner/represented party and NYSA agreement concepts in labels and
  validation.
- Permit initial Draft creation without owner/agreement rows.
- Derive internal-match readiness and external-publication readiness separately.
- Require server-side revalidation at activation, matching, publication submission and publication.
- Apply changes append-only; do not rewrite migrations 001–077 or delete prior evidence.
- Preserve existing records and classify them from retained evidence during any migration/backfill.

### Acceptance criteria

1. A permitted user creates an Inventory Draft using only the Stage 1 minimum fields.
2. The Draft clearly states that it is unverified, unavailable for matching and not publishable.
3. No owner, agreement, permit, Property Match, reservation, publication or communication is
   created automatically.
4. An external agency can be recorded as the source/representative without being labelled the
   property owner.
5. Activation is blocked until current availability, source authority and the configured internal
   verification evidence are complete.
6. A verified internal property can be used by governed matching without creating a portal Listing.
7. Creating an external Listing opens a separate progressive form and requires the applicable
   agreement, marketing, media and permit evidence.
8. Each portal publication has independent status/history and cannot change historical Inventory
   evidence.
9. Current eligibility is revalidated before matching or publication actions.
10. Existing owner/agreement/publication evidence remains readable and immutable after migration.

### Non-goals

- No automatic portal publication or connector is introduced by this requirement.
- No relaxation of availability, verification, advertising-permit or media-rights controls.
- No automatic reservation, availability guarantee, customer message or Property Match.
- No storage of private identity documents in general Inventory free text.

## R3B-IMPORT-ATTRIBUTION-53 — Governed agent attribution for bulk/external intake

### Business intent

Excel upload, CRM migration and later external interfaces must attribute each property to the
genuine NYSA agent who originated it and the agent currently responsible for it. The uploader is
an audit actor, not automatically the business owner of every imported property.

### Confirmed current gap

The manual Inventory form requires an originating agent. The dev.117 upload contract has no agent
column and assigns the authenticated uploader as both `originating_agent_id` and
`responsible_agent_id`. This satisfies the existing database constraints and is accurate only when
an agent uploads their own Inventory. It is inaccurate for Administrator/Admin Assistant bulk
uploads or migrations containing several agents.

### Approved attribution definitions

- **Originating agent:** the NYSA agent who sourced/brought the property; frozen after accepted
  import except through a separately authorized correction process that preserves history.
- **Responsible agent:** the current operational custodian; initially defaults to the originating
  agent and may later be reassigned through governed history.
- **Uploader/import actor:** the authenticated user who reviewed and committed the file; always
  retained separately in import/audit evidence.

### Approved Excel and interface behavior

- Add `originating_agent_reference` to the versioned import contract.
- Accept a maintained NYSA login email initially; never ask users to enter an internal UUID.
- The upload screen provides a **Default originating agent** selector for files where every row
  belongs to one agent.
- Each row may override that default with `originating_agent_reference`.
- If a row has no reference and no explicit default was selected, preview blocks the row.
- Provide an optional **Default responsible agent** selector; otherwise responsible defaults to
  the resolved originating agent.
- Do not silently use the uploader. “Use me as the originating agent” must be an explicit selection.
- Preview displays resolved originating/responsible agent names for every row.
- Unknown, ambiguous, inactive or out-of-scope agent references are errors, not warnings.
- Commit re-resolves/locks the current agent records and refuses stale or unauthorized attribution.
- Persist source reference, resolved broker IDs, uploader, contract version and reviewed mapping in
  immutable intake/audit evidence.
- Reuse the same mapping rules for Excel, current-CRM migration and future external interfaces.

### Scope and authorization

- An agent may attribute rows to themselves within normal scope.
- Manager, Admin Assistant and Administrator assignment must follow the maintained team/company
  authority rules.
- A bulk importer cannot assign an inactive user or bypass Inventory ownership rules.
- Duplicate source IDs remain non-overwriting regardless of the supplied agent reference.

### Contract/version implications

- Advance the reusable contract beyond `inventory-import-v1.1`; do not silently alter v1.1
  semantics.
- Keep the human reference separate from the stored broker UUID snapshot.
- If NYSA later introduces an immutable staff code, a versioned mapping may accept that code;
  names alone are never sufficiently unique.
- Add migrations only when a new durable field/history record is genuinely required; do not edit
  migrations 001–077.

### Acceptance criteria

1. A Sales/Listing Agent uploads their own file by explicitly selecting themselves as the default
   and CORE resolves both agent fields correctly.
2. An Admin Assistant uploads rows for two agents using maintained references and preview shows
   the resolved names row by row.
3. A missing agent reference with no default blocks only that row during preview and reports the
   exact reason.
4. Unknown, duplicate/ambiguous, inactive and out-of-scope references are rejected.
5. Changing the workbook after preview invalidates the review token.
6. Deactivating or changing eligibility of an agent between preview and commit blocks the entire
   atomic import.
7. Accepted Inventory records preserve originating agent, responsible agent and uploader as three
   distinguishable facts.
8. Responsible-agent reassignment preserves originating-agent and assignment history.
9. Re-uploading the same source record never overwrites the existing Inventory or attribution.
10. The same mapping behavior is demonstrated for a representative external-CRM migration payload.

### Candidate impact

- Dev.117 remains suitable only for controlled UAT where the uploader is genuinely the originating
  agent.
- Dev.117 is **not approved for administrator-led bulk migration or multi-agent production use**.
- The next general-use candidate must satisfy all three requirements before general Inventory rollout.

## R3B-INVENTORY-OWNER-54 — Post-import owner enrichment

### Business intent

Excel and external intake must capture the basic owner when it is known at source and create that
owner-side party atomically with the Inventory Draft. Retained older Drafts without an owner must
still provide a clear correction path before verification. Owner-side data belongs to Internal
Inventory and must not automatically create a Customer or an external Listing.

### Confirmed UAT defect and root cause

The detail screen displayed a form labelled **Add another Inventory party**, even when the imported
Draft had zero parties. Its role selector offered Seller, Landlord, Lessor and Developer, but the API
accepted only Authorized representative. Submitting an actual owner therefore failed and left the
Inventory without a usable owner-side record.

### Corrected contract

- Version the Excel contract as `inventory-import-v1.2`; do not reinterpret the frozen v1.1 package.
- Require owner role, type, name, source and authority-evidence reference in every new workbook row.
- Permit owner phone and email but do not require private identity documents in Excel.
- Create the Draft and its owner-side party in one transaction, or roll back both.
- With zero parties, label the form **Add the Inventory owner or represented party**.
- With existing parties, label it as an optional additional owner-side party form.
- Accept Seller, Landlord, Lessor, Developer and Authorized representative roles.
- Require party name, source and authority-evidence reference for every saved party.
- Allow person, company, external broker and external agency party types.
- Preserve the authenticated user as creator/audit actor.
- Do not create or modify Customer Master, matching runs, reservations, availability commitments,
  agreements or external publications as a side effect.
- Keep the Inventory a Draft and unverified until the independent verification workflow succeeds.
- Refuse verification submission when no governed owner-side party has been saved.
- Keep agreement/mandate evidence as a separately saved record when applicable.

### Acceptance criteria

1. Preview a v1.2 workbook and see owner name, role, type and contact alongside each property.
2. Import a valid row and reload the Draft; the matching owner-side party is already present with
   its source and authority evidence, while no Customer or external Listing was created.
3. Open a retained Excel-created Inventory with zero parties; the screen explicitly asks for the first owner
   or represented party rather than claiming one already exists.
4. Save each supported actual-owner role with name, source and authority evidence; reload and see
   the same immutable created party record.
5. Missing name, source or authority evidence produces a visible validation error and no partial row.
6. An unsupported role or type is rejected server-side.
7. A second co-owner or authorized representative can be added without rewriting the first party.
8. Saving or importing an Inventory party creates no Customer, external Listing/publication, match, reservation,
   communication or availability guarantee.
9. The Draft remains blocked from governed matching until all applicable verification and
   availability gates are independently satisfied.
10. Existing Customer-linked owner records remain intact and continue to display from current
   Customer Master identity plus their retained snapshot/audit evidence.

### Delivery status

The UI wording/save action and `inventory-import-v1.2` workbook, parser, preview and atomic owner
creation are corrected in the preserved local worktree with targeted regression coverage. No
migration is required because `inventory_counterparties` already supports these roles and fields.
CRM Test packaging, deployment and UAT are pending explicit authorization.

## Combined UAT evidence record

For these requirements, record defects with:

- requirement ID;
- Inventory ID and external source record ID;
- Inventory stage and publication channel, when applicable;
- originating, responsible and uploader identities;
- expected and actual result;
- user, environment and timestamp; and
- screenshot/API/audit reference without placing private identity evidence in free text.

Production and R2 remain prohibited targets until the corrected candidate passes CRM Test and the
normal release-promotion gates.
