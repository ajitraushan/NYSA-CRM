-- dev.90: governed monthly Lead references and authoritative pursuit status.
CREATE TABLE lead_month_number_counters (
  period_code CHAR(6) PRIMARY KEY,
  last_value INTEGER NOT NULL CHECK(last_value>0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION nysa_assign_lead_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p CHAR(6); n INTEGER;
BEGIN
  IF NEW.lead_reference IS NULL OR BTRIM(NEW.lead_reference)='' THEN
    p:=TO_CHAR(COALESCE(NEW.created_at,NOW()) AT TIME ZONE 'Asia/Dubai','YYYYMM');
    INSERT INTO lead_month_number_counters(period_code,last_value) VALUES(p,1)
    ON CONFLICT(period_code) DO UPDATE SET last_value=lead_month_number_counters.last_value+1,updated_at=NOW()
    RETURNING last_value INTO n;
    NEW.lead_reference:='NYSA-LD-'||p||'-'||LPAD(n::TEXT,6,'0');
  END IF;
  RETURN NEW;
END $$;

WITH existing_max AS (
  SELECT SUBSTRING(lead_reference FROM 9 FOR 6) period_code,
    MAX(SUBSTRING(lead_reference FROM 16)::INTEGER) last_value
  FROM leads WHERE lead_reference ~ '^NYSA-LD-[0-9]{6}-[0-9]{6}$' GROUP BY 1
),renumbered AS (
  SELECT l.id,TO_CHAR(l.created_at AT TIME ZONE 'Asia/Dubai','YYYYMM') period_code,
    COALESCE(m.last_value,0)+ROW_NUMBER() OVER(PARTITION BY TO_CHAR(l.created_at AT TIME ZONE 'Asia/Dubai','YYYYMM') ORDER BY l.created_at,l.id) sequence_no
  FROM leads l LEFT JOIN existing_max m ON m.period_code=TO_CHAR(l.created_at AT TIME ZONE 'Asia/Dubai','YYYYMM')
  WHERE l.lead_reference !~ '^NYSA-LD-[0-9]{6}-[0-9]{6}$'
)
UPDATE leads l SET lead_reference='NYSA-LD-'||r.period_code||'-'||LPAD(r.sequence_no::TEXT,6,'0')
FROM renumbered r WHERE r.id=l.id;

INSERT INTO lead_month_number_counters(period_code,last_value)
SELECT SUBSTRING(lead_reference FROM 9 FOR 6),MAX(SUBSTRING(lead_reference FROM 16)::INTEGER)
FROM leads GROUP BY 1
ON CONFLICT(period_code) DO UPDATE SET last_value=GREATEST(lead_month_number_counters.last_value,EXCLUDED.last_value),updated_at=NOW();

CREATE OR REPLACE FUNCTION nysa_sync_lead_current_status(target_lead UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE leads l SET current_status=CASE
    WHEN EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=target_lead AND o.stage NOT IN ('Closed Won','Closed Lost')) THEN 'active'
    WHEN EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=target_lead AND o.stage='Closed Won') THEN 'closed_won'
    WHEN EXISTS(SELECT 1 FROM opportunities o WHERE o.lead_id=target_lead AND o.stage='Closed Lost') THEN 'closed_lost'
    ELSE 'active' END,updated_at=NOW() WHERE l.id=target_lead;
END $$;

CREATE OR REPLACE FUNCTION nysa_opportunity_sync_lead_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM nysa_sync_lead_current_status(NEW.lead_id); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS opportunities_sync_lead_status ON opportunities;
CREATE TRIGGER opportunities_sync_lead_status AFTER INSERT OR UPDATE OF stage ON opportunities
FOR EACH ROW EXECUTE FUNCTION nysa_opportunity_sync_lead_status();

UPDATE leads l SET current_status='active';
DO $$ DECLARE x RECORD; BEGIN FOR x IN SELECT id FROM leads LOOP PERFORM nysa_sync_lead_current_status(x.id); END LOOP; END $$;

GRANT SELECT,INSERT,UPDATE ON lead_month_number_counters TO nysareal_nysar2app;

-- A recovery Offer is a new immutable Offer whose Revision 1 points back to the
-- terminal predecessor Offer; the predecessor itself is never reopened.
ALTER TABLE offers ADD COLUMN IF NOT EXISTS predecessor_offer_id UUID REFERENCES offers(id);
CREATE INDEX IF NOT EXISTS offers_predecessor_idx ON offers(predecessor_offer_id);
