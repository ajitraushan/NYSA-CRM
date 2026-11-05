# DEV264 acceptance record

- Accepted by: Ajit
- Acceptance date: 5 November 2026
- Environment: CRM Test only
- Version: `2.1.0-dev.264`
- Application commit: `8d9be904149bec1b9b6d56dd8a39f17c2789fd12`
- Migration: 168
- Public tables: 303
Governed trigger contract: 108 enabled triggers across 93 tables

## Accepted scope

DEV264 restores and verifies the complete 108-trigger contract on CRM Test. The
four separately approved hosted phases completed with settled smoke checks,
database readiness green and exactly one command/CWD-verified exact-root
worker. The deployed GitHub-origin package SHA-256 is
`2bc93ff0b98ae9734a80054ca89577f07c7295b0326239d1d3f37d4b7ca1cd75`;
the manifest SHA-256 is
`02f9f6f2efa4c7dd1a4ecdc7111bebd2a489366c5d3cb4b75bfe8fd5b449c5b5`.

The hosted-deployment controls in `CRM_CHANGE_POLICY.md` and the mandatory
hosted-worker verification in `AGENTS.md` remain acceptance criteria for every
later release. This acceptance does not authorise another deployment.

## Acceptance tests

- Layer 1 passed.
- Layer 2 passed for every rule with suitable data: R-03, R-04, the corrected
  R-05 rerun, R-08a/b and I-01 through I-07. Other Layer 2 rules were recorded
  as not exercised because CRM Test had no suitable rows; they were not
  represented as passes.
- Layer 3 WhatsApp simulator UAT passed W-01 through W-15.
- Layer 4 passed in the approved reduced scope.
- The packaged governed suite ran 1,652 tests: 1,556 passed, 96 intentionally
  fixture-gated and zero failed.
- Deferred cases D-01 through D-12, WN-01 through WN-16 and WL-01 through
  WL-05 remain recorded in the DEV264 E2E test plan and are not silently
  converted to passes by this acceptance.

## Known limitation — DEV265

DEV264 is accepted with a separately tracked database-schema limitation. The
read-only DEV264 schema-drift investigation found that CRM Test is missing:

- 975 foreign keys;
- 18 primary keys;
- 15 unique constraints; and
- 404 indexes.

This limitation is tracked as DEV265. Step 5 found 17 affected UAT264 simulator
rows: 12 orphan messages and 5 orphan notifications. All 18 missing-primary-key
checks and all 15 missing-unique checks found zero duplicate or NULL-key
violations. The Step 6 report SHA-256 is
`c97d409f6381c77a470e586c120d6a24578432e9848179e0d8841e9e0858546a`.

DEV264 acceptance does not accept the missing schema objects as correct and
does not authorise their repair. DEV265 design, build, package and any later
deployment remain separately governed.

## Operational state at acceptance

- CRM Test: `2.1.0-dev.264`, accepted.
- Database: migration 168, 303 public tables, 108 enabled governed triggers.
- WhatsApp simulator: paused; fault mode `none`.
- Production, website, REM, Meta, 360dialog and live messaging: unchanged.
