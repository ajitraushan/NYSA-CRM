# Release 3B dev.143 — Property Finder language-header and diagnostic hotfix

The first live dev.142 location step returned an upstream rejection while the same documented request had succeeded with `Accept-Language: en`. dev.143 adds that header to every PF sandbox request and presents the already-redacted diagnostic evidence in the outward UAT screen whenever profile, location or final preflight resolution fails.

The evidence contains the exact method and endpoint, UTC request timestamp, HTTP response status, response content type and redacted response body. It never contains the bearer token, API secret, private owner/contact facts or media delivery URLs.

This remains CRM-Test-only, PF-sandbox-only and no-send. It introduces no listing write, publish, webhook or credit operation and applies no database migration.
