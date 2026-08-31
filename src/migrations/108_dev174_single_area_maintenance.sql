-- Area Maintenance is the only user-maintained source for Market Intelligence areas.
-- Existing market community identities remain as compatibility projections for immutable DLD and snapshot history.

ALTER TABLE market_communities
  ADD COLUMN managed_from_area SMALLINT NOT NULL DEFAULT 0 CHECK(managed_from_area IN (0,1));

DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM market_communities c JOIN areas a ON a.stable_code=c.stable_code WHERE c.area_id<>a.id
  ) THEN
    RAISE EXCEPTION 'A Market Intelligence stable code belongs to a different governed Area';
  END IF;
END $$;

UPDATE market_communities c SET managed_from_area=1
FROM areas a WHERE c.area_id=a.id AND c.stable_code=a.stable_code;

INSERT INTO market_communities(id,stable_code,area_id,managed_from_area,created_by)
SELECT gen_random_uuid(),a.stable_code,a.id,1,a.created_by
FROM areas a
WHERE NOT EXISTS(SELECT 1 FROM market_communities c WHERE c.area_id=a.id AND c.managed_from_area=1)
  AND NOT EXISTS(SELECT 1 FROM market_communities c WHERE c.stable_code=a.stable_code);

CREATE UNIQUE INDEX market_communities_area_projection_uq
  ON market_communities(area_id) WHERE managed_from_area=1;

-- Retain legacy identities/history but retire a duplicate active label before creating the Area projection version.
UPDATE market_community_versions v
SET status='retired',approved_by=COALESCE(v.approved_by,a.created_by),approved_at=COALESCE(v.approved_at,NOW()),
    retired_by=a.created_by,retired_at=NOW(),retirement_reason='Consolidated into governed Area Maintenance source'
FROM market_communities legacy
JOIN areas a ON a.id=legacy.area_id
JOIN market_communities projection ON projection.area_id=a.id AND projection.managed_from_area=1
WHERE v.community_id=legacy.id AND legacy.id<>projection.id AND v.status='active'
  AND v.normalized_label=LOWER(REGEXP_REPLACE(BTRIM(a.business_label),'\s+',' ','g'));

INSERT INTO market_community_versions(
  id,community_id,area_id,version_number,business_label,normalized_label,status,created_by,approved_by,approved_at
)
SELECT gen_random_uuid(),c.id,c.area_id,
  COALESCE((SELECT MAX(existing.version_number) FROM market_community_versions existing WHERE existing.community_id=c.id),0)+1,
  a.business_label,LOWER(REGEXP_REPLACE(BTRIM(a.business_label),'\s+',' ','g')),
  'active',a.created_by,a.created_by,NOW()
FROM market_communities c
JOIN areas a ON a.id=c.area_id
WHERE c.managed_from_area=1
  AND NOT EXISTS(SELECT 1 FROM market_community_versions active WHERE active.community_id=c.id AND active.status='active');

COMMENT ON COLUMN market_communities.managed_from_area IS
  '1 means stable code, current label, emirate, display order and active state are governed only by areas.';

GRANT SELECT,INSERT,UPDATE ON market_communities,market_community_versions TO nysareal_nysar2app;
