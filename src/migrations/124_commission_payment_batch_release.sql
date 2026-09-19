-- DEV-194: record an approved commission-payment batch as one atomic payment.
ALTER TABLE commission_payment_batches
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'awaiting_payment'
    CHECK(payment_status IN ('awaiting_payment','paid')),
  ADD COLUMN payment_date DATE,
  ADD COLUMN payment_reference TEXT,
  ADD COLUMN payment_idempotency_key TEXT UNIQUE,
  ADD COLUMN paid_by UUID REFERENCES brokers(id),
  ADD COLUMN paid_at TIMESTAMPTZ,
  ADD CONSTRAINT commission_payment_batch_payment_state_ck CHECK(
    (payment_status='awaiting_payment' AND payment_date IS NULL AND payment_reference IS NULL
      AND payment_idempotency_key IS NULL AND paid_by IS NULL AND paid_at IS NULL)
    OR
    (payment_status='paid' AND payment_date IS NOT NULL AND CHAR_LENGTH(BTRIM(payment_reference))>=3
      AND payment_idempotency_key IS NOT NULL AND paid_by IS NOT NULL AND paid_at IS NOT NULL)
  );

CREATE INDEX commission_payment_batch_payment_status_idx
  ON commission_payment_batches(payment_status,decided_at);

