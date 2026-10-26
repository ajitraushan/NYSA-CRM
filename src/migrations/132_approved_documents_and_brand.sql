ALTER TABLE brokers
  ADD COLUMN brn TEXT,
  ADD COLUMN brn_issued_on DATE,
  ADD CONSTRAINT brokers_brn_complete_ck CHECK (
    (brn IS NULL AND brn_issued_on IS NULL) OR
    (brn IS NOT NULL AND LENGTH(BTRIM(brn)) > 0 AND brn_issued_on IS NOT NULL)
  );

ALTER TABLE organization_settings
  ADD COLUMN default_document_agent_id UUID REFERENCES brokers(id),
  ADD COLUMN orn TEXT;

CREATE TABLE approved_document_drafts (
  id UUID PRIMARY KEY,
  document_code TEXT NOT NULL CHECK (document_code IN (
    'viewing_confirmation','a2a_buyer','a2a_seller','listing_noc'
  )),
  source_entity_type TEXT NOT NULL,
  source_entity_id UUID NOT NULL,
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','cancelled')),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES brokers(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_document_version_id UUID REFERENCES document_versions(id)
);
CREATE UNIQUE INDEX approved_document_drafts_open_uq
  ON approved_document_drafts(document_code,source_entity_type,source_entity_id)
  WHERE status='draft';

CREATE TABLE approved_document_issuances (
  id UUID PRIMARY KEY,
  document_code TEXT NOT NULL CHECK (document_code IN (
    'buyer_proposal','financial_illustration','offer_letter','viewing_confirmation',
    'a2a_buyer','a2a_seller','listing_noc','tax_invoice','agent_payout'
  )),
  template_version TEXT NOT NULL,
  template_hash CHAR(64) NOT NULL,
  data_snapshot JSONB NOT NULL,
  data_hash CHAR(64) NOT NULL,
  document_version_id UUID NOT NULL UNIQUE REFERENCES document_versions(id),
  pdf_hash CHAR(64) NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id UUID NOT NULL,
  issued_by UUID NOT NULL REFERENCES brokers(id),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX approved_document_issuances_source_idx
  ON approved_document_issuances(source_entity_type,source_entity_id,issued_at DESC);

CREATE TABLE listing_noc_evidence_versions (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  version_number INTEGER NOT NULL CHECK(version_number>0),
  noc_reference TEXT NOT NULL CHECK(CHAR_LENGTH(BTRIM(noc_reference))>=3),
  issued_at DATE NOT NULL,
  expires_at DATE,
  document_version_id UUID NOT NULL UNIQUE REFERENCES document_versions(id),
  source_issued_document_version_id UUID REFERENCES document_versions(id),
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK(status IN('pending_verification','active','rejected','superseded','retired')),
  supersedes_version_id UUID REFERENCES listing_noc_evidence_versions(id),
  created_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES brokers(id),
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  UNIQUE(listing_id,version_number),
  CHECK(expires_at IS NULL OR expires_at>=issued_at),
  CHECK((reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL)),
  CHECK(reviewed_by IS NULL OR reviewed_by<>created_by)
);
CREATE UNIQUE INDEX listing_noc_evidence_open_uq ON listing_noc_evidence_versions(listing_id) WHERE status='pending_verification';
CREATE UNIQUE INDEX listing_noc_evidence_active_uq ON listing_noc_evidence_versions(listing_id) WHERE status='active';
CREATE INDEX listing_noc_evidence_history_idx ON listing_noc_evidence_versions(listing_id,created_at DESC);

CREATE FUNCTION prevent_listing_noc_evidence_fact_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Listing NOC evidence is immutable'; END IF;
  IF ROW(OLD.id,OLD.listing_id,OLD.version_number,OLD.noc_reference,OLD.issued_at,OLD.expires_at,
      OLD.document_version_id,OLD.source_issued_document_version_id,OLD.supersedes_version_id,OLD.created_by,OLD.created_at)
    IS DISTINCT FROM ROW(NEW.id,NEW.listing_id,NEW.version_number,NEW.noc_reference,NEW.issued_at,NEW.expires_at,
      NEW.document_version_id,NEW.source_issued_document_version_id,NEW.supersedes_version_id,NEW.created_by,NEW.created_at) THEN
    RAISE EXCEPTION 'Listing NOC evidence facts are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER listing_noc_evidence_immutable BEFORE UPDATE OR DELETE ON listing_noc_evidence_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_listing_noc_evidence_fact_mutation();

GRANT SELECT,INSERT ON approved_document_issuances TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON approved_document_drafts TO nysareal_nysar2app;
GRANT SELECT,INSERT,UPDATE ON listing_noc_evidence_versions TO nysareal_nysar2app;
