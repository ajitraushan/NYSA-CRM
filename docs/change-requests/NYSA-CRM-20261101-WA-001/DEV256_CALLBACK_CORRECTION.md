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
The revised candidate above supersedes it. CRM Test now serves DEV256, installed
07:52:34 UTC and verified07:53:08 UTC. All459 runtime hashes, ten PDF formats,
database readiness and exactly one command/cwd-verified worker345949 passed.
All282 original non-ledger tables preserved their values. Both outbound flags
remain false. Production/main/website/REM are unchanged.

Fresh private DEV255 paired backup:
/home/nysareal/crm-release-preparation/20261101-wa256/test-20261101T070834378Z.
User manually downloaded the encrypted pair after the browser download gate
required handoff. Authentication and all7 component hashes passed in memory
at07:50:54 UTC; encrypted copy retained in the approved recovery folder under
test-dev256. Ciphertext SHA256
920990923cfcf2e096401ac3c695f94905a1f7906ca5dce1da0278e57c9fe12e.
No plaintext was downloaded. Backup age passed the installation gate.

360dialog accepted reconfiguration through the new URL-only action. User repeat
inbound test is pending; inspect authenticated durable receipt or the static
rejection reason before claiming the400 resolved. Sending and callback activation
remain false; no outbound message is authorized by this correction.

The evidence branch advanced after packaging; re-verification correctly rejected
the no-longer-advertised commit. The exact candidate is now pinned by origin tag
crm-test/dev256-candidate and mandatory provenance verification passes again.
