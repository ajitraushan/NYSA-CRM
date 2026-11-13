\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';

SELECT current_database() AS database_name,
       current_user AS database_user,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('server_version') AS server_version,
       now() AS checked_at;

WITH range_usage(source, matches) AS (
  SELECT 'brokers.phone',COUNT(*) FROM brokers WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'companies.phone',COUNT(*) FROM companies WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'company_calling_numbers.phone',COUNT(*) FROM company_calling_numbers WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'company_calling_numbers.normalized_phone',COUNT(*) FROM company_calling_numbers WHERE regexp_replace(COALESCE(normalized_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'contacts.phone',COUNT(*) FROM contacts WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'contact_channels.normalized_value',COUNT(*) FROM contact_channels WHERE regexp_replace(COALESCE(normalized_value,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'inventory_counterparties.phone',COUNT(*) FROM inventory_counterparties WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'opportunity_property_shares.recipient_phone',COUNT(*) FROM opportunity_property_shares WHERE regexp_replace(COALESCE(recipient_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'organization_settings.primary_phone',COUNT(*) FROM organization_settings WHERE regexp_replace(COALESCE(primary_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'prospects.phone',COUNT(*) FROM prospects WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'prospects.normalized_phone',COUNT(*) FROM prospects WHERE regexp_replace(COALESCE(normalized_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'transaction_counterparties.phone',COUNT(*) FROM transaction_counterparties WHERE regexp_replace(COALESCE(phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'wa_campaign_approval_recipients.normalized_phone',COUNT(*) FROM wa_campaign_approval_recipients WHERE regexp_replace(COALESCE(normalized_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'wa_campaign_recipients.normalized_phone',COUNT(*) FROM wa_campaign_recipients WHERE regexp_replace(COALESCE(normalized_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'wa_contact_suppressions.normalized_phone',COUNT(*) FROM wa_contact_suppressions WHERE regexp_replace(COALESCE(normalized_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
  UNION ALL SELECT 'wa_conversations.normalized_phone',COUNT(*) FROM wa_conversations WHERE regexp_replace(COALESCE(normalized_phone,''),'[^0-9]','','g') BETWEEN '971509100000' AND '971509119999'
)
SELECT source,matches,SUM(matches) OVER() AS total_matches
FROM range_usage
ORDER BY source;

ROLLBACK;
