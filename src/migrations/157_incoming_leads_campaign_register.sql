-- NYSA-CRM-20261028-LEAD-002: campaign-level Meta intake evidence for the
-- Incoming Leads register. Customer form answers remain in encrypted evidence.
ALTER TABLE lead_source_inbox
  ADD COLUMN external_campaign_code TEXT,
  ADD COLUMN external_campaign_name TEXT,
  ADD COLUMN external_adset_code TEXT,
  ADD COLUMN external_adset_name TEXT,
  ADD COLUMN external_ad_code TEXT,
  ADD COLUMN external_ad_name TEXT,
  ADD COLUMN campaign_id UUID REFERENCES marketing_campaigns(id),
  ADD COLUMN campaign_mapping_status TEXT NOT NULL DEFAULT 'not_supplied'
    CHECK (campaign_mapping_status IN ('not_supplied','mapped','unmapped'));

CREATE INDEX lead_source_inbox_campaign_idx
  ON lead_source_inbox(campaign_id,received_at DESC)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX lead_source_inbox_unmapped_campaign_idx
  ON lead_source_inbox(received_at DESC)
  WHERE campaign_mapping_status='unmapped';

GRANT SELECT,INSERT,UPDATE ON lead_source_inbox TO nysareal_nysar2app;
