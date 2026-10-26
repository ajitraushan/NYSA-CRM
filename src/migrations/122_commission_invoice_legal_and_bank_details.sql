-- Commission invoice legal identity, payer VAT identity and remittance details.

ALTER TABLE organization_settings
  ADD COLUMN vat_registration_number TEXT,
  ADD COLUMN bank_account_name TEXT,
  ADD COLUMN bank_name TEXT,
  ADD COLUMN bank_account_number TEXT,
  ADD COLUMN bank_iban TEXT,
  ADD COLUMN bank_swift_code TEXT,
  ADD COLUMN bank_currency CHAR(3) DEFAULT 'AED',
  ADD COLUMN bank_branch TEXT,
  ADD CONSTRAINT organization_settings_bank_currency_ck
    CHECK (bank_currency IS NULL OR bank_currency = UPPER(bank_currency));

ALTER TABLE companies
  ADD COLUMN vat_registration_number TEXT;

