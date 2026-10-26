-- Existing issued revisions remain historical; new revisions use bilateral acceptance.
ALTER TABLE offer_revisions ADD COLUMN requires_bilateral_acceptance BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE offer_revisions ALTER COLUMN requires_bilateral_acceptance SET DEFAULT TRUE;
ALTER TABLE negotiation_events ADD COLUMN accepting_side TEXT CHECK(accepting_side IN ('buyer','seller'));
ALTER TABLE negotiation_events ADD COLUMN acceptance_evidence TEXT;
ALTER TABLE negotiation_events ADD COLUMN accepting_party_id UUID;
CREATE UNIQUE INDEX negotiation_revision_side_acceptance_uq ON negotiation_events(offer_revision_id,accepting_side)
 WHERE event_type='accepted' AND accepting_side IS NOT NULL;
ALTER TABLE inventory_agreements ADD COLUMN document_id UUID REFERENCES documents(id);

CREATE FUNCTION ensure_bilateral_offer_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision_id UUID;
BEGIN
 revision_id:=COALESCE((to_jsonb(NEW)->>'accepted_revision_id')::uuid,(to_jsonb(NEW)->>'accepted_offer_revision_id')::uuid);
 IF revision_id IS NOT NULL AND EXISTS(SELECT 1 FROM offer_revisions WHERE id=revision_id AND requires_bilateral_acceptance) AND
   (SELECT COUNT(DISTINCT accepting_side) FROM negotiation_events WHERE offer_revision_id=revision_id AND event_type='accepted' AND accepting_party_id IS NOT NULL AND NULLIF(BTRIM(acceptance_evidence),'') IS NOT NULL)<2 THEN
  RAISE EXCEPTION 'Both Buyer and Seller must accept the exact Offer revision before acceptance, Booking or Deal creation';
 END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER offers_bilateral_acceptance AFTER INSERT OR UPDATE OF accepted_revision_id ON offers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ensure_bilateral_offer_acceptance();
CREATE TRIGGER bookings_bilateral_acceptance BEFORE INSERT OR UPDATE OF accepted_offer_revision_id ON bookings FOR EACH ROW EXECUTE FUNCTION ensure_bilateral_offer_acceptance();
CREATE TRIGGER deals_bilateral_acceptance BEFORE INSERT OR UPDATE OF accepted_offer_revision_id ON deals FOR EACH ROW EXECUTE FUNCTION ensure_bilateral_offer_acceptance();
