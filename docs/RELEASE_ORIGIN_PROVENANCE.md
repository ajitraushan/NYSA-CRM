# Origin-only release provenance

Status: mandatory for every future NYSA CRM deployment package.

## Authorized command

```text
npm run release:package -- --commit <full-40-character-origin-SHA>
```

The commit must already be advertised by a branch or tag on
`https://github.com/ajitraushan/NYSA-CRM.git`. The builder fetches and verifies
that exact SHA, creates a temporary detached Git worktree, runs `npm test` in
that worktree, packages only tracked runtime files read from it, writes package
and manifest checksum sidecars, and removes the worktree.

The release receipt uses the committed release test selection. Tests that read
ignored historical ZIP/deployer fixtures under `release-artifacts/` are excluded
because those fixtures are not GitHub source; the receipt records counts and
SHA-256 hashes for both the included and excluded file lists. Functional,
authorization, migration-source and runtime-contract tests remain included.

Local modified files and local untracked files are deliberately irrelevant to
the archive. A local-only commit is rejected because it is absent from the
origin branch/tag advertisement.

## Deployment preflight

Before a package may be used, run:

```text
npm run release:verify-package -- <package.zip> <manifest.json> <manifest.sha256.txt>
```

The verifier fails if provenance is missing, the test receipt is not green,
the package or manifest checksum differs, embedded and external provenance do
not agree, the repository is not the governed GitHub origin, or the commit is
no longer advertised by an origin branch or tag.

## GitHub control

`.github/workflows/release-provenance.yml` runs the provenance-policy tests and
the full suite. A repository administrator must separately enable branch
protection and make the `release-provenance / policy` check required; repository
settings are not changed by committing the workflow.
