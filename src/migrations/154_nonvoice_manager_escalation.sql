-- Approved interim routing: manager alert, never automatic agent reassignment.
ALTER TABLE lead_follow_up_cases ADD COLUMN manager_alert_task_id UUID REFERENCES tasks(id);
ALTER TABLE lead_follow_up_cases ADD COLUMN manager_alerted_at TIMESTAMPTZ;
ALTER TABLE lead_follow_up_cases ADD COLUMN manager_alert_setup_missing BOOLEAN NOT NULL DEFAULT FALSE;
