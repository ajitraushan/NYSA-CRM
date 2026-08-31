ALTER TABLE sla_policies
  ADD COLUMN qualification_hot_elapsed_minutes INTEGER NOT NULL DEFAULT 15
    CHECK(qualification_hot_elapsed_minutes BETWEEN 1 AND 1440),
  ADD COLUMN qualification_warm_business_minutes INTEGER NOT NULL DEFAULT 240
    CHECK(qualification_warm_business_minutes BETWEEN 1 AND 10080),
  ADD COLUMN qualification_cold_business_days INTEGER NOT NULL DEFAULT 1
    CHECK(qualification_cold_business_days BETWEEN 1 AND 30),
  ADD COLUMN qualification_cold_nurture_business_days INTEGER NOT NULL DEFAULT 5
    CHECK(qualification_cold_nurture_business_days BETWEEN 1 AND 30);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK(task_type IN(
  'general','proposal_correction','customer_response_follow_up','leave_approval','document_compliance_follow_up',
  'marketing_material_review','marketing_material_follow_up','qualification_follow_up'
));

CREATE TABLE qualification_follow_up_task_links (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id),
  assessment_id UUID NOT NULL REFERENCES qualification_assessments(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  sla_policy_id UUID NOT NULL REFERENCES sla_policies(id),
  temperature TEXT NOT NULL CHECK(temperature IN('Cold','Warm','Hot')),
  timer_basis TEXT NOT NULL CHECK(timer_basis IN('elapsed_minutes','business_minutes','business_days')),
  target_minutes INTEGER NOT NULL CHECK(target_minutes>0),
  cycle_number INTEGER NOT NULL DEFAULT 1 CHECK(cycle_number>0),
  cadence_business_days INTEGER CHECK(cadence_business_days IS NULL OR cadence_business_days>0),
  due_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id,cycle_number)
);
CREATE INDEX qualification_follow_up_lead_idx
  ON qualification_follow_up_task_links(lead_id,created_at DESC);
