ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_temperature_check;
ALTER TABLE leads ALTER COLUMN temperature SET DEFAULT 'Unassessed';
ALTER TABLE leads ADD CONSTRAINT leads_temperature_check
  CHECK (temperature IN ('Unassessed','Hot','Warm','Cold'));
