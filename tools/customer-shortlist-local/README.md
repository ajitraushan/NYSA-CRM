# NYSA CORE Customer Shortlist Local Prototype

This isolated localhost prototype exercises the Release 3 customer shortlist and response workflow
with synthetic data. It is not wired into NYSA CORE, a database, WhatsApp, Property Finder or any
external service.

From the canonical worktree, run:

```powershell
node tools\customer-shortlist-local\server.js
```

Open `http://127.0.0.1:3221` and stop the prototype with `Ctrl+C`.

Suggested offline checks:

1. Select one or more properties as the broker, confirm review and prepare them for customer review.
2. Select more than one prepared property, record the same customer response against all selected
   properties, and inspect the combined next action while each response remains separate.
3. Review the approved floor-plan summary and source-dated market-comparison evidence. Confirm the
   third property displays explicit unavailable states instead of invented values.
4. Select `One property became reserved` and confirm preparation is blocked.
5. Select `One verification expired` and confirm preparation is blocked.
6. Confirm the screen contains no send, publish, contact, credential or external-connection action.
