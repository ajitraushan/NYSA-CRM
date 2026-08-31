# Release 4 — DLD Market Data Import and Inventory Market Intelligence Integration

**Gate:** 1 — functional scope and authority reuse  
**Date:** 13 August 2026 (Asia/Dubai)  
**Classification:** local/offline design only; no migration, API or CRM UI implementation authorized  
**Migration number:** `087` (implemented locally after Gate 2 approval; not applied)

**Owner decision:** Gate 1 approved on 13 August 2026 (Asia/Dubai). Approval authorizes Gate 2
schema/API design only; it does not authorize implementation or migration application.

## Purpose

Integrate the owner-reviewed DLD CSV import contract and Inventory Market Intelligence design as one
offline CRM package. An Administrator manually supplies an official-source CSV already obtained
outside CORE. CORE validates and preserves the exact source evidence, stages valid sales observations,
and produces deterministic advisory market intelligence inside the existing Inventory detail screen.

The package does not fetch DLD data, call Dubai REST, generate a valuation, contact a portal, or alter
Inventory price, availability or workflow state.

## Existing authorities retained

| Concern | Retained CORE authority |
| --- | --- |
| Inventory identity and asking facts | existing `listings` record and governed `areas` reference |
| Source file and immutable version/hash | existing Documents, Document Versions and audited file access |
| Actor and permission | existing broker role/job-role and scope controls |
| Audit evidence | existing `audit_log` |
| Admin navigation | existing Administration page |
| Inventory presentation | existing Inventory detail workflow; no separate operating module |

CORE currently has a governed Area authority but no canonical Community authority. The package may add
only the minimum versioned Community registry and DLD-source-label crosswalk required to prevent unsafe
text matching. Every Community belongs to one existing governed Area. No existing Inventory community
text is rewritten or backfilled by assumption.

## Proposed operating workflow

### 1. Admin source-file staging

1. An Admin user opens **Administration → DLD market data**.
2. The user selects a locally held Dubai Pulse API CSV or DLD website transaction CSV.
3. CORE validates the supported header, file type and size, calculates the immutable file SHA-256,
   and parses in bounded server-side batches.
4. The preview shows accepted sales, rejected rows with controlled reasons, duplicates, date coverage,
   partial/complete periods and deterministic descriptive KPIs.
5. Selecting a file or viewing a preview performs no import.

The source must contain no buyer, seller, owner, contact or authority identity mapping. Such fields,
if present in a future source format, are outside this contract and must not be persisted.

### 2. Explicit Admin acceptance

1. Admin Assistant may upload and stage a batch but cannot accept it.
2. A full Administrator may stage, accept, reject or retire a batch directly. Their activity requires
   no second Administrator approval.
3. Acceptance is an explicit audited decision against the frozen file hash and preview fingerprint.
4. Accepted observations are immutable. Corrections require a new source batch; prior batch and row
   evidence remains preserved.
5. Source dataset + source record reference is unique across accepted batches. Retry or concurrency
   cannot create duplicate market observations.

### 3. Community registry and exact crosswalk

1. Full Administrator maintains a canonical CORE Community under an existing governed Area.
2. Full Administrator may directly activate or retire a Community or mapping version; no maker-checker
   approval is required. Admin Assistant remains draft-only.
3. A versioned crosswalk maps one normalized DLD source-area identity/label to one canonical Community.
4. Conflicting active mappings fail closed. Text similarity never activates a mapping automatically.
5. Unmapped observations remain accepted source evidence but cannot feed Community-level Inventory
   intelligence until an explicit active mapping exists.

### 4. Inventory Market Intelligence

The existing Inventory detail page shows an **Advisory market intelligence** panel. It uses the exact
Inventory transaction type, governed market segment, building and canonical Community, with the
existing governed Area as context. The governed segments are Studio, 1 BR, 2 BR, 3 BR, 4+ BR,
Penthouse and Villa. Only accepted, supported sales observations with a valid active mapping and source
evidence may qualify.

Exact building + Community + segment evidence is preferred when at least three comparables exist.
Otherwise the panel visibly falls back to the same Community + segment, shows both comparable counts
and explains the fallback. Building or Community text is never fuzzily or silently matched.

The panel displays:

- mapping status and version;
- exact Inventory building, canonical Community, governed segment and evidence level;
- source period and last accepted batch;
- eligible comparable count;
- Inventory asking price per square foot;
- weighted average and median market price per square foot;
- asking-price variance to the weighted average;
- observed price range;
- up to four calendar quarters of weighted average, median and transaction count; and
- the exact limitations that prevent or qualify the result.

At least three eligible comparables are required for comparative metrics. A trend claim requires data
in at least two distinct calendar quarters. With only one eligible quarter, CORE shows that quarter's
facts without percentage movement or trend language. Missing mapping, insufficient evidence or stale
evidence blocks only this advisory panel and never blocks Inventory maintenance.

### 5. Reviewed snapshot

An authorized Agent may prepare explanatory draft text from the deterministic panel. A Manager,
Director or full Administrator records the reviewed snapshot before it can be marked customer-ready.
A full Administrator does not require another reviewer and may review a snapshot they prepared. The
snapshot freezes its Inventory facts, observations, calculations, limitations, narrative and review
time. It is labelled **indicative — not a valuation**. No AI or external messaging service is called.

## Permission summary

| Action | Full Administrator | Admin Assistant | Agent | Manager/Director |
| --- | --- | --- | --- | --- |
| Stage source CSV and view preview | Yes | Yes | No | No |
| Accept/reject/retire source batch | Yes, direct | No | No | No |
| Draft Community/crosswalk | Yes | Yes | No | No |
| Activate/retire Community/crosswalk | Yes, direct | No | No | No |
| View scoped Inventory intelligence | Yes | Yes | Yes | Yes |
| Prepare explanatory snapshot draft | Yes | No | Yes, scoped | Yes, scoped |
| Mark snapshot customer-ready | Yes, direct | No | No | Yes, scoped |

## Fail-closed and non-mutation rules

- Unsupported schema, invalid file hash, over-limit file, invalid dates/amount/area, non-sale rows and
  in-file duplicate transaction identifiers are rejected with controlled reasons.
- A changed preview fingerprint requires re-review before acceptance.
- Re-uploading or concurrently accepting the same source evidence produces one accepted batch/result.
- No observation is matched to a Community by free text alone.
- Intelligence never updates Inventory price, reference price, availability, Community, Area or status.
- No accepted source file, observation, mapping or reviewed snapshot is overwritten.
- Business screens do not expose storage keys, raw technical hashes or private identities. Authorized
  Admin audit detail may display evidence hashes when investigation requires them.

## Gate sequence

1. **Gate 1 — scope:** approve this combined package, authority reuse, workflow and exclusions.
2. **Gate 2 — migration/API contract:** review the exact additive schema, endpoints, batching,
   idempotency, permissions, rollback and test matrix. Proposed migration: `087` (unapplied).
3. **Gate 3 — local CRM workflow:** review the Administration import/crosswalk screens and Inventory
   intelligence panel after focused and complete offline tests.
4. **Gate 4 — package completion:** accept the complete local functional package and checkpoint.

No gate authorizes applying a migration, packaging, deployment, restart or external-service access.

## Gate 1 acceptance criteria

Approval confirms that:

1. DLD acquisition remains manual and outside CORE;
2. the exact file/version/hash, batch decision and accepted rows remain immutable evidence;
3. full Administrator activity needs no second approval, while Admin Assistant remains draft/stage-only;
4. canonical Community and exact versioned DLD crosswalk are required; text is never auto-linked;
5. accepted observations are advisory and cannot mutate Inventory;
6. comparative metrics require three eligible observations and trend claims require two quarters;
7. customer-ready output requires a frozen reviewed snapshot labelled not a valuation; and
8. no existing Inventory, Area, document or source record is inferred, rewritten or backfilled.

## Explicit exclusions

- Property Finder, Bayut, Dubizzle or any other portal work.
- Live DLD/Dubai Pulse/Dubai REST connection, API, scraping, automation or CAPTCHA interaction.
- Official-form generation, legal wording, valuation, appraisal or price recommendation.
- Buyer, seller, owner, contact, representative or authority data ingestion.
- Inventory mutation, automatic price/status/workflow changes or new operating queue.
- AI generation, email, WhatsApp, external delivery or customer transmission.
- CRM Test, Production, R2, cPanel, packaging, deployment, migration execution or restart.
