# CRM Test dev.161 — UAT-079 browser-wiring hotfix

Date: 25 August 2026  
Target: CRM Test only  
Baseline: `2.1.0-dev.160` / migration 104  
Candidate: `2.1.0-dev.161` / no new migration

## Failed retest

The Full Administrator could see `Retire version`, but clicking it produced no response. This remains a failed UAT-079 retest; the hotfix is not a human pass.

## Confirmed RCA

The button used an inline `onclick` handler. CORE's deployed Content Security Policy permits scripts only from `self` and blocks inline script execution. Consequently, the browser discarded the click handler before the retirement reason prompt or API request could run. The real HTTP/database test proved the endpoint, not the browser wiring.

## Correction

- Replace inline `onclick` with `data-retire-model`.
- Bind the action using `addEventListener` after rendering the exact register.
- Scope Test, Approve, Activate and Retire bindings to the Qualification register.
- Preserve the Full-Administrator authority, mandatory reason, transactional retirement and audit evidence.
- Add a runtime UI-wiring test that constructs the rendered-action contract, dispatches the registered click callback, and proves the exact model ID reaches the governed retirement action.
- Add a negative assertion prohibiting the blocked inline handler from returning.

## Verification

- UAT-079 correction and runtime UI-wiring tests: 5/5 passed.
- Ordinary regression: 1,169 passed, 0 failed, 27 protected skipped (1,196 total).
- Protected PostgreSQL evidence remains 27/27 from the unchanged dev.160 database contract.
- Human retest: pending after CRM Test deployment.

## Replacement model rule

A replacement Draft can be created while an existing model is active. Versions increment independently for each stable model code and exact Customer objective. Activation atomically retires only the prior active version with the same code and objective. A legacy row with no objective is not automatically retired by activating Buy, Sell, Rent or Rent-out; it requires the governed Retire action.

## Environment boundary

Deploy only to `/home/nysareal/nysa-core-dashboard-dd6262a-stage`. Do not target Production, the R2 clone, Property Finder, cPanel configuration or any external integration. Keep integration switches disabled and create a new pre-dev.161 backup.
