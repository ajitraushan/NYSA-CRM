# NYSA-CRM-20261028-LEAD-002 — DEV246 Incoming Leads

## Approval and target

Approved by the NYSA owner on 28 October 2026 for CRM Test only. Production and live Meta, WhatsApp, email and voice delivery remain unchanged and disabled. Source baseline is CRM Test `2.1.0-dev.245`, Git commit `ac9bdd1ab28a7ac6a1fdeaffdcce3973e7fc334b`, migration 156. The verified rollback evidence before implementation is `/home/nysareal/crm-backups/crm-test-dev243-pre-20261028T054325Z` with encrypted private local copy `C:\NYSA-Recovery\crm-test-dev243-pre-20261028T054325Z\crm-test-dev243-pre-20261028T054325Z.nyback`. A fresh paired backup and verified encrypted off-server copy are required immediately before deployment.

## User outcome

One **Incoming Leads** workspace is available to Admin and Manager. It is the arrival, validation and response-assignment desk—not a duplicate Lead pipeline.

- Source filters: All, Contact Form, NIA, Meta Instant Forms and Other.
- Campaign filters: all governed campaigns, exact individual source campaign, No campaign and Unmapped campaign.
- Status filters: New, Unassigned, Needs review, Failed and Assigned.
- Received filters: Today, Last 7 days, custom range and all dates.
- Search: customer name, email, phone, Lead reference or source event reference.
- After response assignment the enquiry continues in **Lead response**. It remains visible under **Assigned** for audit.

The latest event in a website/NIA journey is shown once. Raw NIA answers are not rendered by this workspace. Email and phone are masked in the register response; search runs within the authorized server boundary.

## Campaign governance

Migration 157 adds non-customer Meta campaign, ad-set and ad identifiers/names to the reference-only source inbox. Meta customer form answers remain in encrypted expiring evidence. Retrieval maps the exact Meta campaign ID to `marketing_campaigns` through `campaign_external_mappings`; unknown IDs remain visibly unmapped. Creating a later `Meta` mapping reconciles both existing inbox events and linked Leads.

## Access and business rules

- Admin and Manager only; Managers remain scoped to unassigned or managed-team records.
- Assigning a response owner uses the existing audited DEV244 operation.
- Response assignment does not alter canonical Lead owner, team, password, staff assignment or configuration.
- No send job is created by opening or filtering the register. Existing DEV244 rules still create eligible jobs only after explicit response-owner assignment.
- Production is excluded.

## Verification and rollback

Required before deployment: syntax, focused access/intake/campaign tests, full release suite, GitHub-origin packaging and provenance verification. Deployment must apply migration 157 to CRM Test only, keep integrations disabled, verify health/readiness and the Incoming Leads filters, and compare protected production state read-only. On failure, restore the fresh paired CRM Test backup and return the prior CRM Test runtime.
