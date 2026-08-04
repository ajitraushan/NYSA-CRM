ALTER TABLE listings
  ADD COLUMN handover_status TEXT NOT NULL DEFAULT 'to_be_confirmed'
    CHECK (handover_status IN ('ready','expected','to_be_confirmed')),
  ADD COLUMN handover_expected_date DATE;

UPDATE listings
SET handover_status = CASE
      WHEN handover_date = 'Ready' THEN 'ready'
      WHEN handover_date ~ '^\d{4}-\d{2}-\d{2}$' THEN 'expected'
      ELSE 'to_be_confirmed'
    END,
    handover_expected_date = CASE
      WHEN handover_date ~ '^\d{4}-\d{2}-\d{2}$' THEN handover_date::date
      ELSE NULL
    END;

ALTER TABLE listings
  ADD CONSTRAINT listings_handover_expected_date_ck
  CHECK ((handover_status = 'expected' AND handover_expected_date IS NOT NULL)
      OR (handover_status <> 'expected' AND handover_expected_date IS NULL));

