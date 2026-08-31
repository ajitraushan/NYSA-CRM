# CRM Test dev.147 — Customer-to-Lead Search Blocker Hotfix

**Date:** 15 August 2026 (Asia/Dubai)  
**Version:** `2.1.0-dev.147`  
**Target:** CRM Test only  
**State:** local correction; deployment requires fresh explicit approval

## Confirmed defect and RCA

CRM Test contains 63 Customer records. Both dev.145 and dev.146 opened Lead capture by requesting
`/crm/contacts` without a query. That endpoint defaults to ten records. The Lead form then searched
only that truncated browser array. A permitted Customer outside the first ten therefore returned no
match even for a valid partial or wildcard search.

Customer Master → Create Lead passed the correct Customer UUID, but the same form tried to find that
UUID inside the same ten-record array. Failure to find it produced a misleading lifecycle/duplicate
eligibility message even when the exact Customer was active, duplicate-approved/not-required and KYC
verified. Approval and KYC were not the cause.

This was a latent pagination-boundary defect already present in dev.145. Earlier UAT did not expose
it because fixtures and selected records remained within the first ten returned Customers.

## Correction

- Customer Master → Create Lead loads the exact scoped Customer through `/crm/customers/:id` and
  evaluates lifecycle and duplicate-resolution status only after that exact record is returned.
- Manual Lead customer search sends every non-empty name, email, phone, partial or `*` wildcard
  query to `/crm/contacts?q=...`.
- SQL applies permission scope and the search predicate across the full permitted Customer register
  before result pagination. The browser no longer filters a prefetched first page or slices matches
  to twelve records.
- Matching results are retrieved in stable 100-row transport pages until the complete scoped result
  count is loaded. The 100-row batch size is not a search or display limit: `*` returns all 63
  current permitted Customers, and future registers continue page-by-page without silent omission.
- The authoritative Lead-creation endpoint continues to revalidate exact Customer scope,
  lifecycle, duplicate-resolution status and required contact channels.

## UAT acceptance

1. From Customer Master, open an active approved/not-required Customer beyond alphabetical row ten
   and create a Lead without an eligibility error.
2. In Capture new Lead, search that Customer by a partial name such as `Aug`, full name, email,
   phone and supported wildcard form; select the exact result.
3. Confirm the created Lead retains the selected Customer UUID and no duplicate Customer is created.
4. Confirm an inaccessible Customer is not disclosed and a genuinely pending, rejected or inactive
   Customer remains blocked with the accurate business reason.

No CRM Test, Production, Production/R2 clone or external integration mutation is authorized by this
local correction record.
