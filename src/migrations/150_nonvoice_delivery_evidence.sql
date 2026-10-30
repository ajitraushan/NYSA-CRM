ALTER TABLE lead_response_message_attempts ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'unknown' CHECK(delivery_state IN ('unknown','sent','delivered','read','failed'));
ALTER TABLE lead_response_chat_drafts ADD COLUMN delivery_state TEXT NOT NULL DEFAULT 'unknown' CHECK(delivery_state IN ('unknown','sent','delivered','read','failed'));
