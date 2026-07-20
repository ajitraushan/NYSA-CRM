WITH eligible AS (
  SELECT pm.id,pm.listing_id,pm.created_by,t.id AS team_id,t.name AS team_name
  FROM property_media pm
  JOIN listings l ON l.id=pm.listing_id
  JOIN brokers owner ON owner.id=l.posted_by
  LEFT JOIN teams t ON t.id=owner.team_id AND t.active=1
  LEFT JOIN brokers manager ON manager.id=t.manager_id AND manager.status='active'
  WHERE pm.approval_status='pending'
    AND pm.usage_rights_confirmed=TRUE
    AND (pm.rights_expires_at IS NULL OR pm.rights_expires_at>NOW())
    AND manager.id IS NULL
)
INSERT INTO audit_log(id,entity_type,entity_id,action,performed_by,details)
SELECT md5('orphaned-property-media:'||id::text)::uuid,
       'PropertyMedia',
       id,
       'auto_approved_no_responsible_manager',
       created_by,
       json_build_object(
         'listingId',listing_id,
         'teamId',team_id,
         'teamName',team_name,
         'reason','No active responsible Manager was maintained at migration time'
       )::text
FROM eligible
ON CONFLICT (id) DO NOTHING;

UPDATE property_media pm
SET approval_status='approved',
    approved_by=pm.created_by,
    approved_at=NOW(),
    rejection_reason=NULL
FROM listings l
JOIN brokers owner ON owner.id=l.posted_by
LEFT JOIN teams t ON t.id=owner.team_id AND t.active=1
LEFT JOIN brokers manager ON manager.id=t.manager_id AND manager.status='active'
WHERE pm.listing_id=l.id
  AND pm.approval_status='pending'
  AND pm.usage_rights_confirmed=TRUE
  AND (pm.rights_expires_at IS NULL OR pm.rights_expires_at>NOW())
  AND manager.id IS NULL;
