# CRM Future Change Backlog

This register records approved future changes that are not part of the current
release candidate. An entry in this file is not authorization to deploy the
change to CRM Test or Production.

## ENH-LEAD-CALL-001 — Post-call outcome capture and automatic Lead status update

- **Type:** Enhancement
- **Priority:** To be prioritised
- **Status:** Recorded for a future release
- **Recorded:** 26 September 2026
- **Current release impact:** Excluded from DEV211
- **Affected area:** Lead contact workflow and activity timeline
- **Actors:** Assigned Sales Agent; integrated telephony provider when configured

### Current behaviour

The Lead **Call** action opens the linked telephone number in the device phone
application. Opening that application does not prove that a call connected. The
agent must return to CORE and record the completed interaction and its outcome.
When a successful contact outcome is recorded, CORE already moves a Lead from
**New** to **Contacted** and records the first-contact timestamp. Unsuccessful
outcomes remain activity evidence without falsely marking the Lead contacted.

### Requested change

After an agent initiates a call from a Lead's linked phone number, present the
call-outcome form when the agent returns to CORE. If an approved telephony
integration later provides a verified call result, ingest that result through a
governed, idempotent integration boundary and correlate it to the exact Lead,
Customer, agent and call attempt.

### Business rules

1. Starting or opening a call must never by itself change Lead status.
2. A successful governed outcome may automatically move **New** to
   **Contacted** and set the first-contact timestamp.
3. **No answer**, **Voicemail left**, **Invalid contact** and **Unreachable**
   must not mark the Lead as Contacted.
4. The linked Customer phone number must be used only after the existing
   contact-restriction and consent checks pass.
5. Every attempt and result must retain actor, Lead, Customer, telephone channel,
   timestamps, outcome, source and correlation identifier in the audit trail.
6. Duplicate provider callbacks must be idempotent and must not create duplicate
   activities or repeat a stage transition.
7. The agent must be able to review and correct an incorrectly captured outcome
   through the governed activity-correction process; history must be preserved.

### Acceptance criteria

- Clicking **Call** records no successful contact and does not change the Lead.
- Returning to CORE after a CRM-initiated call opens or prominently offers the
  outcome form for that exact Lead.
- Recording a successful outcome creates one Call activity, sets first contact,
  and changes **New** to **Contacted** once.
- Recording an unsuccessful outcome creates the Call-attempt evidence but leaves
  the Lead stage unchanged.
- A verified telephony callback, when that integration exists, produces the same
  governed result without bypassing authorization, consent or audit controls.
- Automated tests cover successful, unsuccessful, cancelled, duplicate-callback,
  stale-session, cross-Lead and restricted-contact cases.

