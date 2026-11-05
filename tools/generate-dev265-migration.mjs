import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalDir = path.join(root, 'src', 'database-schema-contract');
const baselineDir = path.join(root, 'src', 'database-schema-baseline');
const triggerFile = path.join(root, 'src', 'database-trigger-contract.json');
const output = path.join(root, 'src', 'migrations', '169_restore_full_schema_contract.sql');
const write = process.argv.includes('--write');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const contract = (directory, file) => read(path.join(directory, file)).entries;
const canonical = {
  constraints: contract(canonicalDir, 'constraints.json'),
  indexes: contract(canonicalDir, 'indexes.json'),
  columns: contract(canonicalDir, 'columns.json'),
  functions: contract(canonicalDir, 'functions.json'),
  sequencesViews: contract(canonicalDir, 'sequences-views.json'),
  triggers: read(triggerFile).triggers.map(({ table, name, function: functionName, enabled }) => ({ table, name, function: functionName, enabled })),
};
const baseline = {
  constraints: contract(baselineDir, 'constraints.json'),
  indexes: contract(baselineDir, 'indexes.json'),
  columns: contract(baselineDir, 'columns.json'),
  functions: contract(baselineDir, 'functions.json'),
  sequencesViews: contract(baselineDir, 'sequences-views.json'),
  triggers: canonical.triggers,
};

const constraintKey = (entry) => `${entry.table}|${entry.name}|${entry.type}`;
const indexKey = (entry) => `${entry.table}|${entry.name}`;
const baselineConstraints = new Set(baseline.constraints.map(constraintKey));
const baselineIndexes = new Set(baseline.indexes.map(indexKey));
const missingConstraints = canonical.constraints.filter((entry) => !baselineConstraints.has(constraintKey(entry)));
const missingIndexes = canonical.indexes.filter((entry) => !baselineIndexes.has(indexKey(entry)));
const primaryUnique = missingConstraints.filter((entry) => ['p', 'u'].includes(entry.type));
const foreignKeys = missingConstraints.filter((entry) => entry.type === 'f');
const constraintIndexNames = new Set(primaryUnique.map((entry) => `${entry.table}|${entry.name}`));
const backingIndexes = missingIndexes.filter((entry) => constraintIndexNames.has(indexKey(entry)));
const standaloneIndexes = missingIndexes.filter((entry) => !constraintIndexNames.has(indexKey(entry)));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(missingConstraints.length === 1008, `Expected 1008 missing constraints, found ${missingConstraints.length}`);
assert(primaryUnique.length === 33, `Expected 33 missing PK/unique constraints, found ${primaryUnique.length}`);
assert(foreignKeys.length === 975, `Expected 975 missing foreign keys, found ${foreignKeys.length}`);
assert(missingIndexes.length === 404, `Expected 404 missing indexes, found ${missingIndexes.length}`);
assert(backingIndexes.length === 33, `Expected 33 constraint-owned indexes, found ${backingIndexes.length}`);
assert(standaloneIndexes.length === 371, `Expected 371 standalone indexes, found ${standaloneIndexes.length}`);

const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const jsonLiteral = (value) => `${literal(JSON.stringify(value))}::jsonb`;
const identifier = (value) => `"${value.replaceAll('"', '""')}"`;
const uuidFrom = (value) => {
  const hex = crypto.createHash('md5').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

function columnsFromDefinition(definition, prefix) {
  const match = definition.match(new RegExp(`${prefix} \\(([^)]+)\\)`));
  if (!match) throw new Error(`Cannot parse constrained columns: ${definition}`);
  return match[1].split(',').map((value) => value.trim().replace(/^"|"$/g, '').replaceAll('""', '"'));
}

function foreignKeyParts(entry) {
  const match = entry.definition.match(/^FOREIGN KEY \(([^)]+)\) REFERENCES ([^ (]+)\(([^)]+)\)/);
  if (!match) throw new Error(`Cannot parse foreign key: ${entry.table}.${entry.name}: ${entry.definition}`);
  return {
    columns: match[1].split(',').map((value) => value.trim().replace(/^"|"$/g, '')),
    target: match[2].replace(/^"|"$/g, ''),
    targetColumns: match[3].split(',').map((value) => value.trim().replace(/^"|"$/g, '')),
  };
}

const actualQueries = {
  constraints: `(SELECT COALESCE(jsonb_agg(jsonb_build_object('table',table_name,'name',object_name,'type',constraint_type,'definition',definition) ORDER BY table_name,object_name,constraint_type),'[]'::jsonb) FROM (SELECT conrelid::regclass::text AS table_name,conname::text AS object_name,contype::text AS constraint_type,regexp_replace(pg_get_constraintdef(oid),'TRIM\\(BOTH FROM ([^)]+)\\)','btrim(\\1)','g') AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype IN ('p','f','u','c','x')) q)`,
  indexes: `(SELECT COALESCE(jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname),'[]'::jsonb) FROM pg_indexes WHERE schemaname='public')`,
  columns: `(SELECT COALESCE(jsonb_agg(jsonb_build_object('table',table_name,'name',column_name,'dataType',data_type,'nullable',is_nullable,'defaultExpression',COALESCE(column_default,'')) ORDER BY table_name,column_name),'[]'::jsonb) FROM information_schema.columns WHERE table_schema='public' AND table_name NOT IN (SELECT viewname FROM pg_views WHERE schemaname='public'))`,
  functions: `(SELECT COALESCE(jsonb_agg(jsonb_build_object('name',proname,'identityArguments',pg_get_function_identity_arguments(oid),'definitionSha256',encode(sha256(convert_to(replace(pg_get_functiondef(oid),chr(13),''),'UTF8')),'hex')) ORDER BY proname,pg_get_function_identity_arguments(oid)),'[]'::jsonb) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f')`,
  sequencesViews: `(SELECT COALESCE(jsonb_agg(jsonb_build_object('kind',object_kind,'name',object_name) ORDER BY object_kind,object_name),'[]'::jsonb) FROM (SELECT 'sequence' AS object_kind,sequencename::text AS object_name FROM pg_sequences WHERE schemaname='public' UNION ALL SELECT 'view' AS object_kind,viewname::text AS object_name FROM pg_views WHERE schemaname='public') q)`,
  triggers: `(SELECT COALESCE(jsonb_agg(jsonb_build_object('table',table_name,'name',trigger_name,'function',function_name,'enabled',enabled) ORDER BY table_name,trigger_name),'[]'::jsonb) FROM (SELECT c.relname::text AS table_name,t.tgname::text AS trigger_name,n.nspname||'.'||p.proname AS function_name,t.tgenabled::text AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace n ON n.oid=p.pronamespace WHERE NOT t.tgisinternal AND c.relnamespace='public'::regnamespace) q)`,
};

function assertCatalog(state, label) {
  return Object.keys(canonical).map((type) => `
  SELECT ${actualQueries[type]} INTO observed;
  IF NOT (observed @> ${jsonLiteral(state[type])} AND ${jsonLiteral(state[type])} @> observed
          AND jsonb_array_length(observed)=jsonb_array_length(${jsonLiteral(state[type])})) THEN
    RAISE EXCEPTION 'DEV265 ${label} ${type} contract mismatch';
  END IF;`).join('\n');
}

function duplicateGuard(entry) {
  const columns = columnsFromDefinition(entry.definition, entry.type === 'p' ? 'PRIMARY KEY' : 'UNIQUE');
  const list = columns.map(identifier).join(',');
  const nullPredicate = columns.map((column) => `${identifier(column)} IS NULL`).join(' OR ');
  const nonNullPredicate = columns.map((column) => `${identifier(column)} IS NOT NULL`).join(' AND ');
  const table = identifier(entry.table);
  const nullCheck = entry.type === 'p' ? `
  EXECUTE ${literal(`SELECT COUNT(*) FROM ${table} WHERE ${nullPredicate}`)} INTO violation_count;
  IF violation_count <> 0 THEN RAISE EXCEPTION 'DEV265 primary-key NULL guard failed for ${entry.table}.${entry.name}: %',violation_count; END IF;` : '';
  return `${nullCheck}
  EXECUTE ${literal(`SELECT COUNT(*) FROM (SELECT ${list} FROM ${table} WHERE ${nonNullPredicate} GROUP BY ${list} HAVING COUNT(*)>1) d`)} INTO violation_count;
  IF violation_count <> 0 THEN RAISE EXCEPTION 'DEV265 duplicate guard failed for ${entry.table}.${entry.name}: %',violation_count; END IF;
  EXECUTE ${literal(`ALTER TABLE ${table} ADD CONSTRAINT ${identifier(entry.name)} ${entry.definition}`)};`;
}

function foreignKeyGuard(entry) {
  const { columns, target, targetColumns } = foreignKeyParts(entry);
  const nonNull = columns.map((column) => `c.${identifier(column)} IS NOT NULL`).join(' AND ');
  const join = columns.map((column, index) => `p.${identifier(targetColumns[index])}=c.${identifier(column)}`).join(' AND ');
  const sql = `SELECT COUNT(*) FROM ${identifier(entry.table)} c WHERE ${nonNull} AND NOT EXISTS (SELECT 1 FROM ${identifier(target)} p WHERE ${join})`;
  return `
  EXECUTE ${literal(sql)} INTO violation_count;
  IF violation_count <> 0 THEN RAISE EXCEPTION 'DEV265 foreign-key orphan guard failed for ${entry.table}.${entry.name}: %',violation_count; END IF;
  EXECUTE ${literal(`ALTER TABLE ${identifier(entry.table)} ADD CONSTRAINT ${identifier(entry.name)} ${entry.definition}`)};`;
}

const auditId = uuidFrom('DEV265 migration 169 UAT264 orphan cleanup');
const sql = `-- DEV265 migration 169: restore the full CRM Test schema contract.
-- Generated; do not edit by hand. Canonical commit baseline: 8d9be904149bec1b9b6d56dd8a39f17c2789fd12.
-- Index split: 33 constraint-owned indexes restored by PK/UNIQUE constraints; 371 standalone indexes created explicitly.
-- The application migration runner wraps this file in one transaction.

SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='15min';

DO $dev265$
DECLARE
  observed jsonb;
  canonical_state boolean;
  orphan_messages integer;
  orphan_notifications integer;
  actor_count integer;
  cleanup_actor uuid;
  cleanup_conversation uuid;
  violation_count bigint;
BEGIN
  SELECT contract.observed @> ${jsonLiteral(canonical.constraints)} AND ${jsonLiteral(canonical.constraints)} @> contract.observed
         AND jsonb_array_length(contract.observed)=jsonb_array_length(${jsonLiteral(canonical.constraints)})
    INTO canonical_state
    FROM (SELECT ${actualQueries.constraints} observed) contract;
  IF canonical_state THEN
${assertCatalog(canonical, 'idempotent canonical preflight')}
    RETURN;
  END IF;

${assertCatalog(baseline, 'approved pre-migration baseline')}

  SELECT COUNT(*)::int,MIN(m.conversation_id::text)::uuid
    INTO orphan_messages,cleanup_conversation
    FROM wa_conversation_messages m
   WHERE m.simulated=TRUE
     AND NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=m.conversation_id);
  SELECT COUNT(*)::int,COUNT(DISTINCT n.broker_id)::int,MIN(n.broker_id::text)::uuid
    INTO orphan_notifications,actor_count,cleanup_actor
    FROM wa_inbox_notifications n
   WHERE NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=n.conversation_id)
     AND EXISTS(SELECT 1 FROM wa_conversation_messages m WHERE m.conversation_id=n.conversation_id AND m.simulated=TRUE);
  IF orphan_messages<>12 OR orphan_notifications<>5 THEN
    RAISE EXCEPTION 'DEV265 UAT264 cleanup guard expected 12 messages/5 notifications, observed %/%',orphan_messages,orphan_notifications;
  END IF;
  IF actor_count<>1 OR cleanup_actor IS NULL OR cleanup_conversation IS NULL THEN
    RAISE EXCEPTION 'DEV265 audit actor guard expected one retained notification broker, observed %',actor_count;
  END IF;

  DELETE FROM wa_inbox_notifications n
   WHERE NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=n.conversation_id)
     AND EXISTS(SELECT 1 FROM wa_conversation_messages m WHERE m.conversation_id=n.conversation_id AND m.simulated=TRUE);
  GET DIAGNOSTICS violation_count=ROW_COUNT;
  IF violation_count<>5 THEN RAISE EXCEPTION 'DEV265 notification delete count changed: %',violation_count; END IF;
  DELETE FROM wa_conversation_messages m
   WHERE m.simulated=TRUE AND NOT EXISTS(SELECT 1 FROM wa_conversations c WHERE c.id=m.conversation_id);
  GET DIAGNOSTICS violation_count=ROW_COUNT;
  IF violation_count<>12 THEN RAISE EXCEPTION 'DEV265 message delete count changed: %',violation_count; END IF;

  INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
  VALUES('${auditId}','WhatsAppConversation',cleanup_conversation,'uat264_simulator_orphan_cleanup',cleanup_actor,
         jsonb_build_object('approval','Ajit 5 Nov 2026','messages',12,'notifications',5,
           'reason','UAT264 simulator orphans removed for FK restoration')::text)
  ON CONFLICT(id) DO NOTHING;

  -- 18 primary keys and 15 unique constraints. Their 33 backing indexes are created here.
${primaryUnique.map(duplicateGuard).join('\n')}

  -- 975 foreign keys, each preceded by an explicit orphan check.
${foreignKeys.map(foreignKeyGuard).join('\n')}

  -- 371 standalone indexes; the other 33 missing indexes belong to constraints above.
${standaloneIndexes.map((entry) => `  EXECUTE ${literal(entry.definition)};`).join('\n')}

${assertCatalog(canonical, 'final')}
END
$dev265$;
`;

const summary = {
  missingConstraints: missingConstraints.length,
  primaryKeys: primaryUnique.filter((entry) => entry.type === 'p').length,
  uniqueConstraints: primaryUnique.filter((entry) => entry.type === 'u').length,
  foreignKeys: foreignKeys.length,
  missingIndexes: missingIndexes.length,
  constraintOwnedIndexes: backingIndexes.length,
  standaloneIndexes: standaloneIndexes.length,
  auditPerformedBy: 'the single distinct retained broker_id on the five approved orphan wa_inbox_notifications rows; abort if absent or ambiguous',
  output,
  sha256: crypto.createHash('sha256').update(sql).digest('hex'),
};

if (write) fs.writeFileSync(output, sql, 'utf8');
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
