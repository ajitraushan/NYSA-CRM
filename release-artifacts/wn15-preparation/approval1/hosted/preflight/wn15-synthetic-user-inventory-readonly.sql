\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';

SELECT current_database() AS database_name,
       current_user AS database_user,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('server_version') AS server_version,
       now() AS checked_at;

WITH synthetic_candidates AS (
  SELECT b.id,b.name,b.job_role,b.status,b.team_id,
         split_part(lower(b.email),'@',2) AS email_domain,
         (b.phone IS NOT NULL AND btrim(b.phone)<>'') AS has_phone,
         (lower(b.email) LIKE '%@example.invalid' OR lower(b.email) LIKE '%@nysarealty.test' OR lower(b.email) LIKE '%@example.test') AS non_delivery_email,
         (lower(b.name||' '||b.email) ~ '(synthetic|simulat|uat|test|qa)') AS synthetic_marker
  FROM brokers b
  WHERE b.status='active'
    AND b.job_role IN('sales_agent','listing_agent','manager','director')
    AND lower(b.name||' '||b.email) ~ '(synthetic|simulat|uat|test|qa)'
)
SELECT t.id AS team_id,t.name AS team_name,t.active,
       m.id AS manager_id,m.name AS manager_name,m.job_role AS manager_role,
       m.email_domain AS manager_email_domain,m.has_phone AS manager_has_phone,m.non_delivery_email AS manager_non_delivery_email,
       c.id AS agent_id,c.name AS agent_name,c.job_role AS agent_role,
       c.email_domain AS agent_email_domain,c.has_phone AS agent_has_phone,c.non_delivery_email AS agent_non_delivery_email
FROM teams t
LEFT JOIN synthetic_candidates m ON m.id=t.manager_id AND m.job_role IN('manager','director')
LEFT JOIN synthetic_candidates c ON c.team_id=t.id AND c.job_role IN('sales_agent','listing_agent')
WHERE lower(t.name) ~ '(synthetic|simulat|uat|test|qa)'
   OR m.id IS NOT NULL OR c.id IS NOT NULL
ORDER BY t.name,c.name;

SELECT job_role,COUNT(*)::int AS candidate_count,
       COUNT(*) FILTER(WHERE non_delivery_email AND NOT has_phone)::int AS safe_non_delivery_count
FROM (
  SELECT b.job_role,
         (b.phone IS NOT NULL AND btrim(b.phone)<>'') AS has_phone,
         (lower(b.email) LIKE '%@example.invalid' OR lower(b.email) LIKE '%@nysarealty.test' OR lower(b.email) LIKE '%@example.test') AS non_delivery_email
  FROM brokers b
  WHERE b.status='active'
    AND b.job_role IN('sales_agent','listing_agent','manager','director')
    AND lower(b.name||' '||b.email) ~ '(synthetic|simulat|uat|test|qa)'
) candidates
GROUP BY job_role
ORDER BY job_role;

ROLLBACK;
