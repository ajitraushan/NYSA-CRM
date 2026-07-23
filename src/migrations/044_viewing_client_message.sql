ALTER TABLE viewings
  ADD COLUMN IF NOT EXISTS client_message TEXT;

ALTER TABLE viewings
  DROP CONSTRAINT IF EXISTS viewings_client_message_length_ck;

ALTER TABLE viewings
  ADD CONSTRAINT viewings_client_message_length_ck
  CHECK (client_message IS NULL OR char_length(client_message) <= 1000);
