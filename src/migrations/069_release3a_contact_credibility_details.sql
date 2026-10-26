ALTER TABLE contacts
  ADD COLUMN email_credibility_evidence JSONB;

GRANT SELECT,UPDATE ON contacts TO nysareal_nysar2app;
