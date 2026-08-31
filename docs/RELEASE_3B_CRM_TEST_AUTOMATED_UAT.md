# Release 3B CRM Test automated UAT

This harness tests the installed `2.1.0-dev.135` Release 3B candidate only at
`https://crm-test.nysarealty.com`. It refuses any other scheme, hostname, port or
path. It does not deploy, migrate, package, delete evidence, call Property Finder
or Bayut, or publish externally.

## Read-only preflight

Run this first. It calls only the public CRM Test health endpoint and writes a new,
timestamped JSON and Markdown report directory.

```powershell
npm run uat:release3b:crm-test
```

Exit code `0` means pass, `1` means a failed check, and `2` means no automated
failure but at least one deliberately blocked check. Reports are written below
`outputs/release3b-crm-test-uat/<run-tag>/`. Existing reports are never replaced.

## Explicit CRM-Test-only mutation mode

Use only a UAT Lead and Inventory records deliberately selected by the UAT Lead.
Supply secrets only through the process environment. Do not paste them into source,
commands committed to Git, report files or screenshots.

```powershell
$env:NYSA_R3B_UAT_BASE_URL='https://crm-test.nysarealty.com'
$env:NYSA_R3B_UAT_CONFIRM='CRM_TEST_RELEASE3B_UAT_CONFIRMED'
$env:NYSA_R3B_UAT_EMAIL='<UAT actor email>'
$env:NYSA_R3B_UAT_PASSWORD='<password>'
$env:NYSA_R3B_UAT_ACTOR_ID='<authenticated UAT actor UUID>'
$env:NYSA_R3B_UAT_RECORD_TAG='<visible non-private tag present in Lead and Inventory labels, for example R3B-UAT-04>'
$env:NYSA_R3B_UAT_LEAD_ID='<tagged UAT Lead UUID>'
$env:NYSA_R3B_UAT_INVENTORY_IDS='<tagged UAT Inventory UUID>,<tagged UAT Inventory UUID>'
$env:NYSA_R3B_UAT_PORTAL_INVENTORY_ID='<one UUID from NYSA_R3B_UAT_INVENTORY_IDS>'
$env:NYSA_R3B_UAT_PRICE='2500000'
$env:NYSA_R3B_UAT_LOCATION_REFERENCE='<approved test portal location reference>'
$env:NYSA_R3B_UAT_PROPERTY_REFERENCE='<approved test property reference>'
$env:NYSA_R3B_UAT_AGENT_REFERENCE='<approved test portal agent reference>'
npm run uat:release3b:crm-test:mutate
```

Optional non-private advertising inputs are
`NYSA_R3B_UAT_PORTAL_TITLE`, `NYSA_R3B_UAT_PORTAL_DESCRIPTION`,
`NYSA_R3B_UAT_PROPERTY_TYPE`, `NYSA_R3B_UAT_OFFERING_TYPE`,
`NYSA_R3B_UAT_DOWN_PAYMENT`, and `NYSA_R3B_UAT_BATHROOMS`. Do not provide owner
identity, contact details, agreements, private authority evidence, cookies, API
keys or permit files to the harness.

Mutation mode authenticates, verifies that the returned actor UUID is the supplied
actor, refuses records whose Lead reference/title or Inventory reference/headline
does not contain the supplied visible UAT tag, and tags immutable notes with a
unique `NYSA-R3B-UAT-*` run tag. It never
deletes those records. It validates requirement authority, conflict blocking,
matching run replay, deterministic counts/ranks, policy/hash controls, exclusions,
shortlist/defer/reject history, stale-write rejection, feedback retention, live
eligibility on shortlist, portal content limits, privacy, permit-readiness blocking
and the no-transmission controls.

## Deliberate limits and manual evidence

- The current matching-run API evaluates the complete eligible Inventory pool and
  has no Inventory allowlist parameter. The harness changes decisions only for an
  explicitly supplied Inventory UUID and reports all other evaluated candidates as
  a known Release 3B gap. The immutable run snapshot can still reference ordinary
  Inventory; obtain UAT Lead approval before mutation mode.
- The harness will not change Inventory status merely to force a live stale-
  eligibility failure. That rejection has targeted domain/route regression coverage;
  live proof needs a separately authorized, explicitly managed test fixture.
- An unresolved website-conflict block is exercised only when the supplied UAT Lead
  already has such a tagged fixture. The harness does not invent or resolve authority
  evidence.
- Human confirmation remains required for visual clarity, the business truth of
  requirement/Inventory/permit facts, role-specific UI behavior, and the operational
  confirmation that vendor portals and credits remain untouched.

The reports contain IDs, hashes-presence indicators, counts and controlled errors,
but never credentials, cookies, owner/contact private data, authority evidence or
full portal payloads.
