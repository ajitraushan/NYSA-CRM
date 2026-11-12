# DEV273 D-1 · Customer and Lead visibility

Approved D-1 incorporating Ajit’s additions. Requirements follow the [consolidated DEV273 artifact](https://claude.ai/artifact/2GSKWQKtBNcvAQc8Y4nywE).

Build target is `2.1.0-dev.273` on DEV272 commit `54421912fc1496a1066814cd8b665c19c7e8fd45`. CRM Test starts from DEV272. Production goes directly from accepted DEV270 (`5c1c350151d6ace33377b33526e2bfedf4ae8f6b`, 171 migrations) to DEV273 and receives migration 172 with the DEV272 changes. DEV274 auto-assignment has its own D-1.

## Access and affected surfaces

| Role | Customers | Leads | Phone and email |
| --- | --- | --- | --- |
| Sales Agent | Own | Assigned to them, with the existing assignment offer workflow | Full on owned or assigned records. An open offer shows masked contact details until the Agent accepts it. |
| Manager | Own plus customers whose owning Agent is in a managed team | Own, managed teams and unassigned intake | Masked, with logged Reveal on a single record |
| Director | All | All, including unassigned | Masked, with logged Reveal on a single record |
| Admin | None | Existing WEB intake audit metadata only | No contact values |

Apply record scope in server queries before search, counts, pagination and serialization. Return 404 for an out-of-scope direct or linked record. Require the same scope in Customer 360, Lead detail and queues, contact pickers, duplicate checks, dashboard counts and recent records, exports, opportunities, customer-linked tasks, activities, documents and proposals (including preview and download), and AI tools. Include the WhatsApp workspace and conversations, campaign recipient lists and imports, My Diary and calendar entries, lead notification emails, and customer values embedded in generated PDFs. Enforce scope before recipient selection, import preview, calendar rendering, email delivery and PDF generation or download. Apply parent scope in addition to the linked object's own permission checks. Duplicate checks may return a generic outside-scope match warning without identity or contact details. Review alternate access paths such as stored exports, document artifacts, and assistant context for unmasked values.

Customers and Leads get a searchable Owning Agent filter for Managers and Directors, combined with existing search. Agent is always own, Manager defaults to My team, and Director defaults to All. Director can narrow to a team or Agent. Managers can narrow to an Agent in a managed team. Leads also offer Unassigned for Managers and Directors. Apply the same customer scope and filter to dashboard counts, tiles, recent customers and exports.

## Reveal and migration decision

**No migration 173 is proposed.** DEV272 already uses the existing `audit_log` for Contact and Lead events with actor, record, action, timestamp and details. Record a `contact_details_revealed` event containing the field names only. A dedicated record action rechecks scope, reads and audits in one transaction, then returns only that record's permitted values after commit. Fail closed if the audit write fails. Use a non-cacheable response and clear the revealed values when leaving or reloading the record. Manager and Director logs are limited by the current scope of the underlying record. Exports always use masked values for those roles. Mask phone to the last four digits and email to the first letter and domain, with safe handling for incomplete values.

Enforce a single owning Agent through the existing scalar `contacts.owner_id` and validate all customer creation and ownership changes in the application. Managers and Directors can transfer ownership with a recorded reason. Keep the existing converting-Agent ownership rule. Unassigned WEB and Meta Leads are available to Managers and Directors for manual assignment to an in-scope Agent. Agents see only their own open offers through the existing offer workflow, with phone and email masked until acceptance. Check masking in offer notifications too. If review calls for a database-enforced owner invariant, revisit migration 173 after reconciliation and rehearse it against the Production-shaped database before release.

## Production ownership baseline and proposal

The saved DEV270 acceptance and preflight evidence establish the version and schema. They do not report the four requested record counts. Production counts are **unverified**, including whether any count is zero.

| Measure | Proposed count definition | Production result |
| --- | --- | --- |
| Customers without owner | `contacts.owner_id IS NULL` | Pending |
| Customers without team | No owner, or the owner's `brokers.team_id` is null | Pending |
| Leads without owner | `leads.assigned_to IS NULL` | Pending |
| Leads without team | `leads.assigned_team_id IS NULL` | Pending |

Use the committed aggregate query in tools/production-dev273-ownership-counts.sql with the approved read-only launcher. Run an aggregate-only snapshot in a read-only transaction against the approved Production database, after Ajit's written go. Report totals and the overlap between missing owner and missing team for each entity, with an active-only Customer row alongside the all-Customer total. Report missing Agent team and assignee-team mismatches separately for Leads. Return no record IDs, names, phones or emails.

Propose that the Director reviews legacy exceptions before go-live. Keep valid owners. For ownerless Customers, the Director designates one active Agent per record. For a Customer with an owner and no team, correct the Agent's team membership only where confirmed. For a Lead with an assigned Agent and missing team, review that Agent's team and reconcile through the audited assignment path. Keep genuinely unassigned WEB and Meta Leads in the Manager and Director queue for manual assignment. Put other unresolved legacy Leads before the Director for a manual decision. No blanket reassignment or inferred owner from creation history.

## Verification and release

- API and data tests with two Agents, a Manager with an in-scope and out-of-scope team, a Director and an Admin. Cover direct and linked IDs, search, counts, filters, queues, exports, documents, tasks, opportunities and AI retrieval, including absent or changed ownership. Check the WEB audit exception and outside-scope duplicate warning.
- Verify identical masking across surfaces and exports, successful Reveal with one metadata-only audit entry, failure on an audit-write error, a scoped Reveal log and remasking after reload. Test ownership transfer, conversion, manual assignment and offer visibility with audit and authorization checks.
- CRM Test UAT uses synthetic data with the same roles. Verify sticky Prospect Diary tabs on desktop and mobile, the running version in the digest test email subject, and DEV272 regression coverage for Prospect Diary, lead intake, conversion and WhatsApp guards.
- After D-1 review, deliver the D-2 hashes, tests, upgrade rehearsal and rollback evidence. Rehearse DEV270 plus migration 172 into DEV273, including app rollback compatibility. Production rollback to DEV270 requires Ajit’s written go. Ajit will re-issue the interim access rule if rollback is needed. Use CRM Test A–D and UAT before Production preflight, backup, install and smoke. Each hosted step needs Ajit's written go. Use the controlled restart tool for hosted settings changes.

- Benchmark scoped Customer and Lead lists and search in D-2 against the two-second target. Record fixture size, role and team scope, search cases, measurement method and timings. Include initial lists and representative searches for all three viewing roles, with repeated measurements and p95 reported per case.
