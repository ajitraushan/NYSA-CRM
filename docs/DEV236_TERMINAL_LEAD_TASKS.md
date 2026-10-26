# DEV236 — Terminal Lead follow-up lifecycle

CRM Test only. Baseline DEV235 / 0924cc9cabe5135f80ce6fba32b15bb91ed99b3c / migration 137. Fresh verified app/database backup required before deployment.

Won Lead NYSA-LD-202610-000001 retained an Open Warm qualification task. Closure did not retire its obsolete follow-up. Additionally the dashboard CASE counted any past-due Cancelled task as overdue.

Migration 138 cancels open/in-progress general Lead, qualification and customer-response follow-ups on Won/Lost stage or closed_won/closed_lost current status, preserving original outcome text and recording an automatic cancellation reason and audit event. Audit attribution retains the original task creator and explicitly labels execution as automatic, not a human cancellation. Existing terminal Lead follow-ups are reconciled once. Creation or reopening of these tasks on closed Leads is also guarded; active Leads remain unchanged. Follow-up pointers are recalculated at closure/backfill.

Independent proposal correction, document/compliance, marketing and leave work is not auto-cancelled. Completed/cancelled historical tasks are preserved; reopening a Lead does not resurrect obsolete tasks. No permissions or approval rules change.

Only JavaScript runtime change is one dashboard CASE branch separating cancelled from overdue. No UI/layout/target/ownership changes. SQL guard covers existing Lead and Opportunity closure paths without changing their decisions.

Tests: actual PostgreSQL trigger/backfill execution, Won/Lost and current-status closure, open/in-progress cleanup, preservation of active Leads/completed work/independent approvals, late tasks/reopen, idempotent audit, Lead reopen, dashboard classification and transactional rollback. Full fixture migration rehearsal precedes release. Full release regression and extracted-package checks precede CRM Test deployment from canonical origin-only package.

Rollback: fresh pre-DEV236 application archive and database dump. Previous application is schema-compatible; migration and audited cancellations remain unless controlled database recovery is explicitly needed. Production and R2 excluded.
