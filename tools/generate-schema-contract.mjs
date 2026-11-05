import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const CONTRACT_SCHEMA = 'nysa.database-schema-contract.v1';

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') {
      options.write = true;
      continue;
    }
    if (!argument.startsWith('--')) fail(`Unexpected argument: ${argument}`);
    const name = argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`Missing value for ${argument}`);
    options[name] = value;
    index += 1;
  }
  for (const required of [
    'input',
    'outputDir',
    'triggerContract',
    'sourceCommit',
    'postgresqlVersion',
    'migrationCount',
    'latestMigration',
  ]) {
    if (!options[required]) fail(`Missing --${required.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  if (!/^[0-9a-f]{40}$/.test(options.sourceCommit)) fail('source commit must be a full lowercase SHA-1');
  options.migrationCount = Number.parseInt(options.migrationCount, 10);
  if (!Number.isInteger(options.migrationCount) || options.migrationCount < 1) fail('migration count must be a positive integer');
  return options;
}

function normalizedText(file) {
  return fs.readFileSync(file, 'utf8').replaceAll('\r', '');
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function splitFirst(value, count) {
  const fields = [];
  let offset = 0;
  for (let index = 0; index < count; index += 1) {
    const separator = value.indexOf('|', offset);
    if (separator < 0) fail(`Expected at least ${count} separators in: ${value.slice(0, 160)}`);
    fields.push(value.slice(offset, separator));
    offset = separator + 1;
  }
  fields.push(value.slice(offset));
  return fields;
}

function logicalConstraintRecords(file) {
  const lines = normalizedText(file).split('\n');
  if (lines.at(-1) === '') lines.pop();
  const records = [];
  let current = null;
  for (const line of lines) {
    if (/^[^|\n]+\|[^|\n]+\|[pfucx]\|/.test(line)) {
      if (current !== null) records.push(current);
      current = line;
    } else {
      if (current === null) fail(`Constraint continuation without record in ${file}`);
      current += `\n${line}`;
    }
  }
  if (current !== null) records.push(current);
  return records;
}

function oneLineRecords(file) {
  return normalizedText(file).split('\n').filter(Boolean);
}

function assertUnique(entries, keyOf, label) {
  const keys = new Set();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (keys.has(key)) fail(`Duplicate ${label} key: ${key}`);
    keys.add(key);
  }
}

function canonicalHash(entries) {
  return sha256Bytes(Buffer.from(`${JSON.stringify(entries)}\n`, 'utf8'));
}

function contractDocument(objectType, entries, metadata = {}) {
  return {
    schema: CONTRACT_SCHEMA,
    objectType,
    count: entries.length,
    canonicalSha256: canonicalHash(entries),
    ...metadata,
    entries,
  };
}

function parseConstraints(file) {
  const entries = logicalConstraintRecords(file).map((record) => {
    const [table, name, type, definition] = splitFirst(record, 3);
    return { table, name, type, definition };
  }).sort((left, right) => `${left.table}|${left.name}|${left.type}`.localeCompare(`${right.table}|${right.name}|${right.type}`));
  assertUnique(entries, (entry) => `${entry.table}|${entry.name}|${entry.type}`, 'constraint');
  const byType = Object.fromEntries(['p', 'f', 'u', 'c', 'x'].map((type) => [type, entries.filter((entry) => entry.type === type).length]));
  return contractDocument('constraints', entries, { countsByType: byType });
}

function parseIndexes(file) {
  const entries = oneLineRecords(file).map((record) => {
    const [table, name, definition] = splitFirst(record, 2);
    return { table, name, definition };
  }).sort((left, right) => `${left.table}|${left.name}`.localeCompare(`${right.table}|${right.name}`));
  assertUnique(entries, (entry) => `${entry.table}|${entry.name}`, 'index');
  return contractDocument('indexes', entries);
}

function parseColumns(file) {
  const entries = oneLineRecords(file).map((record) => {
    const [table, name, dataType, nullable, defaultExpression] = splitFirst(record, 4);
    return { table, name, dataType, nullable, defaultExpression };
  }).sort((left, right) => `${left.table}|${left.name}`.localeCompare(`${right.table}|${right.name}`));
  assertUnique(entries, (entry) => `${entry.table}|${entry.name}`, 'column');
  return contractDocument('columns', entries);
}

function parseFunctions(file) {
  const entries = oneLineRecords(file).map((record) => {
    const [name, identityArguments, definitionHex] = splitFirst(record, 2);
    if (!/^(?:[0-9a-f]{2})+$/.test(definitionHex)) fail(`Malformed function definition hex for ${name}`);
    const definition = Buffer.from(definitionHex, 'hex').toString('utf8').replaceAll('\r', '');
    return { name, identityArguments, definitionSha256: sha256Bytes(Buffer.from(definition, 'utf8')) };
  }).sort((left, right) => `${left.name}|${left.identityArguments}`.localeCompare(`${right.name}|${right.identityArguments}`));
  assertUnique(entries, (entry) => `${entry.name}|${entry.identityArguments}`, 'function');
  return contractDocument('functions', entries, {
    normalization: 'SHA-256 of full pg_get_functiondef UTF-8 text after removing carriage returns',
  });
}

function parseSequencesViews(file) {
  const entries = oneLineRecords(file).map((record) => {
    const [kind, name] = splitFirst(record, 1);
    if (!['sequence', 'view'].includes(kind)) fail(`Unexpected sequence/view kind: ${kind}`);
    return { kind, name };
  }).sort((left, right) => `${left.kind}|${left.name}`.localeCompare(`${right.kind}|${right.name}`));
  assertUnique(entries, (entry) => `${entry.kind}|${entry.name}`, 'sequence/view');
  const countsByKind = Object.fromEntries(['sequence', 'view'].map((kind) => [kind, entries.filter((entry) => entry.kind === kind).length]));
  return contractDocument('sequencesViews', entries, { countsByKind });
}

function serialized(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

const options = parseArgs(process.argv.slice(2));
const inputDir = path.resolve(options.input);
const outputDir = path.resolve(options.outputDir);
const triggerContractPath = path.resolve(options.triggerContract);

const inputs = {
  constraints: path.join(inputDir, 'EXPECTED_constraints.txt'),
  indexes: path.join(inputDir, 'EXPECTED_indexes.txt'),
  columns: path.join(inputDir, 'EXPECTED_columns.txt'),
  functions: path.join(inputDir, 'EXPECTED_function_defs.hex.txt'),
  sequencesViews: path.join(inputDir, 'EXPECTED_sequences_views.txt'),
};
for (const file of [...Object.values(inputs), triggerContractPath]) {
  if (!fs.existsSync(file)) fail(`Required contract source is missing: ${file}`);
}

const documents = {
  constraints: parseConstraints(inputs.constraints),
  indexes: parseIndexes(inputs.indexes),
  columns: parseColumns(inputs.columns),
  functions: parseFunctions(inputs.functions),
  sequencesViews: parseSequencesViews(inputs.sequencesViews),
};

const triggerContract = JSON.parse(fs.readFileSync(triggerContractPath, 'utf8'));
if (triggerContract.schema !== 'nysa.database-trigger-contract.v1') fail('Unexpected trigger-contract schema');
if (triggerContract.triggerCount !== 108 || triggerContract.tableCount !== 93) {
  fail(`Unexpected trigger contract counts: ${triggerContract.triggerCount}/${triggerContract.tableCount}`);
}

const outputNames = {
  constraints: 'constraints.json',
  indexes: 'indexes.json',
  columns: 'columns.json',
  functions: 'functions.json',
  sequencesViews: 'sequences-views.json',
};

const outputBytes = Object.fromEntries(Object.entries(documents).map(([name, document]) => [name, serialized(document)]));
const manifest = {
  schema: CONTRACT_SCHEMA,
  generatedFrom: {
    sourceCommit: options.sourceCommit,
    postgresqlVersion: options.postgresqlVersion,
    migrationCount: options.migrationCount,
    latestMigration: options.latestMigration,
    sourceFiles: Object.fromEntries(Object.entries(inputs).map(([name, file]) => [name, {
      file: path.basename(file),
      sha256: sha256File(file),
    }])),
  },
  contracts: Object.fromEntries(Object.entries(documents).map(([name, document]) => [name, {
    file: outputNames[name],
    count: document.count,
    canonicalSha256: document.canonicalSha256,
    fileSha256: sha256Bytes(Buffer.from(outputBytes[name], 'utf8')),
  }])),
  triggers: {
    file: path.relative(path.dirname(outputDir), triggerContractPath).replaceAll('\\', '/'),
    triggerCount: triggerContract.triggerCount,
    tableCount: triggerContract.tableCount,
    canonicalSha256: triggerContract.canonicalSha256,
    fileSha256: sha256File(triggerContractPath),
  },
};

if (options.write) {
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) fail(`Output directory is not empty: ${outputDir}`);
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [name, bytes] of Object.entries(outputBytes)) {
    fs.writeFileSync(path.join(outputDir, outputNames[name]), bytes, 'utf8');
  }
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), serialized(manifest), 'utf8');
}

process.stdout.write(`${JSON.stringify({ write: options.write, outputDir, ...manifest }, null, 2)}\n`);
