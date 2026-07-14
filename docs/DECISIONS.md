# NYSA CRM Decision Register

## Approved Decisions

| ID | Decision | Rationale | Status |
| --- | --- | --- | --- |
| D-001 | NYSA CRM is an internal company system for the current phases. | NYSA does not currently require external broker or customer access. | Approved |
| D-002 | PostgreSQL is the production database. | Supports growth, constraints, transactions, backup, and future CRM relationships. | Implemented |
| D-003 | Leads belong to NYSA first, then a team, then one responsible agent. | Prevents personal ownership from causing lost leads and enables management reassignment. | Approved |
| D-004 | Assignment and reassignment history is immutable and auditable. | Management must understand lead custody and SLA failures. | Approved |
| D-005 | Lead status and opportunity stage are separate lifecycles. | Qualification and deal execution have different controls, reports, and outcomes. | Approved |
| D-006 | Internal roles are Admin, Sales Agent, Listing Agent, Manager/Team Lead, Director, and Accountant. | Matches NYSA's stated user groups. | Approved |
| D-007 | Hot/Warm/Cold qualification uses transparent first-party factors with manual override. | Avoids opaque decisions and inappropriate personal profiling. | Approved |
| D-008 | Automated social-media screening is excluded from the first release. | Requires a defined lawful purpose, vendor/privacy assessment, and human review. | Approved |
| D-009 | The financial calculator is informational and assumption-driven. | It must not imply bank approval or guaranteed investment returns. | Approved |
| D-010 | Customer Proposal Builder is part of the next release. | Rapid, tailored customer presentation is a core sales workflow. | Approved |
| D-011 | Proposals are editable before PDF export and are versioned against the lead/opportunity. | Protects accuracy and preserves the communication record. | Approved |
| D-012 | Transaction and compliance checklists are configurable. | Requirements vary by transaction type, emirate, and regulatory change. | Approved |
| D-013 | GitHub `main` and the versioned project documents are the source of truth. | Preserves continuity across tasks, releases, and future developers. | Implemented |
| D-014 | The canonical local repository is `C:\Users\ajitr\Projects\NYSA-CRM`. | Avoids OneDrive interference with Git internals. | Implemented |
| D-015 | User-facing NYSA Pocket Ledger naming will become NYSA CRM in the next release. | The current name no longer represents the product scope. | Approved, pending |
| D-016 | NYSA website leads enter a company-owned queue through a secured, idempotent server endpoint in Release 1. | Website intake is high value, controlled by NYSA, and exercises the common integration foundation early. | Approved |
| D-017 | External lead payloads are normalized into the standard lead workflow while retaining provider IDs and processing history. | One operating model avoids channel-specific lead silos and supports audit and replay. | Approved |
| D-018 | Meta lead retrieval and Meta conversion-outcome feedback are separate integrations. | They move different data in opposite directions and need separate access, consent, and approval. | Approved |
| D-019 | Property Finder and Bayut publication begins only after portal-ready inventory validation and vendor access are complete. | Premature publication would create rejected, incomplete, stale, or duplicate listings. | Approved |
| D-020 | Only documented vendor APIs, feeds, webhooks, or approved partner mechanisms will be used. | Scraping or browser automation is fragile, unsafe for credentials, and may violate platform terms. | Approved |
| D-021 | Phase 1 includes secure operational lead documents and attachments, while full compliance-document management remains later. | Customer communications must link to the exact file/version without prematurely expanding into regulated transaction workflows. | Approved |
| D-022 | Marketing consent can be Granted only from an executed, approved, versioned NYSA Marketing Agreement. | Consent must have consistent documentary evidence and cannot rely on an informal flag. | Approved |
| D-023 | Contact channel kind, label, normalized value, and WhatsApp capability are separate validated fields. | Prevents duplicate phone records and supports consistent manual/import/integration validation. | Approved |
| D-024 | NYSA Organization Settings are separate from external companies, which use category plus multiple roles. | Separates NYSA identity from business accounts and avoids duplicate multi-role companies. | Approved |
| D-025 | Proposals assemble authoritative cross-module data and approved media into immutable version snapshots. | Avoids retyping and preserves the exact content sent to a customer. | Approved |
| D-026 | Qualification Model Setup is separate from historical Qualification Assessments. | Enables explainable rules, approval, versioning, and reproducibility. | Approved |
| D-027 | Dashboards are the default role-scoped login workspace with Agent, Manager, and Managing Director hierarchy. | Users need immediate actionable work and management needs consolidated oversight. | Approved |
| D-028 | The Managing Director dashboard is strategic, summarized, future-oriented, and supports hierarchical drill-down. | Executive decisions require targets, trends, risks, and causes without defaulting to task-level noise. | Approved |
| D-029 | Controlled values are maintained through governed Admin Settings and used values are never hard-deleted. | Protects historical meaning, workflow behavior, reports, and integrations. | Approved |

## Recommended Defaults Awaiting Approval

| ID | Recommendation | Proposed default |
| --- | --- | --- |
| O-001 | Initial geography | Dubai first, then configure other Emirates |
| O-002 | Initial queues | Sales, Rentals, Off-plan, Commercial |
| O-003 | Lead acceptance SLA | 15 minutes during configured business hours |
| O-004 | First-contact SLA | 30 minutes during configured business hours |
| O-005 | SLA failure | Alert agent, escalate to team lead, then allow reassignment |
| O-006 | Proposal outputs | Quick, Investment, and Comparison PDF templates |

## Information Still Required

- Confirmed geography for the first operational release
- Team and queue structure, managers, and membership
- Business hours, holidays, SLA values, and reassignment policy
- Current CRM vendor, export structure, data volume, and attachment volume
- Email provider and per-user mailbox model
- Google Calendar account model
- WhatsApp Business Platform status and dedicated number
- NYSA proposal sample, logo/brand assets, and approved disclaimers
- Final sale and rental completion-document checklists
- Commission percentages, exceptions, approvals, and payment workflow
- Website form fields, consent wording, sender authentication, and website deployment owner
- Property Finder Enterprise API account, sandbox/live access, approved scopes, and key owner
- Bayut XML feed specification, Profolio Leads API entitlement, credentials, and polling limits
- Meta Business assets, lead forms, application owner, permissions, token rotation, and privacy approval

## Decision Process

New decisions use the next sequential ID and record:

1. The decision in one sentence.
2. Why it was chosen.
3. Alternatives materially considered.
4. Approval status and date.
5. Any migration, security, or operational consequence.
