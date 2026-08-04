ALTER TABLE viewing_calendar_events ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE viewing_calendar_events ADD COLUMN last_attempt_at TIMESTAMPTZ;
ALTER TABLE viewing_calendar_events ADD COLUMN last_error TEXT;
ALTER TABLE viewing_calendar_events ADD COLUMN reconciled_at TIMESTAMPTZ;
ALTER TABLE viewing_calendar_events ADD COLUMN external_updated_at TIMESTAMPTZ;
CREATE INDEX viewing_calendar_events_retry_idx ON viewing_calendar_events(sync_status,last_attempt_at) WHERE sync_status='error';
