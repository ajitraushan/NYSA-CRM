import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const ordered = (rows, key) => [...rows].sort((a, b) => key(a).localeCompare(key(b)));

export function loadSchemaContractIdentity({
  helperFile,
  expectedHelperSha256,
  contractDirectory,
  manifestFile,
  expectedManifestSha256,
  triggerContractFile,
  label = 'schema-contract',
}) {
  if (!helperFile || !fs.existsSync(helperFile)) throw new Error(`${label} helper file missing: ${helperFile || '(not configured)'}`);
  const observedHelperSha256 = sha256(fs.readFileSync(helperFile));
  if (observedHelperSha256 !== expectedHelperSha256) {
    throw new Error(`${label} helper hash mismatch: expected ${expectedHelperSha256}, observed ${observedHelperSha256}`);
  }
  if (!manifestFile || !fs.existsSync(manifestFile)) throw new Error(`${label} manifest file missing: ${manifestFile || '(not configured)'}`);
  const observedManifestSha256 = sha256(fs.readFileSync(manifestFile));
  if (observedManifestSha256 !== expectedManifestSha256) {
    throw new Error(`${label} manifest hash mismatch: expected ${expectedManifestSha256}, observed ${observedManifestSha256}`);
  }
  if (!triggerContractFile || !fs.existsSync(triggerContractFile)) throw new Error(`${label} trigger contract file missing: ${triggerContractFile || '(not configured)'}`);
  return {
    contract: loadSchemaContract(contractDirectory, triggerContractFile),
    identity: {
      helperFile,
      helperSha256: observedHelperSha256,
      manifestFile,
      manifestSha256: observedManifestSha256,
      triggerContractFile,
      triggerContractSha256: sha256(fs.readFileSync(triggerContractFile)),
    },
  };
}

export function loadSchemaContract(directory, triggerContractFile) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const read = (name) => JSON.parse(fs.readFileSync(path.join(directory, manifest.contracts[name].file), 'utf8')).entries;
  const triggerContract = JSON.parse(fs.readFileSync(triggerContractFile, 'utf8'));
  return {
    manifest,
    constraints: read('constraints'),
    indexes: read('indexes'),
    columns: read('columns'),
    functions: read('functions'),
    sequencesViews: read('sequencesViews'),
    triggers: triggerContract.triggers.map(({ table, name, function: functionName, enabled }) => ({
      table, name, function: functionName, enabled,
    })),
  };
}

export async function readDatabaseSchemaContract(client) {
  const constraints = (await client.query(`
    SELECT conrelid::regclass::text AS table, conname AS name, contype AS type,
           pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
     WHERE connamespace='public'::regnamespace AND contype IN ('p','f','u','c','x')
     ORDER BY 1,2`)).rows.map((row) => ({
       ...row,
       // PostgreSQL 16 renders the SQL-standard TRIM spelling where 13 emits
       // the equivalent btrim() spelling. Normalize only that proven synonym.
       definition: row.definition.replace(/TRIM\(BOTH FROM ([^)]+)\)/g, 'btrim($1)'),
     }));
  const indexes = (await client.query(`
    SELECT tablename AS table,indexname AS name,indexdef AS definition
      FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2`)).rows;
  const columns = (await client.query(`
    SELECT table_name AS table,column_name AS name,data_type AS "dataType",
           is_nullable AS nullable,COALESCE(column_default,'') AS "defaultExpression"
      FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name NOT IN (SELECT viewname FROM pg_views WHERE schemaname='public')
     ORDER BY 1,2`)).rows;
  const functions = (await client.query(`
    SELECT p.proname AS name,pg_get_function_identity_arguments(p.oid) AS "identityArguments",
           pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
     ORDER BY 1,2`)).rows.map(({ definition, ...row }) => ({
       ...row,
       definitionSha256: sha256(Buffer.from(definition.replaceAll('\r', ''), 'utf8')),
     }));
  const sequencesViews = (await client.query(`
    SELECT 'sequence' AS kind,sequencename AS name FROM pg_sequences WHERE schemaname='public'
    UNION ALL SELECT 'view',viewname FROM pg_views WHERE schemaname='public'
    ORDER BY 1,2`)).rows;
  const triggers = (await client.query(`
    SELECT c.relname AS table,t.tgname AS name,
           n.nspname||'.'||p.proname AS function,t.tgenabled AS enabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_proc p ON p.oid=t.tgfoid
      JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace
     ORDER BY 1,2`)).rows;
  return { constraints, indexes, columns, functions, sequencesViews, triggers };
}

const definitions = {
  constraints: { key: (x) => `${x.table}|${x.name}|${x.type}`, value: (x) => x.definition },
  indexes: { key: (x) => `${x.table}|${x.name}`, value: (x) => x.definition },
  columns: { key: (x) => `${x.table}|${x.name}`, value: (x) => `${x.dataType}|${x.nullable}|${x.defaultExpression}` },
  functions: { key: (x) => `${x.name}|${x.identityArguments}`, value: (x) => x.definitionSha256 },
  sequencesViews: { key: (x) => `${x.kind}|${x.name}`, value: () => '' },
  triggers: { key: (x) => `${x.table}|${x.name}`, value: (x) => `${x.function}|${x.enabled}` },
};

export function compareSchemaContracts(expected, observed) {
  const result = {};
  for (const [type, definition] of Object.entries(definitions)) {
    const expectedMap = new Map(expected[type].map((entry) => [definition.key(entry), definition.value(entry)]));
    const observedMap = new Map(observed[type].map((entry) => [definition.key(entry), definition.value(entry)]));
    const missing = [...expectedMap.keys()].filter((key) => !observedMap.has(key)).sort();
    const extra = [...observedMap.keys()].filter((key) => !expectedMap.has(key)).sort();
    const changed = [...expectedMap.keys()].filter((key) => observedMap.has(key) && expectedMap.get(key) !== observedMap.get(key)).sort();
    result[type] = {
      expected: expectedMap.size,
      observed: observedMap.size,
      missing,
      extra,
      changed,
      matches: missing.length === 0 && extra.length === 0 && changed.length === 0,
    };
  }
  result.matches = Object.values(result).filter((value) => typeof value === 'object').every((value) => value.matches);
  return result;
}

export function schemaContractSummary(contract) {
  return Object.fromEntries(Object.keys(definitions).map((type) => [type, contract[type].length]));
}

export function canonicalContractHash(entries, key) {
  return sha256(Buffer.from(`${JSON.stringify(ordered(entries, key))}\n`, 'utf8'));
}
