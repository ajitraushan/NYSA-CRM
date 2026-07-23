ALTER TABLE activities ADD COLUMN meeting_duration_minutes INTEGER
  CHECK (meeting_duration_minutes IS NULL OR meeting_duration_minutes BETWEEN 15 AND 480);

CREATE TABLE activity_calendar_events (
  id UUID PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider='google_calendar'),
  external_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL,
  event_url TEXT,
  meeting_url TEXT,
  sync_status TEXT NOT NULL DEFAULT 'active' CHECK (sync_status IN ('active','cancelled','error')),
  synced_by UUID NOT NULL REFERENCES brokers(id),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(activity_id,provider),
  UNIQUE(provider,external_event_id)
);

