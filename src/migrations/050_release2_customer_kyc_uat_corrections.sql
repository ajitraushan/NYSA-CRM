ALTER TABLE contacts
  ADD COLUMN duplicate_review_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (duplicate_review_status IN ('not_required','pending','approved','rejected')),
  ADD COLUMN duplicate_match_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  ADD COLUMN duplicate_reviewed_at TIMESTAMPTZ,
  ADD COLUMN duplicate_reviewed_by UUID REFERENCES brokers(id),
  ADD COLUMN duplicate_review_notes TEXT;

CREATE INDEX contacts_duplicate_review_queue_idx
  ON contacts(duplicate_review_status,created_at)
  WHERE duplicate_review_status='pending' AND archived_at IS NULL;

-- Recover the duplicate customer created during the dev.42 CRM Test UAT. This is deliberately
-- conditional: if the supplied UAT record no longer exists or no longer shares a channel with
-- another active customer, the migration changes nothing.
WITH matched AS (
  SELECT candidate.id,
    ARRAY_AGG(DISTINCT existing.contact_id) FILTER (WHERE existing.contact_id IS NOT NULL) AS match_ids
  FROM contacts candidate
  JOIN contact_channels candidate_channel ON candidate_channel.contact_id=candidate.id
  JOIN contact_channels existing ON existing.channel_kind=candidate_channel.channel_kind
    AND existing.normalized_value=candidate_channel.normalized_value
    AND existing.contact_id<>candidate.id
  JOIN contacts existing_contact ON existing_contact.id=existing.contact_id
    AND existing_contact.archived_at IS NULL
    AND existing_contact.lifecycle_status<>'merged'
  WHERE candidate.id='a9dc9573-9948-4cd3-b23e-d3fea8230ab7'
    AND candidate.archived_at IS NULL
  GROUP BY candidate.id
)
UPDATE contacts candidate
SET duplicate_review_status='pending',
    duplicate_match_ids=matched.match_ids,
    lifecycle_status='inactive',
    updated_at=NOW()
FROM matched
WHERE candidate.id=matched.id
  AND CARDINALITY(matched.match_ids)>0;
