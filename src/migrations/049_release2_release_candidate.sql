ALTER TABLE deals
  ADD COLUMN approval_reason TEXT,
  ADD COLUMN approval_evidence_reference TEXT,
  ADD COLUMN closure_evidence_reference TEXT;

ALTER TABLE deals ADD CONSTRAINT deals_approval_evidence_ck CHECK (
  status NOT IN ('approved','closed_won') OR
  (approved_at IS NOT NULL AND approved_by IS NOT NULL
    AND approval_reason IS NOT NULL AND approval_evidence_reference IS NOT NULL)
);

ALTER TABLE deals ADD CONSTRAINT deals_closed_won_evidence_ck CHECK (
  status <> 'closed_won' OR
  (actual_completion_at IS NOT NULL AND closed_by IS NOT NULL
    AND closure_evidence_reference IS NOT NULL)
);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('reserved','released','expired','cancelled','completed'));
ALTER TABLE bookings ADD COLUMN completed_at TIMESTAMPTZ;

ALTER TABLE booking_status_history DROP CONSTRAINT IF EXISTS booking_status_history_to_status_check;
ALTER TABLE booking_status_history ADD CONSTRAINT booking_status_history_to_status_check
  CHECK (to_status IN ('reserved','released','expired','cancelled','completed'));

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_closed_reason_check;
ALTER TABLE listings ADD CONSTRAINT listings_closed_reason_check
  CHECK (closed_reason IN ('Sold','Rented','Withdrawn','Expired'));

CREATE OR REPLACE VIEW r2_release_candidate_reconciliation AS
SELECT
  (SELECT COUNT(*) FROM opportunities) AS opportunity_count,
  (SELECT COUNT(*) FROM opportunity_attribution) AS attribution_count,
  (SELECT COUNT(*) FROM deals) AS deal_count,
  (SELECT COUNT(*) FROM deals WHERE status='closed_won') AS closed_won_deal_count,
  (SELECT COUNT(*) FROM opportunities WHERE stage='Closed Won') AS closed_won_opportunity_count,
  (SELECT COUNT(*) FROM opportunities o
    LEFT JOIN opportunity_attribution a ON a.opportunity_id=o.id
    WHERE a.id IS NULL) AS missing_attribution_count,
  (SELECT COUNT(*) FROM opportunities o
    LEFT JOIN deals d ON d.opportunity_id=o.id AND d.status='closed_won'
    WHERE o.stage='Closed Won' AND d.id IS NULL) AS closed_won_without_deal_count,
  (SELECT COUNT(*) FROM bookings b
    JOIN listings l ON l.id=b.listing_id
    WHERE (b.status='reserved' AND l.status<>'Reserved')
       OR (b.status='completed' AND l.status<>'Closed')) AS booking_inventory_mismatch_count,
  NOW() AS data_as_of;
