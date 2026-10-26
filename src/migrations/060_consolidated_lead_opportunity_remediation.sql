-- Consolidated Lead and Opportunity Remediation (dev.88).  Additive only.
CREATE TABLE IF NOT EXISTS lead_number_counters (
  year_code CHAR(4) PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK (last_value > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_reference TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS recovery_state TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS recovery_checkpoint TEXT;

CREATE OR REPLACE FUNCTION nysa_assign_lead_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE y CHAR(4); n INTEGER;
BEGIN
  IF NEW.lead_reference IS NULL OR BTRIM(NEW.lead_reference)='' THEN
    y:=TO_CHAR(COALESCE(NEW.created_at,NOW()) AT TIME ZONE 'Asia/Dubai','YYYY');
    INSERT INTO lead_number_counters(year_code,last_value) VALUES(y,1)
    ON CONFLICT(year_code) DO UPDATE SET last_value=lead_number_counters.last_value+1,updated_at=NOW()
    RETURNING last_value INTO n;
    NEW.lead_reference:='NYSA-LD-'||y||'-'||LPAD(n::TEXT,6,'0');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS leads_assign_reference ON leads;
CREATE TRIGGER leads_assign_reference BEFORE INSERT ON leads FOR EACH ROW EXECUTE FUNCTION nysa_assign_lead_reference();

-- Backfill deterministically without altering historical title/stage evidence.
WITH numbered AS (SELECT id,TO_CHAR(created_at AT TIME ZONE 'Asia/Dubai','YYYY') y,
  ROW_NUMBER() OVER (PARTITION BY TO_CHAR(created_at AT TIME ZONE 'Asia/Dubai','YYYY') ORDER BY created_at,id) n FROM leads WHERE lead_reference IS NULL)
UPDATE leads l SET lead_reference='NYSA-LD-'||numbered.y||'-'||LPAD(numbered.n::TEXT,6,'0') FROM numbered WHERE l.id=numbered.id;
INSERT INTO lead_number_counters(year_code,last_value)
SELECT SUBSTRING(lead_reference FROM 9 FOR 4),MAX(SUBSTRING(lead_reference FROM 14)::INTEGER) FROM leads
WHERE lead_reference LIKE 'NYSA-LD-____-______' GROUP BY 1
ON CONFLICT(year_code) DO UPDATE SET last_value=GREATEST(lead_number_counters.last_value,EXCLUDED.last_value),updated_at=NOW();
ALTER TABLE leads ALTER COLUMN lead_reference SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_reference_uq ON leads(lead_reference);
CREATE INDEX IF NOT EXISTS leads_reference_search_idx ON leads(lead_reference);

-- Terminal pursuit status is current-state data; Lead stage/temperature stay historical qualification data.
UPDATE leads l SET current_status=CASE WHEN EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=l.id AND o.stage='Closed Won') THEN 'closed_won'
  WHEN NOT EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=l.id AND o.stage NOT IN ('Closed Won','Closed Lost'))
       AND EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=l.id AND o.stage='Closed Lost') THEN 'closed_lost' ELSE COALESCE(l.current_status,'active') END;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_current_status_ck;
ALTER TABLE leads ADD CONSTRAINT leads_current_status_ck CHECK (current_status IN ('active','closed_won','closed_lost'));
ALTER TABLE opportunities DROP CONSTRAINT IF EXISTS opportunities_recovery_state_ck;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_recovery_state_ck CHECK (recovery_state IS NULL OR recovery_state IN ('offer_recovery','matching','closed_lost'));

GRANT SELECT,INSERT,UPDATE ON lead_number_counters TO nysareal_nysar2app;
