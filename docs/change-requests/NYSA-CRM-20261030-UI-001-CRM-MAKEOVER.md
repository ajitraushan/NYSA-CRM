# NYSA CORE - CRM visual makeover and shared design system

**Governed requirement · 30 October 2026**
**Reference:** NYSA-CRM-20261030-UI-001
**Source:** `NYSA-CORE-CRM-Makeover-Plan.pdf`, reviewed in full on 30 October 2026
**Status:** Implemented and deployed as DEV251 on CRM Test with exact approval on 31 October. Source, hosted technical and live Agent/Manager/Director checks passed. Production is unchanged and awaits exact final approval. See `UI-001-IMPLEMENTATION-STATUS.md`.
**Target:** CRM Test first; production candidate preparation is approved, production deployment awaits exact final approval.

## 1. Document control and baseline

This change request records the visual makeover requirement supplied after review of the CRM Test interface. It preserves the approved WEB Intake lifecycle and business workflow; it does not authorize changes to ownership, access, compliance, assignment or integration rules.

The observed source baseline is application version `2.1.0-dev.247` at Git commit `72f88565be43e76254f022b426531864a269763a`. This is a documentation-only change. No application runtime, database, website, provider, customer data or production environment is changed. Reverting this file is the rollback for this documentation step.

## 2. Objective

Create one shared NYSA CORE design system and use it consistently across the CRM. The makeover must improve readability, accessibility, terminology and task clarity without replacing NYSA's established visual identity.

The existing Inter body typeface, serif display typeface and navy/cream/gold palette remain. The change standardizes how they are applied.

## 3. Shared design system

### 3.1 Type scale

Only the following roles are permitted in ordinary working screens:

| Role | Size and line height | Weight | Use |
|---|---:|---:|---|
| Page title | 28 px / 1.2, serif | 600 | One consistent title on every screen |
| Section or record title | 20 px / 1.3, serif | 600 | Cards, records and form sections |
| Body | 16 px / 1.5 | 400 | Values, tables and paragraphs |
| Secondary | 14 px / 1.45 | 400 | Helper text and secondary table lines |
| Label | 12 px / 1.3, uppercase, 0.06 em | 600 | Field labels, table headers and badges |

Nothing may render below 12 px.

### 3.2 Colours and contrast

| Purpose | Colour |
|---|---|
| Main text on cream | Navy `#14232C` |
| Secondary text on cream | Grey `#5B6770` |
| Labels and breadcrumbs on cream | Dark gold `#7A5A26` |
| Gold text on navy | Light gold `#C9A86A` |
| Primary action | Gold `#8F6A30` with white text |

Light gold is used on navy; dark gold is used on cream. Ordinary text must meet a minimum 4.5:1 contrast ratio. Focus indicators, disabled states, links, errors and success states must also pass the approved accessibility checks.

### 3.3 Page header

Every working screen uses the same header component:

1. a plain-language breadcrumb without release codes or internal workspace names;
2. one 28 px page title;
3. one short 14 px description, no more than 90 characters where practical;
4. at most one primary gold action on the right; and
5. secondary actions under a **More** menu when needed.

Operational state such as **Live outreach off** is a compact badge beside the title, not a large explanation banner.

### 3.4 Dates and time

- Date and time: `30 Oct 2026, 09:00`.
- Date only: `30 Oct 2026`.
- Use 24-hour time without seconds.
- Use Dubai time unless the value is explicitly labelled **customer time**.
- Never expose raw ISO timestamps or US-formatted dates in ordinary UI.

### 3.5 Spacing and layout

- Use an 8 px spacing grid: 8, 16, 24 and 32 px.
- Table rows have a minimum 48 px height and 12 px vertical padding.
- Use 24 px between page sections and 16 px between filters and results.
- At 1280 px viewport width, no ordinary working screen may scroll horizontally.
- Filter labels, values and placeholders must remain fully readable.

### 3.6 Business language

- Render business labels, not stored codes: **3-6 months**, not `3_to_6_months`.
- Render **Not provided** for information never supplied.
- Render **Not sure yet** only when the customer explicitly selected that answer.
- Do not expose lower-case `unknown`, `other`, hashes, release numbers, schema terms, ETL terminology or governance implementation language in ordinary workflow UI.
- Technical provenance and audit information remains accessible to authorized users inside a collapsed **Audit details** section.

## 4. Shared component corrections

- Show three or four main filters in one row; put remaining permitted filters under **More filters**.
- Remove Passport and Emirates ID from default filters. Where a permitted identity search is necessary, expose it only in the authorized Customers view under **More filters**.
- Make result rows accessible and clickable instead of repeating a gold **Open** button on every row.
- Show complete names or authorized masked hints up to 40 characters; do not render unexplained fragments such as `O...`.
- Remove repetitive filler text from tables. Use a dash or blank value when repetition adds no meaning.
- Empty states must say what would appear and what the user can do next.
- Use one task priority vocabulary: **Urgent**, **High**, **Normal**.
- A primary next-action task uses **Record outcome** consistently and cannot be closed with an outcome-bypassing **Complete** action.
- Remove the stray punctuation observed beside the signed-in user's name.

## 5. Delivery phases

### Phase UI-1 - Shared foundation

- Implement design tokens for typography, colour, spacing, borders, focus and responsive layout.
- Implement shared page header, date/time presenter, badge, filter panel, table/list row, empty state and audit-details components.
- Add automated contrast, typography, responsive-width and date-format checks.

### Phase UI-2 - Daily agent screens (P1)

- WEB Intake Leads.
- My Lead Queue.
- Leads list.
- Lead and Opportunity record views.
- My Tasks.
- Primary next-action outcome control.

The current My Lead Queue replaces the historical Lead Response workspace; the retired screen must not be restyled as a competing workflow.

### Phase UI-3 - Supporting screens (P2)

- Dashboard.
- My Diary.
- Customers.
- Inventory.
- Opportunities.
- My Payout Advice.
- Shared filter, clickable-row and empty-state corrections.

### Phase UI-4 - Remaining screens (P3)

- External Portal Listings, redesigned as a three-step flow: listing selection, advertising details and media.
- My Leave.
- Marketing Compliance.
- Bulk Upload.
- Final cross-screen accessibility and consistency audit.

## 6. Screen-specific direction

### WEB Intake Leads

Use the standard header and a compact result list containing customer/masked hint, source, campaign, intake status, AI status, age, owner, next action and pickup. Display source labels such as **NIA - Property selection**, never raw form identifiers.

### My Lead Queue

Replace raw values and multiple small answer tiles with a readable summary line, for example **Villa - 4 bedrooms - 3-6 months - Budget not provided**. Detailed evidence remains available on opening the item. Sort by priority and due time.

### Leads and record pages

Keep one primary action and move secondary actions into **More**. Show plain business stage and qualification labels. Place provenance, hashes and immutable/audit wording in collapsed Audit details.

### My Tasks

Use **Record outcome** for primary next-action tasks. Put customer name and source on separate lines, and use the shared priority labels.

### Customers

Mask phone and email in the list according to role policy while retaining authorized full details on the record. Use compact filters and clickable rows.

### Inventory and Opportunities

Reduce default filters, remove personal-identity filters, explain empty filtered results and show **Closed - no action** for closed opportunities.

### My Payout Advice

Use the breadcrumb **Finance - My payouts** for Sales Agents. Hide accountant-only labels and tabs from roles that do not hold those permissions.

## 7. Functional observations kept outside the makeover

The source review identified possible functional or authorization defects. They must be diagnosed and tracked separately so visual work does not silently change business rules:

- inconsistent stage completion on a Closed Won test record;
- a Closed Won opportunity still displaying a next action;
- a primary first-contact task closable without a recorded outcome;
- inconsistent customer masking between WEB Intake Leads, My Lead Queue and My Tasks;
- inconsistent meanings for **unknown**, **Not provided** and **Not sure yet**;
- possible accountant-only controls visible to a Sales Agent;
- unmasked contact details in the Customers list; and
- an empty default Inventory view that may be data- or filter-related.

Each confirmed defect requires its own reference, tests and approval if it changes logic, access or data. UI-001 may consume an approved fix but does not authorize it.

## 8. Acceptance criteria

- AC-UI-01: No ordinary screen uses more than the five approved text roles and nothing renders below 12 px.
- AC-UI-02: Every page uses the shared 28 px title/header layout.
- AC-UI-03: Ordinary text and interactive states meet approved contrast requirements.
- AC-UI-04: All visible dates use the governed format; raw ISO and US-style timestamps are absent.
- AC-UI-05: Stored codes, hashes, release labels and internal workspace names are absent outside authorized Audit details.
- AC-UI-06: Default filters contain no Passport or Emirates ID search.
- AC-UI-07: Primary next-action tasks require **Record outcome**.
- AC-UI-08: At 1280 px width, every affected screen is usable without horizontal page scrolling.
- AC-UI-09: A Sales Agent sees no accountant-only labels, tabs or actions.
- AC-UI-10: All controls have keyboard access, visible focus and accessible names.
- AC-UI-11: Empty, loading, error and disabled states explain the state and safe next action.
- AC-UI-12: Before/after screenshots exist for every affected CRM Test screen at approved desktop and mobile/tablet breakpoints.
- AC-UI-13: Existing workflows, access controls, assignments, integrations and customer data remain unchanged unless governed by a separately approved functional fix.
- AC-UI-14: Full regression and focused accessibility/visual tests pass with zero failures.
- AC-UI-15: Production code, data, schema, configuration and runtime remain unchanged during development and CRM Test UAT.

## 9. Release controls

- Build and verify in an isolated source/test environment using synthetic or approved data.
- Deploy to CRM Test only after a fresh baseline, paired backups and verified encrypted private off-server recovery copy.
- Package only from a GitHub-advertised commit using the mandatory origin builder and verify provenance before deployment.
- Preserve live-integration flags and production state.
- Obtain a separate exact approval for the tested UI candidate and another separate approval for any later production release.

