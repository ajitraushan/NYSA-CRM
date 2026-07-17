ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS id_document_type TEXT
    CHECK (id_document_type IS NULL OR id_document_type IN ('passport','emirates_id')),
  ADD COLUMN IF NOT EXISTS id_document_last4 TEXT
    CHECK (id_document_last4 IS NULL OR id_document_last4 ~ '^[A-Za-z0-9]{4}$'),
  ADD COLUMN IF NOT EXISTS id_document_expiry DATE,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (kyc_status IN ('unverified','pending_review','verified','expired','rejected')),
  ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_verified_by UUID REFERENCES brokers(id),
  ADD COLUMN IF NOT EXISTS kyc_notes TEXT;
