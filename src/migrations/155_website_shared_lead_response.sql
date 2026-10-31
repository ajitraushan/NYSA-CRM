-- NYSA-CRM-20261026-LEAD-001: website and Meta share the governed CORE response pipeline.
-- Existing cases, assignments, users, credentials and provider activation are unchanged.
ALTER TABLE lead_source_inbox DROP CONSTRAINT lead_source_inbox_source_system_check;
ALTER TABLE lead_source_inbox ADD CONSTRAINT lead_source_inbox_source_system_check
  CHECK (source_system IN ('meta','website'));
ALTER TABLE lead_source_inbox ADD COLUMN website_intake_event_id UUID UNIQUE REFERENCES website_intake_events(id);
CREATE INDEX lead_source_website_event ON lead_source_inbox(website_intake_event_id)
  WHERE source_system='website';
