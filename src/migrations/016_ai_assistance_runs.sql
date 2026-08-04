CREATE TABLE ai_assistance_runs (
  id UUID PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  function_code TEXT NOT NULL CHECK (function_code IN ('requirements_draft','match_explanation','missing_information')),
  provider TEXT NOT NULL DEFAULT 'openai' CHECK (provider='openai'),
  model TEXT NOT NULL,
  input_hash CHAR(64) NOT NULL,
  provider_response_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms>=0),
  error_code TEXT,
  requested_by UUID NOT NULL REFERENCES brokers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX ai_assistance_runs_lead_idx ON ai_assistance_runs(lead_id,created_at DESC);
CREATE INDEX ai_assistance_runs_status_idx ON ai_assistance_runs(status,created_at DESC);
