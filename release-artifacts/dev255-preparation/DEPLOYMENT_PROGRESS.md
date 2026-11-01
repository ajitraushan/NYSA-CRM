# DEV255 approved Test deployment progress — 1 November 2026

User approved exact commit c4a6a04de892e50cf933ecb1821f202576b76e8d,
archive aab165065a0aef04243e92517e2b2aa50be80cd889163bf643ca4e6ecbe16160.
Mandatory GitHub provenance verification was refreshed and passed.

Hosted staging passed: all459 candidate runtime files verified, dependencies
unchanged, ten approved PDF formats passed. DEV254 baseline455 files matched.

Exact Test worker2497246 was verified by command and cwd, then stopped safely.
Fresh paired backup created in private hosting directory
`/home/nysareal/crm-release-preparation/20261101-wa255/test-20261101T063433359Z`.
All seven components encrypted with AES-GCM/RSA wrapping. Ciphertext409250647
bytes. No plaintext downloaded.

Browser download security gate could not acquire download authority/origin.
Deployment recovery gate was not bypassed. User asked to download only the
encrypted .bin and .header.json files into Downloads for in-memory verification.

CRM Test was restarted unchanged on DEV254: database ready, exactly one verified
worker2941203. No runtime replacement, migration160, configuration/key creation,
provider call, production/main/website/REM change occurred.

Next: verify encrypted download using prepared verify-dev255-recovery.ps1;
refresh quiesced backup before installation if baseline has changed or90min
freshness exceeded; then run approved install and verify phases. Approval persists.
