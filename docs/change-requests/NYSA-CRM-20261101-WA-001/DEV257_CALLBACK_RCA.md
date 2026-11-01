# DEV257 sandbox callback RCA

1 November 2026. Target: CRM Test only; sending remains paused.

## Confirmed cause

The authenticated DEV256 callback wrote callback_rejected with static reason
alternate_identity at 2026-11-01T07:54:40.507Z (11:54:40 Dubai). Its parser rejected
an accompanying user ID even after matching the approved phone. This is the
confirmed latest failure, not a claim that the original DEV255 failure's exact
field was captured. No payload or identifier is copied into this report.

Private server comparison confirms the saved recipient kind is phone, its value
matches the user's approved test phone, connection paused=true and sending=false.
The presumed saved-number mismatch is not supported by that evidence.

## Narrow correction

Phone-scoped messages and statuses accept a syntactically valid accompanying
BSUID only after the exact approved phone matches. Both identifiers are retained
inside the already encrypted event evidence. A missing or different phone remains
rejected even with a valid BSUID. BSUID-scoped behavior is unchanged.

Recipient failures now carry recipient_missing/recipient_mismatch diagnostics.
Only the isolated sandbox defers malformed JSON to its authenticated route;
empty/invalid bodies produce safe empty_body/invalid_json audit reasons after
authentication. Other JSON endpoints and the live WhatsApp adapter are unchanged.
No unauthenticated diagnostic writes or outbound activation are introduced.

## Verification and deployment state

- GitHub commit b4a12928aa3678757d5c725a7f1d3861707c9c9c.
- Mandatory origin package: 1617 selected tests,1522 passed,95 intentional skips,
  zero failures. Focused sandbox HTTP/protocol:20 passed.
- Archive SHA256 bd87f5cd153f11a305fa3169409874db84905332b37dcecb603304f616fe7f9f.
- Manifest SHA256 13dae90a5d00c35f3341df4256366324dd61564482a82b975a90d42e2dd75b91.
- Provenance verification passed. Hosted staging passed459 hashes and10 PDFs at
  08:16:38 UTC. No migrations; ledger160.
- Fresh paired DEV256 backup captured after exact worker345949 quiescence:
  /home/nysareal/crm-release-preparation/20261101-wa257/test-20261101T081441334Z.
  The downloaded encrypted pair authenticated all seven components in memory at
  08:21:42 UTC, wrote no plaintext locally, and is retained in the approved
  `NYSA-Recovery/20261031-dev251-preparation/test-dev257` folder.
- The first installer attempt failed closed before copying files because a worker
  appeared during the stop/install gap. A single controlled quiesce-and-install
  sequence then succeeded. DEV257 verification completed at 08:23:48 UTC: all
  459 runtime hashes, ten PDFs, database readiness, ledger160 and all282 preserved
  original tables passed; exactly one exact-root command/cwd-verified worker
  (`999701`) served readiness.
- Real post-fix acceptance passed: after the approved phone sent the DEV257 test,
  the protected Admin status reported `Authenticated callback observed` and one
  verified reply event. No test submission or outbound message was created.
- Production/main/website/REM remain unchanged. Sending and callback activation
  remain false; no outgoing test was authorized or performed.
