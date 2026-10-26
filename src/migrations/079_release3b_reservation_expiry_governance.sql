CREATE TABLE booking_reservation_extensions (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  previous_expires_at TIMESTAMPTZ NOT NULL,
  approved_expires_at TIMESTAMPTZ NOT NULL,
  approval_reason TEXT NOT NULL CHECK (LENGTH(BTRIM(approval_reason)) >= 10),
  approved_by UUID NOT NULL REFERENCES brokers(id),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (approved_expires_at > previous_expires_at)
);

CREATE INDEX booking_reservation_extensions_booking_idx
  ON booking_reservation_extensions(booking_id,approved_at DESC,id DESC);

CREATE TRIGGER booking_reservation_extensions_immutable
  BEFORE UPDATE OR DELETE ON booking_reservation_extensions
  FOR EACH ROW EXECUTE FUNCTION prevent_release2_immutable_evidence_mutation();

GRANT SELECT,INSERT ON booking_reservation_extensions TO nysareal_nysar2app;

CREATE OR REPLACE FUNCTION enforce_booking_reservation_expiry_policy() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.expires_at > NEW.reservation_starts_at + INTERVAL '7 days' THEN
    RAISE EXCEPTION 'initial reservation cannot exceed seven days';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    IF NEW.expires_at > NEW.reservation_starts_at + INTERVAL '14 days' THEN
      RAISE EXCEPTION 'reservation cannot exceed fourteen cumulative days';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM booking_reservation_extensions extension
      WHERE extension.booking_id=NEW.id AND extension.approved_expires_at=NEW.expires_at
    ) THEN
      RAISE EXCEPTION 'reservation extension requires immutable manager approval evidence';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_reservation_expiry_policy
  BEFORE INSERT OR UPDATE OF expires_at ON bookings
  FOR EACH ROW EXECUTE FUNCTION enforce_booking_reservation_expiry_policy();
