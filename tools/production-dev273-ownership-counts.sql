\set ON_ERROR_STOP on
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF current_database() <> 'nysareal_nysacrm'
     OR current_user <> 'nysareal_nysacrmapp' THEN
    RAISE EXCEPTION 'Expected the Production database and CRM app role';
  END IF;
END
$guard$;

WITH ownership AS (
  SELECT 'customers_all' AS population, c.owner_id AS owner_id,
         b.team_id AS team_id, b.team_id AS owner_team_id
  FROM public.contacts c
  LEFT JOIN public.brokers b ON b.id = c.owner_id
  UNION ALL
  SELECT 'customers_active', c.owner_id, b.team_id, b.team_id
  FROM public.contacts c
  LEFT JOIN public.brokers b ON b.id = c.owner_id
  WHERE c.archived_at IS NULL
  UNION ALL
  SELECT 'leads_all', l.assigned_to, l.assigned_team_id, b.team_id
  FROM public.leads l
  LEFT JOIN public.brokers b ON b.id = l.assigned_to
),
populations(population) AS (
  VALUES ('customers_all'), ('customers_active'), ('leads_all')
)
SELECT p.population,
       count(o.population) AS total,
       count(o.population) FILTER (WHERE o.owner_id IS NULL) AS without_owner,
       count(o.population) FILTER (WHERE o.team_id IS NULL) AS without_team,
       count(o.population) FILTER (
         WHERE o.owner_id IS NULL AND o.team_id IS NULL
       ) AS without_owner_and_team,
       count(o.population) FILTER (
         WHERE o.owner_id IS NOT NULL AND o.owner_team_id IS NULL
       ) AS owner_without_team,
       count(o.population) FILTER (
         WHERE o.owner_id IS NOT NULL AND o.team_id <> o.owner_team_id
       ) AS assigned_team_differs_from_owner_team
FROM populations p
LEFT JOIN ownership o USING (population)
GROUP BY p.population
ORDER BY p.population;

ROLLBACK;
