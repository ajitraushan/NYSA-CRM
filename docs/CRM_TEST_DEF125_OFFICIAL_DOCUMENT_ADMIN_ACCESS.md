# DEF-125 — Admin cannot maintain official-document requirements

**Recorded:** 19 September 2026 (Asia/Dubai)  
**Environment observed:** CRM Test  
**Severity:** Blocker — prevents valid end-to-end Deal-to-Finance UAT  
**Status:** Implemented and authenticated-runtime-tested in DEV208 source; not deployed

## Observation

An authenticated Admin can open **Administration → Official document requirements**, but both the
document-definition register and workflow-step rule register fail with:

> Official document evidence is restricted to NYSA staff

The message appears twice because the screen makes separate requests for document definitions and
workflow-step rules, and both requests are rejected.

## Root cause identified from the current source

The official-document router applies an internal-CRM-identity check to every route before evaluating
the Admin-only configuration permission. The configuration endpoints then separately require Admin.
Following the role-access separation, configuration-only Admin does not carry an operational CRM
identity, so the router-wide prerequisite blocks the very Admin role authorized to maintain this
configuration.

## Expected behavior

- Admin may create, activate, revise and retire official-document definitions and workflow-step rules.
- Admin remains configuration-only and receives no Deal, Customer, Lead, Inventory or evidence-case
  operating access from this permission.
- Operational official-document evidence routes remain restricted to permitted internal CRM roles and
  record scope.
- Authorization must be separated by route capability rather than restored through a broad Admin
  operational identity.
- The two registers must load successfully before a rule can be created and activated.

## Scope boundary

The correction must split configuration authorization from operational evidence authorization. It
must not grant Admin access to business records or weaken existing Deal/Inventory scope checks.

DEV208 separates Admin configuration endpoints from operational evidence endpoints. Authenticated
runtime verification confirms Admin receives `200` for configuration and `403` for operational
evidence. CRM Test and Production remain unchanged until an explicitly approved deployment.

## UAT impact

This defect blocks the intended end-to-end sequence:

```text
Official-document rule configuration
→ Deal evidence and completion gate
→ Commission receivable/invoice
→ Company payment receipt
→ Agent commission calculation
→ MD payout approval
→ Payout recording
```

With no active rule, the Deal screen can report the workflow step as ready because it evaluates zero
requirements. Continuing from that state would bypass the control being tested. Existing Finance
screens may still be inspected independently, but the resulting exercise is not valid evidence of the
complete Deal-to-Finance workflow.
