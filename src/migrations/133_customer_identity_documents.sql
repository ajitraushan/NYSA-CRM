CREATE TABLE IF NOT EXISTS customer_document_requirement_versions (
  id UUID PRIMARY KEY,
  requirement_code TEXT NOT NULL,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  label TEXT NOT NULL,
  business_reason TEXT NOT NULL,
  customer_kind TEXT NOT NULL DEFAULT 'individual' CHECK (customer_kind IN ('individual','organization')),
  accepted_document_types TEXT[] NOT NULL,
  required_document_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  minimum_valid_documents INTEGER NOT NULL DEFAULT 1 CHECK (minimum_valid_documents BETWEEN 1 AND 6),
  review_required BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_required BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_offsets_days INTEGER[] NOT NULL DEFAULT ARRAY[0,7,14,30],
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','superseded','retired')),
  effective_from TIMESTAMPTZ NOT NULL,
  supersedes_version_id UUID REFERENCES customer_document_requirement_versions(id),
  created_by UUID REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_by UUID REFERENCES brokers(id),
  activated_at TIMESTAMPTZ,
  retired_by UUID REFERENCES brokers(id),
  retired_at TIMESTAMPTZ,
  retirement_reason TEXT,
  UNIQUE(requirement_code,version_number),
  CHECK (cardinality(accepted_document_types)>0),
  CHECK (accepted_document_types <@ ARRAY['passport','emirates_id','trade_license','certificate_of_incorporation','memorandum_of_association','power_of_attorney']::TEXT[]),
  CHECK (minimum_valid_documents<=cardinality(accepted_document_types))
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_document_requirement_active_uq
  ON customer_document_requirement_versions(requirement_code) WHERE status='active';

CREATE TABLE IF NOT EXISTS customer_identity_documents (
  id UUID PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('passport','emirates_id','power_of_attorney')),
  document_id UUID REFERENCES documents(id),
  document_version_id UUID REFERENCES document_versions(id),
  masked_final_four TEXT CHECK (masked_final_four IS NULL OR masked_final_four ~ '^[A-Z0-9]{4}$'),
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','verified','expired','rejected')),
  notes TEXT,
  submitted_by UUID NOT NULL REFERENCES brokers(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contact_id,document_type)
  ,CHECK (document_type='power_of_attorney' OR (masked_final_four IS NOT NULL AND expiry_date IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS customer_identity_documents_review_idx
  ON customer_identity_documents(status,submitted_at);
CREATE INDEX IF NOT EXISTS customer_identity_documents_expiry_idx
  ON customer_identity_documents(expiry_date) WHERE status='verified';

INSERT INTO customer_document_requirement_versions(
  id,requirement_code,version_number,label,business_reason,customer_kind,
  accepted_document_types,required_document_groups,minimum_valid_documents,review_required,expiry_required,
  reminder_offsets_days,status,effective_from
)
SELECT gen_random_uuid(),'individual_identity',1,'Individual customer identity',
  'At least one valid approved identity document is required for Customer KYC.',
  'individual',ARRAY['passport','emirates_id','power_of_attorney']::TEXT[],
  '[["passport","emirates_id"]]'::jsonb,1,TRUE,TRUE,
  ARRAY[0,7,14,30]::INTEGER[],'active',NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_document_requirement_versions WHERE requirement_code='individual_identity'
);

INSERT INTO customer_identity_documents(
  id,contact_id,document_type,masked_final_four,expiry_date,status,notes,
  submitted_by,submitted_at,reviewed_by,reviewed_at,review_notes
)
SELECT gen_random_uuid(),c.id,c.id_document_type,UPPER(c.id_document_last4),c.id_document_expiry,
  c.kyc_status,c.kyc_notes,COALESCE(c.created_by,c.owner_id),c.updated_at,
  c.kyc_verified_by,c.kyc_verified_at,NULL
FROM contacts c
WHERE c.id_document_type IN ('passport','emirates_id')
  AND c.id_document_last4 ~ '^[A-Za-z0-9]{4}$'
  AND c.id_document_expiry IS NOT NULL
  AND c.kyc_status IN ('pending_review','verified','expired','rejected')
ON CONFLICT(contact_id,document_type) DO NOTHING;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

CREATE TABLE IF NOT EXISTS company_identity_documents (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('trade_license','certificate_of_incorporation','memorandum_of_association','power_of_attorney')),
  document_id UUID NOT NULL REFERENCES documents(id),
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  masked_final_four TEXT CHECK (masked_final_four IS NULL OR masked_final_four ~ '^[A-Z0-9]{4}$'),
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','verified','expired','rejected')),
  notes TEXT,
  submitted_by UUID NOT NULL REFERENCES brokers(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id,document_type),
  CHECK (document_type NOT IN ('trade_license','certificate_of_incorporation') OR masked_final_four IS NOT NULL),
  CHECK (document_type<>'trade_license' OR expiry_date IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS company_identity_documents_review_idx
  ON company_identity_documents(status,submitted_at);

INSERT INTO customer_document_requirement_versions(
  id,requirement_code,version_number,label,business_reason,customer_kind,
  accepted_document_types,required_document_groups,minimum_valid_documents,review_required,expiry_required,
  reminder_offsets_days,status,effective_from
)
SELECT gen_random_uuid(),'corporate_identity',1,'Corporate identity and authority',
  'A corporate customer requires registration, constitutional and representative-authority evidence.',
  'organization',ARRAY['trade_license','certificate_of_incorporation','memorandum_of_association','power_of_attorney']::TEXT[],
  '[["trade_license","certificate_of_incorporation"],["memorandum_of_association"],["power_of_attorney"]]'::jsonb,
  3,TRUE,TRUE,ARRAY[0,7,14,30]::INTEGER[],'active',NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM customer_document_requirement_versions WHERE requirement_code='corporate_identity'
);

-- Identity is maintained once in Customer Master. Transaction-specific identity
-- requirements are retained for audit but no longer remain active for new Deals.
UPDATE document_compliance_requirement_versions
SET status='retired',retired_at=NOW(),retirement_reason='Replaced by reusable Customer Master identity requirements'
WHERE status='active'
  AND (
    document_type IN ('identity_document','passport','emirates_id','kyc_document')
    OR label ILIKE '%KYC%'
    OR label ILIKE '%passport%'
    OR label ILIKE '%emirates id%'
  );
