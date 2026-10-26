CREATE TABLE lead_requirement_website_conflicts (
  id UUID PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES lead_requirements(id),
  prior_requirement_id UUID REFERENCES lead_requirements(id),
  source_event_id UUID NOT NULL REFERENCES website_intake_events(id),
  field_code TEXT NOT NULL CHECK (field_code IN ('business_line','purpose','property_types','areas','budget_min','budget_max','funding_method','bedrooms_min','bedrooms_max','timeline_code','declared_priorities','must_haves','preferences','exclusions','acceptable_trade_offs')),
  governed_value JSONB,
  website_value JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requirement_id,source_event_id,field_code),
  CHECK (governed_value IS DISTINCT FROM website_value)
);

CREATE INDEX lead_requirement_website_conflicts_requirement_idx
  ON lead_requirement_website_conflicts(requirement_id,field_code);

CREATE TABLE lead_requirement_conflict_resolutions (
  id UUID PRIMARY KEY,
  conflict_id UUID NOT NULL UNIQUE REFERENCES lead_requirement_website_conflicts(id),
  resolution TEXT NOT NULL CHECK (resolution IN ('confirmed_current_value','requires_new_version')),
  resolution_notes TEXT NOT NULL CHECK (LENGTH(BTRIM(resolution_notes))>0),
  resolved_by UUID NOT NULL REFERENCES brokers(id),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lead_requirement_confirmations (
  id UUID PRIMARY KEY,
  requirement_id UUID NOT NULL UNIQUE REFERENCES lead_requirements(id),
  requirement_snapshot JSONB NOT NULL,
  requirement_snapshot_hash CHAR(64) NOT NULL,
  confirmation_basis TEXT NOT NULL CHECK (confirmation_basis IN ('direct_customer','documented_customer_instruction','reviewed_first_party_evidence')),
  confirmation_notes TEXT NOT NULL CHECK (LENGTH(BTRIM(confirmation_notes))>0),
  confirmed_by UUID NOT NULL REFERENCES brokers(id),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX lead_requirement_confirmations_requirement_idx
  ON lead_requirement_confirmations(requirement_id,confirmed_at DESC);

CREATE TRIGGER lead_requirement_website_conflicts_immutable BEFORE UPDATE OR DELETE ON lead_requirement_website_conflicts
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();
CREATE TRIGGER lead_requirement_conflict_resolutions_immutable BEFORE UPDATE OR DELETE ON lead_requirement_conflict_resolutions
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();
CREATE TRIGGER lead_requirement_confirmations_immutable BEFORE UPDATE OR DELETE ON lead_requirement_confirmations
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT,INSERT ON lead_requirement_website_conflicts TO nysareal_nysar2app;
GRANT SELECT,INSERT ON lead_requirement_conflict_resolutions TO nysareal_nysar2app;
GRANT SELECT,INSERT ON lead_requirement_confirmations TO nysareal_nysar2app;
