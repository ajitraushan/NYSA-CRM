# DEV258 — number-independent WhatsApp workspaces

## Authorized scope

CRM Test review candidate only. This increment provides:

- template drafts, versions and internal approval;
- a Manager/Director review queue;
- governed recipient CSV preview, duplicate decisions and commit;
- reusable audience segments;
- a draft-only campaign composer; and
- a materials catalogue with private optional files.

Agents and Managers prepare in-scope drafts. In-scope Managers or Directors
review. Director visibility is company-wide. Meta status is `Not submitted`
until a separately approved test-number connection is active.

## Explicit exclusions

- no send route, send control or provider dispatch;
- no 360dialog template submission or status webhook in DEV258;
- no automated follow-up or AI conversation;
- no production, website, REM, live-number or workflow change.

The connected-number Stage B increment will submit internally approved
templates through the 360dialog Templates API and reconcile status evidence.
It will allow Agent free-form inbox replies only in an active 24-hour customer
service window and require a current Meta-approved template outside it.
Automation and AI remain Stage C.

## Data and migration

Migration `162_whatsapp_stage_b_workspaces.sql` adds versioned message templates,
materials and campaign-material links; adds owner-team scope to recipient import
batches; and extends the existing fail-closed audit allow-lists. It does not add
a dispatch table, provider credential or provider network path.

## Verification

- all 162 migrations applied under the restricted synthetic fixture role;
- 294 application-schema tables, including 15 `wa_` tables;
- authenticated PostgreSQL route lifecycle: 1 passed, zero failed;
- focused Stage B domain checks: 12 passed, zero failed;
- browser workspace checks: all six sections at 1280, 768 and 390 pixels,
  without page-level horizontal overflow or send controls;
- governed release regression: 1,534 passed, 96 intentionally skipped, zero
  failed.

The first non-escalated release run was blocked only from opening loopback test
servers. Its permitted rerun passed without a code change.

## Release controls

Before CRM Test installation: commit and push the exact candidate, package only
with the governed GitHub-origin builder, verify provenance and archive hashes,
refresh the paired encrypted rollback backup, verify the exact application-root
worker before and after controlled restart, and obtain approval for that exact
candidate. Sending must remain disabled.
