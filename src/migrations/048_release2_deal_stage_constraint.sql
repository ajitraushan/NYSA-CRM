ALTER TABLE opportunities DROP CONSTRAINT opportunities_stage_check;
ALTER TABLE opportunities ADD CONSTRAINT opportunities_stage_check CHECK (stage IN (
  'Requirements','Matching','Viewing','Offer','Negotiation','Booking','Deal','Closed Won','Closed Lost'
));
