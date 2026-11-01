# Sandbox callback HTTP400 correction

1 November 2026, Dubai. User authorizes diagnosis, narrow correction, regression
and CRM Test deployment, with sending paused and no unrelated changes.

## Evidence and scope

DEV255 callback configuration was accepted, but the user's inbound test reached
the exact sandbox endpoint and received400/33bytes. No authenticated event was
persisted. The existing generic error does not identify the rejected field;
do not claim the precise original rejection cause has been established yet.

The sandbox parser does **not** require entry.id, value.metadata or
messaging_product. A real HTTP regression explicitly proves this minimum packet
is accepted when authenticated. No live receiver validation is relaxed.

The user subsequently specifies the provider accepts only url in configuration
and directs authentication using a secret URL-path token on a separate sandbox
receiver. The revised candidate follows that contract: url-only configuration,
HMAC-derived256-bit path token bound to saved connection ID and revision,
timing-safe verification, then exact saved-recipient matching. Token/credentials
are never returned by status, audit or error responses. URLs containing tokens
must be treated as credentials; hosting access logs remain private and must not
be copied verbatim into reports.

Authenticated validation failures record only a static allowlisted reason in
the existing sandbox audit table after the failed transaction rolls back. No
phone, message, token, API key or raw body is recorded in that diagnostic.

## Candidate and checks

- Runtime candidate2.1.0-dev.256, GitHub commit
  e9af2be51e1925a9763986419eb54ffb253f5ea7.
- Archive SHA256 c3b82db96801a238a69e787db86e1d7ac39d39f1e9724f63c955f2bc1309aef9.
- Manifest SHA2569269872264830b1a02de77e8d81c47dbee5910a0481426cd1a5cfe562c59ad98.
- Origin build:1616 tests,1521 passed,95 intentionally skipped,0failures.
- Focused HTTP/protocol19/19; restricted synthetic PostgreSQL lifecycle9/9.
- Tests cover missing live metadata, URL-only configuration, invalid and stale
  token rejection even with a valid Basic header, wrong sender, bounded request,
  encrypted persistence, replay/concurrency and paused outbound controls.
- Hosted staging:459 runtime files and all10PDF formats passed.
- No migration; ledger remains160. No live adapter, workflow or permission edits.

## Deployment status

The initial diagnostic-only candidate2760b58 was staged but never installed.
The revised candidate above supersedes it. CRM Test remains DEV255, paused,
after exact-worker restart verification (one worker3651688, database ready).
Production/main/website/REM are unchanged.

Fresh private DEV255 paired backup:
/home/nysareal/crm-release-preparation/20261101-wa256/test-20261101T070834378Z.
Manual encrypted download pending because the browser's download security gate
could not acquire authority. Verify the new encrypted pair off-server before
installation. Recheck freshness/baseline immediately before mutation. Do not use
the earlier DEV254 backup as the DEV255 credential rollback.

After installation, reconnect the sandbox callback using the new URL-only action,
then repeat the user's inbound test and inspect authenticated durable receipt or
the static rejection reason. Sending and callback activation remain false; no
outbound message is authorized by this correction.
