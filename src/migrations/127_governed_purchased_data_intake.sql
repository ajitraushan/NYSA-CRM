ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_customer_reference_uq ON contacts(customer_reference) WHERE customer_reference IS NOT NULL;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK(source IN ('Website','WhatsApp','Current CRM','Purchased data','Referral','Social media','Walk-in','Phone','Property portal','Other'));

CREATE TABLE purchased_data_import_batches (
  id UUID PRIMARY KEY,
  batch_reference TEXT NOT NULL UNIQUE,
  module_type TEXT NOT NULL CHECK(module_type IN ('customer_only','lead')),
  source_system_code TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  acquisition_batch_reference TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  campaign_reference TEXT,
  processing_basis TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  media_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK(file_size_bytes>0),
  file_hash TEXT NOT NULL CHECK(file_hash ~ '^[a-f0-9]{64}$'),
  preview_hash TEXT NOT NULL CHECK(preview_hash ~ '^[a-f0-9]{64}$'),
  storage_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('previewed','confirmed','processing','completed','completed_with_exceptions','failed')),
  row_count INTEGER NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  linked_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  invalid_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES brokers(id),
  confirmed_by UUID REFERENCES brokers(id),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_type,source_system_code,acquisition_batch_reference,file_hash)
);

CREATE TABLE purchased_data_import_authorizations (
  broker_id UUID PRIMARY KEY REFERENCES brokers(id),
  may_preview SMALLINT NOT NULL DEFAULT 1 CHECK(may_preview IN (0,1)),
  may_confirm SMALLINT NOT NULL DEFAULT 0 CHECK(may_confirm IN (0,1)),
  active SMALLINT NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  reason TEXT NOT NULL,
  configured_by UUID NOT NULL REFERENCES brokers(id),
  configured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Import authority is deliberately not inferred from an existing role. Admin must
-- explicitly authorize a Manager or Managing Director before operational use.

CREATE TABLE purchased_data_import_rows (
  id UUID PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES purchased_data_import_batches(id),
  row_number INTEGER NOT NULL,
  external_row_reference TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('created','linked','skipped','review_required','invalid','failed')),
  contact_id UUID REFERENCES contacts(id),
  lead_id UUID REFERENCES leads(id),
  reason TEXT,
  normalized_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(batch_id,row_number),
  UNIQUE(batch_id,external_row_reference)
);
CREATE UNIQUE INDEX purchased_data_customer_row_idempotency_uq ON purchased_data_import_rows((normalized_payload->>'sourceSystemCode'),(normalized_payload->>'acquisitionBatchReference'),external_row_reference)
  WHERE outcome IN ('created','linked') AND normalized_payload->>'moduleType'='customer_only';
CREATE UNIQUE INDEX purchased_data_lead_row_idempotency_uq ON purchased_data_import_rows((normalized_payload->>'sourceSystemCode'),(normalized_payload->>'acquisitionBatchReference'),external_row_reference)
  WHERE outcome='created' AND normalized_payload->>'moduleType'='lead';

DO $$
DECLARE prior_expression TEXT;
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT prior_expression
  FROM pg_constraint WHERE conrelid='audit_log'::regclass AND conname='audit_log_entity_type_check';
  ALTER TABLE audit_log DROP CONSTRAINT audit_log_entity_type_check;
  EXECUTE 'ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK ((' || prior_expression || ') OR entity_type = ''PurchasedDataImport'')';
END $$;
