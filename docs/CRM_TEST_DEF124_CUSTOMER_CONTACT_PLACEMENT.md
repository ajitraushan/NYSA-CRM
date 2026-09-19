# DEF-124 — Customer-contact action and conversation-history placement

**Recorded:** 19 September 2026 (Asia/Dubai)  
**Environment observed:** CRM Test  
**Status:** Implemented and regression-tested in DEV208 source; not deployed

## Observation

On an assigned, unassessed Lead, the interface displays **Qualification locked until Customer
contact**, but no visible customer-contact recording action appears beside that message.

The governed action was moved into **Customer interaction & enrichment → Completed interaction**.
When the Lead has no activity, the empty conversation-history block reserves a large blank area before
the interaction workflow. This pushes the relevant action below the visible area and makes the section
appear empty.

## Expected presentation

- Keep the qualification lock and its reason visible.
- Place a clear **Record customer contact** action beside the qualification lock.
- The action must open the existing governed completed-interaction form; it must not bypass controlled
  channel, outcome, discussion, next-action or due-date fields.
- Present the contact form/workflow before prior conversation details.
- Show conversation/activity history below the contact form under a clear history heading.
- An empty history must not create excessive whitespace or obscure the contact action.
- Qualification must remain locked until a completed substantive Customer-contact outcome is saved.

## Scope boundary

This is a Lead-workspace placement and clarity defect. The authoritative backend customer-contact
evidence rule, first-contact timestamp, qualification gate, activity audit history and permissions must
remain unchanged.

DEV208 changes presentation only: the existing governed **Record customer contact** action is placed
beside the qualification lock and the conversation history follows the contact workflow. Backend
evidence, qualification and permission rules are unchanged. CRM Test and Production remain unchanged
until an explicitly approved deployment.
