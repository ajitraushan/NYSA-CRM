# Release 3B — one controlled Property Finder Production draft

This control exists only for one explicitly authorized, unpublished Property Finder Production draft. It is not a general Production connector and must not be mounted as a browser or CRM route.

## Audit position — 17 August 2026

- The canonical local version is `2.1.0-dev.155`; the PF media boundary was introduced at dev.144 and remains separate from this runner.
- dev.144 creates a separate, pending PF-ready image derivative. It does not send a listing or expose a Production operation.
- The Production draft runner is an unmounted server-side module. No CRM or browser route can invoke it.
- Sandbox and Production use different origins, environment-variable names and credential values. Production configuration fails closed if a Sandbox origin/value is detected.
- All Production switches are off by default. Publication, update, delete, unpublish, webhook and automatic POST retry capabilities are absent.
- PF support confirmed on 7 August 2026 that Sandbox cannot validate NYSA's live DLD/Trakheesi and trade-licence data. The prior Sandbox `422 compliance_client-license-mismatch` is therefore retained as a non-mutating environment mismatch, not a failed live compliance result. Production draft creation remains unexecuted.

The current preparation is local only. It has not been deployed, installed on CRM Test, authenticated to PF Production, or used for any live read/write.

Existing Production-draft package/install artifacts predate the v2 controls in this document and are intentionally not rebuilt under the no-package/no-deploy instruction. They must not be installed or used for a later UAT; a fresh reviewed artifact would require separate authorization.

## Staged authority

1. Offline implementation and tests require no Property Finder or database access.
2. Production reads require a separate user approval and the exact read-preflight confirmation.
3. The sanitized preview, mapping version and deterministic payload hash must be reviewed by the user.
4. Exactly one Production draft POST requires a fresh second approval and the exact create confirmation.
5. Publication is unsupported. The runner exposes no update, delete, publish or unpublish method.

The read approval and create approval are separate records. Both expire after five minutes and must name the exact payload hash, selected Inventory ID, Production environment, exact listing endpoint and `one_unpublished_draft_only` effect. The create approval must also bind the signed preflight.

## Runtime boundary

- Run only from the CRM-Test operator environment; never install or run this code as the Production or R2 application.
- Use only the exact `https://atlas.propertyfinder.com` origin.
- Use separate Production credential environment names and values. Never place secret values in source, command arguments, reports or logs.
- Keep Production reads and draft creation independently disabled except during their separately approved windows.
- Keep the publication switch at `0`; setting it to `1` makes the runner fail closed.
- Load the company licence and permit only in memory from the current immutable evidence. Do not print or persist either value in runner evidence.
- Bind the payload to one explicit CORE Inventory ID/reference/revision, one immutable permit-evidence ID/version/SHA-256, and one dated PF Expert licence-confirmation record.
- Hashes of the permit and licence values must match the exact in-memory payload before authentication is attempted.
- The only capability-bearing scope is `listings:full_access`, because PF does not expose a draft-create-only scope in the present contract. Risk is reduced by an isolated credential, default-off switch, unmounted runner, no publication code, exact endpoint allow-list and one-time signed approval.

## Preflight boundary

The read-only preflight resolves the selected public profile and manually selected location, performs the live Dubai compliance check, searches both draft and non-draft listings for the exact reference, and captures a credit baseline. It returns only booleans, counts, mapping/governance hashes and endpoint/effect confirmation; it never returns the permit, licence, credential, contact or authority values. The signed approval expires after five minutes.

The authorized operator must separately inspect the exact in-memory payload. It must never be copied into a ticket, chat, terminal output, source file or audit report. The deterministic payload hash is the review handle used in approvals and evidence.

## Draft boundary

Immediately before `POST /v1/listings`, the runner repeats the exact-reference duplicate search. The POST is attempted once and has no automatic retry. If its network outcome is indeterminate, the runner performs a read-only exact-reference lookup instead of retrying the POST.

After creation, the runner must verify an unpublished draft state, query credits spent for the returned listing, obtain a second credit balance and prove a zero before/after delta. Any unexpected state, response or credit movement stops the workflow. No publish-price or publish endpoint is called. The signed preflight is consumed before the POST and cannot be reused in the running process.

## Redacted audit evidence

The runner records a small in-memory audit stream and passes the same records to an approved secure sink. A configured sink is mandatory for draft creation, and the attempt record must be accepted before the POST is sent. Records include UTC time, event, Production endpoint/effect, payload and governance hashes, hashed Inventory/listing identifiers, check outcome, draft state, and credit delta. They exclude credentials, tokens, permit/licence values, operator identity, owner/contact data, request bodies and upstream response bodies.

## Exact manual approvals required

No approval is currently granted. A later execution needs all of the following, in order:

1. **Evidence selection approval:** Ajit names the single CORE Inventory record/revision and confirms the immutable permit-evidence version and the dated official trade-licence confirmation shown in PF Expert.
2. **Production read approval:** after reviewing the redacted target summary and exact payload in the secure operator process, Ajit explicitly authorizes the time-bound Production authentication and read-only checks for the displayed payload hash. This may resolve profile, location, compliance, duplicates and the credit baseline only.
3. **Production draft approval:** only after the preflight passes and its signed summary is shown, Ajit separately authorizes exactly one `POST https://atlas.propertyfinder.com/v1/listings` for that same hash and signed preflight, with effect `one_unpublished_draft_only`.
4. **Stop/review decision:** the operator reports the redacted draft-state and zero-credit evidence. No cleanup mutation is automatic. Any edit, deletion or other PF action requires a new explicit instruction; publication is prohibited.

Switches must be enabled only for the corresponding approved window and returned to `0` immediately afterward. A denial, timeout, mismatch, duplicate, unexpected response/state, unknown POST outcome that cannot be resolved uniquely, or non-zero/unknown credit result ends the run.

## Local automated coverage

Tests cover exact Production-origin separation, default-off switches, absent publish/update/delete capability, safe payload fields, immutable evidence and PF Expert confirmation binding, separate fresh operator approvals, deterministic hashes, signed five-minute preflight, duplicate checks, single-use authorization, one POST with no retry, indeterminate-outcome lookup, draft-state verification, before/after credit checks, and redacted audit evidence. All network behavior is mocked.

Manual deletion is outside this runner. It must be performed by the user in PF Expert after reviewing the draft and any retained audit history.
