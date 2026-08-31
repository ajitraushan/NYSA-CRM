-- UAT-062: one immutable, versioned business-classification catalogue.
-- Historical source values are preserved; ambiguous legacy rows enter a review queue.

CREATE TABLE classification_catalogue_versions (
  id UUID PRIMARY KEY,
  version_code TEXT NOT NULL UNIQUE CHECK(version_code ~ '^[a-z][a-z0-9_-]{2,79}$'),
  status TEXT NOT NULL CHECK(status IN('draft','active','superseded','retired')),
  business_label TEXT NOT NULL,
  approved_at TIMESTAMPTZ,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_to TIMESTAMPTZ,
  supersedes_version_id UUID REFERENCES classification_catalogue_versions(id),
  content_sha256 TEXT NOT NULL CHECK(content_sha256 ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK((status='active' AND approved_at IS NOT NULL) OR status<>'active')
);
CREATE UNIQUE INDEX classification_catalogue_one_active_uq ON classification_catalogue_versions((status)) WHERE status='active';

CREATE TABLE classification_dimensions (
  id UUID PRIMARY KEY,
  catalogue_version_id UUID NOT NULL REFERENCES classification_catalogue_versions(id),
  dimension_code TEXT NOT NULL CHECK(dimension_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  business_label TEXT NOT NULL,
  help_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(catalogue_version_id,dimension_code)
);

CREATE TABLE classification_values (
  id UUID PRIMARY KEY,
  dimension_id UUID NOT NULL REFERENCES classification_dimensions(id),
  stable_code TEXT NOT NULL CHECK(stable_code ~ '^[a-z][a-z0-9_]{1,79}$'),
  business_label TEXT NOT NULL,
  help_text TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  applicability JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(dimension_id,stable_code)
);

CREATE TABLE classification_mappings (
  id UUID PRIMARY KEY,
  catalogue_version_id UUID NOT NULL REFERENCES classification_catalogue_versions(id),
  source_dimension_code TEXT NOT NULL,
  source_value_code TEXT NOT NULL,
  target_context TEXT NOT NULL,
  target_value_code TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  mapping_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(catalogue_version_id,source_dimension_code,source_value_code,target_context)
);

CREATE TABLE classification_legacy_exceptions (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  source_field TEXT NOT NULL,
  source_value TEXT,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','resolved','retained_as_history')),
  resolution_evidence JSONB,
  resolved_by UUID REFERENCES brokers(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id,source_field,reason_code)
);

INSERT INTO classification_catalogue_versions(id,version_code,status,business_label,approved_at,effective_from,content_sha256)
VALUES('06200000-0000-4000-8000-000000000001','uat062-v1','active','NYSA CORE Business Classification v1',NOW(),NOW(),'dbd0dc52dcbca73e41cfc96ea3c7693cad8e4656c7e575e96bbf8a5418fb1eaf');

INSERT INTO classification_dimensions(id,catalogue_version_id,dimension_code,business_label,help_text,sort_order) VALUES
('06200000-0000-4000-8000-000000000011','06200000-0000-4000-8000-000000000001','customer_objective','Customer objective','What the Customer wants NYSA to help achieve.',10),
('06200000-0000-4000-8000-000000000012','06200000-0000-4000-8000-000000000001','derived_transaction','Derived transaction','Sale or Rental is derived from the Customer objective; it is not entered separately.',20),
('06200000-0000-4000-8000-000000000013','06200000-0000-4000-8000-000000000001','market_stage','Market stage','Whether the requirement concerns Ready / Secondary, Off-plan, either, or is not yet confirmed.',30),
('06200000-0000-4000-8000-000000000014','06200000-0000-4000-8000-000000000001','property_segment','Property segment','The broad property segment required by the Customer.',40);

INSERT INTO classification_values(id,dimension_id,stable_code,business_label,help_text,sort_order) VALUES
('06200000-0000-4000-8000-000000000101','06200000-0000-4000-8000-000000000011','buy','Buy a property','Customer wants to acquire a property.',10),
('06200000-0000-4000-8000-000000000102','06200000-0000-4000-8000-000000000011','sell','Sell my property','Customer wants NYSA to broker a sale of linked Inventory.',20),
('06200000-0000-4000-8000-000000000103','06200000-0000-4000-8000-000000000011','rent','Rent a property','Customer wants to take a property on rent.',30),
('06200000-0000-4000-8000-000000000104','06200000-0000-4000-8000-000000000011','rent_out','Rent out my property','Customer wants NYSA to broker a rental of linked Inventory.',40),
('06200000-0000-4000-8000-000000000105','06200000-0000-4000-8000-000000000011','not_confirmed','Not yet confirmed','The objective must be confirmed before governed progression.',90),
('06200000-0000-4000-8000-000000000201','06200000-0000-4000-8000-000000000012','sale','Sale','Derived from Buy or Sell.',10),
('06200000-0000-4000-8000-000000000202','06200000-0000-4000-8000-000000000012','rental','Rental','Derived from Rent or Rent out.',20),
('06200000-0000-4000-8000-000000000203','06200000-0000-4000-8000-000000000012','not_confirmed','Not yet confirmed','Cannot be derived until the objective is confirmed.',90),
('06200000-0000-4000-8000-000000000301','06200000-0000-4000-8000-000000000013','ready_secondary','Ready / Secondary','Completed or secondary-market property.',10),
('06200000-0000-4000-8000-000000000302','06200000-0000-4000-8000-000000000013','off_plan','Off-plan','Property under development or sold off-plan.',20),
('06200000-0000-4000-8000-000000000303','06200000-0000-4000-8000-000000000013','either','Either','Customer is open to either market stage.',30),
('06200000-0000-4000-8000-000000000304','06200000-0000-4000-8000-000000000013','not_confirmed','Not yet confirmed','Market stage has not yet been confirmed.',90),
('06200000-0000-4000-8000-000000000401','06200000-0000-4000-8000-000000000014','residential','Residential','Residential property.',10),
('06200000-0000-4000-8000-000000000402','06200000-0000-4000-8000-000000000014','commercial','Commercial','Commercial property.',20),
('06200000-0000-4000-8000-000000000403','06200000-0000-4000-8000-000000000014','land','Land','Land.',30),
('06200000-0000-4000-8000-000000000404','06200000-0000-4000-8000-000000000014','plot','Plot','Plot.',40),
('06200000-0000-4000-8000-000000000405','06200000-0000-4000-8000-000000000014','not_confirmed','Not yet confirmed','Property segment has not yet been confirmed.',90);

INSERT INTO classification_mappings(id,catalogue_version_id,source_dimension_code,source_value_code,target_context,target_value_code,reason_code) VALUES
('06200000-0000-4000-8000-000000001001','06200000-0000-4000-8000-000000000001','customer_objective','buy','derived_transaction','sale','objective_to_transaction'),
('06200000-0000-4000-8000-000000001002','06200000-0000-4000-8000-000000000001','customer_objective','sell','derived_transaction','sale','objective_to_transaction'),
('06200000-0000-4000-8000-000000001003','06200000-0000-4000-8000-000000000001','customer_objective','rent','derived_transaction','rental','objective_to_transaction'),
('06200000-0000-4000-8000-000000001004','06200000-0000-4000-8000-000000000001','customer_objective','rent_out','derived_transaction','rental','objective_to_transaction'),
('06200000-0000-4000-8000-000000001005','06200000-0000-4000-8000-000000000001','customer_objective','not_confirmed','derived_transaction','not_confirmed','objective_to_transaction'),
('06200000-0000-4000-8000-000000001011','06200000-0000-4000-8000-000000000001','customer_objective','buy','customer_role','buyer','objective_to_role'),
('06200000-0000-4000-8000-000000001012','06200000-0000-4000-8000-000000000001','customer_objective','sell','customer_role','seller','objective_to_role'),
('06200000-0000-4000-8000-000000001013','06200000-0000-4000-8000-000000000001','customer_objective','rent','customer_role','tenant','objective_to_role'),
('06200000-0000-4000-8000-000000001014','06200000-0000-4000-8000-000000000001','customer_objective','rent_out','customer_role','landlord','objective_to_role'),
('06200000-0000-4000-8000-000000001021','06200000-0000-4000-8000-000000000001','customer_objective','buy','offer_direction','purchase','objective_to_offer'),
('06200000-0000-4000-8000-000000001022','06200000-0000-4000-8000-000000000001','customer_objective','sell','offer_direction','sale','objective_to_offer'),
('06200000-0000-4000-8000-000000001023','06200000-0000-4000-8000-000000000001','customer_objective','rent','offer_direction','rent','objective_to_offer'),
('06200000-0000-4000-8000-000000001024','06200000-0000-4000-8000-000000000001','customer_objective','rent_out','offer_direction','rent_out','objective_to_offer');

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_market_stage_requirement_check;
UPDATE leads SET market_stage_requirement='ready_secondary' WHERE market_stage_requirement='ready';
ALTER TABLE leads ADD CONSTRAINT leads_market_stage_requirement_check CHECK(market_stage_requirement IN('ready_secondary','off_plan','either','not_confirmed'));
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_property_segment_requirement_check;
UPDATE leads SET property_segment_requirement='not_confirmed',legacy_classification_review_required=TRUE WHERE property_segment_requirement='either';
ALTER TABLE leads ADD CONSTRAINT leads_property_segment_requirement_check CHECK(property_segment_requirement IN('residential','commercial','land','plot','not_confirmed'));
ALTER TABLE leads ADD COLUMN classification_catalogue_version_id UUID REFERENCES classification_catalogue_versions(id);
ALTER TABLE leads ADD COLUMN classification_mapping_evidence JSONB;
UPDATE leads SET classification_catalogue_version_id='06200000-0000-4000-8000-000000000001' WHERE classification_version='uat062-v1';

ALTER TABLE lead_requirements DROP CONSTRAINT IF EXISTS lead_requirements_market_stage_requirement_check;
UPDATE lead_requirements SET market_stage_requirement='ready_secondary' WHERE market_stage_requirement='ready';
ALTER TABLE lead_requirements ADD CONSTRAINT lead_requirements_market_stage_requirement_check CHECK(market_stage_requirement IN('ready_secondary','off_plan','either','not_confirmed'));
ALTER TABLE lead_requirements DROP CONSTRAINT IF EXISTS lead_requirements_property_segment_requirement_check;
UPDATE lead_requirements SET property_segment_requirement='not_confirmed' WHERE property_segment_requirement='either';
ALTER TABLE lead_requirements ADD CONSTRAINT lead_requirements_property_segment_requirement_check CHECK(property_segment_requirement IN('residential','commercial','land','plot','not_confirmed'));
ALTER TABLE lead_requirements ADD COLUMN classification_catalogue_version_id UUID REFERENCES classification_catalogue_versions(id);
ALTER TABLE lead_requirements ADD COLUMN classification_mapping_evidence JSONB;
UPDATE lead_requirements SET classification_catalogue_version_id='06200000-0000-4000-8000-000000000001' WHERE classification_version='uat062-v1';

ALTER TABLE opportunities ADD COLUMN classification_catalogue_version_id UUID REFERENCES classification_catalogue_versions(id);
ALTER TABLE opportunities ADD COLUMN classification_mapping_evidence JSONB;
ALTER TABLE offers ADD COLUMN classification_catalogue_version_id UUID REFERENCES classification_catalogue_versions(id);
ALTER TABLE offers ADD COLUMN classification_mapping_evidence JSONB;

-- Historical downstream records are linked only where authoritative requirement evidence is unambiguous.
UPDATE opportunities o SET classification_catalogue_version_id=lr.classification_catalogue_version_id,
  classification_mapping_evidence=lr.classification_mapping_evidence
FROM lead_requirements lr WHERE lr.id=o.requirement_id AND lr.classification_catalogue_version_id IS NOT NULL;
UPDATE offers f SET classification_catalogue_version_id=o.classification_catalogue_version_id,
  classification_mapping_evidence=o.classification_mapping_evidence
FROM opportunities o WHERE o.id=f.opportunity_id AND o.classification_catalogue_version_id IS NOT NULL;

INSERT INTO classification_legacy_exceptions(id,lead_id,source_field,source_value,reason_code)
SELECT gen_random_uuid(),id,'business_type',business_type,'ambiguous_legacy_classification'
FROM leads WHERE legacy_classification_review_required=TRUE
ON CONFLICT DO NOTHING;

CREATE INDEX classification_values_dimension_idx ON classification_values(dimension_id,active,sort_order);
CREATE INDEX classification_mappings_lookup_idx ON classification_mappings(catalogue_version_id,source_dimension_code,source_value_code,target_context);
CREATE INDEX classification_legacy_exceptions_pending_idx ON classification_legacy_exceptions(status,created_at) WHERE status='pending';
GRANT SELECT ON classification_catalogue_versions,classification_dimensions,classification_values,classification_mappings TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON classification_legacy_exceptions TO nysareal_nysar2app;
