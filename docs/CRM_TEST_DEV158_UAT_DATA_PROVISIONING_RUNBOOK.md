# CRM Test dev.158 human-UAT data provisioning runbook

## Purpose and boundary

This process creates reusable, visibly synthetic prerequisites for one full human UAT round on **NYSA CORE 2.1.0-dev.158**. It does not perform the decisions or exceptions that the human tester must observe.

It prepares:

- 5 baseline Areas and 4 baseline Teams
- 8 additional role users; the existing authorized Administrator is the ninth test identity
- baseline routing rules at priorities 10, 20, 30, 50 and 9999 (an exact active existing rule is reused rather than duplicated)
- 4 additional Contact fixtures and one pending duplicate-review draft
- 5 Companies
- 12 Customers
- 16 Leads
- 16 draft Inventory records
- 4 transaction counterparties

It intentionally does **not** perform user suspension/revocation/role reversal, disposable Area/Team/routing-rule maintenance, duplicate resolution, Lead acceptance/rejection/rerouting, qualification, Inventory verification/availability/closure, or Opportunity/Viewing/Offer/Booking/Deal progression. Those remain human tests. Property Finder and every external integration remain excluded.

## Safety controls

- Default execution is an offline plan. It makes no network call.
- `--preflight` performs only health/readiness checks against the exact approved CRM Test origin.
- `--apply` refuses any host other than `https://crm-test.nysarealty.com` and requires version `2.1.0-dev.158`.
- Apply requires an exact confirmation phrase plus an explicitly matched actor ID.
- Login values are environment-only. Credentials, cookies, email addresses and phone numbers are omitted from output.
- Records use the visible tag `UAT158-HUMAN`; rerunning reuses exact tagged records instead of creating another set.
- The process never deletes or rolls back records.

## Step 1 — inspect the offline plan

```powershell
npm run uat:dev158:data:plan
```

This is safe to run at any time. It prints counts, record codes and the excluded workflow actions. Generated contact channels use the reserved `example.invalid` domain and a non-routable synthetic number pattern.

## Step 2 — read-only CRM Test preflight

```powershell
npm run uat:dev158:data:preflight
```

Expected result: the exact CRM Test origin reports version `2.1.0-dev.158` and ready database state. No login or data mutation occurs.

## Step 3 — identify existing prerequisites

Use one already-approved, active full CRM Test Administrator as the bootstrap identity. The process creates and activates eight synthetic role users, three Teams and three Areas. It asks for one temporary 12+ character password for the new UAT role users; this value is used only in memory and is never printed or stored. Disposable access changes, Team/Area retirement and routing-rule exercises remain manual UAT actions.

## Step 4 — guarded apply (requires a separate explicit approval)

Do not run this merely because the script exists. The user must explicitly approve CRM Test data creation in the current task first. Then set the required values in the process environment without pasting them into chat or storing them in a file, and run:

```powershell
node scripts/dev158-manual-uat-provisioner.mjs --apply
```

Required environment variables are `NYSA_UAT158_CONFIRM` with the exact value `CRM_TEST_DEV158_UAT_DATA_PROVISION_CONFIRMED`, `NYSA_UAT158_EMAIL`, `NYSA_UAT158_PASSWORD`, and `NYSA_UAT158_TEST_USER_PASSWORD`. `NYSA_UAT158_BASE_URL` is optional, but only the exact approved origin is accepted.

The result contains only record type, synthetic code, CRM UUID/reference, and created/reused counts. It does not contain credentials or contact channels.

### Recommended secure entry method

From a PowerShell terminal opened in the canonical worktree, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dev158-uat-provisioning.ps1
```

The launcher asks for every value using masked prompts, invokes the provisioner in that same temporary process, and clears the environment values afterward. It does not write them to `.env`, shell history, source files or reports.

## Step 5 — human testing begins

Use the created/reused record codes with:

- `CRM_TEST_DEV158_COMPLETE_MANUAL_UAT_ROUND.md` for the execution checklist
- `CRM_TEST_DEV158_MANUAL_UAT_DATA_AND_ADMIN_SETUP.md` for allocation and sample values
- `CONSOLIDATED_CRM_TEST_END_TO_END_UAT.md` for observed results and defects

Every action under test must still be performed and observed by the assigned human role. Provisioning success is not a UAT pass.

## Sanitized actual-data dump

After provisioning, run the read-only dump launcher from the canonical worktree:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-dev158-uat-dump.ps1
```

It uses masked Administrator login prompts and writes timestamped `uat158-data.json` and `uat158-data.md` files under `outputs/dev158-uat-data-dump/`. The export contains actual matching record names, references, workflow states and non-private test facts. It excludes credentials, sessions, invitations, activation codes, emails, phone numbers, addresses and private authority/contact evidence.
