import fs from 'node:fs/promises';
import path from 'node:path';

const contractPath=path.resolve('src/database-trigger-contract.json');
const outputPath=path.resolve('src/migrations/168_restore_governed_trigger_contract.sql');
const contract=JSON.parse(await fs.readFile(contractPath,'utf8'));
if(contract.schema!=='nysa.database-trigger-contract.v1'||!Array.isArray(contract.triggers)||!contract.triggers.length){
  throw new Error('Trigger contract is invalid');
}

const qi=value=>`"${String(value).replaceAll('"','""')}"`;
const literal=value=>`'${String(value).replaceAll("'","''")}'`;

const triggerSql=contract.triggers.map(item=>[
  `-- ${item.sourceMigration}`,
  `DROP TRIGGER IF EXISTS ${qi(item.name)} ON ${qi(item.table)};`,
  item.definition
].join('\n')).join('\n\n');

const expectedValues=contract.triggers.map(item=>
  `    (${literal(item.table)},${literal(item.name)},${literal(item.function.split('.').at(-1))},${literal(item.enabled)})`
).join(',\n');

const sql=`-- DEV264: restore the complete governed trigger contract after CRM Test schema drift.
-- Generated from ${contract.generatedFrom.migrationCount} migrations through ${contract.generatedFrom.latestMigration}.
-- Contract SHA-256: ${contract.canonicalSha256}
-- This migration intentionally recreates triggers only. It does not replace trigger functions.

-- Reconcile every monthly Lead counter with durable references before restoring
-- the BEFORE INSERT allocator. Existing higher counters are never reduced.
INSERT INTO lead_month_number_counters(period_code,last_value,updated_at)
SELECT SUBSTRING(lead_reference FROM 9 FOR 6),
       MAX(SUBSTRING(lead_reference FROM 16)::INTEGER),
       NOW()
  FROM leads
 WHERE lead_reference ~ '^NYSA-LD-[0-9]{6}-[0-9]{6}$'
 GROUP BY 1
ON CONFLICT(period_code) DO UPDATE
  SET last_value=GREATEST(lead_month_number_counters.last_value,EXCLUDED.last_value),
      updated_at=CASE
        WHEN lead_month_number_counters.last_value<EXCLUDED.last_value THEN NOW()
        ELSE lead_month_number_counters.updated_at
      END;

${triggerSql}

DO $trigger_contract$
DECLARE
  missing_count INTEGER;
  unexpected_count INTEGER;
  disabled_count INTEGER;
  wrong_function_count INTEGER;
BEGIN
  WITH expected(table_name,trigger_name,function_name,enabled) AS (VALUES
${expectedValues}
  ),actual AS (
    SELECT c.relname AS table_name,t.tgname AS trigger_name,p.proname AS function_name,t.tgenabled AS enabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_proc p ON p.oid=t.tgfoid
     WHERE NOT t.tgisinternal AND n.nspname=current_schema()
  )
  SELECT COUNT(*) FILTER(WHERE a.trigger_name IS NULL),
         COUNT(*) FILTER(WHERE a.trigger_name IS NOT NULL AND a.enabled<>e.enabled),
         COUNT(*) FILTER(WHERE a.trigger_name IS NOT NULL AND a.function_name<>e.function_name)
    INTO missing_count,disabled_count,wrong_function_count
    FROM expected e LEFT JOIN actual a USING(table_name,trigger_name);

  WITH expected(table_name,trigger_name) AS (VALUES
${contract.triggers.map(item=>`    (${literal(item.table)},${literal(item.name)})`).join(',\n')}
  ),actual AS (
    SELECT c.relname AS table_name,t.tgname AS trigger_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE NOT t.tgisinternal AND n.nspname=current_schema()
  )
  SELECT COUNT(*) INTO unexpected_count
    FROM actual a LEFT JOIN expected e USING(table_name,trigger_name)
   WHERE e.trigger_name IS NULL;

  IF missing_count<>0 OR unexpected_count<>0 OR disabled_count<>0 OR wrong_function_count<>0 THEN
    RAISE EXCEPTION 'Governed trigger contract mismatch: missing %, unexpected %, disabled %, wrong function %',
      missing_count,unexpected_count,disabled_count,wrong_function_count;
  END IF;

  IF (SELECT COUNT(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE NOT t.tgisinternal AND n.nspname=current_schema())<>${contract.triggerCount} THEN
    RAISE EXCEPTION 'Governed trigger count mismatch: expected ${contract.triggerCount}';
  END IF;
END
$trigger_contract$;
`;

await fs.writeFile(outputPath,sql);
console.log(JSON.stringify({output:outputPath,triggerCount:contract.triggerCount,tableCount:contract.tableCount}));
