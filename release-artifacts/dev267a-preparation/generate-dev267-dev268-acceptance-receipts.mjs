import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(here, '..', '..');
const outputPath = path.join(here, 'DEV267_DEV268_ACCEPTANCE_RECEIPT_HASHES.json');
const acceptancePath = path.join(here, 'DEV267_DEV268_ACCEPTANCE.md');

const releases = [
  {
    release: 'DEV267',
    version: '2.1.0-dev.267',
    commit: 'd9133a980390fe375af36ef415b84e2f4f4fda4e',
    configSha256: '809e4d84168f39bc43613f5ca28ce15b4fbc6893cba30d18fd397464ba9829b9',
    packageSha256: '62b8f0c6d1c96224e134b5764b66d5010128614a670e593eeef47b228af20ccc',
    manifestSha256: 'dac329aefa0e0749e4567ec16b84fbc8b53b9b1ea8837b3baa411250a3c5a15f',
    backupPath: '/home/nysareal/crm-release-preparation/20261110-dev267-run2/scoped-backup-dev267-phased-run2-63ad3c5',
    receiptDirectory: path.join(repositoryRoot, 'release-artifacts', 'dev267-preparation', 'run2', 'evidence'),
  },
  {
    release: 'DEV268',
    version: '2.1.0-dev.268',
    commit: 'b6272e9c9f2a17a2c082324ec8810391de7bdf01',
    configSha256: '3a1fa077651a99e036658d99787fe5627e5da391484f65f98b95300fa4baf74d',
    packageSha256: '6ebacdb5f19e7c65b5a99e31cbf62d88e7a0b737d736a96367f382b463c43b3c',
    manifestSha256: '447f6a655219c4d108e2cb164d0520bc502cefac2ee55d40b180bece81ca5b5d',
    backupPath: '/home/nysareal/crm-release-preparation/20261111-dev268/scoped-backup-dev268-phased-run1-63ad3c5',
    receiptDirectory: path.join(repositoryRoot, 'release-artifacts', 'dev267a-preparation', 'run1', 'evidence'),
  },
];

const receiptSpecifications = [
  ['STAGE_RESULT.json', 'stage', 'STAGED_AND_VERIFIED'],
  ['BACKUP_RESULT.json', 'backup', 'SCOPED_BACKUP_VERIFIED'],
  ['SCOPED_BACKUP_VERIFIED.json', null, null],
  ['INSTALL_RESULT.json', 'install', 'INSTALLED_STARTED_AND_READY'],
  ['SMOKE_RESULT.json', 'smoke', 'SETTLED_SMOKE_PASSED'],
];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertSha256(value, label) {
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${label} is not exactly 64 lowercase hexadecimal characters: ${value}`);
  }
}

function assertCommit(value, label) {
  if (!/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(`${label} is not exactly 40 lowercase hexadecimal characters: ${value}`);
  }
}

const generated = {
  schema: 'nysa.dev267-dev268.acceptance-receipt-hashes.v1',
  generatedAt: new Date().toISOString(),
  generator: 'Node.js SHA-256 over retained receipt bytes with 64-hex and identity/result assertions',
  allHashesValid: true,
  releases: [],
};

for (const release of releases) {
  assertCommit(release.commit, `${release.release} commit`);
  assertSha256(release.configSha256, `${release.release} config SHA-256`);
  assertSha256(release.packageSha256, `${release.release} package SHA-256`);
  assertSha256(release.manifestSha256, `${release.release} manifest SHA-256`);
  const releaseOutput = {
    release: release.release,
    version: release.version,
    commit: release.commit,
    configSha256: release.configSha256,
    packageSha256: release.packageSha256,
    manifestSha256: release.manifestSha256,
    backupPath: release.backupPath,
    receipts: [],
  };

  for (const [fileName, expectedPhase, expectedResult] of receiptSpecifications) {
    const absolutePath = path.join(release.receiptDirectory, fileName);
    const bytes = await readFile(absolutePath);
    const hash = sha256(bytes);
    assertSha256(hash, `${release.release} ${fileName} SHA-256`);
    const parsed = JSON.parse(bytes.toString('utf8'));

    if (expectedPhase && parsed.phase !== expectedPhase) {
      throw new Error(`${release.release} ${fileName} phase mismatch: ${parsed.phase}`);
    }
    if (expectedResult && parsed.result !== expectedResult) {
      throw new Error(`${release.release} ${fileName} result mismatch: ${parsed.result}`);
    }
    if (parsed.commit && parsed.commit !== release.commit) {
      throw new Error(`${release.release} ${fileName} commit mismatch: ${parsed.commit}`);
    }
    if (parsed.version && parsed.version !== release.version) {
      throw new Error(`${release.release} ${fileName} version mismatch: ${parsed.version}`);
    }
    if (parsed.configSha256 && parsed.configSha256 !== release.configSha256) {
      throw new Error(`${release.release} ${fileName} config mismatch: ${parsed.configSha256}`);
    }

    releaseOutput.receipts.push({
      file: fileName,
      sha256: hash,
      sha256Length: hash.length,
      phase: parsed.phase ?? null,
      result: parsed.result ?? null,
    });
  }

  generated.releases.push(releaseOutput);
}

await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');
const indexSha256 = sha256(await readFile(outputPath));
assertSha256(indexSha256, 'receipt index SHA-256');

const receiptTables = generated.releases.map((release) => {
  const rows = release.receipts.map((receipt) =>
    `| \`${receipt.file}\` | \`${receipt.result ?? 'verified scoped backup contents'}\` | \`${receipt.sha256}\` |`,
  );
  return [
    `### ${release.release} receipts`,
    '',
    '| Evidence | Result | SHA-256 |',
    '|---|---|---|',
    ...rows,
  ].join('\n');
}).join('\n\n');

const acceptance = `# DEV267 and DEV268 acceptance record

- Accepted by: Ajit
- Acceptance date: 11 November 2026
- Environment: CRM Test only
- Application root: \`/home/nysareal/nysa-core-dashboard-dd6262a-stage\`
- Database: \`nysareal_nysa_dev247_smoke\`
- Final installed version: \`2.1.0-dev.268\`
- Final installed commit: \`b6272e9c9f2a17a2c082324ec8810391de7bdf01\`
- Migration ledger: 170
- Public tables: 306
- Governed triggers: 111 enabled triggers across 95 tables
- Canonical schema manifest SHA-256: \`59491afe6bc3613eb665c6cc67f44b1d9122de8c0e73d98fa4eb2dd11a13c944\`
- Trigger-contract file SHA-256: \`70a68947a69b452aed67ff733c73673515dcc37617a2acff11431fb11deabddf\`

## Acceptance scope

DEV267 delivered Prospect Diary, shared suppression enforcement, governed cold-call
controls and the approved manual-DNCR evidence foundation. DEV268 corrected the
hosted Prospect Diary bootstrap recursion, validated malformed company-calling-number
identifiers before the PostgreSQL query and exposed the approved Manager/Director
manual-DNCR controls in Prospect Diary and the WhatsApp suppression workspace.

Ajit separately performed authenticated Prospect Diary and DNCR browser UAT on
11 November 2026 and reported it passed. That browser UAT is owner-supplied evidence,
not part of the unauthenticated Phase D receipt. The remaining display and workflow
observations—including the non-standard dark Prospect Diary banner, near-invisible
prospect name, stale Today/Upcoming counts, DNCR refresh, warning wording/reasons and
duplicate action wording—are explicitly carried into DEV269.

The hosted-deployment controls in \`CRM_CHANGE_POLICY.md\` and mandatory exact-root
worker verification in \`AGENTS.md\` remain acceptance criteria. This record does not
authorize another CRM Test operation or any production change.

## Candidate identities

| Release | Version | Candidate commit | Package SHA-256 | Manifest SHA-256 | Config SHA-256 |
|---|---|---|---|---|---|
${generated.releases.map((release) => `| ${release.release} | \`${release.version}\` | \`${release.commit}\` | \`${release.packageSha256}\` | \`${release.manifestSha256}\` | \`${release.configSha256}\` |`).join('\n')}

- Canonical operator commit: \`63ad3c5595d7e7d58296641351b47ac623ef8071\`
- Canonical operator LF SHA-256: \`5af8bbc8b18cfe8afee8d281913911a105150f3b111dba5c0ec04081da029911\`

## Script-generated deployment receipt hashes

The generator read each retained receipt byte-for-byte, computed SHA-256, asserted
that every receipt hash is exactly 64 lowercase hexadecimal characters and verified
the expected phase, result, version, commit and configuration identity. The structured
index is \`DEV267_DEV268_ACCEPTANCE_RECEIPT_HASHES.json\`, SHA-256
\`${indexSha256}\`. No receipt hash in the tables below was manually transcribed.

${receiptTables}

## Database, rollback and continuity evidence

Both releases completed the four separately approved canonical phases. DEV268 Phase D
recorded eight passing HTTP attempts, database readiness green and exactly one
command/CWD-verified exact-root worker: PID 1576558, command
\`lsnode:/home/nysareal/nysa-core-dashboard-dd6262a-stage/\`, cwd
\`/home/nysareal/nysa-core-dashboard-dd6262a-stage\`.

Verified scoped rollback points:

${generated.releases.map((release) => `- ${release.release}: \`${release.backupPath}\``).join('\n')}

No database restore was run. Production, website, REM and unrelated integrations were
unchanged by both deployments.

## Evidence boundaries and DEV269 carry-forward

Phase D covered \`/\`, health, readiness and protected unauthenticated endpoints. It
did not itself exercise authenticated Prospect Diary editing, DNCR actions, campaign
retirement or the remaining visual corrections. Ajit's separate authenticated browser
UAT covers the deployed Prospect Diary/DNCR path; its display defects are not accepted
as correct behavior and move to DEV269.
`;

await writeFile(acceptancePath, acceptance, 'utf8');
console.log(`WROTE ${outputPath}`);
console.log(`WROTE ${acceptancePath}`);
for (const release of generated.releases) {
  for (const receipt of release.receipts) {
    console.log(`${receipt.sha256}  ${release.release}/${receipt.file}  length=${receipt.sha256Length}`);
  }
}
console.log('ALL_HASHES_64_HEX=true');
