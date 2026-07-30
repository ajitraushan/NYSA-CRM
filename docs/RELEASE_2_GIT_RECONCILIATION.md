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
| R2.6 | 2.1.0-dev.79 | reconciled source `5669016`, baseline `9073206`, frozen candidate SHA-256 in the unit ledger | 054–059 | Accepted by NYSA owner |

The machine-readable authority is `docs/RELEASE_2_UNIT_SIGNOFFS.json`. Its automated contract
requires all eight units, explicit acceptance authority and evidence, an exact non-overlapping
migration chain from 038 through 059, and the frozen dev.79 candidate hash.

## Signing state

Release attestations use the dedicated SSH Ed25519 signing key for principal
`ajitraush@gmail.com`, fingerprint
`SHA256:Z9KhEvKwhC3kdyesE2+PbjbIVBc0Nr7GcMtJRcKf6Mc`. The public key is recorded in
`docs/GIT_ALLOWED_SIGNERS`; the private key remains outside the repository.

Each unit has a distinct signed tag recorded in the machine-readable ledger. Existing historical
commits are not rewritten merely to add signatures.

## Scope preservation

Reconciliation must stage only the accepted dev.79 application, its regression tests, the exact
accepted packages/checksums, the clone-only rehearsal controls, and these sign-off records.
Unrelated modified and untracked workspace artifacts remain user-owned and must not be swept into
the release commit.
