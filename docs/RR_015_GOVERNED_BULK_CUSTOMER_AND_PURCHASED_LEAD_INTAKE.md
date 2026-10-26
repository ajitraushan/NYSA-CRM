# RR-015 — Governed Bulk Customer and Purchased Lead Intake

**Recorded:** 19 September 2026 (Asia/Dubai)  
**Status:** Implemented, tested and deployed to CRM Test in DEV208; human UAT pending  
**Application baseline reviewed:** `2.1.0-dev.207`  
**Production authorization:** None  

## Business requirement

NYSA may purchase prospect data that contains only basic identity and contact information, or may
receive an enriched file containing some buyer preferences. The CRM therefore requires two separate,
modular bulk-import facilities:

1. **Bulk Customer Import** creates or matches Customer Master records only. It must not create a
   Lead, requirement, assignment or Opportunity.
2. **Bulk Lead Import** creates Leads against existing Customer Master records and, when supplied,
   creates structured Lead Requirements through the same governed model used by website intake.

The separation is deliberate. A person may be loaded into Customer Master without representing a
current sales enquiry. Conversely, every Lead must link to exactly one governed Customer record and
must not create a competing customer identity.

## Confirmed current-state gap

The deployed source contains `POST /crm/imports/leads`, but it is not a purchased-data bulk-import
facility:

- it accepts one Lead per request rather than a reviewed workbook;
- it requires an existing active `contactId`;
- it hard-codes the source as `Current CRM`;
- it creates an unassigned Lead and queued assignment correctly, but does not create or match a
  Customer;
- it does not accept, preview or reconcile optional buyer preferences from a workbook; and
- it does not provide a batch register, row-level result file, retry/reconciliation view or rollback
  boundary.

The Customer interface currently requires both email and phone for manual creation, although the
database identity constraint permits either one. This is incompatible with purchased data, which may
contain a name and only one usable contact channel.

Website intake already demonstrates the required downstream pattern: it resolves Customer identity,
creates an unassigned queued Lead, and versions structured Lead Requirements when preference data is
available. The new bulk Lead module must reuse that domain behavior rather than duplicate it.

## Module A — Bulk Customer Import

### Purpose and boundary

This module imports basic purchased prospect identities into the authoritative Customer Master. It
does not infer an enquiry, qualification, ownership entitlement or Lead.

### Approved template

Required workbook metadata:

- source-system code;
- supplier/data-provider name;
- purchase or acquisition batch reference;
- acquisition date;
- campaign reference when applicable;
- contact/processing basis declared for the batch; and
- a stable external row reference for every row.

Permitted row fields:

- full name;
- email;
- phone;
- preferred contact channel, when known;
- source notes; and
- do-not-contact or restriction evidence, when supplied.

The Customer-only template must not contain Lead, budget, area, property or qualification fields.

### Minimum usable identity

- A row requires a name and at least one usable contact channel: email **or** phone.
- Email-only and phone-only records are permitted. The available channel starts unverified.
- A name with neither email nor phone is held as an invalid review row and does not create an
  operational Customer.
- A row without a usable name is held for correction; the system must not manufacture names such as
  `Unknown Customer`.

### Preview, validation and duplicate handling

Before confirmation the system must show a non-mutating preview with row number, normalized identity,
proposed action and validation messages.

Each row is classified as one of:

- **Create:** no Customer matches the normalized email or phone;
- **Link/no change:** one active Customer is an exact, non-conflicting match;
- **Review required:** email and phone point to different Customers, multiple candidates exist, or the
  source conflicts with an existing identity;
- **Skipped/idempotent:** the same source-system code, batch and external row reference was previously
  committed; or
- **Invalid:** required identity, provenance or format validation failed.

An exact match must never overwrite Customer ownership, verified identity, restrictions, roles or KYC
data. An ambiguous match must not create a second active Customer. It enters a governed duplicate
review outcome instead.

### Commit behavior

- Only an explicitly confirmed, unchanged preview may be committed.
- The file hash and normalized preview hash must bind confirmation to the reviewed workbook.
- New purchased Customers are company-held (`owner_id` unset), active only when duplicate checks pass,
  and retain unverified channel/KYC status.
- No Lead, assignment, requirement or Opportunity is created.
- A commit is atomic at the approved batch boundary. If partial-batch processing is later approved,
  successful and rejected rows must be explicitly separated and reconcilable; silent partial success
  is prohibited.
- The result provides Customer reference, action, reason and error for every source row and is
  downloadable.

## Module B — Bulk Lead Import

### Purpose and Customer linkage

This module converts approved purchased-data rows into Leads. It operates only against existing,
eligible Customer Master records and must not silently create Customers.

A Lead row identifies its Customer using, in priority order:

1. NYSA Customer reference produced by Module A;
2. an unambiguous normalized email or phone match; or
3. the stable source-system, batch and external row reference mapped by Module A.

No match or an ambiguous match is a row-level review error. The operator is directed to Customer
Import or Duplicate Review; no Lead is created for that row.

### Core Lead fields

Required:

- stable external Lead/row reference;
- source-system code, supplier/batch and acquisition provenance;
- Customer reference or resolvable identity;
- Lead title or an approved generated title rule; and
- business type when known, otherwise a maintained intake value approved for routing.

Optional enriched preference fields:

- budget minimum and maximum;
- preferred area or areas;
- property type;
- bedroom requirement;
- buy/rent objective;
- investment or end-use purpose;
- desired timing;
- specific property/listing interest, when a valid CRM reference exists;
- campaign reference; and
- source notes.

Preference fields are optional. Their absence must not prevent creation of an otherwise valid Lead.

### Requirement behavior

- Basic data only creates a `New`, `Unassessed` Lead with no invented preference values.
- Any supplied preferences create a structured, versioned Lead Requirement using the same domain
  validation, field meanings and history model as website intake.
- Missing values remain unknown; they must not be replaced by zero, `Any`, fabricated areas or free-
  text assumptions.
- A later website submission or Agent qualification updates the requirement through a new version and
  preserves source evidence and conflicts.
- Imported preference data does not automatically qualify the Lead or create an Opportunity.

### Routing and assignment

- Every purchased Lead is company-sourced and begins unassigned.
- Source, business type and primary area feed the maintained routing rules.
- A queued assignment-history row is created in the same transaction as the Lead.
- A Manager responsible for the routed team, or the Managing Director under company-wide authority,
  assigns the Lead to an eligible Sales Agent.
- The uploader is never assigned merely because they uploaded or confirmed the batch.
- Existing Customer ownership is not changed by import or Lead assignment.
- Agent operating access follows the assigned Lead; any later Customer ownership transfer remains a
  separate, explicit, audited decision.

## Roles and permissions

- **Admin:** may upload, preview and confirm purchased-data batches and maintains related controlled
  configuration. Admin does not receive Lead assignment merely by importing.
- **Sales Agent:** may upload, preview and confirm purchased-data batches. Import never assigns the
  resulting Lead to the uploader or changes Customer ownership.
- **Manager and Managing Director:** have no purchased-data import permission. Their downstream
  duplicate-review, routing or assignment authority remains separate from import.
- **Manager:** resolves team-scoped duplicate/identity exceptions where permitted and assigns routed
  Leads for the responsible team.
- Imported Leads remain unassigned until the normal governed assignment workflow completes.
- **Accountant and other read-only roles:** have no import permission.

Separation of duties must prevent the same upload action from bypassing duplicate review, routing,
assignment or qualification controls.

## Batch register, audit and reconciliation

Both modules require a batch register containing:

- immutable batch ID and user-facing batch reference;
- module type (`customer_only` or `lead`);
- source-system code, supplier, acquisition date and campaign;
- original file name, media type, byte size and SHA-256 hash;
- uploader, reviewer/confirmer and timestamps;
- preview/confirmation hashes;
- row counts by created, linked, skipped, review-required, invalid and failed outcome;
- status (`uploaded`, `previewed`, `confirmed`, `processing`, `completed`, `completed_with_exceptions`,
  `failed`, or `reversed` if a future governed reversal is approved); and
- a downloadable row-level reconciliation result.

Audit events must identify the batch and external row reference without logging unnecessary personal
data. Re-uploading the same source record must be idempotent. A retry must continue safely without
creating duplicate Customers, Leads, assignments or requirements.

## Privacy and contact controls

- Supplier, acquisition source and declared contact/processing basis are mandatory batch evidence.
- Do-not-contact and restriction evidence must be preserved and enforced before Agent outreach.
- The import must not treat purchased data as consent verified by NYSA.
- Raw workbooks are private evidence, access-controlled, retention-governed and never exposed through
  public files or logs.
- Test execution uses synthetic or explicitly approved data only.

## User experience

Each module follows the same controlled sequence:

```text
Download approved template
→ Upload workbook
→ Validate and preview every row
→ Correct or explicitly resolve exceptions
→ Confirm the unchanged preview
→ Process once
→ Download reconciliation result
→ Open created/matched records or exception queues
```

Customer Import and Lead Import must be visibly separate actions. Their preview tables must clearly
state that Customer Import creates no Leads and Lead Import creates no Customers.

## Acceptance criteria

### Customer Import

1. Import a valid name + email row and create exactly one unverified Customer and no Lead.
2. Import a valid name + phone row with the same result.
3. Reject/hold name-only, contact-only-without-name and invalid-channel rows without placeholder data.
4. Link an exact existing identity without overwriting it or changing ownership.
5. Hold conflicting/ambiguous identities for review and create no active duplicate.
6. Re-upload an already committed source row and prove idempotent skip/no duplicate.
7. Prove a failed atomic confirmation leaves no partial Customer batch.

### Lead Import

8. Create a basic Lead against a Customer created by Module A; confirm `New`, `Unassessed`, unassigned
   and queued states, with no requirement invented.
9. Import an enriched row and verify the structured requirement equals the supplied budget, areas,
   property preferences, objective and timing.
10. Confirm website continuation produces a later requirement version without erasing import evidence.
11. Reject unresolved and ambiguous Customer references without creating a Lead.
12. Confirm maintained routing selects the correct team and Manager/Director assignment is required.
13. Confirm upload does not assign the Lead to the uploader or change Customer ownership.
14. Re-import the same external Lead and prove no duplicate Lead, assignment or requirement.
15. Prove one invalid batch cannot silently partially commit under the selected transaction policy.

### Security, audit and regression

16. Test every permitted and forbidden role against preview, confirmation, result download and raw-file
    access.
17. Verify batch, row, Customer, Lead, requirement, routing and assignment audit lineage end to end.
18. Verify existing manual Customer/Lead creation, website intake, Current CRM import, duplicate review,
    assignment SLA and qualification workflows remain unchanged.
19. Verify concurrent confirmation and retry behavior cannot process a batch twice.
20. Verify no personal data or raw workbook content appears in application logs or public storage.

## Implementation and deployment boundary

This record documents the approved functional gap only. It does not authorize schema changes, data
imports, CRM Test deployment or Production deployment. Implementation must include:

- a versioned schema/API contract and migrations;
- reusable Customer matching and Lead-intake domain services shared with website intake;
- generated, versioned Excel templates and preview parsers;
- focused unit/integration tests plus authenticated CRM Test UAT;
- a file/database snapshot, migration rehearsal, package checksum and rollback procedure; and
- a line-by-line comparison of this requirement against the release evidence before deployment
  approval is requested.
