\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';

SELECT current_database() AS database_name,
       current_user AS database_user,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('server_version') AS server_version,
       NOW() AS checked_at;

SELECT t.id AS team_id,
       t.name AS team_name,
       t.active,
       t.manager_id,
       manager.name AS manager_name,
       manager.status AS manager_status,
       manager.job_role AS manager_role
  FROM teams t
  LEFT JOIN brokers manager ON manager.id=t.manager_id
 WHERE t.id=ANY(ARRAY[
   'd2000000-0000-4000-8000-000000000001'::uuid,
   'd2000000-0000-4000-8000-000000000002'::uuid
 ])
 ORDER BY t.id;

SELECT b.id AS broker_id,
       b.name,
       b.status,
       b.job_role,
       b.team_id,
       b.email LIKE '%@example.invalid' AS non_delivery_email,
       NULLIF(BTRIM(COALESCE(b.phone,'')),'') IS NOT NULL AS has_phone
  FROM brokers b
 WHERE b.id=ANY(ARRAY[
   'd1000000-0000-4000-8000-000000000002'::uuid,
   'd1000000-0000-4000-8000-000000000003'::uuid,
   'd1000000-0000-4000-8000-000000000004'::uuid,
   'd1000000-0000-4000-8000-000000000005'::uuid
 ])
 ORDER BY b.id;

ROLLBACK;
