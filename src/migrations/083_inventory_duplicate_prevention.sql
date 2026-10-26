-- Release 4 local integration: prevent duplicate Inventory masters and govern reopening.

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS unit_reference TEXT,
  ADD COLUMN IF NOT EXISTS building TEXT;

CREATE INDEX IF NOT EXISTS listings_inventory_identity_review_idx
  ON listings (
    area_id,
    LOWER(BTRIM(community)),
    LOWER(BTRIM(building)),
    LOWER(BTRIM(unit_reference)),
    size_sqft
  )
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS inventory_reopen_requests (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  requested_by UUID NOT NULL REFERENCES brokers(id),
  request_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  decided_by UUID REFERENCES brokers(id),
  decision_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  CHECK (
    (status='pending' AND decided_by IS NULL AND decided_at IS NULL) OR
    (status<>'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_reopen_requests_pending_uq
  ON inventory_reopen_requests(listing_id)
  WHERE status='pending';

CREATE INDEX IF NOT EXISTS inventory_reopen_requests_queue_idx
  ON inventory_reopen_requests(status,requested_at DESC);
