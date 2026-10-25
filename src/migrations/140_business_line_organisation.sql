-- Reporting configuration only; no routing, ownership, workflow or role changes.
CREATE TABLE business_lines(id UUID PRIMARY KEY,code TEXT NOT NULL UNIQUE,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE,revision INTEGER NOT NULL DEFAULT 1,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX business_lines_name_uq ON business_lines(LOWER(name));
CREATE TABLE business_line_kpis(business_line_id UUID NOT NULL REFERENCES business_lines(id),metric_code TEXT NOT NULL,PRIMARY KEY(business_line_id,metric_code));
CREATE TABLE team_business_line_assignments(id UUID PRIMARY KEY,team_id UUID NOT NULL REFERENCES teams(id),business_line_id UUID REFERENCES business_lines(id),effective_from DATE NOT NULL,changed_by UUID REFERENCES brokers(id),reason TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(team_id,effective_from));
CREATE INDEX team_business_line_history_idx ON team_business_line_assignments(team_id,effective_from DESC);
INSERT INTO business_lines(id,code,name,description) VALUES
 ('b2390000-0000-4000-8000-000000000001','off_plan_sales','Off-plan Sales','Approved initial business-line setup'),
 ('b2390000-0000-4000-8000-000000000002','secondary_sales','Secondary Sales','Approved initial business-line setup'),
 ('b2390000-0000-4000-8000-000000000003','rental','Rental','Approved initial business-line setup');
INSERT INTO business_line_kpis SELECT id,metric FROM business_lines CROSS JOIN UNNEST(ARRAY['new_leads','won_leads','hot_leads','sla_breaches','sla_risk','no_next_action','stale_risk','team_capacity_pressure','proposal_workload','customer_engagement','inventory_available','inventory_stale','inventory_readiness_exposure','operational_exceptions']) metric;
-- Exact team names explicitly reviewed with the user. Establish initial
-- reporting baseline for existing records, preserving later dated changes.
INSERT INTO team_business_line_assignments(id,team_id,business_line_id,effective_from,reason)
 SELECT gen_random_uuid(),t.id,b.id,'1900-01-01','User-approved initial reporting baseline; no routing change'
 FROM teams t JOIN business_lines b ON b.code=CASE t.name WHEN 'Off Plan Team' THEN 'off_plan_sales' WHEN 'Secondary team' THEN 'secondary_sales' WHEN 'Rental Team' THEN 'rental' END;
GRANT SELECT,INSERT,UPDATE,DELETE ON business_lines,business_line_kpis,team_business_line_assignments TO nysareal_nysar2app;
-- Retain the existing audit allow-list and add only this feature's entities.
DO $$
DECLARE prior_expression TEXT;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO prior_expression FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
 IF prior_expression IS NULL THEN RAISE EXCEPTION 'Required audit entity constraint is missing'; END IF;
 ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
 EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK ((' || prior_expression || ') OR entity_type IN (''BusinessLine'',''TeamBusinessLine''))';
END $$;
