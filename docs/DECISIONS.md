# NYSA CRM Decision Register

## Approved Decisions

| ID | Decision | Rationale | Status |
| --- | --- | --- | --- |
| D-001 | NYSA CRM is an internal company system for the current phases. | NYSA does not currently require external broker or customer access. | Approved; reaffirmed by D-033 |
| D-002 | PostgreSQL is the production database. | Supports growth, constraints, transactions, backup, and future CRM relationships. | Implemented |
| D-003 | Leads belong to NYSA first, then a team, then one responsible agent. | Prevents personal ownership from causing lost leads and enables management reassignment. | Approved |
| D-004 | Assignment and reassignment history is immutable and auditable. | Management must understand lead custody and SLA failures. | Approved |
| D-005 | Lead status and opportunity stage are separate lifecycles. | Qualification and deal execution have different controls, reports, and outcomes. | Approved |
| D-006 | Internal roles are Admin, Sales Agent, Listing Agent, Manager/Team Lead, Director, and Accountant. | Matches NYSA's stated user groups. | Approved |
| D-007 | Hot/Warm/Cold qualification uses transparent first-party factors with manual override. | Avoids opaque decisions and inappropriate personal profiling. | Approved |
| D-008 | Automated social-media screening is excluded from the first release. | Requires a defined lawful purpose, vendor/privacy assessment, and human review. | Approved |
| D-009 | The financial calculator is informational and assumption-driven. | It must not imply bank approval or guaranteed investment returns. | Approved |
| D-010 | Customer Proposal Builder is part of Release 1. | Rapid, tailored customer presentation is a core sales workflow. | Implemented locally; acceptance pending |
| D-011 | Proposals are editable before PDF export and are versioned against the lead/opportunity. | Protects accuracy and preserves the communication record. | Approved |
| D-012 | Transaction and compliance checklists are configurable. | Requirements vary by transaction type, emirate, and regulatory change. | Approved |
| D-013 | GitHub `main` and the versioned project documents are the source of truth. | Preserves continuity across tasks, releases, and future developers. | Implemented |
| D-014 | The canonical local repository is `C:\Users\ajitr\Projects\NYSA-CRM`. | Avoids OneDrive interference with Git internals. | Implemented |
| D-015 | User-facing NYSA Pocket Ledger naming becomes NYSA CRM in Release 1. | The prior name no longer represents the product scope. | Implemented and deployed; superseded for the header by D-030 |
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
| D-030 | The user-facing system name is NYSA CORE, displayed centrally between the NYSA logo and user controls. | CORE is the approved operating-system identity while the repository and technical service retain their established CRM identifiers. | Implemented and deployed 2026-07-14 in `1179cca` |
| D-031 | Release 1.1 delivers a dedicated Listing Executive workspace, manual inventory workflow, property media, and provider-neutral integration-created drafts; live portal publication remains Release 4. | Listing Executives require an inventory-first workspace, while human review and a stable authoritative record must precede vendor automation. | Approved 2026-07-15 |
| D-032 | Restricted External Broker access is brought into Release 1 under R1-AMD-011 Revision 2; customer access remains excluded. | External collaboration was considered during User Management review. | Withdrawn 2026-07-15; superseded by D-033 |
| D-033 | External Broker remains an interface identity classification only; external authentication and CRM access stay outside Release 1. | The classification is useful for interface identification, but no external-user workspace or data-access scope is currently required. | Approved 2026-07-15 |
| D-034 | The active governed NYSA company-profile version is the authoritative source for proposal legal/contact/regional/brand defaults; proposals retain a safe immutable snapshot of that version and its logo hash. | Company identity must be maintainable by administrators without silent live changes, applied consistently to customer output, and reproducible without exposing private file-storage keys. | Approved and implemented locally 2026-07-15 under R1-AMD-012; CRM Test acceptance pending |
| D-035 | Release 1.1 adds governed Area maintenance and area-specific team-queue routing with an `All areas` fallback under R1.1-AMD-001. | NYSA requires location-aware routing as operations expand beyond one default geography, while unmatched or ambiguous areas must still fail safely to the company queue. | Approved 2026-07-19; implementation pending |
| D-036 | Release 1.1 delivers business-readable inventory amounts, structured handover, calculated listing-publication readiness and governed compatibility between buyer Funding Method and inventory Payment Plan under R1.1-AMD-002. | Listing Executive maintenance and property matching require consistent commercial meanings; live portal publication remains a Release 4 integration rather than a manually selected Release 1.1 status. | Approved 2026-07-19; implementation pending |
| D-037 | Release 2 preserves immutable lead-to-opportunity-to-deal campaign attribution, Release 3A delivers governed campaign management before channel automation, and Release 6 adds financially authoritative CPL, CPA and ROI. | Opportunity outcomes are required before campaign conversion can be authoritative; campaign ownership, budgets and channel execution belong with the Release 3 marketing/integration module; financial return must wait for reconciled spend, deals, revenue and commissions. | Approved 2026-07-22; planning boundary recorded, implementation pending |
| D-038 | Release 2 begins with the recommended additive defaults in `RELEASE_2_SCOPE.md`; every behavior accepted through Release 1.1 remains unchanged unless the NYSA owner explicitly approves a documented amendment. | Release 2 needs a safe compatibility baseline before new Opportunity records can coexist with the accepted lead lifecycle. Additive schema, routes and workspace preserve existing APIs, screens, stages, dashboards and audit history while new behavior is proven independently on CRM Test. | Approved 2026-07-22; R2.0/R2.1 implementation authorized, production excluded |
| D-039 | Release 2 must present Customer, Lead, Opportunity and Listing work as one linked operational flow: reuse authoritative data instead of asking users to re-enter it, preserve every history record, make ownership and next action visible, and coordinate authorized reassignment across the Lead and selected open Opportunities. | Separate records remain necessary for governance, but users should not have to understand database boundaries or maintain the same fact in several places. A clear impact preview, transactional updates and immutable assignment history prevent split ownership, partial updates, duplication and data loss. | Approved 2026-07-22; implement as R2.1A on CRM Test only, production excluded |
| D-040 | Agent and Manager work areas must demonstrate the operating sequence visually and guide each user to the next permitted action, required information and unresolved blocker without requiring knowledge of module boundaries. | Functional depth is valuable only when ordinary users can understand where a case stands and what to do next. Role-specific flow guidance, actionable queues and contextual navigation reduce training effort, missed steps and duplicate entry while preserving governed controls. | Approved 2026-07-22; R2.1A usability and CRM Test acceptance gate, production excluded |
| D-041 | An unassigned Lead does not appear in an Agent dashboard or guided work area; it enters that Agent's operational workspace only after governed assignment to that Agent. | The Agent workspace must contain work the Agent is authorized and expected to perform. Unassigned company/team queue work belongs to Manager, Director and Administrator assignment controls and must not create misleading Agent actions or counts. | Approved 2026-07-22 during R2.1A CRM Test UAT; dashboard/export scope amendment only, production excluded |
| D-042 | R2.2 includes an optional Google Calendar and Google Meet adapter for governed viewings, using `nysarealtyy@gmail.com` during CRM Test while retaining provider-neutral local scheduling and `.ics` fallback. | NYSA approved the available Google account for testing and wants meeting creation inside CORE. The adapter must not make Calendar authoritative, expose OAuth credentials, create duplicates, or leave reschedules and cancellations inconsistent. | Approved 2026-07-22; R2.2 extension on CRM Test only, production excluded |

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
