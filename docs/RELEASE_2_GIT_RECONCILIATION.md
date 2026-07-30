# Release 2 Git reconciliation

## Reconciled release units

| Unit | Accepted version | Source/evidence point | Migrations | Explicit unit status |
|---|---|---|---|---|
| R2.1A | 2.0.0-dev.14 | `6fc1aee` / `a62d2b8` | 038–039 | Accepted by NYSA owner |
| R2.2 | 2.0.0-dev.17 | `dba3e44` | 040–044 | Accepted by NYSA owner |
| R2.3 | 2.0.0-dev.38.2 | `0a0f797` | Application-only | Accepted by NYSA owner |
| R2.3A | 2.0.0-dev.39.7 | `a911730` | 045 | Accepted by NYSA owner |
| R2.3B | 2.0.0-dev.40.6 | `bb95521` / `f946c78` | 046 | Accepted by NYSA owner |
| R2.4A | 2.0.0-dev.41.4 | `9d932a0` / `28b8b1c` | 047–048 | Accepted by NYSA owner |
| R2.5 | 2.0.0-dev.54 | `5b5e199` | 049–053 | Accepted by NYSA owner |
| R2.6 | 2.1.0-dev.79 | baseline `9073206`, frozen candidate SHA-256 in the unit ledger | 054–059 | Accepted by NYSA owner |

The machine-readable authority is `docs/RELEASE_2_UNIT_SIGNOFFS.json`. Its automated contract
requires all eight units, explicit acceptance authority and evidence, an exact non-overlapping
migration chain from 038 through 059, and the frozen dev.79 candidate hash.

## Signing state

The repository has a configured author name and email, but the audited workstation has no GPG
program, GPG secret key, SSH signing key, `user.signingkey`, `commit.gpgsign`, or `tag.gpgsign`.
Cryptographic signing is therefore **not configured** and must not be claimed.

Unit-level acceptance is explicit and test-enforced. Cryptographically signed release tags remain
a separate hardening action after the repository owner installs or connects an appropriate signing
key. Existing historical commits must not be rewritten merely to add signatures.

## Scope preservation

Reconciliation must stage only the accepted dev.79 application, its regression tests, the exact
accepted packages/checksums, the clone-only rehearsal controls, and these sign-off records.
Unrelated modified and untracked workspace artifacts remain user-owned and must not be swept into
the release commit.
