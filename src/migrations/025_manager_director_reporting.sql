ALTER TABLE brokers ADD COLUMN reports_to_id UUID REFERENCES brokers(id);
ALTER TABLE brokers ADD CONSTRAINT brokers_reports_to_not_self_ck CHECK (reports_to_id IS NULL OR reports_to_id<>id);
CREATE INDEX brokers_reports_to_idx ON brokers(reports_to_id) WHERE reports_to_id IS NOT NULL;

-- When there is one unambiguous active Managing Director, preserve the agreed company
-- hierarchy by assigning every active Manager to that Director. Future changes are
-- maintained explicitly in User Management.
WITH sole_director AS (
  SELECT (ARRAY_AGG(id ORDER BY joined_at,id))[1] AS id
  FROM brokers
  WHERE role='internal_broker' AND job_role='director' AND status='active'
  HAVING COUNT(*)=1
)
UPDATE brokers manager
SET reports_to_id=director.id
FROM sole_director director
WHERE manager.role='internal_broker'
  AND manager.job_role='manager'
  AND manager.status IN ('active','pending_activation')
  AND manager.reports_to_id IS NULL;
