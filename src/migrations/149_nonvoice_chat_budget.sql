ALTER TABLE lead_response_chat_drafts DROP CONSTRAINT lead_response_chat_drafts_state_check;
ALTER TABLE lead_response_chat_drafts ADD CONSTRAINT lead_response_chat_drafts_state_check CHECK(state IN ('preparing','ready','needs_human','sent','outcome_unknown','cancelled'));
ALTER TABLE lead_response_chat_drafts ADD COLUMN budget_day DATE REFERENCES lead_response_messaging_budgets(budget_day);
ALTER TABLE lead_response_chat_drafts ADD COLUMN reserved_usd NUMERIC(12,6) CHECK(reserved_usd>0);
ALTER TABLE lead_response_chat_drafts ADD COLUMN provider_ref TEXT;
