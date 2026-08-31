ALTER TABLE website_intake_events
  ADD COLUMN ai_routing_status TEXT,
  ADD COLUMN ai_routing_business_type TEXT,
  ADD COLUMN ai_routing_reason TEXT,
  ADD COLUMN ai_routing_decision JSONB;

ALTER TABLE website_intake_events
  ADD CONSTRAINT website_intake_events_ai_routing_status_check
  CHECK (ai_routing_status IS NULL OR ai_routing_status IN (
    'awaiting_property_selection','determined','review_required','manager_review','not_emitted'
  ));

ALTER TABLE website_intake_events
  ADD CONSTRAINT website_intake_events_ai_routing_business_check
  CHECK (ai_routing_business_type IS NULL OR ai_routing_business_type IN ('Sale','Off-plan'));

CREATE INDEX website_intake_events_ai_routing_review_idx
  ON website_intake_events(ai_routing_status,received_at DESC)
  WHERE ai_routing_status IN ('review_required','manager_review','not_emitted');

GRANT SELECT,INSERT,UPDATE ON website_intake_events TO nysareal_nysar2app;
