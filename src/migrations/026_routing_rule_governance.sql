UPDATE routing_rules SET active=0,updated_at=NOW()
WHERE active=1 AND source IS NULL AND business_type IS NULL AND team_id IS NOT NULL;

WITH duplicates AS (
  SELECT id,ROW_NUMBER() OVER(PARTITION BY COALESCE(source,''),COALESCE(business_type,'') ORDER BY priority,created_at,id) AS position
  FROM routing_rules WHERE active=1
)
UPDATE routing_rules r SET active=0,updated_at=NOW()
FROM duplicates d WHERE r.id=d.id AND d.position>1;

ALTER TABLE routing_rules ADD CONSTRAINT routing_rules_active_fallback_ck
  CHECK(active=0 OR source IS NOT NULL OR business_type IS NOT NULL OR team_id IS NULL);
CREATE UNIQUE INDEX routing_rules_active_match_uq
  ON routing_rules(COALESCE(source,''),COALESCE(business_type,'')) WHERE active=1;
