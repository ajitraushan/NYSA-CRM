-- DRAFT: Restore the exact table and column grants. Requires separate Production approval.
-- Source inventory SHA-256: 24d68854cc3c5a383a5dbc448aa24f6c6cb40788af6a8c99882ac4362ace4b7d
-- Each fingerprint is SHA-256 of UTF-8 JSONB array lines sorted with C collation.
\set ON_ERROR_STOP on
BEGIN READ WRITE;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $change$
DECLARE
  pass integer;
  actual_acl text;
  actual_rights text;
  actual_shape text;
  expected_acl text[] := ARRAY['fc357923ab106675adba7f03015e0557bfcffb25a564e426cf2e93b463da453e', 'b35b9cad0e24de7b49345211c29dd6f43afb54b9eb9c0533f2ad155877fa8405'];
  expected_rights text[] := ARRAY['47a571d49b0beae58f739294dbef329f6ac57650f084434da1017840a75339f1', '7c818d86d2ae0ad776264d12976ebe693fd6f06fc32ca5f27205c6648675797a'];
  expected_shape constant text := '9f07a7a77aa5f778369d9437a1d5a53161d3185eb7ecfed9acbf50835efa5c11';
BEGIN
  IF current_database() <> 'nysareal_nysacrm'
     OR session_user <> 'nysareal_nysacrmapp' OR current_user <> 'nysareal_nysacrmapp'
     OR current_setting('server_version_num') <> '130023'
     OR (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) <> 'nysareal_nysacrm'
     OR to_regrole('nysareal_nysar2app') IS NULL
     OR NOT pg_has_role('nysareal_nysacrmapp', 'nysareal_nysacrm', 'MEMBER') THEN
    RAISE EXCEPTION 'Production database, role or owner identity check failed';
  END IF;

  -- Keep the scoped table ACLs stable through both checks and the change.
  LOCK TABLE
    ONLY public.agent_area_assignments,
    ONLY public.deal_checklists,
    ONLY public.deal_parties,
    ONLY public.external_listing_publications,
    ONLY public.inventory_agreements,
    ONLY public.inventory_counterparties,
    ONLY public.inventory_verification_requests,
    ONLY public.lead_inventory_selections,
    ONLY public.lead_month_number_counters,
    ONLY public.lead_number_counters,
    ONLY public.listings,
    ONLY public.opportunity_property_share_items,
    ONLY public.opportunity_property_shares,
    ONLY public.opportunity_representation_history,
    ONLY public.provisional_external_properties,
    ONLY public.transaction_counterparties
    IN ACCESS EXCLUSIVE MODE NOWAIT;

  FOR pass IN 1..2 LOOP
    WITH expected(name) AS (
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
    ),
    fingerprints AS (
      SELECT 'acl' AS kind, jsonb_build_array(object_type, object_name, column_name,
        pg_get_userbyid(grantor), CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee)::text END,
        privilege_type, is_grantable, default_acl)::text AS line
      FROM grants
      UNION ALL
      SELECT 'rights', jsonb_build_array(role, object_type, object_name, column_name,
        privilege, allowed, grant_option)::text
      FROM effective
      UNION ALL
      SELECT 'shape', jsonb_build_array(name, pg_get_userbyid(owner), rls, forced_rls)::text
      FROM scoped_tables WHERE oid IS NOT NULL
    ), digests AS (
      SELECT kind, encode(sha256(convert_to(string_agg(line, E'\n' ORDER BY line COLLATE "C"), 'UTF8')), 'hex') AS digest
      FROM fingerprints GROUP BY kind
    )
    SELECT max(digest) FILTER (WHERE kind = 'acl'),
           max(digest) FILTER (WHERE kind = 'rights'),
           max(digest) FILTER (WHERE kind = 'shape')
      INTO actual_acl, actual_rights, actual_shape
    FROM digests;
    IF actual_shape IS DISTINCT FROM expected_shape THEN
      RAISE EXCEPTION 'Scoped table identity or ownership drift (check %)', pass;
    END IF;
    IF actual_acl IS DISTINCT FROM expected_acl[pass] THEN
      RAISE EXCEPTION 'ACL fingerprint mismatch (check %): %', pass, actual_acl;
    END IF;
    IF actual_rights IS DISTINCT FROM expected_rights[pass] THEN
      RAISE EXCEPTION 'Effective rights fingerprint mismatch (check %): %', pass, actual_rights;
    END IF;
    RAISE NOTICE 'ACL check % passed: ACL %, effective rights %', pass, actual_acl, actual_rights;
    EXIT WHEN pass = 2;

    GRANT INSERT, SELECT, UPDATE ON TABLE public.agent_area_assignments TO nysareal_nysar2app;
    GRANT UPDATE ON TABLE public.deal_checklists TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.deal_parties TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.external_listing_publications TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.inventory_agreements TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.inventory_counterparties TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.inventory_verification_requests TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.lead_inventory_selections TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.lead_month_number_counters TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.lead_number_counters TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.opportunity_property_share_items TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.opportunity_property_shares TO nysareal_nysar2app;
    GRANT INSERT, SELECT ON TABLE public.opportunity_representation_history TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.provisional_external_properties TO nysareal_nysar2app;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.transaction_counterparties TO nysareal_nysar2app;
    SET LOCAL ROLE nysareal_nysacrm;
    GRANT INSERT, SELECT, UPDATE ON TABLE public.listings TO nysareal_nysar2app;
    GRANT UPDATE (originating_agent_id, responsible_agent_id) ON TABLE public.listings TO nysareal_nysar2app;
    RESET ROLE;
  END LOOP;
END
$change$;

COMMIT;
