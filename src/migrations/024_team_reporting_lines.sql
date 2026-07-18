-- A user's reporting manager is derived from the manager of the user's primary team.
-- Reconcile an unambiguous existing Manager assignment without silently choosing when
-- more than one active Manager has been placed in the same team.
WITH sole_manager AS (
  SELECT b.team_id,(ARRAY_AGG(b.id ORDER BY b.joined_at,b.id))[1] AS manager_id
  FROM brokers b
  WHERE b.team_id IS NOT NULL
    AND b.job_role='manager'
    AND b.status IN ('active','pending_activation')
  GROUP BY b.team_id
  HAVING COUNT(*)=1
)
UPDATE teams t
SET manager_id=s.manager_id
FROM sole_manager s
WHERE t.id=s.team_id
  AND t.manager_id IS NULL;

UPDATE team_memberships tm
SET membership_role='member'
FROM teams t
WHERE tm.team_id=t.id
  AND tm.membership_role='manager'
  AND tm.ends_at IS NULL
  AND tm.broker_id IS DISTINCT FROM t.manager_id;

INSERT INTO team_memberships(id,team_id,broker_id,membership_role,created_by)
SELECT md5('team-manager:'||t.id::text||':'||t.manager_id::text)::uuid,t.id,t.manager_id,'manager',t.manager_id
FROM teams t
WHERE t.manager_id IS NOT NULL
ON CONFLICT (team_id,broker_id) WHERE ends_at IS NULL
DO UPDATE SET membership_role='manager';

CREATE UNIQUE INDEX IF NOT EXISTS team_memberships_one_active_manager_uq
  ON team_memberships(team_id)
  WHERE membership_role='manager' AND ends_at IS NULL;
