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
  IF to_regrole('nysareal_nysar2app') IS NULL THEN
    RAISE EXCEPTION 'Expected legacy role is missing';
  END IF;
END
$guard$;

-- The allowlist comes from the verified DEV270 Production preflight r2.
WITH RECURSIVE expected(name) AS (
  VALUES ('agent_area_assignments'), ('deal_checklists'), ('deal_parties'),
         ('external_listing_publications'), ('inventory_agreements'),
         ('inventory_counterparties'), ('inventory_verification_requests'),
         ('lead_inventory_selections'), ('lead_month_number_counters'),
         ('lead_number_counters'), ('listings'), ('opportunity_property_share_items'),
         ('opportunity_property_shares'), ('opportunity_representation_history'),
         ('provisional_external_properties'), ('transaction_counterparties')
), scoped_tables AS (
  SELECT e.name, c.oid, c.relowner AS owner, c.relacl AS acl,
         c.relrowsecurity AS rls, c.relforcerowsecurity AS forced_rls
  FROM expected e
  LEFT JOIN pg_class c ON c.relname = e.name
    AND c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p')
), columns AS (
  SELECT t.name AS table_name, t.oid, a.attname AS name, a.attnum, a.attacl AS acl
  FROM scoped_tables t JOIN pg_attribute a ON a.attrelid = t.oid
  WHERE a.attnum > 0 AND NOT a.attisdropped
), db AS (
  SELECT oid, datname AS name, datdba AS owner, datacl AS acl
  FROM pg_database WHERE datname = current_database()
), roles AS (
  SELECT oid, rolname FROM pg_roles
  WHERE rolname IN ('nysareal_nysacrmapp', 'nysareal_nysar2app')
), ancestors(subject, role_oid) AS (
  SELECT oid, oid FROM roles
  UNION
  SELECT a.subject, m.roleid
  FROM ancestors a JOIN pg_auth_members m ON m.member = a.role_oid
), grants AS (
  SELECT 'database' AS object_type, d.name::text AS object_name,
         NULL::name AS column_name, d.acl IS NULL AS default_acl, g.*
  FROM db d CROSS JOIN LATERAL aclexplode(coalesce(d.acl, acldefault('d', d.owner))) g
  UNION ALL
  SELECT 'table', t.name, NULL::name, t.acl IS NULL, g.*
  FROM scoped_tables t
  CROSS JOIN LATERAL aclexplode(coalesce(t.acl, acldefault('r', t.owner))) g
  WHERE t.oid IS NOT NULL
  UNION ALL
  SELECT 'column', c.table_name, c.name, false, g.*
  FROM columns c CROSS JOIN LATERAL aclexplode(c.acl) g
), effective AS (
  SELECT r.rolname AS role, 'database' AS object_type, d.name::text AS object_name,
         NULL::name AS column_name, p.privilege,
         has_database_privilege(r.oid, d.oid, p.privilege) AS allowed,
         has_database_privilege(r.oid, d.oid, p.privilege || ' WITH GRANT OPTION') AS grant_option
  FROM roles r CROSS JOIN db d
  CROSS JOIN unnest(ARRAY['CONNECT','CREATE','TEMPORARY']) p(privilege)
  UNION ALL
  SELECT r.rolname, 'schema', 'public', NULL::name, p.privilege,
         has_schema_privilege(r.oid, 'public'::regnamespace::oid, p.privilege),
         has_schema_privilege(r.oid, 'public'::regnamespace::oid, p.privilege || ' WITH GRANT OPTION')
  FROM roles r CROSS JOIN unnest(ARRAY['USAGE','CREATE']) p(privilege)
  UNION ALL
  SELECT r.rolname, 'table', t.name, NULL::name, p.privilege,
         has_table_privilege(r.oid, t.oid, p.privilege),
         has_table_privilege(r.oid, t.oid, p.privilege || ' WITH GRANT OPTION')
  FROM roles r CROSS JOIN scoped_tables t
  CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p(privilege)
  WHERE t.oid IS NOT NULL
  UNION ALL
  SELECT r.rolname, 'column', c.table_name, c.name, p.privilege,
         has_column_privilege(r.oid, c.oid, c.attnum, p.privilege),
         has_column_privilege(r.oid, c.oid, c.attnum, p.privilege || ' WITH GRANT OPTION')
  FROM roles r CROSS JOIN columns c
  CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) p(privilege)
)
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', transaction_timestamp(),
  'database', current_database(),
  'database_owner', (SELECT pg_get_userbyid(owner) FROM db),
  'server_version', current_setting('server_version'),
  'session_user', session_user,
  'current_user', current_user,
  'transaction_read_only', current_setting('transaction_read_only'),
  'missing_tables', (SELECT coalesce(jsonb_agg(name ORDER BY name), '[]')
                     FROM scoped_tables WHERE oid IS NULL),
  'tables', (SELECT jsonb_agg(jsonb_build_object(
      'name', name, 'owner', pg_get_userbyid(owner), 'rls', rls, 'forced_rls', forced_rls
    ) ORDER BY name) FROM scoped_tables WHERE oid IS NOT NULL),
  'acl', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'object_type', object_type, 'object_name', object_name, 'column', column_name,
      'grantor', pg_get_userbyid(grantor),
      'grantee', CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee)::text END,
      'privilege', privilege_type, 'grant_option', is_grantable, 'default_acl', default_acl
    ) ORDER BY object_type, object_name, column_name, grantor, grantee, privilege_type), '[]') FROM grants),
  'role_attributes', (SELECT jsonb_agg(jsonb_build_object(
      'role', p.rolname, 'inherit', p.rolinherit, 'can_login', p.rolcanlogin,
      'superuser', p.rolsuper, 'bypass_rls', p.rolbypassrls
    ) ORDER BY p.rolname) FROM pg_roles p JOIN roles r USING (oid)),
  'membership_edges', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'member', pg_get_userbyid(m.member), 'role', pg_get_userbyid(m.roleid),
      'grantor', pg_get_userbyid(m.grantor), 'admin_option', m.admin_option
    ) ORDER BY m.member, m.roleid, m.grantor), '[]')
    FROM pg_auth_members m
    WHERE m.member IN (SELECT role_oid FROM ancestors) OR m.roleid IN (SELECT oid FROM roles)),
  'membership_effective', (SELECT jsonb_agg(jsonb_build_object(
      'role', pg_get_userbyid(subject), 'member_of', pg_get_userbyid(role_oid),
      'usage', pg_has_role(subject, role_oid, 'USAGE')
    ) ORDER BY subject, role_oid) FROM ancestors WHERE subject <> role_oid),
  'effective_rights', (SELECT jsonb_agg(to_jsonb(e)
    ORDER BY role, object_type, object_name, column_name, privilege) FROM effective e)
));
ROLLBACK;
