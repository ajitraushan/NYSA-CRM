\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF NOT (
    (current_database() = 'nysareal_nysacrm' AND session_user = 'nysareal_nysacrmapp' AND current_user = session_user)
    OR
    (current_database() = 'nysareal_nysa_dev247_smoke' AND session_user = 'nysareal_nysar2app' AND current_user = session_user)
  ) THEN
    RAISE EXCEPTION 'Unexpected Prospect Diary database or role';
  END IF;
  IF (SELECT count(*) FROM public.schema_migrations) NOT IN (171, 172) THEN
    RAISE EXCEPTION 'Expected migration ledger count 171 or 172';
  END IF;
END
$guard$;

SELECT count(*) = 172 AS has_backfill FROM public.schema_migrations \gset
\if :has_backfill
  SELECT current_database() AS database, current_user AS role, transaction_timestamp() AS measured_at,
    'stored_after_migration_172' AS basis, count(*) AS prospects_total,
    count(first_call_due_at) AS prospects_with_deadline,
    count(*) FILTER (WHERE first_call_due_at < transaction_timestamp()) AS first_call_due_in_past
  FROM public.prospects;
\else
  -- Same Dubai working-day expression as migration 172, evaluated without writes.
  WITH projected AS (
    SELECT ((created_at AT TIME ZONE 'Asia/Dubai') +
      CASE WHEN extract(isodow FROM created_at AT TIME ZONE 'Asia/Dubai') = 6
        THEN interval '2 days' ELSE interval '1 day' END)
      AT TIME ZONE 'Asia/Dubai' AS first_call_due_at
    FROM public.prospects
  )
  SELECT current_database() AS database, current_user AS role, transaction_timestamp() AS measured_at,
    'projected_before_migration_172' AS basis, count(*) AS prospects_total,
    count(first_call_due_at) AS prospects_with_deadline,
    count(*) FILTER (WHERE first_call_due_at < transaction_timestamp()) AS first_call_due_in_past
  FROM projected;
\endif
ROLLBACK;
