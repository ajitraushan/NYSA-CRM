# NYSA-CRM-20261028-NIA-001 — DEV245 NIA staging mapping correction

## Authorization and boundary

- Authorized target: CRM Test and `staging.nysarealty.com` only.
- Installed baseline: CRM Test `2.1.0-dev.243`, migration 155; staging bridge 1.0.1.
- Source baseline: undeployed DEV244 commit `f9ba9759bc180f154748e7aecf17392d9e33c0db`, migration 156.
- Production, production NIA, production data/configuration, existing user passwords, team/manager assignments and live integration flags are outside this change and remain unchanged.
- A fresh paired CRM Test/staging backup and verified encrypted private off-server copy are required before deployment. Rollback restores the complete pair and prior selector configuration.

## Corrected contract

| NIA declaration | CORE destination |
|---|---|
| Name, email and WhatsApp | Customer identity/contact channels |
| Apartment, Villa, Townhouse or Land | `lead_requirements.property_types` |
| Purchase timing | `lead_requirements.timeline_code` |
| Investment/home outcome | `lead_requirements.purpose` |
| Studio/bedroom selection | `lead_requirements.bedrooms_min` and `bedrooms_max` |
| Ready/off-plan/compare | Website profile preference and, when unambiguous, Lead business type |
| Intended usage | Website profile preference |
| Location criteria such as transport or family facilities | Website profile declared priorities; never invented as a governed Area |
| Complete original NIA payload | Immutable intake event and source-specific raw evidence |

Format-valid email is promoted to the Customer contact. Domain credibility remains advisory evidence (`credible_domain`, `review_advised` or `check_unavailable`) and does not erase a syntactically valid address or claim that the person was verified.

## Originator and ownership

- NIA events require a separate server-side `NIA_INTAKE_ACTOR_ID` whose active broker name is exactly `System – NIA Intake`. It is a non-posting Viewer with an unshared random password discarded at creation.
- This identity records technical creation and audit events only. It is not a Lead owner and is not copied into customer/team assignments.
- New NIA Leads remain `assignment_status='unassigned'` with `assigned_to=NULL`. Any later team or agent assignment continues through the approved routing/assignment workflow.

## Acceptance criteria

1. A synthetic completed NIA case with email, WhatsApp, Apartment, two bedrooms, an investment purpose, timing, ready/off-plan preference and location criteria produces matching structured CORE fields.
2. The original NIA answers, profile, requirement and normalization codes remain available as controlled audit evidence.
3. A syntactically valid email remains on the Customer while its credibility result is stored separately.
4. The Created-by display is `System – NIA Intake`; Lead owner remains unassigned.
5. Repeated delivery remains idempotent and journey continuation enriches the same Lead.
6. Existing users, passwords, teams, managers, assignments and prior customer values are unchanged.
7. All live outbound providers remain disabled and production remains unchanged.

## Verification evidence

- Focused mapping/continuation regression: 30 passed, zero failed.
- Governed release selection: 1,558 tests; 1,467 passed, 91 restricted-fixture skips, zero failed.
- No new migration. The existing DEV244 migration 156 remains the latest migration and retains its prior isolated rehearsal evidence.
- Package and deployment require the mandatory GitHub-origin builder and provenance verifier after the exact commit is pushed.
