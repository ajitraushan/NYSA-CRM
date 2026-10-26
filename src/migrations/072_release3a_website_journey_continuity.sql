ALTER TABLE website_intake_events
  ADD COLUMN journey_key TEXT;

CREATE INDEX website_intake_events_journey_idx
  ON website_intake_events(journey_key,processed_at DESC)
  WHERE journey_key IS NOT NULL;

GRANT SELECT,INSERT,UPDATE ON website_intake_events TO nysareal_nysar2app;
