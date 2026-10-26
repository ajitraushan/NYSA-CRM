ALTER TABLE contacts
  ADD COLUMN email_professional_evidence JSONB;

GRANT SELECT,UPDATE ON contacts TO nysareal_nysar2app;
