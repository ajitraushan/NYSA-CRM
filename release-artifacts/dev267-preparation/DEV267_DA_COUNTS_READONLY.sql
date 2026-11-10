\set ON_ERROR_STOP on

BEGIN;
SET TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '60s';

WITH recipient_gaps AS (
  SELECT COUNT(*)::int AS count
    FROM wa_campaign_recipients r
    JOIN wa_contact_suppressions s
      ON s.normalized_phone = r.normalized_phone
   WHERE r.suppression_status <> 'suppressed'
), contact_gaps AS (
  SELECT COUNT(DISTINCT c.id)::int AS count
    FROM contacts c
    JOIN contact_channels cc
      ON cc.contact_id = c.id
     AND cc.channel_kind = 'Phone'
    JOIN wa_contact_suppressions s
      ON s.normalized_phone = cc.normalized_value
   WHERE c.do_not_contact = 0
      OR cc.restriction_status <> 'do_not_contact'
)
SELECT
  (SELECT count FROM recipient_gaps)
    AS recipient_rows_not_marked_suppressed,
  (SELECT count FROM contact_gaps)
    AS contacts_not_marked_do_not_contact;

ROLLBACK;
