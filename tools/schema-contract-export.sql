\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on
\o EXPECTED_constraints.txt
SELECT conrelid::regclass::text,conname,contype,pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE connamespace='public'::regnamespace AND contype IN ('p','f','u','c','x')
 ORDER BY 1,2;
\o EXPECTED_indexes.txt
SELECT tablename,indexname,indexdef FROM pg_indexes
 WHERE schemaname='public' ORDER BY 1,2;
\o EXPECTED_columns.txt
SELECT table_name,column_name,data_type,is_nullable,COALESCE(column_default,'')
  FROM information_schema.columns
 WHERE table_schema='public'
   AND table_name NOT IN (SELECT viewname FROM pg_views WHERE schemaname='public')
 ORDER BY 1,2;
\o EXPECTED_function_defs.hex.txt
SELECT p.proname,pg_get_function_identity_arguments(p.oid),
       encode(convert_to(replace(pg_get_functiondef(p.oid),chr(13),''),'UTF8'),'hex')
  FROM pg_proc p
 WHERE p.pronamespace='public'::regnamespace AND p.prokind='f'
 ORDER BY 1,2;
\o EXPECTED_sequences_views.txt
SELECT 'sequence',sequencename FROM pg_sequences WHERE schemaname='public'
UNION ALL SELECT 'view',viewname FROM pg_views WHERE schemaname='public'
 ORDER BY 1,2;
\o
