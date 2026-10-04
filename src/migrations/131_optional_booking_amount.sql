ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_booking_amount_check;
ALTER TABLE bookings ALTER COLUMN booking_amount DROP NOT NULL;
ALTER TABLE bookings ADD CONSTRAINT bookings_booking_amount_non_negative_ck
  CHECK (booking_amount IS NULL OR booking_amount >= 0);

COMMENT ON COLUMN bookings.booking_amount IS
  'Exact deposit/reservation amount from the accepted Offer revision; NULL when the accepted commercial terms did not specify one.';
