ALTER TABLE prospect_activities
  ADD COLUMN next_step text,
  ADD COLUMN not_interested_reason text,
  ADD COLUMN not_interested_note text,
  ADD COLUMN recontact_month date;

ALTER TABLE tasks
  ADD COLUMN source_activity_id uuid REFERENCES prospect_activities(id),
  ADD COLUMN snoozed_until timestamptz,
  ADD COLUMN snooze_reason text;

ALTER TABLE prospects
  ADD COLUMN purpose text,
  ADD COLUMN budget_band text,
  ADD COLUMN property_type text,
  ADD COLUMN market text,
  ADD COLUMN timeline text,
  ADD COLUMN retry_attempts smallint,
  ADD COLUMN next_retry_at timestamptz,
  ADD COLUMN parked_at timestamptz,
  ADD COLUMN last_activity_at timestamptz,
  ADD COLUMN first_call_due_at timestamptz;

CREATE TABLE prospect_preferred_areas (
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES areas(id),
  PRIMARY KEY (prospect_id, area_id)
);

CREATE TABLE prospect_interest_history (
  id uuid PRIMARY KEY,
  prospect_id uuid NOT NULL REFERENCES prospects(id),
  changed_by uuid NOT NULL REFERENCES brokers(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  before_values jsonb NOT NULL,
  after_values jsonb NOT NULL
);

CREATE FUNCTION nysa_prospect_interest_history_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Prospect interest history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER prospect_interest_history_append_only
  BEFORE UPDATE OR DELETE ON prospect_interest_history
  FOR EACH ROW EXECUTE FUNCTION nysa_prospect_interest_history_append_only();

CREATE TABLE prospect_cadence_policy_versions (
  id uuid PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('draft','active','retired')),
  daily_target smallint NOT NULL CHECK (daily_target BETWEEN 0 AND 300),
  working_days smallint[] NOT NULL CHECK (cardinality(working_days) > 0 AND working_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]),
  first_call_days smallint NOT NULL CHECK (first_call_days BETWEEN 1 AND 14),
  retry_gaps smallint[] NOT NULL CHECK (cardinality(retry_gaps) BETWEEN 1 AND 10 AND 1 <= ALL(retry_gaps) AND 14 >= ALL(retry_gaps)),
  park_on_exhaustion boolean NOT NULL,
  created_by uuid REFERENCES brokers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES brokers(id),
  approved_at timestamptz
);
CREATE UNIQUE INDEX prospect_cadence_one_active_idx ON prospect_cadence_policy_versions (status) WHERE status = 'active';
INSERT INTO prospect_cadence_policy_versions (id, status, daily_target, working_days, first_call_days, retry_gaps, park_on_exhaustion)
VALUES ('fc007271-0000-4000-8000-000000000001','active',40,ARRAY[1,2,3,4,5,6],1,ARRAY[1,2,4],true);

CREATE TABLE prospect_agent_targets (
  id uuid PRIMARY KEY,
  agent_id uuid NOT NULL REFERENCES brokers(id),
  effective_from date NOT NULL,
  daily_target smallint NOT NULL CHECK (daily_target BETWEEN 0 AND 300),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  created_by uuid NOT NULL REFERENCES brokers(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prospect_agent_targets_effective_idx ON prospect_agent_targets (agent_id, effective_from DESC, created_at DESC, id DESC);

CREATE TABLE prospect_override_reviews (
  id uuid PRIMARY KEY,
  activity_id uuid UNIQUE REFERENCES prospect_activities(id),
  task_id uuid UNIQUE REFERENCES tasks(id),
  reviewed_by uuid NOT NULL REFERENCES brokers(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  comment text CHECK (length(btrim(comment)) >= 5),
  CHECK (num_nonnulls(activity_id, task_id) = 1)
);

CREATE TABLE prospect_digest_runs (
  id uuid PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES brokers(id),
  recipient_email text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('agent','manager','director','admin_test')),
  report_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','sending','accepted','retry','review','failed','skipped')),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 2),
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  error_code text,
  UNIQUE (recipient_id, audience, report_date)
);
CREATE INDEX prospect_digest_due_idx ON prospect_digest_runs (next_attempt_at) WHERE status IN ('pending','retry');
ALTER TABLE brokers ADD COLUMN prospect_digest_opt_out boolean;

CREATE INDEX prospect_activities_author_time_idx ON prospect_activities (created_by, occurred_at);
CREATE INDEX prospects_owner_status_activity_idx ON prospects (owner_id, status, last_activity_at);
CREATE INDEX prospects_team_status_activity_idx ON prospects (team_id, status, last_activity_at);
CREATE INDEX tasks_prospect_assignee_due_idx ON tasks (assignee_id, status, due_at)
  WHERE task_type = 'prospect_follow_up' AND status IN ('open','in_progress');
CREATE INDEX prospects_retry_due_idx ON prospects (owner_id, next_retry_at)
  WHERE next_retry_at IS NOT NULL AND parked_at IS NULL;

WITH latest AS (
  SELECT prospect_id, max(occurred_at) AS at FROM prospect_activities GROUP BY prospect_id
)
UPDATE prospects p SET last_activity_at = latest.at FROM latest WHERE p.id = latest.prospect_id;

UPDATE prospects
SET first_call_due_at =
  ((created_at AT TIME ZONE 'Asia/Dubai') +
    CASE WHEN extract(isodow FROM created_at AT TIME ZONE 'Asia/Dubai') = 6
      THEN interval '2 days' ELSE interval '1 day' END)
  AT TIME ZONE 'Asia/Dubai';
